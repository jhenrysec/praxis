import { Router } from 'express';
import { z } from 'zod';
import { query, queryOne } from '../../db/pool.js';
import { validate } from '../middleware/validate.js';
import { authenticate, requireRole, requireSlotOwner } from '../middleware/auth.js';
import { writeAuditLog } from '../middleware/auditLog.js';
import { NotFoundError } from '../../utils/errors.js';
import { terraformService } from '../../services/terraform.js';
import { proxmoxService } from '../../services/proxmox.js';
import { pushStatusUpdate } from '../../services/statusBroadcast.js';
import { getIp, param } from '../../utils/request.js';
import type { SlotRow } from '../../types/index.js';

export const slotsRouter = Router();

slotsRouter.use(authenticate);

// ── Schemas ──────────────────────────────────────────────────────────────────

const deploySchema = z.object({
  scenario_id: z.string().min(1).max(100),
});

// ── POST /deploy-all ─────────────────────────────────────────────────────────
// Registered before /:slot routes to prevent "deploy-all" matching as :slot param

slotsRouter.post(
  '/deploy-all',
  requireRole('admin', 'instructor'),
  validate(deploySchema),
  async (req, res, next) => {
    try {
      const { scenario_id } = req.body as z.infer<typeof deploySchema>;

      // Find all slots with assigned users that are currently empty
      const slots = await query<SlotRow>(
        "SELECT * FROM lab_slots WHERE user_id IS NOT NULL AND status = 'empty' ORDER BY slot_number",
      );

      if (slots.length === 0) {
        res.status(400).json({ error: 'No eligible slots for deployment' });
        return;
      }

      const slotNumbers = slots.map((s) => s.slot_number);

      await writeAuditLog(
        req.user!.id,
        'slot_deploy_all',
        'slot',
        null,
        { scenario_id, slots: slotNumbers },
        getIp(req),
      );

      // Trigger deploys (they run in background)
      for (const slot of slots) {
        await query(
          `UPDATE lab_slots SET status = 'deploying', scenario_id = $1,
           tf_workspace = $2 WHERE slot_number = $3`,
          [scenario_id, `student-slot-${String(slot.slot_number).padStart(2, '0')}`, slot.slot_number],
        );

        terraformService.deploy(slot.slot_number, scenario_id, () => {}).then(async () => {
          await query(
            "UPDATE lab_slots SET status = 'running', deployed_at = NOW() WHERE slot_number = $1",
            [slot.slot_number],
          );
          pushStatusUpdate();
        }).catch(async (err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          await query(
            "UPDATE lab_slots SET status = 'error', deploy_log = $1 WHERE slot_number = $2",
            [`ERROR: ${message}`, slot.slot_number],
          );
          pushStatusUpdate();
        });
      }

      pushStatusUpdate();

      res.status(202).json({
        message: `Deployment started for ${slots.length} slots`,
        slots: slotNumbers,
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
      // Students only see their own slot
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
        'SELECT * FROM lab_slots WHERE slot_number = $1',
        [slotNumber],
      );
      if (!slot) throw new NotFoundError('Slot not found');

      if (slot.status !== 'empty' && slot.status !== 'error') {
        res.status(400).json({ error: `Slot is currently ${slot.status}` });
        return;
      }

      // Mark as deploying
      await query(
        `UPDATE lab_slots SET status = 'deploying', scenario_id = $1,
         tf_workspace = $2, deploy_log = '' WHERE slot_number = $3`,
        [scenario_id, `student-slot-${String(slotNumber).padStart(2, '0')}`, slotNumber],
      );
      pushStatusUpdate();

      // Record assignment
      await query(
        `INSERT INTO scenario_assignments (slot_number, scenario_id, assigned_by)
         VALUES ($1, $2, $3)`,
        [slotNumber, scenario_id, req.user!.id],
      );

      await writeAuditLog(req.user!.id, 'slot_deploy', 'slot', String(slotNumber), { scenario_id }, getIp(req));

      // Start terraform deploy in background
      terraformService.deploy(slotNumber, scenario_id, async (line) => {
        // Append to deploy_log
        await query(
          "UPDATE lab_slots SET deploy_log = COALESCE(deploy_log, '') || $1 || E'\\n' WHERE slot_number = $2",
          [line, slotNumber],
        );
      }).then(async () => {
        await query(
          "UPDATE lab_slots SET status = 'running', deployed_at = NOW() WHERE slot_number = $1",
          [slotNumber],
        );
        pushStatusUpdate();
      }).catch(async (err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        await query(
          "UPDATE lab_slots SET status = 'error', deploy_log = COALESCE(deploy_log, '') || $1 WHERE slot_number = $2",
          [`\nERROR: ${message}`, slotNumber],
        );
        pushStatusUpdate();
      });

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
      const slot = await queryOne<SlotRow>(
        'SELECT * FROM lab_slots WHERE slot_number = $1',
        [slotNumber],
      );
      if (!slot) throw new NotFoundError('Slot not found');

      if (slot.status === 'empty') {
        res.status(400).json({ error: 'Slot is already empty' });
        return;
      }

      if (!slot.scenario_id) {
        res.status(400).json({ error: 'No scenario associated with slot' });
        return;
      }

      await query(
        "UPDATE lab_slots SET status = 'destroying' WHERE slot_number = $1",
        [slotNumber],
      );
      pushStatusUpdate();

      await writeAuditLog(req.user!.id, 'slot_destroy', 'slot', String(slotNumber), { scenario_id: slot.scenario_id }, getIp(req));

      const scenarioId = slot.scenario_id;

      terraformService.destroy(slotNumber, scenarioId, async (line) => {
        await query(
          "UPDATE lab_slots SET deploy_log = COALESCE(deploy_log, '') || $1 || E'\\n' WHERE slot_number = $2",
          [line, slotNumber],
        );
      }).then(async () => {
        await query(
          `UPDATE lab_slots SET status = 'empty', scenario_id = NULL, deployed_at = NULL,
           deploy_log = NULL, tf_workspace = NULL WHERE slot_number = $1`,
          [slotNumber],
        );
        pushStatusUpdate();
      }).catch(async (err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        await query(
          "UPDATE lab_slots SET status = 'error', deploy_log = COALESCE(deploy_log, '') || $1 WHERE slot_number = $2",
          [`\nDESTROY ERROR: ${message}`, slotNumber],
        );
        pushStatusUpdate();
      });

      res.status(202).json({ message: 'Destroy started', slot_number: slotNumber });
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /:slot/reset ────────────────────────────────────────────────────────

slotsRouter.post(
  '/:slot/reset',
  requireRole('admin', 'instructor'),
  async (req, res, next) => {
    try {
      const slotNumber = parseInt(param(req, 'slot'), 10);
      const slot = await queryOne<SlotRow>(
        'SELECT * FROM lab_slots WHERE slot_number = $1',
        [slotNumber],
      );
      if (!slot) throw new NotFoundError('Slot not found');

      if (slot.status !== 'running') {
        res.status(400).json({ error: `Cannot reset slot with status: ${slot.status}` });
        return;
      }

      // Update last_reset timestamp
      await query(
        'UPDATE lab_slots SET last_reset = NOW() WHERE slot_number = $1',
        [slotNumber],
      );

      await writeAuditLog(req.user!.id, 'slot_reset', 'slot', String(slotNumber), null, getIp(req));

      // Reset is a destroy + redeploy cycle
      // For now, we just record the intent — full snapshot rollback requires Proxmox API
      res.json({ message: 'Reset recorded', slot_number: slotNumber });
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

