# /portal-build — Build the Complete Lab Portal System

Build the entire student/instructor portal from scratch. This is a multi-agent coordinated
build that produces a fully functional, production-ready lab management portal.

Scope: $ARGUMENTS
(Leave blank for full build. Pass "auth", "admin", "student", "console", or "backend" to build one layer.)

## Full Build Order (ORCHESTRATOR enforces this sequence)

### Step 1 — Database (BACKEND_AGENT)
- Create PostgreSQL database and user on management host
- Run all migrations (users, refresh_tokens, lab_slots, audit_log, objectives_progress, hints)
- Run seed script (admin account + 20 empty slots)
- Verify: `psql -c "SELECT * FROM lab_slots;"` shows 20 rows

### Step 2 — Backend API (BACKEND_AGENT)
Build in this order:
1. `src/db/pool.ts` — database pool
2. `src/utils/errors.ts` — typed error classes
3. `src/utils/crypto.ts` — token generation
4. `src/api/middleware/auth.ts` — authenticate, requireRole, requireSlotOwner
5. `src/api/middleware/validate.ts` — Zod wrapper
6. `src/api/middleware/auditLog.ts`
7. `src/api/middleware/errorHandler.ts`
8. `src/models/user.ts` — user model functions
9. `src/models/slot.ts` — slot model functions
10. `src/services/proxmox.ts` — Proxmox API client
11. `src/services/terraform.ts` — Terraform CLI wrapper with streaming output
12. `src/services/console.ts` — VNC ticket + WebSocket proxy
13. `src/services/statusBroadcast.ts` — WebSocket slot status feed
14. `src/services/email.ts` — password reset email service
15. `src/api/routes/auth.ts` — register, login, logout, refresh, me
16. `src/api/routes/users.ts` — user CRUD, approve, lock, unlock
17. `src/api/routes/slots.ts` — 20-slot management, deploy, destroy, reset
18. `src/api/routes/consoles.ts` — VM list, VNC ticket, WebSocket proxy
19. `src/api/routes/scenarios.ts` — scenario catalog reader
20. `src/api/routes/objectives.ts` — objective progress tracking
21. `src/api/routes/hints.ts` — instructor→student hint system
22. `src/api/routes/audit.ts` — audit log viewer
23. `src/app.ts` — Express app assembly
24. `src/index.ts` — server entry, HTTP + WebSocket server

After each route file: `cd portal-backend && npm run build` — fix errors before continuing.

### Step 3 — Portal UI Auth Layer (PORTAL_AGENT)
1. `src/api/authApi.ts` — login, register, refresh, logout client functions
2. `src/stores/authStore.ts` — JWT in memory, user profile, role
3. `src/hooks/useAuth.ts` — login/logout actions, token refresh timer
4. `src/components/shared/ProtectedRoute.tsx`
5. `src/components/shared/NavBar.tsx` — role-aware navigation
6. `src/components/auth/LoginForm.tsx` — email/password with error states
7. `src/components/auth/RegisterForm.tsx` — student self-registration
8. `src/components/auth/PasswordResetForm.tsx`
9. `src/pages/LoginPage.tsx`
10. `src/pages/RegisterPage.tsx`

### Step 4 — Instructor Admin Dashboard (PORTAL_AGENT)
1. `src/api/usersApi.ts` — user management client
2. `src/api/labsApi.ts` — slot deploy/destroy/reset client
3. `src/stores/labStore.ts` — slot states, WebSocket feed
4. `src/hooks/useLabStatus.ts` — WebSocket slot status subscription
5. `src/components/instructor/UserTable.tsx` — sortable user list with action buttons
6. `src/components/instructor/UserEditModal.tsx` — edit role, status, slot
7. `src/components/instructor/LabGrid.tsx` — 20-slot visualization grid
8. `src/components/instructor/SlotCard.tsx` — per-slot status and controls
9. `src/components/instructor/DeployModal.tsx` — scenario picker + deploy
10. `src/components/instructor/ConsoleGrid.tsx` — multi-VM console monitor
11. `src/pages/AdminPage.tsx` — tabs: Users | Lab Slots | Console Monitor | Audit Log

### Step 5 — Student Dashboard (PORTAL_AGENT)
1. `src/api/consolesApi.ts` — VM list and ticket client
2. `src/components/student/ScenarioCard.tsx` — scenario info + objectives
3. `src/components/student/ObjectiveTracker.tsx` — self-check objectives
4. `src/components/student/MyConsoles.tsx` — student's VM connection cards
5. `src/components/student/HintFeed.tsx` — instructor hints feed
6. `src/pages/DashboardPage.tsx`

### Step 6 — VM Console Viewer (PORTAL_AGENT)
1. `src/components/console/NoVNCViewer.tsx` — noVNC integration
2. `src/components/console/ConsoleToolbar.tsx` — fullscreen, disconnect, clipboard paste
3. `src/components/console/ConsoleAuth.tsx` — ticket request + connection state machine
4. `src/pages/ConsolePage.tsx` — full-page console with toolbar

### Step 7 — Router and App Shell (PORTAL_AGENT)
1. `src/App.tsx` — React Router setup with all routes
2. `src/main.tsx` — entry point, QueryClient provider
3. `index.html` — Google Fonts import, meta tags
4. `vite.config.ts` — proxy /api/* and WebSocket to portal-backend:4000

Final build check: `cd portal-ui && npm run build && npm run type-check`

### Step 8 — Integration Wiring (INFRA_AGENT)
1. Ansible role: `lab-database` — installs PostgreSQL 16, creates DB and user
2. Ansible role: `lab-portal` — deploys portal-backend with PM2, serves portal-ui with nginx
3. nginx config: serves portal-ui on :3000, reverse-proxies /api and /novnc-proxy to :4000
4. PM2 ecosystem file for portal-backend auto-start and restart
5. Systemd override to start PM2 on boot

### Step 9 — Security Review (SECURITY_AGENT)
- Verify all admin routes require instructor/admin role (server-side, not just client-side)
- Verify console access is validated (student can only see own VMs)
- Verify no credentials in committed files
- Verify rate limiting is active on /api/auth/login
- Add hardening checklist entry for portal

### Step 10 — Documentation (DOCS_AGENT)
- `docs/portal/PORTAL_SETUP.md` — deploy and configure the portal
- `docs/portal/API_REFERENCE.md` — all endpoints with request/response schemas
- `docs/portal/DATABASE_SCHEMA.md` — all tables with column descriptions
- `docs/portal/INSTRUCTOR_GUIDE.md` — how to manage students and deploy labs
- `docs/portal/STUDENT_GUIDE.md` — how to register, access your lab, use the console
- `docs/portal/CONSOLE_SETUP.md` — noVNC proxy configuration
- CHANGELOG.md entries for all portal work
- Update README.md with portal section

## After Full Build — Verify
```bash
# 1. Backend health check
curl http://172.16.0.10:4000/api/health

# 2. Login as admin
curl -c cookies.txt -X POST http://172.16.0.10:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@lab.local","password":"ChangeMe123!@#"}'

# 3. Portal UI loads in browser
# http://172.16.0.10:3000 → redirects to /login
# Login → redirects to /admin (for admin role)

# 4. Register a test student
# Navigate to /register → fill form → approve in admin panel

# 5. Deploy a test slot
# Admin → Lab Slots → Slot 1 → Deploy → select scenario → confirm
```
