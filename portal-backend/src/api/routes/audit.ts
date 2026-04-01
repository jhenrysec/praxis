import { Router } from 'express';
import { query } from '../../db/pool.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import type { AuditLogRow } from '../../types/index.js';

export const auditRouter = Router();

// Admin only
auditRouter.use(authenticate, requireRole('admin'));

// ── GET / — paginated audit log ──────────────────────────────────────────────

auditRouter.get('/', async (req, res, next) => {
  try {
    const {
      actor_id,
      action,
      from_date,
      to_date,
      page = '1',
      limit = '50',
    } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const offset = (pageNum - 1) * limitNum;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (actor_id) {
      conditions.push(`actor_id = $${paramIdx++}`);
      params.push(actor_id);
    }
    if (action) {
      conditions.push(`action = $${paramIdx++}`);
      params.push(action);
    }
    if (from_date) {
      conditions.push(`created_at >= $${paramIdx++}`);
      params.push(from_date);
    }
    if (to_date) {
      conditions.push(`created_at <= $${paramIdx++}`);
      params.push(to_date);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const entries = await query<AuditLogRow>(
      `SELECT * FROM audit_log ${where} ORDER BY created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx}`,
      [...params, limitNum, offset],
    );

    const countResult = await query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM audit_log ${where}`,
      params,
    );

    res.json({
      entries,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: parseInt(countResult[0]?.total ?? '0', 10),
      },
    });
  } catch (err) {
    next(err);
  }
});
