# Skill: Backend API — Express 5 + TypeScript + PostgreSQL

**Applies to**: BACKEND_AGENT  
**Stack**: Node.js 22 · Express 5 · TypeScript 5.6 · PostgreSQL 16 · node-pg-migrate  
**Last reviewed**: 2025-06

---

## Project Structure

```
portal-backend/
├── src/
│   ├── index.ts              — server entry point
│   ├── app.ts                — Express app config, middleware, routes
│   ├── api/
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── users.ts
│   │   │   ├── slots.ts
│   │   │   ├── consoles.ts
│   │   │   ├── scenarios.ts
│   │   │   ├── objectives.ts
│   │   │   ├── hints.ts
│   │   │   └── audit.ts
│   │   └── middleware/
│   │       ├── auth.ts       — JWT verify, requireRole, requireSlotOwner
│   │       ├── validate.ts   — Zod request validation wrapper
│   │       ├── auditLog.ts   — automatic audit logging middleware
│   │       └── errorHandler.ts
│   ├── models/
│   │   ├── user.ts
│   │   ├── slot.ts
│   │   └── types.ts          — shared TypeScript interfaces
│   ├── services/
│   │   ├── proxmox.ts        — Proxmox API client
│   │   ├── terraform.ts      — Terraform CLI wrapper
│   │   ├── console.ts        — VNC ticket + WebSocket proxy
│   │   ├── email.ts          — password reset emails
│   │   └── statusBroadcast.ts — WebSocket slot status feed
│   ├── db/
│   │   ├── pool.ts           — pg Pool singleton
│   │   └── queries.ts        — parameterized query helpers
│   └── utils/
│       ├── crypto.ts         — token generation, hashing
│       └── errors.ts         — typed error classes
├── migrations/               — node-pg-migrate SQL files
├── seeds/                    — initial data (admin user, slots)
├── package.json
├── tsconfig.json
└── .env.example
```

---

## Express App Setup

```typescript
// src/app.ts
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import { authRouter } from './api/routes/auth';
import { usersRouter } from './api/routes/users';
import { slotsRouter } from './api/routes/slots';
import { consolesRouter } from './api/routes/consoles';
import { errorHandler } from './api/middleware/errorHandler';

const app = express();

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", 'ws:', 'wss:'],
      scriptSrc: ["'self'"],
    }
  }
}));

// CORS — allow portal-ui origin only
app.use(cors({
  origin: process.env.PORTAL_ORIGIN || 'http://172.16.0.10:3000',
  credentials: true,  // required for httpOnly cookies
}));

app.use(express.json({ limit: '10kb' }));  // limit body size
app.use(cookieParser());

// Global rate limit
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
}));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/slots', slotsRouter);
app.use('/api/consoles', consolesRouter);

// Error handler (must be last)
app.use(errorHandler);

export { app };
```

---

## Database Pool

```typescript
// src/db/pool.ts
import { Pool } from 'pg';

let pool: Pool;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: parseInt(process.env.DATABASE_POOL_MAX || '10'),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
    });

    pool.on('error', (err) => {
      console.error('Unexpected pool error:', err);
    });
  }
  return pool;
}

// Typed query helper
export async function query<T = Record<string, unknown>>(
  text: string,
  values?: unknown[]
): Promise<T[]> {
  const client = await getPool().connect();
  try {
    const result = await client.query(text, values);
    return result.rows as T[];
  } finally {
    client.release();
  }
}

// Single-row helper
export async function queryOne<T>(text: string, values?: unknown[]): Promise<T | null> {
  const rows = await query<T>(text, values);
  return rows[0] ?? null;
}
```

---

## Migration Pattern

```bash
# Install
npm install node-pg-migrate

# Create migration
npx node-pg-migrate create create_users_table

# Run migrations
DATABASE_URL=postgresql://... npx node-pg-migrate up

# Rollback
DATABASE_URL=postgresql://... npx node-pg-migrate down
```

```javascript
// migrations/001_create_users.js
exports.up = (pgm) => {
  pgm.createExtension('pgcrypto', { ifNotExists: true });
  pgm.createTable('users', {
    id:            { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    email:         { type: 'varchar(255)', notNull: true, unique: true },
    username:      { type: 'varchar(50)', notNull: true, unique: true },
    password_hash: { type: 'varchar(255)', notNull: true },
    full_name:     { type: 'varchar(255)', notNull: true },
    student_id:    { type: 'varchar(50)' },
    role:          { type: 'varchar(20)', notNull: true, default: 'student',
                     check: "role IN ('admin','instructor','student')" },
    status:        { type: 'varchar(20)', notNull: true, default: 'pending',
                     check: "status IN ('pending','active','locked','deleted')" },
    lab_slot:      { type: 'smallint', unique: true, check: 'lab_slot BETWEEN 1 AND 20' },
    created_at:    { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    last_login:    { type: 'timestamptz' },
  });
  pgm.addIndex('users', 'email');
  pgm.addIndex('users', 'role');
  pgm.addIndex('users', 'status');
};

exports.down = (pgm) => pgm.dropTable('users');
```

---

## Error Handler

```typescript
// src/api/middleware/errorHandler.ts
import { ZodError } from 'zod';

export function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.errors.map(e => ({ path: e.path.join('.'), message: e.message })),
    });
  }

  if (err.name === 'UnauthorizedError') return res.status(401).json({ error: err.message });
  if (err.name === 'ForbiddenError')    return res.status(403).json({ error: err.message });
  if (err.name === 'NotFoundError')     return res.status(404).json({ error: err.message });
  if (err.name === 'ConflictError')     return res.status(409).json({ error: err.message });

  console.error(err);
  return res.status(500).json({ error: 'Internal server error' });
}
```

---

## package.json

```json
{
  "name": "portal-backend",
  "version": "0.1.0",
  "scripts": {
    "dev":     "tsx watch src/index.ts",
    "build":   "tsc --project tsconfig.json",
    "start":   "node dist/index.js",
    "migrate": "node-pg-migrate up",
    "seed":    "tsx database/seeds/seed.ts",
    "test":    "vitest run"
  },
  "dependencies": {
    "express": "^5.0.0",
    "@types/express": "^5.0.0",
    "pg": "^8.12.0",
    "bcrypt": "^5.1.0",
    "@types/bcrypt": "^5.0.0",
    "jsonwebtoken": "^9.0.0",
    "@types/jsonwebtoken": "^9.0.0",
    "zod": "^3.23.0",
    "helmet": "^8.0.0",
    "cors": "^2.8.5",
    "@types/cors": "^2.8.0",
    "cookie-parser": "^1.4.6",
    "@types/cookie-parser": "^1.4.0",
    "express-rate-limit": "^7.4.0",
    "ws": "^8.18.0",
    "@types/ws": "^8.5.0",
    "http-proxy-middleware": "^3.0.0",
    "node-fetch": "^3.3.0",
    "dotenv": "^16.4.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "tsx": "^4.17.0",
    "node-pg-migrate": "^7.7.0",
    "vitest": "^2.0.0"
  }
}
```

---

## Seed Script (Initial Admin + Slots)

```typescript
// database/seeds/seed.ts
import bcrypt from 'bcrypt';
import { query } from '../../src/db/pool';
import dotenv from 'dotenv';
dotenv.config();

async function seed() {
  console.log('Seeding database...');

  // Create default admin account
  const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeMe123!@#';
  const hash = await bcrypt.hash(adminPassword, 12);

  await query(`
    INSERT INTO users (email, username, password_hash, full_name, role, status)
    VALUES ($1, $2, $3, $4, 'admin', 'active')
    ON CONFLICT (email) DO NOTHING
  `, ['admin@lab.local', 'admin', hash, 'Lab Administrator']);

  // Pre-populate 20 lab slots
  for (let i = 1; i <= 20; i++) {
    await query(`
      INSERT INTO lab_slots (slot_number)
      VALUES ($1) ON CONFLICT (slot_number) DO NOTHING
    `, [i]);
  }

  console.log('✅ Seed complete');
  console.log(`   Admin account: admin@lab.local / ${adminPassword}`);
  console.log('   Change this password immediately after first login!');
  process.exit(0);
}

seed().catch(console.error);
```
