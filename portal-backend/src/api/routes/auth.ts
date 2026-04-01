import { Router } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { query, queryOne } from '../../db/pool.js';
import { validate } from '../middleware/validate.js';
import { authenticate, signAccessToken, signRefreshToken } from '../middleware/auth.js';
import { generateToken, hashToken } from '../../utils/crypto.js';
import { writeAuditLog } from '../middleware/auditLog.js';
import { ConflictError } from '../../utils/errors.js';
import { getIp } from '../../utils/request.js';
import type { UserRow, RefreshTokenRow } from '../../types/index.js';
import { toUserPublic } from '../../types/index.js';

const BCRYPT_ROUNDS = 12;

export const authRouter = Router();

// ── Schemas ──────────────────────────────────────────────────────────────────

const registerSchema = z.object({
  email: z.string().email().max(255),
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/),
  password: z.string().min(8).max(128),
  full_name: z.string().min(1).max(255),
  student_id: z.string().max(50).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const refreshSchema = z.object({
  refresh_token: z.string(),
});

// ── POST /register ───────────────────────────────────────────────────────────

authRouter.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const { email, username, password, full_name, student_id } = req.body as z.infer<typeof registerSchema>;

    // Check for existing user
    const existing = await queryOne<UserRow>(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username],
    );
    if (existing) throw new ConflictError('Email or username already taken');

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const autoApprove = process.env.AUTO_APPROVE_STUDENTS === 'true';
    const status = autoApprove ? 'active' : 'pending';

    const user = await queryOne<UserRow>(
      `INSERT INTO users (email, username, password_hash, full_name, student_id, role, status)
       VALUES ($1, $2, $3, $4, $5, 'student', $6)
       RETURNING *`,
      [email, username, passwordHash, full_name, student_id ?? null, status],
    );

    await writeAuditLog(user!.id, 'user_registered', 'user', user!.id, { auto_approved: autoApprove }, getIp(req));

    res.status(201).json({
      user: toUserPublic(user!),
      message: autoApprove
        ? 'Registration complete — you can now log in'
        : 'Registration submitted — awaiting instructor approval',
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /login ──────────────────────────────────────────────────────────────

authRouter.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body as z.infer<typeof loginSchema>;

    const user = await queryOne<UserRow>(
      'SELECT * FROM users WHERE email = $1',
      [email],
    );

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      await writeAuditLog(null, 'login_failed', 'user', email, null, getIp(req));
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    if (user.status !== 'active') {
      res.status(403).json({ error: `Account is ${user.status}` });
      return;
    }

    // Issue tokens
    const accessToken = signAccessToken(user.id, user.role);
    const refreshToken = generateToken();
    const refreshHash = hashToken(refreshToken);
    const expiresDays = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS || '7', 10);
    const expiresAt = new Date(Date.now() + expiresDays * 86_400_000);

    await query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, refreshHash, expiresAt, getIp(req), String(req.headers['user-agent'] ?? '')],
    );

    // Update last_login
    await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    await writeAuditLog(user.id, 'login_success', 'user', user.id, null, getIp(req));

    res.json({
      access_token: accessToken,
      refresh_token: refreshToken,
      user: toUserPublic(user),
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /logout ─────────────────────────────────────────────────────────────

authRouter.post('/logout', validate(refreshSchema), async (req, res, next) => {
  try {
    const { refresh_token } = req.body as z.infer<typeof refreshSchema>;
    const tokenHash = hashToken(refresh_token);

    // Look up the token to find the user for audit logging
    const stored = await queryOne<RefreshTokenRow>(
      'SELECT user_id FROM refresh_tokens WHERE token_hash = $1',
      [tokenHash],
    );

    await query(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL',
      [tokenHash],
    );

    if (stored) {
      await writeAuditLog(stored.user_id, 'logout', 'user', stored.user_id, null, getIp(req));
    }

    res.json({ message: 'Logged out' });
  } catch (err) {
    next(err);
  }
});

// ── POST /refresh ────────────────────────────────────────────────────────────

authRouter.post('/refresh', validate(refreshSchema), async (req, res, next) => {
  try {
    const { refresh_token } = req.body as z.infer<typeof refreshSchema>;
    const tokenHash = hashToken(refresh_token);

    const stored = await queryOne<RefreshTokenRow>(
      `SELECT * FROM refresh_tokens
       WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > NOW()`,
      [tokenHash],
    );

    if (!stored) {
      res.status(401).json({ error: 'Invalid or expired refresh token' });
      return;
    }

    const user = await queryOne<UserRow>('SELECT * FROM users WHERE id = $1', [stored.user_id]);
    if (!user || user.status !== 'active') {
      res.status(401).json({ error: 'User not found or inactive' });
      return;
    }

    // Rotate: revoke old, issue new
    await query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1', [stored.id]);

    const newAccessToken = signAccessToken(user.id, user.role);
    const newRefreshToken = generateToken();
    const newRefreshHash = hashToken(newRefreshToken);
    const expiresDays = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS || '7', 10);
    const expiresAt = new Date(Date.now() + expiresDays * 86_400_000);

    await query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, newRefreshHash, expiresAt, getIp(req), String(req.headers['user-agent'] ?? '')],
    );

    res.json({
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /me ──────────────────────────────────────────────────────────────────

authRouter.get('/me', authenticate, (req, res) => {
  res.json({ user: toUserPublic(req.user!) });
});
