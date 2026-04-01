import { Router } from 'express';
import { z } from 'zod';
import { query } from '../../db/pool.js';
import { authenticate, requireRole, requireSlotOwner } from '../middleware/auth.js';
import { writeAuditLog } from '../middleware/auditLog.js';
import { getIp, param } from '../../utils/request.js';
import type { ObjectiveProgressRow } from '../../types/index.js';

export const objectivesRouter = Router();

objectivesRouter.use(authenticate);

// ── GET / — current user's objective progress ────────────────────────────────

objectivesRouter.get('/', async (req, res, next) => {
  try {
    const objectives = await query<ObjectiveProgressRow>(
      'SELECT * FROM objectives_progress WHERE user_id = $1 ORDER BY slot_number, scenario_id, objective_n',
      [req.user!.id],
    );
    res.json({ objectives });
  } catch (err) {
    next(err);
  }
});

// ── POST /:objectiveN/complete — mark objective complete (self-reported) ─────

const completeSchema = z.object({
  slot_number: z.number().int().min(1).max(20),
  scenario_id: z.string().min(1).max(100),
});

objectivesRouter.post('/:objectiveN/complete', async (req, res, next) => {
  try {
    const objectiveN = parseInt(param(req, 'objectiveN'), 10);
    if (isNaN(objectiveN) || objectiveN < 1) {
      res.status(400).json({ error: 'Invalid objective number' });
      return;
    }

    // Parse body — slot_number and scenario_id may come from body or be inferred
    let slotNumber: number;
    let scenarioId: string;

    if (req.body && typeof req.body === 'object' && 'slot_number' in req.body) {
      const parsed = completeSchema.parse(req.body);
      slotNumber = parsed.slot_number;
      scenarioId = parsed.scenario_id;
    } else if (req.user!.lab_slot) {
      slotNumber = req.user!.lab_slot;
      // Look up current scenario for this slot
      const slotRows = await query<{ scenario_id: string }>(
        'SELECT scenario_id FROM lab_slots WHERE slot_number = $1',
        [slotNumber],
      );
      if (!slotRows[0]?.scenario_id) {
        res.status(400).json({ error: 'No scenario deployed to your slot' });
        return;
      }
      scenarioId = slotRows[0].scenario_id;
    } else {
      res.status(400).json({ error: 'No slot assigned — provide slot_number and scenario_id' });
      return;
    }

    // Students can only complete objectives for their own slot
    if (req.user!.role === 'student' && req.user!.lab_slot !== slotNumber) {
      res.status(403).json({ error: 'Access denied to this slot' });
      return;
    }

    const result = await query<ObjectiveProgressRow>(
      `INSERT INTO objectives_progress (user_id, slot_number, scenario_id, objective_n, completed, completed_at)
       VALUES ($1, $2, $3, $4, true, NOW())
       ON CONFLICT (user_id, slot_number, scenario_id, objective_n)
       DO UPDATE SET completed = true, completed_at = COALESCE(objectives_progress.completed_at, NOW())
       RETURNING *`,
      [req.user!.id, slotNumber, scenarioId, objectiveN],
    );

    await writeAuditLog(
      req.user!.id,
      'objective_completed',
      'objective',
      String(objectiveN),
      { slot_number: slotNumber, scenario_id: scenarioId },
      getIp(req),
    );

    res.json({ objective: result[0] });
  } catch (err) {
    next(err);
  }
});

// ── GET /slot/:slot — instructor view of student progress ────────────────────

objectivesRouter.get(
  '/slot/:slot',
  requireRole('admin', 'instructor'),
  requireSlotOwner,
  async (req, res, next) => {
    try {
      const slotNumber = parseInt(param(req, 'slot'), 10);
      const objectives = await query<ObjectiveProgressRow>(
        'SELECT * FROM objectives_progress WHERE slot_number = $1 ORDER BY scenario_id, objective_n',
        [slotNumber],
      );
      res.json({ objectives });
    } catch (err) {
      next(err);
    }
  },
);
