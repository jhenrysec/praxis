import { Router } from 'express';
import { z } from 'zod';
import { query, queryOne } from '../../db/pool.js';
import { validate } from '../middleware/validate.js';
import { authenticate, requireRole, requireSlotOwner } from '../middleware/auth.js';
import { writeAuditLog } from '../middleware/auditLog.js';
import { NotFoundError } from '../../utils/errors.js';
import { terraformService } from '../../services/terraform.js';
import { proxmoxService } from '../../services/proxmox.js';
import { scenarioLifecycle } from '../../services/scenarioLifecycle.js';
import { pushStatusUpdate } from '../../services/statusBroadcast.js';
import { getIp, param } from '../../utils/request.js';
import type { SlotRow, SlotStatus } from '../../types/index.js';

export const slotsRouter = Router();

slotsRouter.use(authenticate);

// ── Schemas ──────────────────────────────────────────────────────────────────

const deploySchema = z.object({
  scenario_id: z.string().min(1).max(100),
});

// Helper: append a line to deploy_log
async function appendLog(slotNumber: number, line: string): Promise<void> {
  await query(
    "UPDATE lab_slots SET deploy_log = COALESCE(deploy_log, '') || $1 || E'\\n' WHERE slot_number = $2",
    [line, slotNumber],
  );
}

// Helper: atomic status transition guarded by allowed prior states
async function transitionStatus(
  slotNumber: number,
  nextStatus: SlotStatus,
  allowedPriorStates: SlotStatus[],
): Promise<SlotRow | null> {
  const placeholders = allowedPriorStates.map((_, i) => `$${i + 3}`).join(', ');
  const sql = `UPDATE lab_slots SET status = $1, last_error = NULL
               WHERE slot_number = $2 AND status IN (${placeholders})
               RETURNING *`;
  return queryOne<SlotRow>(sql, [nextStatus, slotNumber, ...allowedPriorStates]);
}

// ── POST /deploy-all ─────────────────────────────────────────────────────────
// Registered before /:slot routes to prevent "deploy-all" matching as :slot param

slotsRouter.post(
  '/deploy-all',
  requireRole('admin', 'instructor'),
  validate(deploySchema),
  async (req, res, next) => {
    try {
      const { scenario_id } = req.body as z.infer<typeof deploySchema>;

      const candidates = await query<{ slot_number: number }>(
        "SELECT slot_number FROM lab_slots WHERE user_id IS NOT NULL AND status = 'empty' ORDER BY slot_number",
      );

      if (candidates.length === 0) {
        res.status(400).json({ error: 'No eligible slots for deployment' });
        return;
      }

      // Per-slot atomic claim — guards against concurrent /deploy-all and
      // single /:slot/deploy requests racing on the same slot.
      const claimed: number[] = [];
      const skipped: number[] = [];
      for (const candidate of candidates) {
        const slotNumber = candidate.slot_number;
        const row = await queryOne<SlotRow>(
          `UPDATE lab_slots SET status = 'deploying', scenario_id = $1,
           tf_workspace = $2, deploy_log = '', last_error = NULL
           WHERE slot_number = $3 AND status = 'empty'
           RETURNING *`,
          [scenario_id, `student-slot-${String(slotNumber).padStart(2, '0')}`, slotNumber],
        );
        if (row) claimed.push(slotNumber);
        else skipped.push(slotNumber);
      }

      if (claimed.length === 0) {
        res.status(409).json({
          error: 'No slots were eligible once the request was processed',
          skipped,
        });
        return;
      }

      await writeAuditLog(
        req.user!.id,
        'slot_deploy_all',
        'slot',
        null,
        { scenario_id, claimed, skipped },
        getIp(req),
      );

      for (const slotNumber of claimed) {
        // Preflight + deploy chained so preflight failures hit the same error
        // sink as Terraform failures — the slot row goes to 'error' either way.
        (async () => {
          try {
            await scenarioLifecycle.deployPreflight(slotNumber, scenario_id, (line) =>
              appendLog(slotNumber, line).catch(() => {}),
            );
            await terraformService.deploy(slotNumber, scenario_id, (line) =>
              appendLog(slotNumber, line).catch(() => {}),
            );
            await query(
              "UPDATE lab_slots SET status = 'running', deployed_at = NOW() WHERE slot_number = $1",
              [slotNumber],
            );
            pushStatusUpdate();
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            await query(
              "UPDATE lab_slots SET status = 'error', deploy_log = COALESCE(deploy_log, '') || $1, last_error = $2 WHERE slot_number = $3",
              [`\nERROR: ${message}`, message, slotNumber],
            );
            pushStatusUpdate();
          }
        })();
      }

      pushStatusUpdate();

      res.status(202).json({
        message: `Deployment started for ${claimed.length} slot${claimed.length !== 1 ? 's' : ''}`,
        slots: claimed,
        ...(skipped.length > 0 ? { skipped } : {}),
      });
    } catch (err) {
      next(err);
    }
  },
);

// ── GET / ────────────────────────────────────────────────────────────────────

slotsRouter.get('/', async (req, res, next) => {
  try {
    let slots: SlotRow[];
    if (req.user!.role === 'student') {
      if (req.user!.lab_slot) {
        slots = await query<SlotRow>(
          'SELECT * FROM lab_slots WHERE slot_number = $1',
          [req.user!.lab_slot],
        );
      } else {
        slots = [];
      }
    } else {
      slots = await query<SlotRow>(
        'SELECT * FROM lab_slots ORDER BY slot_number',
      );
    }
    res.json({ slots });
  } catch (err) {
    next(err);
  }
});

// ── GET /:slot ───────────────────────────────────────────────────────────────

slotsRouter.get('/:slot', requireSlotOwner, async (req, res, next) => {
  try {
    const slotNumber = parseInt(param(req, 'slot'), 10);
    const slot = await queryOne<SlotRow>(
      'SELECT * FROM lab_slots WHERE slot_number = $1',
      [slotNumber],
    );
    if (!slot) throw new NotFoundError('Slot not found');
    res.json({ slot });
  } catch (err) {
    next(err);
  }
});

// ── POST /:slot/deploy ───────────────────────────────────────────────────────

slotsRouter.post(
  '/:slot/deploy',
  requireRole('admin', 'instructor'),
  validate(deploySchema),
  async (req, res, next) => {
    try {
      const slotNumber = parseInt(param(req, 'slot'), 10);
      const { scenario_id } = req.body as z.infer<typeof deploySchema>;

      const slot = await queryOne<SlotRow>(
        `UPDATE lab_slots SET status = 'deploying', scenario_id = $1,
         tf_workspace = $2, deploy_log = '', last_error = NULL
         WHERE slot_number = $3 AND status IN ('empty', 'error')
         RETURNING *`,
        [scenario_id, `student-slot-${String(slotNumber).padStart(2, '0')}`, slotNumber],
      );

      if (!slot) {
        const existing = await queryOne<SlotRow>(
          'SELECT status FROM lab_slots WHERE slot_number = $1',
          [slotNumber],
        );
        if (!existing) throw new NotFoundError('Slot not found');
        res.status(400).json({ error: `Slot is currently ${existing.status}` });
        return;
      }
      pushStatusUpdate();

      await query(
        `INSERT INTO scenario_assignments (slot_number, scenario_id, assigned_by)
         VALUES ($1, $2, $3)`,
        [slotNumber, scenario_id, req.user!.id],
      );

      await writeAuditLog(req.user!.id, 'slot_deploy', 'slot', String(slotNumber), { scenario_id }, getIp(req));

      // Preflight + deploy chained so a dirty slot or orphan storage aborts
      // before Terraform starts; both failure modes route to the same error sink.
      (async () => {
        try {
          await scenarioLifecycle.deployPreflight(slotNumber, scenario_id, (line) =>
            appendLog(slotNumber, line).catch(() => {}),
          );
          await terraformService.deploy(slotNumber, scenario_id, (line) =>
            appendLog(slotNumber, line).catch(() => {}),
          );
          await query(
            "UPDATE lab_slots SET status = 'running', deployed_at = NOW() WHERE slot_number = $1",
            [slotNumber],
          );
          pushStatusUpdate();
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          await query(
            "UPDATE lab_slots SET status = 'error', deploy_log = COALESCE(deploy_log, '') || $1, last_error = $2 WHERE slot_number = $3",
            [`\nERROR: ${message}`, message, slotNumber],
          );
          pushStatusUpdate();
        }
      })();

      res.status(202).json({ message: 'Deployment started', slot_number: slotNumber });
    } catch (err) {
      next(err);
    }
  },
);

// ── DELETE /:slot/destroy ────────────────────────────────────────────────────

slotsRouter.delete(
  '/:slot/destroy',
  requireRole('admin', 'instructor'),
  async (req, res, next) => {
    try {
      const slotNumber = parseInt(param(req, 'slot'), 10);

      // Atomic claim — only terminal states (running/stopped/error) may destroy.
      // Transitional states (deploying/resetting/etc) must use /force-destroy.
      const slot = await transitionStatus(slotNumber, 'destroying', ['running', 'stopped', 'error']);
      if (!slot) {
        const existing = await queryOne<SlotRow>(
          'SELECT status FROM lab_slots WHERE slot_number = $1',
          [slotNumber],
        );
        if (!existing) throw new NotFoundError('Slot not found');
        if (existing.status === 'empty') {
          res.status(400).json({ error: 'Slot is already empty' });
          return;
        }
        res.status(409).json({
          error: `Cannot destroy slot with status: ${existing.status}. Use /force-destroy if stuck.`,
        });
        return;
      }

      if (!slot.scenario_id) {
        // Non-empty slot without a scenario is itself a broken state — surface it
        // as error and direct operator to force-destroy rather than guessing.
        await query(
          "UPDATE lab_slots SET status = 'error', last_error = $1 WHERE slot_number = $2",
          ['Destroy aborted: slot has no associated scenario', slotNumber],
        );
        pushStatusUpdate();
        res.status(409).json({ error: 'Slot has no associated scenario; use /force-destroy' });
        return;
      }

      pushStatusUpdate();

      await writeAuditLog(req.user!.id, 'slot_destroy', 'slot', String(slotNumber), { scenario_id: slot.scenario_id }, getIp(req));

      const scenarioId = slot.scenario_id;

      terraformService.destroy(slotNumber, scenarioId, (line) => {
        appendLog(slotNumber, line).catch(() => {});
      }).then(async () => {
        // Workspace lifecycle invariant: every destroy ends with a clean
        // workspace so the next deploy starts cold without depending on
        // this run's state being intact.
        await terraformService.cleanupWorkspace(slotNumber, scenarioId, (line) =>
          appendLog(slotNumber, line).catch(() => {}),
        );
        await query(
          `UPDATE lab_slots SET status = 'empty', scenario_id = NULL, deployed_at = NULL,
           deploy_log = NULL, tf_workspace = NULL, last_error = NULL WHERE slot_number = $1`,
          [slotNumber],
        );
        pushStatusUpdate();
      }).catch(async (err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        await query(
          "UPDATE lab_slots SET status = 'error', deploy_log = COALESCE(deploy_log, '') || $1, last_error = $2 WHERE slot_number = $3",
          [`\nDESTROY ERROR: ${message}`, message, slotNumber],
        );
        pushStatusUpdate();
      });

      res.status(202).json({ message: 'Destroy started', slot_number: slotNumber });
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /:slot/shutdown ─────────────────────────────────────────────────────
// Graceful ACPI shutdown of every VM in the slot. running → stopping → stopped.

slotsRouter.post(
  '/:slot/shutdown',
  requireRole('admin', 'instructor'),
  async (req, res, next) => {
    try {
      const slotNumber = parseInt(param(req, 'slot'), 10);
      const slot = await transitionStatus(slotNumber, 'stopping', ['running']);
      if (!slot) {
        const existing = await queryOne<SlotRow>(
          'SELECT status FROM lab_slots WHERE slot_number = $1',
          [slotNumber],
        );
        if (!existing) throw new NotFoundError('Slot not found');
        res.status(400).json({ error: `Cannot shutdown slot with status: ${existing.status}` });
        return;
      }
      pushStatusUpdate();

      await writeAuditLog(req.user!.id, 'slot_shutdown', 'slot', String(slotNumber), null, getIp(req));

      scenarioLifecycle.shutdownSlot(slotNumber, (line) => {
        appendLog(slotNumber, line).catch(() => {});
      }).then(async () => {
        await query(
          "UPDATE lab_slots SET status = 'stopped' WHERE slot_number = $1",
          [slotNumber],
        );
        pushStatusUpdate();
      }).catch(async (err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        await query(
          "UPDATE lab_slots SET status = 'error', deploy_log = COALESCE(deploy_log, '') || $1, last_error = $2 WHERE slot_number = $3",
          [`\nSHUTDOWN ERROR: ${message}`, message, slotNumber],
        );
        pushStatusUpdate();
      });

      res.status(202).json({ message: 'Shutdown started', slot_number: slotNumber });
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /:slot/start ────────────────────────────────────────────────────────
// Power on all VMs in a stopped slot. stopped → starting → running.

slotsRouter.post(
  '/:slot/start',
  requireRole('admin', 'instructor'),
  async (req, res, next) => {
    try {
      const slotNumber = parseInt(param(req, 'slot'), 10);
      const slot = await transitionStatus(slotNumber, 'starting', ['stopped']);
      if (!slot) {
        const existing = await queryOne<SlotRow>(
          'SELECT status FROM lab_slots WHERE slot_number = $1',
          [slotNumber],
        );
        if (!existing) throw new NotFoundError('Slot not found');
        res.status(400).json({ error: `Cannot start slot with status: ${existing.status}` });
        return;
      }
      pushStatusUpdate();

      await writeAuditLog(req.user!.id, 'slot_start', 'slot', String(slotNumber), null, getIp(req));

      scenarioLifecycle.startSlot(slotNumber, (line) => {
        appendLog(slotNumber, line).catch(() => {});
      }).then(async () => {
        await query(
          "UPDATE lab_slots SET status = 'running' WHERE slot_number = $1",
          [slotNumber],
        );
        pushStatusUpdate();
      }).catch(async (err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        await query(
          "UPDATE lab_slots SET status = 'error', deploy_log = COALESCE(deploy_log, '') || $1, last_error = $2 WHERE slot_number = $3",
          [`\nSTART ERROR: ${message}`, message, slotNumber],
        );
        pushStatusUpdate();
      });

      res.status(202).json({ message: 'Start initiated', slot_number: slotNumber });
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /:slot/reset ────────────────────────────────────────────────────────
// Rollback all slot VMs to their 'baseline' snapshot.

slotsRouter.post(
  '/:slot/reset',
  requireRole('admin', 'instructor'),
  async (req, res, next) => {
    try {
      const slotNumber = parseInt(param(req, 'slot'), 10);
      const slot = await transitionStatus(slotNumber, 'resetting', ['running', 'stopped']);
      if (!slot) {
        const existing = await queryOne<SlotRow>(
          'SELECT status FROM lab_slots WHERE slot_number = $1',
          [slotNumber],
        );
        if (!existing) throw new NotFoundError('Slot not found');
        res.status(400).json({ error: `Cannot reset slot with status: ${existing.status}` });
        return;
      }
      pushStatusUpdate();

      await writeAuditLog(req.user!.id, 'slot_reset', 'slot', String(slotNumber), null, getIp(req));

      scenarioLifecycle.resetSlot(slotNumber, (line) => {
        appendLog(slotNumber, line).catch(() => {});
      }).then(async () => {
        await query(
          "UPDATE lab_slots SET status = 'running', last_reset = NOW() WHERE slot_number = $1",
          [slotNumber],
        );
        pushStatusUpdate();
      }).catch(async (err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        await query(
          "UPDATE lab_slots SET status = 'error', deploy_log = COALESCE(deploy_log, '') || $1, last_error = $2 WHERE slot_number = $3",
          [`\nRESET ERROR: ${message}`, message, slotNumber],
        );
        pushStatusUpdate();
      });

      res.status(202).json({ message: 'Reset started', slot_number: slotNumber });
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /:slot/force-destroy ────────────────────────────────────────────────
// Recovery path when Terraform state is unreliable: hard-stop + delete via
// Proxmox API directly, then clear workspace. Admin-only because it bypasses
// Terraform entirely.

slotsRouter.post(
  '/:slot/force-destroy',
  requireRole('admin', 'instructor'),
  async (req, res, next) => {
    try {
      const slotNumber = parseInt(param(req, 'slot'), 10);
      const existing = await queryOne<SlotRow>(
        'SELECT * FROM lab_slots WHERE slot_number = $1',
        [slotNumber],
      );
      if (!existing) throw new NotFoundError('Slot not found');

      await query(
        "UPDATE lab_slots SET status = 'destroying', last_error = NULL WHERE slot_number = $1",
        [slotNumber],
      );
      pushStatusUpdate();

      await writeAuditLog(
        req.user!.id,
        'slot_force_destroy',
        'slot',
        String(slotNumber),
        { prior_status: existing.status, prior_scenario: existing.scenario_id },
        getIp(req),
      );

      scenarioLifecycle.forceDestroySlot(slotNumber, (line) => {
        appendLog(slotNumber, line).catch(() => {});
      }).then(async () => {
        await query(
          `UPDATE lab_slots SET status = 'empty', scenario_id = NULL, deployed_at = NULL,
           deploy_log = NULL, tf_workspace = NULL, last_error = NULL WHERE slot_number = $1`,
          [slotNumber],
        );
        pushStatusUpdate();
      }).catch(async (err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        await query(
          "UPDATE lab_slots SET status = 'error', deploy_log = COALESCE(deploy_log, '') || $1, last_error = $2 WHERE slot_number = $3",
          [`\nFORCE-DESTROY ERROR: ${message}`, message, slotNumber],
        );
        pushStatusUpdate();
      });

      res.status(202).json({ message: 'Force-destroy started', slot_number: slotNumber });
    } catch (err) {
      next(err);
    }
  },
);

// ── GET /:slot/diagnostics ───────────────────────────────────────────────────
// Snapshot of DB state vs live Proxmox state, with remediation advisories.

slotsRouter.get(
  '/:slot/diagnostics',
  requireRole('admin', 'instructor'),
  async (req, res, next) => {
    try {
      const slotNumber = parseInt(param(req, 'slot'), 10);
      const diagnostics = await scenarioLifecycle.getDiagnostics(slotNumber);
      res.json({ diagnostics });
    } catch (err) {
      next(err);
    }
  },
);

// ── GET /:slot/vms ───────────────────────────────────────────────────────────

slotsRouter.get('/:slot/vms', requireSlotOwner, async (req, res, next) => {
  try {
    const slotNumber = parseInt(param(req, 'slot'), 10);
    const vms = await proxmoxService.getVMsForSlot(slotNumber);
    res.json({ vms });
  } catch (err) {
    next(err);
  }
});
