import { Router, type Request, type Response, type NextFunction } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import jwt from 'jsonwebtoken';
import { authenticate, requireRole } from '../middleware/auth.js';
import { writeAuditLog } from '../middleware/auditLog.js';
import { queryOne } from '../../db/pool.js';
import type { UserRow, Role } from '../../types/index.js';

export const socRouter = Router();

const WAZUH_DASHBOARD_URL = process.env.WAZUH_DASHBOARD_URL || 'https://192.168.1.60';
const SOC_COOKIE_NAME = 'soc_session';
const SOC_SESSION_MINUTES = parseInt(process.env.SOC_SESSION_EXPIRES_MIN || '60', 10);
const SOC_COOKIE_PATH = '/api/soc';

const JWT_SECRET = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not set');
  return secret;
};

interface SocTokenPayload {
  sub: string;
  role: Role;
  scope: 'soc';
  iat?: number;
  exp?: number;
}

function getIp(req: Request): string | null {
  const ip = req.ip;
  if (typeof ip === 'string') return ip;
  if (Array.isArray(ip)) return ip[0] ?? null;
  return req.socket.remoteAddress ?? null;
}

/**
 * Accept either an Authorization: Bearer header (normal API flow) OR the
 * soc_session httpOnly cookie (iframe/tab navigation flow). Populates
 * req.user the same way authenticate() does. Requires admin or instructor.
 */
async function authenticateSoc(req: Request, res: Response, next: NextFunction): Promise<void> {
  let userId: string | null = null;
  let role: Role | null = null;

  const header = req.headers.authorization;
  const bearer = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (bearer) {
    try {
      const payload = jwt.verify(bearer, JWT_SECRET()) as { sub: string; role: Role };
      userId = payload.sub;
      role = payload.role;
    } catch {
      // fall through to cookie check
    }
  }

  if (!userId) {
    const cookieVal = (req as Request & { cookies?: Record<string, string> }).cookies?.[SOC_COOKIE_NAME];
    if (cookieVal) {
      try {
        const payload = jwt.verify(cookieVal, JWT_SECRET()) as SocTokenPayload;
        if (payload.scope === 'soc') {
          userId = payload.sub;
          role = payload.role;
        }
      } catch {
        // invalid cookie — fall through
      }
    }
  }

  if (!userId || !role) {
    res.status(401).json({ error: 'SOC access requires active session' });
    return;
  }

  const user = await queryOne<UserRow>('SELECT * FROM users WHERE id = $1', [userId]);
  if (!user || user.status !== 'active') {
    res.status(403).json({ error: 'Account inactive' });
    return;
  }
  if (user.role !== 'admin' && user.role !== 'instructor') {
    res.status(403).json({ error: 'SOC access restricted to admin/instructor' });
    return;
  }

  req.user = user;
  next();
}

// ── POST /grant — mint short-lived SOC session cookie ─────────────────────────
// Called by portal-ui before opening the SOC iframe/tab. Requires full Bearer
// auth (instructor/admin only). Sets httpOnly cookie scoped to /api/soc so it
// travels with iframe requests automatically but never touches portal-ui JS.

socRouter.post(
  '/grant',
  authenticate,
  requireRole('admin', 'instructor'),
  async (req, res, next) => {
    try {
      const user = req.user;
      if (!user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const expiresIn = `${SOC_SESSION_MINUTES}m` as string & jwt.SignOptions['expiresIn'];
      const socToken = jwt.sign(
        { sub: user.id, role: user.role, scope: 'soc' } satisfies SocTokenPayload,
        JWT_SECRET(),
        { expiresIn },
      );

      const secureCookie = process.env.NODE_ENV === 'production';
      res.cookie(SOC_COOKIE_NAME, socToken, {
        httpOnly: true,
        secure: secureCookie,
        sameSite: 'lax',
        path: SOC_COOKIE_PATH,
        maxAge: SOC_SESSION_MINUTES * 60 * 1000,
      });

      await writeAuditLog(
        user.id,
        'soc_access_granted',
        'soc',
        null,
        { expires_in_minutes: SOC_SESSION_MINUTES, target: WAZUH_DASHBOARD_URL },
        getIp(req),
      );

      res.json({
        ok: true,
        expires_in_seconds: SOC_SESSION_MINUTES * 60,
        dashboard_url: '/api/soc/',
      });
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /revoke — clear SOC session cookie ───────────────────────────────────

socRouter.post('/revoke', authenticate, (req, res) => {
  res.clearCookie(SOC_COOKIE_NAME, { path: SOC_COOKIE_PATH });
  res.json({ ok: true });
});

// ── ALL /* — reverse-proxy to Wazuh dashboard ─────────────────────────────────
// Gated by cookie or Bearer. http-proxy-middleware v3 uses the `on:` event
// bag. Strips anti-framing headers and rewrites Location redirects so the
// SPA navigates through /api/soc instead of escaping to the Wazuh origin.

// ws:false — statusBroadcast already owns the HTTP server's upgrade event at
// /ws/status. Wazuh dashboard polls over HTTPS for most state, so dropping
// WebSocket proxying here is acceptable for MVP. To enable later, hook the
// server's `upgrade` event in src/index.ts and dispatch by path.
const wazuhProxy = createProxyMiddleware({
  target: WAZUH_DASHBOARD_URL,
  changeOrigin: true,
  secure: false, // Wazuh ships a self-signed cert in the lab
  ws: false,
  // No pathRewrite — Wazuh dashboard is configured with
  // server.basePath: "/api/soc" + server.rewriteBasePath: true via the
  // wazuh-manager Ansible role, so the prefix must reach the origin intact.
  selfHandleResponse: false,
  on: {
    proxyRes: (proxyRes) => {
      // Wazuh/OpenSearch Dashboards blocks framing by default; strip the
      // headers so the iframe in portal-ui can render the dashboard.
      delete proxyRes.headers['x-frame-options'];

      const csp = proxyRes.headers['content-security-policy'];
      if (typeof csp === 'string') {
        const cleaned = csp
          .split(';')
          .map((d) => d.trim())
          .filter((d) => d && !d.toLowerCase().startsWith('frame-ancestors'))
          .join('; ');
        proxyRes.headers['content-security-policy'] = cleaned;
      }

      // Rewrite absolute Location redirects so the browser stays on /api/soc.
      const loc = proxyRes.headers['location'];
      if (typeof loc === 'string' && loc.startsWith('/') && !loc.startsWith('/api/soc')) {
        proxyRes.headers['location'] = `/api/soc${loc}`;
      }
    },
    error: (err, _req, res) => {
      console.error('[soc-proxy] upstream error:', err.message);
      if (res && 'writeHead' in res && !res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Wazuh dashboard unreachable', detail: err.message }));
      }
    },
  },
});

socRouter.use('/', authenticateSoc, wazuhProxy);
