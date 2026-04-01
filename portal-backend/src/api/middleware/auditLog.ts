import type { Request, Response, NextFunction } from 'express';
import { query } from '../../db/pool.js';

export async function writeAuditLog(
  actorId: string | null,
  action: string,
  targetType: string | null,
  targetId: string | null,
  details: Record<string, unknown> | null,
  ipAddress: string | null,
): Promise<void> {
  await query(
    `INSERT INTO audit_log (actor_id, action, target_type, target_id, details, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [actorId, action, targetType, targetId, details ? JSON.stringify(details) : null, ipAddress],
  );
}

/**
 * Middleware that auto-logs mutating requests to the audit table.
 * Attach after authenticate so req.user is available.
 */
export function auditMiddleware(action: string, targetType?: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userId = (req as Request & { user?: { id: string } }).user?.id ?? null;
    const ip = (typeof req.ip === 'string' ? req.ip : req.socket.remoteAddress) ?? null;

    // Log after response finishes
    res.on('finish', () => {
      if (res.statusCode < 400) {
        const rawId = req.params['id'] ?? req.params['slot'];
        const targetId = typeof rawId === 'string' ? rawId : null;
        writeAuditLog(userId, action, targetType ?? null, targetId, null, ip).catch((err: unknown) => {
          console.error('[audit] write failed:', err);
        });
      }
    });
    next();
  };
}
