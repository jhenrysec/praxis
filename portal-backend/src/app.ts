import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import { errorHandler } from './api/middleware/errorHandler.js';
import { authRouter } from './api/routes/auth.js';
import { usersRouter } from './api/routes/users.js';
import { slotsRouter } from './api/routes/slots.js';
import { vmsRouter } from './api/routes/vms.js';
import { consolesRouter } from './api/routes/consoles.js';
import { scenariosRouter } from './api/routes/scenarios.js';
import { objectivesRouter } from './api/routes/objectives.js';
import { hintsRouter } from './api/routes/hints.js';
import { auditRouter } from './api/routes/audit.js';
import { socRouter } from './api/routes/soc.js';

const app = express();

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'"],
        scriptSrc: ["'self'"],
        frameSrc: ["'self'"],
      },
    },
  }),
);

// CORS — PORTAL_ORIGIN is comma-separated so the portal is reachable from
// both localhost (dev on the host) and the LAN IP (other machines on the
// subnet, like Proxmox at 192.168.1.50:8006). credentials: true precludes
// wildcard, so we match the incoming Origin against the allow-list.
// Requests without an Origin (curl, server-to-server) pass through — the
// browser same-origin policy is what matters for the actual credential leak.
const allowedOrigins = (process.env.PORTAL_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

// Global rate limit
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    standardHeaders: true,
  }),
);

// Stricter rate limit for auth endpoints (brute-force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15,                   // 15 attempts per 15 minutes
  standardHeaders: true,
  message: { error: 'Too many authentication attempts — try again in 15 minutes' },
});

// Rate limit for VNC ticket requests (prevent ticket exhaustion)
const consoleLimiter = rateLimit({
  windowMs: 60 * 1000,      // 1 minute
  max: 10,                   // 10 ticket requests per minute
  standardHeaders: true,
  message: { error: 'Too many console requests — try again in a minute' },
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// API routes
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/refresh', authLimiter);
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/slots', slotsRouter);
app.use('/api/vms', vmsRouter);
app.use('/api/consoles/ticket', consoleLimiter);
app.use('/api/consoles', consolesRouter);
app.use('/api/scenarios', scenariosRouter);
app.use('/api/objectives', objectivesRouter);
app.use('/api/hints', hintsRouter);
app.use('/api/audit', auditRouter);
app.use('/api/soc', socRouter);

// Error handler (must be last)
app.use(errorHandler);

export { app };
