import { Router } from 'express';
import { z } from 'zod';
import { query, queryOne } from '../../db/pool.js';
import { validate } from '../middleware/validate.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { writeAuditLog } from '../middleware/auditLog.js';
import { NotFoundError } from '../../utils/errors.js';
import { getIp, param } from '../../utils/request.js';
import type { HintRow } from '../../types/index.js';

export const hintsRouter = Router();

hintsRouter.use(authenticate);

// ── GET / — student gets hints for own slot, instructor gets all ─────────────

hintsRouter.get('/', async (req, res, next) => {
  try {
    let hints: HintRow[];

    if (req.user!.role === 'student') {
      if (!req.user!.lab_slot) {
        res.json({ hints: [] });
        return;
      }
      hints = await query<HintRow>(
        'SELECT * FROM hints WHERE to_slot = $1 ORDER BY created_at DESC',
        [req.user!.lab_slot],
      );
    } else {
      // Instructors/admins see all hints (optionally filter by slot)
      const slotFilter = req.query['slot'];
      if (slotFilter) {
        hints = await query<HintRow>(
          'SELECT * FROM hints WHERE to_slot = $1 ORDER BY created_at DESC',
          [parseInt(slotFilter as string, 10)],
        );
      } else {
        hints = await query<HintRow>(
          'SELECT * FROM hints ORDER BY created_at DESC LIMIT 100',
        );
      }
    }

    res.json({ hints });
  } catch (err) {
    next(err);
  }
});

// ── POST / — instructor sends hint to a slot ─────────────────────────────────

const sendHintSchema = z.object({
  slot: z.number().int().min(1).max(20),
  message: z.string().min(1).max(2000),
});

hintsRouter.post(
  '/',
  requireRole('admin', 'instructor'),
  validate(sendHintSchema),
  async (req, res, next) => {
    try {
      const { slot, message } = req.body as z.infer<typeof sendHintSchema>;

      const hint = await queryOne<HintRow>(
        `INSERT INTO hints (from_user, to_slot, message)
         VALUES ($1, $2, $3) RETURNING *`,
        [req.user!.id, slot, message],
      );

      await writeAuditLog(req.user!.id, 'hint_sent', 'slot', String(slot), { message }, getIp(req));

      res.status(201).json({ hint });
    } catch (err) {
      next(err);
    }
  },
);

// ── PATCH /:id/read — mark hint as read ──────────────────────────────────────

hintsRouter.patch('/:id/read', async (req, res, next) => {
  try {
    const hintId = param(req, 'id');
    const hint = await queryOne<HintRow>('SELECT * FROM hints WHERE id = $1', [hintId]);
    if (!hint) throw new NotFoundError('Hint not found');

    // Students can only mark hints for their own slot
    if (req.user!.role === 'student' && req.user!.lab_slot !== hint.to_slot) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const updated = await queryOne<HintRow>(
      'UPDATE hints SET read_at = COALESCE(read_at, NOW()) WHERE id = $1 RETURNING *',
      [hintId],
    );

    res.json({ hint: updated });
  } catch (err) {
    next(err);
  }
});
