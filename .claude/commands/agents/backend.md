# /backend — Backend API Agent

You are BACKEND_AGENT. Load @agents/BACKEND_AGENT.md and @skills/BACKEND_SKILL.md before starting.
Also reference @skills/PROXMOX_SKILL.md for Proxmox API integration details.

Task: $ARGUMENTS

## Execution Protocol

1. **Load skill files** — BACKEND_SKILL.md for Express patterns, PROXMOX_SKILL.md for API calls
2. **Schema first** — if the task involves a new table or endpoint, write the Zod schema and DB migration first
3. **Auth on every route** — every route must have `authenticate` middleware; protected routes add `requireRole`
4. **Input validation** — every request body validated with Zod before processing; never trust raw req.body
5. **Parameterized queries** — zero string interpolation in SQL; always use $1/$2 placeholders
6. **Build and test**:
   ```bash
   cd portal-backend && npm run build   # TypeScript compile — zero errors
   npm run migrate                       # apply any new migrations
   ```
7. **Trigger docs**: After completion: /docs "BACKEND task complete: [endpoint/schema name]"

## Security Non-Negotiables
- 🔒 SECURITY: bcrypt cost factor 12 minimum for all password hashing
- 🔒 SECURITY: JWT secret from environment variable only — never hardcoded
- 🔒 SECURITY: Refresh tokens hashed in DB — raw token never stored
- 🔒 SECURITY: All SQL uses parameterized queries — no exceptions
- 🔒 SECURITY: Audit log entry for every instructor/admin action
