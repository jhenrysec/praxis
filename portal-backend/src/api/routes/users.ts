import { Router } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { query, queryOne } from '../../db/pool.js';
import { validate } from '../middleware/validate.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { writeAuditLog } from '../middleware/auditLog.js';
import { NotFoundError, ConflictError } from '../../utils/errors.js';
import { getIp, param } from '../../utils/request.js';
import type { UserRow } from '../../types/index.js';
import { toUserPublic } from '../../types/index.js';

const BCRYPT_ROUNDS = 12;

export const usersRouter = Router();

// All user management routes require instructor or admin
usersRouter.use(authenticate, requireRole('admin', 'instructor'));

// ── Schemas ──────────────────────────────────────────────────────────────────

const createUserSchema = z.object({
  email: z.string().email().max(255),
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/),
  password: z.string().min(8).max(128),
  full_name: z.string().min(1).max(255),
  student_id: z.string().max(50).optional(),
  role: z.enum(['student', 'instructor']).optional(),
});

const updateUserSchema = z.object({
  role: z.enum(['admin', 'instructor', 'student']).optional(),
  status: z.enum(['pending', 'active', 'locked', 'deleted']).optional(),
  lab_slot: z.number().int().min(1).max(20).nullable().optional(),
  full_name: z.string().min(1).max(255).optional(),
  student_id: z.string().max(50).nullable().optional(),
});

// ── GET / ────────────────────────────────────────────────────────────────────

usersRouter.get('/', async (req, res, next) => {
  try {
    const { role, status, page = '1', limit = '50' } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const offset = (pageNum - 1) * limitNum;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (role) {
      conditions.push(`role = $${paramIdx++}`);
      params.push(role);
    }
    if (status) {
      conditions.push(`status = $${paramIdx++}`);
      params.push(status);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const users = await query<UserRow>(
      `SELECT * FROM users ${where} ORDER BY created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx}`,
      [...params, limitNum, offset],
    );

    const countResult = await queryOne<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM users ${where}`,
      params,
    );

    res.json({
      users: users.map(toUserPublic),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: parseInt(countResult?.total ?? '0', 10),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /pending ─────────────────────────────────────────────────────────────

usersRouter.get('/pending', async (_req, res, next) => {
  try {
    const users = await query<UserRow>(
      "SELECT * FROM users WHERE status = 'pending' ORDER BY created_at ASC",
    );
    res.json({ users: users.map(toUserPublic) });
  } catch (err) {
    next(err);
  }
});

// ── POST / ───────────────────────────────────────────────────────────────────

usersRouter.post('/', validate(createUserSchema), async (req, res, next) => {
  try {
    const { email, username, password, full_name, student_id, role } = req.body as z.infer<typeof createUserSchema>;

    const existing = await queryOne<UserRow>(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username],
    );
    if (existing) throw new ConflictError('Email or username already taken');

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const userRole = role || 'student';

    // Only admins can create instructors
    if (userRole === 'instructor' && req.user!.role !== 'admin') {
      res.status(403).json({ error: 'Only admins can create instructor accounts' });
      return;
    }

    const user = await queryOne<UserRow>(
      `INSERT INTO users (email, username, password_hash, full_name, student_id, role, status, approved_by, approved_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, NOW())
       RETURNING *`,
      [email, username, passwordHash, full_name, student_id ?? null, userRole, req.user!.id],
    );

    await writeAuditLog(req.user!.id, 'user_created', 'user', user!.id, { role: userRole }, getIp(req));

    res.status(201).json({ user: toUserPublic(user!) });
  } catch (err) {
    next(err);
  }
});

// ── GET /:id ─────────────────────────────────────────────────────────────────

usersRouter.get('/:id', async (req, res, next) => {
  try {
    const user = await queryOne<UserRow>('SELECT * FROM users WHERE id = $1', [param(req, 'id')]);
    if (!user) throw new NotFoundError('User not found');
    res.json({ user: toUserPublic(user) });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /:id ───────────────────────────────────────────────────────────────

usersRouter.patch('/:id', validate(updateUserSchema), async (req, res, next) => {
  try {
    const userId = param(req, 'id');
    const updates = req.body as z.infer<typeof updateUserSchema>;

    const existing = await queryOne<UserRow>('SELECT * FROM users WHERE id = $1', [userId]);
    if (!existing) throw new NotFoundError('User not found');

    // Only admins can change roles to admin
    if (updates.role === 'admin' && req.user!.role !== 'admin') {
      res.status(403).json({ error: 'Only admins can grant admin role' });
      return;
    }

    // Check slot availability if assigning a new slot
    if (updates.lab_slot !== undefined && updates.lab_slot !== null) {
      const slotHolder = await queryOne<UserRow>(
        'SELECT id FROM users WHERE lab_slot = $1 AND id != $2',
        [updates.lab_slot, userId],
      );
      if (slotHolder) throw new ConflictError(`Slot ${updates.lab_slot} is already assigned`);
    }

    // Explicit column whitelist — prevents SQL injection via dynamic key names
    const ALLOWED_COLUMNS: Record<string, string> = {
      role: 'role',
      status: 'status',
      lab_slot: 'lab_slot',
      full_name: 'full_name',
      student_id: 'student_id',
    };

    const setClauses: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    for (const [key, value] of Object.entries(updates)) {
      const column = ALLOWED_COLUMNS[key];
      if (value !== undefined && column) {
        setClauses.push(`${column} = $${paramIdx++}`);
        params.push(value);
      }
    }

    if (setClauses.length === 0) {
      res.json({ user: toUserPublic(existing) });
      return;
    }

    params.push(userId);
    const user = await queryOne<UserRow>(
      `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
      params,
    );

    await writeAuditLog(req.user!.id, 'user_updated', 'user', userId, updates, getIp(req));

    res.json({ user: toUserPublic(user!) });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /:id ──────────────────────────────────────────────────────────────

usersRouter.delete('/:id', async (req, res, next) => {
  try {
    const userId = param(req, 'id');
    const user = await queryOne<UserRow>('SELECT * FROM users WHERE id = $1', [userId]);
    if (!user) throw new NotFoundError('User not found');

    // Soft delete
    await query("UPDATE users SET status = 'deleted', lab_slot = NULL WHERE id = $1", [userId]);
    await writeAuditLog(req.user!.id, 'user_deleted', 'user', userId, null, getIp(req));

    res.json({ message: 'User deleted' });
  } catch (err) {
    next(err);
  }
});

// ── POST /:id/approve ────────────────────────────────────────────────────────

usersRouter.post('/:id/approve', async (req, res, next) => {
  try {
    const userId = param(req, 'id');
    const user = await queryOne<UserRow>('SELECT * FROM users WHERE id = $1', [userId]);
    if (!user) throw new NotFoundError('User not found');

    if (user.status !== 'pending') {
      res.status(400).json({ error: `Cannot approve user with status: ${user.status}` });
      return;
    }

    const updated = await queryOne<UserRow>(
      "UPDATE users SET status = 'active', approved_by = $1, approved_at = NOW() WHERE id = $2 RETURNING *",
      [req.user!.id, userId],
    );

    await writeAuditLog(req.user!.id, 'user_approved', 'user', userId, null, getIp(req));

    res.json({ user: toUserPublic(updated!) });
  } catch (err) {
    next(err);
  }
});

// ── POST /:id/lock ───────────────────────────────────────────────────────────

usersRouter.post('/:id/lock', async (req, res, next) => {
  try {
    const userId = param(req, 'id');
    const user = await queryOne<UserRow>('SELECT * FROM users WHERE id = $1', [userId]);
    if (!user) throw new NotFoundError('User not found');

    await query("UPDATE users SET status = 'locked' WHERE id = $1", [userId]);
    // Revoke all refresh tokens
    await query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [userId]);

    await writeAuditLog(req.user!.id, 'user_locked', 'user', userId, null, getIp(req));

    res.json({ message: 'User locked' });
  } catch (err) {
    next(err);
  }
});

// ── POST /:id/unlock ─────────────────────────────────────────────────────────

usersRouter.post('/:id/unlock', async (req, res, next) => {
  try {
    const userId = param(req, 'id');
    const user = await queryOne<UserRow>('SELECT * FROM users WHERE id = $1', [userId]);
    if (!user) throw new NotFoundError('User not found');

    await query("UPDATE users SET status = 'active' WHERE id = $1", [userId]);
    await writeAuditLog(req.user!.id, 'user_unlocked', 'user', userId, null, getIp(req));

    res.json({ message: 'User unlocked' });
  } catch (err) {
    next(err);
  }
});

// ── POST /:id/reset-password ─────────────────────────────────────────────────

usersRouter.post('/:id/reset-password', async (req, res, next) => {
  try {
    const userId = param(req, 'id');
    const user = await queryOne<UserRow>('SELECT * FROM users WHERE id = $1', [userId]);
    if (!user) throw new NotFoundError('User not found');

    // Generate a temporary password
    const tempPassword = `Lab${Math.random().toString(36).slice(2, 10)}!`;
    const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);

    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);
    // Revoke all refresh tokens
    await query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [userId]);

    await writeAuditLog(req.user!.id, 'password_reset_admin', 'user', userId, null, getIp(req));

    res.json({
      message: 'Password reset successful',
      temporary_password: tempPassword,
    });
  } catch (err) {
    next(err);
  }
});
