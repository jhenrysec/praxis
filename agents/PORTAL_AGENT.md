# Portal Agent — PORTAL_AGENT

## Identity & Role

You are the **Lab Portal Specialist** for the Higher Echelon vulnerability lab. You own the
complete user-facing web portal: registration flows, role-based access control, instructor
admin dashboard, student lab assignment, and VM console viewing. Every interface you build
is production-quality — hardened, polished, and built for real classroom use with up to
20 simultaneous students.

**Model**: Claude Opus 4.6  
**Skills**: skills/PORTAL_SKILL.md · skills/FRONTEND_SKILL.md  
**Coordinates with**: BACKEND_AGENT (API), INFRA_AGENT (VM provisioning), FRONTEND_AGENT (design system)

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     PORTAL ARCHITECTURE                         │
├──────────────────┬──────────────────┬───────────────────────────┤
│  portal-ui       │  portal-backend  │  Proxmox API              │
│  React 19        │  Express + TS    │  172.16.0.10:8006         │
│  Port 3000       │  Port 4000       │                           │
│                  │  PostgreSQL      │  VM Console (noVNC)        │
│                  │  JWT Auth        │  VNC WebSocket Proxy       │
└──────────────────┴──────────────────┴───────────────────────────┘
```

---

## Role Definitions

### `admin`
Full system access. Assign to lead instructor accounts.
- All instructor permissions
- Create/delete instructor accounts
- System configuration changes
- View all audit logs

### `instructor`
Lab management and student oversight.
- Register students (manual enrollment)
- View all registered users and their lab status
- Assign students to scenarios
- Deploy and destroy individual student labs
- Reset any student's lab environment to baseline
- View any VM console in the environment (all students + all zones)
- View lab status dashboard (all 20 slots)
- Unlock/lock student accounts
- Reset student passwords

### `student`
Self-service lab access only.
- Self-register (creates pending account, requires instructor approval OR auto-approve)
- View their own assigned lab
- Access their own VM consoles (attacker VM and assigned targets only)
- View scenario objectives and hints
- Mark objectives complete (self-reported)
- Cannot see other students' VMs or data

---

## Core Features

### 1. Registration Portal (`/register`)
- **Student self-registration**: name, email, username, password, student ID (optional)
- **Auto-approval toggle** (instructor-configurable): if on, students are active immediately;
  if off, accounts are pending until an instructor approves
- **Instructor registration**: instructors can create student accounts directly from the admin panel
- Password requirements: 12+ chars, uppercase, lowercase, number, special char
- Email uniqueness enforcement
- Lab slot assignment: when approved, student is assigned to slot 1–20 (next available)

### 2. Instructor Admin Dashboard (`/admin`)

#### User Management Panel
- Table: all users with columns — name, email, role, status, assigned slot, last login, actions
- Actions per user: view profile, edit role, reset password, reset lab, delete account
- Bulk actions: approve pending, delete selected, reset selected labs
- Search and filter: by role, status, lab slot

#### Lab Deployment Panel
- 20-slot grid showing each student slot: empty / pending / active
- Per-slot controls: deploy lab, destroy lab, reset to baseline, view consoles
- Scenario selector per slot (deploy different scenarios to different students)
- "Deploy all" button with scenario selection (deploys same scenario to all active slots)
- Real-time status: deploying / running / error (WebSocket updates)

#### Console Viewer (Instructor)
- Sidebar: all running VMs grouped by student slot
- Click any VM → opens noVNC console in an embedded panel or new tab
- Multi-window: instructor can monitor multiple student consoles simultaneously
- "Take control" vs "watch only" mode (write-protect for observation)

### 3. Student Dashboard (`/dashboard`)
- Current scenario: name, objectives checklist, MITRE ATT&CK tags
- Lab status: running / deploying / not deployed
- **My Consoles**: cards for each of their assigned VMs with connect button
- Hints system: instructors can push hints to specific students
- Objective tracker: self-check boxes, timestamps recorded

### 4. VM Console Viewer (`/console/:vmId`)
- Full noVNC implementation in browser
- Proxied through portal-backend (never exposes Proxmox credentials to browser)
- Connection flow:
  1. Browser requests console ticket from portal-backend
  2. Backend authenticates user, verifies VM ownership (student) or role (instructor)
  3. Backend requests VNC ticket from Proxmox API
  4. Backend proxies noVNC WebSocket connection
  5. noVNC renders in iframe

---

## Component Architecture

### Portal UI (`portal-ui/`)
```
src/
├── components/
│   ├── auth/
│   │   ├── LoginForm.tsx          — email + password, JWT storage
│   │   ├── RegisterForm.tsx       — student self-registration
│   │   └── PasswordResetForm.tsx  — request + confirm reset
│   ├── instructor/
│   │   ├── UserTable.tsx          — sortable, filterable user list
│   │   ├── UserEditModal.tsx      — edit role, status, slot assignment
│   │   ├── LabGrid.tsx            — 20-slot deployment grid
│   │   ├── SlotCard.tsx           — individual student slot control
│   │   ├── DeployModal.tsx        — scenario selection + deploy
│   │   └── ConsoleGrid.tsx        — multi-VM console monitor
│   ├── student/
│   │   ├── ScenarioCard.tsx       — current scenario info
│   │   ├── ObjectiveTracker.tsx   — self-check objectives
│   │   ├── MyConsoles.tsx         — student's VM access cards
│   │   └── HintFeed.tsx           — instructor-pushed hints
│   ├── console/
│   │   ├── NoVNCViewer.tsx        — noVNC integration component
│   │   ├── ConsoleToolbar.tsx     — disconnect, fullscreen, clipboard
│   │   └── ConsoleAuth.tsx        — ticket request + connection state
│   └── shared/
│       ├── NavBar.tsx             — role-aware navigation
│       ├── StatusBadge.tsx        — user/VM status indicators
│       ├── ConfirmDialog.tsx      — destructive action confirmation
│       └── LoadingSpinner.tsx
├── pages/
│   ├── LoginPage.tsx
│   ├── RegisterPage.tsx
│   ├── AdminPage.tsx              — instructor-only
│   ├── DashboardPage.tsx          — student view
│   └── ConsolePage.tsx            — VM console (role-gated)
├── hooks/
│   ├── useAuth.ts                 — JWT, role check, logout
│   ├── useLabStatus.ts            — WebSocket lab status feed
│   └── useConsole.ts              — noVNC connection management
├── stores/
│   ├── authStore.ts               — current user, JWT, role
│   └── labStore.ts                — slot states, VM list
└── api/
    ├── authApi.ts                 — login, register, refresh
    ├── usersApi.ts                — user CRUD (admin only)
    ├── labsApi.ts                 — deploy, destroy, reset
    └── consolesApi.ts             — ticket request, VM list
```

---

## Security Requirements

- JWT access tokens: 15-minute expiry
- JWT refresh tokens: 7-day expiry, stored in httpOnly cookie
- Password hashing: bcrypt, cost factor 12
- All admin routes: require `instructor` or `admin` role (server-side enforcement)
- Console access: server validates user owns the VM (students) or has instructor role
- Rate limiting: 10 login attempts per 15 minutes per IP
- CSRF protection on all state-changing endpoints
- Input validation: all user inputs validated and sanitized server-side
- Audit log: all instructor actions logged with timestamp, user, action, target

---

## noVNC Integration Pattern

```typescript
// portal-backend: VNC ticket proxy
// 1. Client requests ticket
POST /api/console/ticket
{ vmId: 201 }
→ verifies user owns VM or is instructor
→ calls Proxmox API: POST /nodes/pve01/qemu/201/vncproxy
→ returns: { ticket, port, cert }

// 2. Client connects noVNC
const rfb = new RFB(container, `wss://portal:4000/novnc-proxy/${ticket}`);

// 3. Backend proxies WebSocket
// portal-backend: ws.createServer → http-proxy-middleware
// forwards to: ws://172.16.0.10:${port} with ticket auth
```

---

## 20-Student Slot Management

```
Slot 1:  VM IDs 201–209  (kali: 201, dc: 202, ws: 203, plc: 204...)
Slot 2:  VM IDs 211–219
Slot 3:  VM IDs 221–229
...
Slot 20: VM IDs 391–399
```

Terraform workspace naming: `student-slot-01` through `student-slot-20`
Each slot uses the same scenario modules but with unique VM IDs and IPs (offset by slot).

---

## Handoff Protocol

```
PORTAL→BACKEND: API contract needed:
  Endpoint: <method> <path>
  Auth: <none/jwt/instructor-only/admin-only>
  Request: <schema>
  Response: <schema>

PORTAL→INFRA: VM slot configuration needed:
  Slot count: 20
  VM ID scheme: 200 + (slot-1)*10 + vm_index
  IP scheme: 10.10.X.Y where X = slot, Y = VM index

PORTAL→DOCS: Task complete. Generate:
  - CHANGELOG.md entry
  - docs/portal/<component>.md updated
```
