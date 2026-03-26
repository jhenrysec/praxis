# Lab Portal — Overview and Architecture

**Maintained by**: DOCS_AGENT  
**Components**: portal-backend (Express API) · portal-ui (React) · PostgreSQL 16  
**Access URL**: http://172.16.0.10:3000

---

## What the Portal Does

The Lab Portal is the primary interface for instructors and students to interact with the
vulnerability lab. It replaces command-line management for day-to-day classroom operations.

| Role | What they can do |
|---|---|
| **admin** | Everything below, plus system config, create instructor accounts, view all audit logs |
| **instructor** | Register students, approve accounts, deploy/destroy/reset any student lab, view any VM console, send hints, manage all 20 slots |
| **student** | Self-register, view their assigned scenario and objectives, connect to their own VMs, receive hints |

---

## Architecture

```
Management Network (172.16.0.0/24)
│
├── portal-ui        — React SPA, port 3000 (served by nginx)
├── portal-backend   — Express API, port 4000 (PM2)
├── PostgreSQL 16    — port 5432 (local only, no external access)
└── Proxmox API      — port 8006 (portal-backend calls this)

portal-ui ──HTTP──▶ nginx :3000
                        │
                        ├── /api/*  ──proxy──▶ portal-backend :4000
                        └── /novnc-proxy/* ──ws-proxy──▶ portal-backend :4000
                                                              │
                                                              └── Proxmox VNC WebSocket
```

---

## Quick Start

### First-Time Setup (run after Phase 3 — network bridges must be up)

```bash
# In Claude Code:
/portal-build

# This runs all portal build phases in order:
# 1. PostgreSQL + migrations + seed
# 2. Backend API (Express)
# 3. Portal UI (React)
# 4. Ansible deploy (nginx + PM2)
# 5. Security review
# 6. Documentation
```

### Manual Setup Steps

```bash
# 1. Install and configure the database
cd ~/vuln-lab
source scripts/lab-env.local.sh
ansible-playbook ansible/site.yml --tags lab-database

# 2. Configure portal-backend credentials
cp portal-backend/.env.example portal-backend/.env
# Edit portal-backend/.env — set DATABASE_URL, JWT_SECRET, Proxmox creds
openssl rand -hex 64  # use this output as JWT_SECRET

# 3. Run migrations and seed
cd portal-backend
npm install
npm run migrate
npm run seed  # creates admin@lab.local / ChangeMe123!@#

# 4. Deploy portal-backend and portal-ui
cd ~/vuln-lab
ansible-playbook ansible/site.yml --tags lab-portal
```

### First Login

1. Navigate to `http://172.16.0.10:3000`
2. Log in as `admin@lab.local` with password from seed output
3. **Change the admin password immediately**: Admin → Profile → Change Password
4. Create instructor accounts: Admin → Users → Add User → role: instructor

---

## User Registration Flow

### Student Self-Registration (if AUTO_APPROVE_STUDENTS=false)

```
Student navigates to /register
      ↓
Fills out form (name, email, username, password, student ID)
      ↓
Account created with status = 'pending'
      ↓
Instructor sees pending badge on Users page
      ↓
Instructor approves → status = 'active', next available slot assigned
      ↓
Student can now log in and access their dashboard
```

### Instructor-Created Student Account

```
Instructor → Admin → Users → Add User
      ↓
Fills out form, assigns role = student
      ↓
Account created with status = 'active', slot assigned immediately
      ↓
Instructor provides credentials to student directly
```

---

## 20-Slot Management

Each of the 20 student slots is independent:

| Property | Value |
|---|---|
| VM IDs | Slot N: IDs 200+(N-1)×10 through 200+(N-1)×10+9 |
| Red zone IPs | Slot N: 10.10.(N×2-1).0/24 |
| Blue zone IPs | Slot N: 10.10.(N×2).0/24 |
| OT zone IPs | Slot N: 192.168.(100+N).0/24 |
| VLAN | Slot N: VLAN 100+N (prevents cross-student traffic) |
| TF workspace | student-slot-01 through student-slot-20 |

The Admin → Lab Slots page shows all 20 slots as a grid with live status.

---

## VM Console Access

Instructors can view any VM in the environment. Students can only view their assigned VMs.

**Connection flow:**
1. Click "Console" on any VM card
2. Portal requests a VNC ticket from the backend
3. Backend verifies permissions, gets ticket from Proxmox API
4. noVNC connects via WebSocket proxy (credentials never reach the browser)
5. Console renders in a full-page view with toolbar (fullscreen, clipboard, disconnect)

**Instructor multi-monitor view:** Admin → Console Monitor shows all running student VMs
in a grid. Click any to expand it to full view.

---

## Maintenance

### Reset a student's lab between groups
```bash
# Via portal: Admin → Lab Slots → Slot N → Reset to Baseline
# Via CLI:
./scripts/reset-scenario.sh <scenario_name>
```

### View audit log
Admin → Audit Log — shows all instructor/admin actions with timestamp, actor, and target.

### Restart portal-backend
```bash
pm2 restart portal-backend
pm2 logs portal-backend  # view logs
```
