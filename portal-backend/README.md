# portal-backend

Express 5 + TypeScript API server for the Lab Portal. Handles authentication, RBAC,
Proxmox integration, Terraform deployment triggers, and WebSocket status broadcasting.

## Stack

| Component | Version |
|---|---|
| Node.js | 22 LTS |
| Express | 5.x |
| TypeScript | 5.6+ |
| PostgreSQL | 16 |
| Auth | JWT (jsonwebtoken) + bcrypt (cost 12) |
| Validation | Zod 3.x |
| Migrations | node-pg-migrate 7.x |

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — set DATABASE_URL, JWT_SECRET, Proxmox credentials

# 3. Run migrations and seed
npm run migrate
npm run seed

# 4. Start dev server (auto-reload)
npm run dev
```

The server starts on port 4000 (configurable via `PORT` env var).

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start with tsx watch (auto-reload on changes) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled output (`dist/index.js`) |
| `npm run migrate` | Run pending database migrations |
| `npm run migrate:down` | Roll back the last migration |
| `npm run seed` | Seed admin account and 20 lab slots |
| `npm test` | Run tests (vitest) |

## Project Structure

```
src/
├── index.ts              — Server entry point, graceful shutdown
├── app.ts                — Express app, middleware, route mounting
├── api/
│   ├── routes/           — 8 route modules (auth, users, slots, consoles,
│   │                       scenarios, objectives, hints, audit)
│   └── middleware/       — auth, validate, auditLog, errorHandler
├── services/             — proxmox, terraform, console, email,
│                           scenarios, statusBroadcast
├── db/
│   └── pool.ts           — pg Pool singleton with typed query helpers
├── types/
│   └── index.ts          — TypeScript interfaces for all DB rows
└── utils/                — crypto, errors, request helpers
migrations/               — 7 SQL migration files (001–007)
database/seeds/           — Seed script (admin + slots)
```

## API Endpoints

| Group | Base Path | Auth Required | Notes |
|---|---|---|---|
| Auth | `/api/auth` | Partial | Register/login are public |
| Users | `/api/users` | instructor+ | Full CRUD + approve/lock/reset |
| Slots | `/api/slots` | Yes | Mutations require instructor+ |
| Consoles | `/api/consoles` | Yes | Students limited to own VMs |
| Scenarios | `/api/scenarios` | Yes | Read-only scenario catalog |
| Objectives | `/api/objectives` | Yes | Self-reported progress |
| Hints | `/api/hints` | Yes | Instructor → student messaging |
| Audit | `/api/audit` | admin | Paginated audit log |
| WebSocket | `/ws/status` | JWT query param | Slot status broadcast (5s) |

See [API_REFERENCE.md](../docs/portal/API_REFERENCE.md) for complete endpoint documentation.

## Environment Variables

See `.env.example` for the full list. Critical variables:

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | `openssl rand -hex 64` |
| `PROXMOX_TOKEN_ID` | Yes | Proxmox API token ID |
| `PROXMOX_TOKEN_SECRET` | Yes | Proxmox API token secret |

## Security

- JWT access tokens: 15-minute expiry, stored in memory only
- Refresh tokens: 7-day expiry, SHA-256 hashed before DB storage, rotated on use
- bcrypt cost factor 12 for all password hashing
- Parameterized SQL queries throughout (zero string interpolation)
- Rate limiting: global 200/min, auth 15/15min, console 10/min
- WebSocket requires JWT authentication
- All admin/instructor actions written to audit log
