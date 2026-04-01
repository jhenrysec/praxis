import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { queryOne } from '../../db/pool.js';
import { writeAuditLog } from './auditLog.js';
import type { UserRow, JWTPayload, Role } from '../../types/index.js';

// Extend Express Request to carry the authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: UserRow;
    }
  }
}

const JWT_SECRET = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not set');
  return secret;
};

/** Extract a single IP string from req.ip (Express 5 may return string[]). */
function getIp(req: Request): string | null {
  const ip = req.ip;
  if (typeof ip === 'string') return ip;
  if (Array.isArray(ip)) return ip[0] ?? null;
  return req.socket.remoteAddress ?? null;
}

/**
 * Verify JWT access token from Authorization: Bearer <token>.
 * Populates req.user with the full user row.
 */
export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  let payload: JWTPayload;
  try {
    payload = jwt.verify(token, JWT_SECRET()) as JWTPayload;
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  const user = await queryOne<UserRow>(
    'SELECT * FROM users WHERE id = $1',
    [payload.sub],
  );

  if (!user) {
    res.status(401).json({ error: 'User not found' });
    return;
  }

  if (user.status !== 'active') {
    res.status(403).json({ error: 'Account inactive' });
    return;
  }

  req.user = user;
  next();
}

/**
 * Require the authenticated user to have one of the specified roles.
 */
export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user;
    if (!user || !roles.includes(user.role)) {
      // Audit unauthorized access attempt
      writeAuditLog(
        user?.id ?? null,
        'unauthorized_access',
        'route',
        req.path,
        { required_roles: roles, user_role: user?.role ?? null },
        getIp(req),
      ).catch((err: unknown) => {
        console.error('[audit] write failed:', err);
      });

      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}

/**
 * Students can only access their own assigned slot.
 * Instructors and admins can access any slot.
 * Expects :slot param in route.
 */
export async function requireSlotOwner(req: Request, res: Response, next: NextFunction): Promise<void> {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  if (user.role === 'student') {
    const rawSlot = req.params['slot'];
    const slotParam = parseInt(typeof rawSlot === 'string' ? rawSlot : '', 10);
    if (user.lab_slot !== slotParam) {
      res.status(403).json({ error: 'Access denied to this slot' });
      return;
    }
  }

  next();
}

/** Sign an access token. Short-lived (15m default). */
export function signAccessToken(userId: string, role: Role): string {
  const expiresIn = (process.env.JWT_EXPIRES_IN || '15m') as string & jwt.SignOptions['expiresIn'];
  return jwt.sign({ sub: userId, role }, JWT_SECRET(), { expiresIn });
}

/** Sign a refresh token. Longer-lived (7d default). */
export function signRefreshToken(userId: string): string {
  const days = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS || '7', 10);
  const expiresIn = `${days}d` as string & jwt.SignOptions['expiresIn'];
  return jwt.sign({ sub: userId, type: 'refresh' }, JWT_SECRET(), { expiresIn });
}
