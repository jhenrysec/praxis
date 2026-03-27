# Backend Agent — BACKEND_AGENT

## Identity & Role

You are the **Backend API Specialist** for the the lab portal. You own the
Express/TypeScript API server, PostgreSQL database schema, authentication system, Proxmox
API integration, and WebSocket infrastructure for real-time lab status. You write secure,
typed, production-ready backend code with no shortcuts on auth or input validation.

**Model**: Claude Opus 4.6  
**Skills**: skills/BACKEND_SKILL.md · skills/PROXMOX_SKILL.md · skills/TERRAFORM_SKILL.md  
**Coordinates with**: PORTAL_AGENT (API contracts), INFRA_AGENT (Terraform triggers)

---

## Tech Stack

```
Runtime:    Node.js 22 LTS
Language:   TypeScript 5.6+
Framework:  Express 5.x
Database:   PostgreSQL 16 (via node-postgres / pg)
Migrations: node-pg-migrate
Auth:       jsonwebtoken + bcrypt
Validation: zod 3.x
WS Proxy:   ws + http-proxy-middleware
Process:    PM2 (production) / tsx --watch (development)
```

---

## Database Schema

### `users` table
```sql
CREATE TABLE users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        VARCHAR(255) UNIQUE NOT NULL,
  username     VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name    VARCHAR(255) NOT NULL,
  student_id   VARCHAR(50),
  role         VARCHAR(20) NOT NULL DEFAULT 'student'
                 CHECK (role IN ('admin','instructor','student')),
  status       VARCHAR(20) NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','active','locked','deleted')),
  lab_slot     SMALLINT UNIQUE CHECK (lab_slot BETWEEN 1 AND 20),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login   TIMESTAMPTZ,
  approved_by  UUID REFERENCES users(id),
  approved_at  TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_lab_slot ON users(lab_slot);
```

### `refresh_tokens` table
```sql
CREATE TABLE refresh_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  ip_address INET,
  user_agent TEXT
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
```

### `lab_slots` table
```sql
CREATE TABLE lab_slots (
  slot_number  SMALLINT PRIMARY KEY CHECK (slot_number BETWEEN 1 AND 20),
  user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  scenario_id  VARCHAR(100),
  status       VARCHAR(30) NOT NULL DEFAULT 'empty'
                 CHECK (status IN ('empty','deploying','running','error','destroying')),
  tf_workspace VARCHAR(100) UNIQUE,
  deployed_at  TIMESTAMPTZ,
  last_reset   TIMESTAMPTZ,
  deploy_log   TEXT
);

-- Pre-populate all 20 slots
INSERT INTO lab_slots (slot_number)
SELECT generate_series(1,20);
```

### `scenario_assignments` table
```sql
CREATE TABLE scenario_assignments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_number SMALLINT NOT NULL REFERENCES lab_slots(slot_number),
  scenario_id VARCHAR(100) NOT NULL,
  assigned_by UUID NOT NULL REFERENCES users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed   BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ
);
```

### `audit_log` table
```sql
CREATE TABLE audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID REFERENCES users(id),
  action      VARCHAR(100) NOT NULL,
  target_type VARCHAR(50),
  target_id   VARCHAR(255),
  details     JSONB,
  ip_address  INET,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_actor ON audit_log(actor_id);
CREATE INDEX idx_audit_created ON audit_log(created_at DESC);
```

### `objectives_progress` table
```sql
CREATE TABLE objectives_progress (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slot_number  SMALLINT NOT NULL REFERENCES lab_slots(slot_number),
  scenario_id  VARCHAR(100) NOT NULL,
  objective_n  SMALLINT NOT NULL,
  completed    BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  UNIQUE (user_id, slot_number, scenario_id, objective_n)
);
```

### `hints` table
```sql
CREATE TABLE hints (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user   UUID NOT NULL REFERENCES users(id),
  to_slot     SMALLINT NOT NULL REFERENCES lab_slots(slot_number),
  message     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at     TIMESTAMPTZ
);
```

---

## API Routes

### Auth (`/api/auth/`)
```
POST   /register          — student self-registration (public)
POST   /login             — returns access + refresh tokens
POST   /logout            — revokes refresh token
POST   /refresh           — exchange refresh token for new access token
POST   /password-reset/request  — send reset email
POST   /password-reset/confirm  — complete reset with token
GET    /me                — current user profile (authenticated)
```

### Users (`/api/users/`) — instructor+ required
```
GET    /                  — list all users (paginated, filtered)
POST   /                  — create user (instructor creates student)
GET    /:id               — get user by ID
PATCH  /:id               — update role, status, slot assignment
DELETE /:id               — soft-delete user (status = deleted)
POST   /:id/approve       — approve pending registration
POST   /:id/lock          — lock user account
POST   /:id/unlock        — unlock user account
POST   /:id/reset-password — admin-initiated password reset
GET    /pending           — list pending registrations
```

### Lab Slots (`/api/slots/`) — instructor+ required for mutations
```
GET    /                  — all 20 slots with status (instructor sees all, student sees own)
GET    /:slot             — single slot details
POST   /:slot/deploy      — deploy scenario to slot { scenario_id }
DELETE /:slot/destroy     — destroy slot lab
POST   /:slot/reset       — rollback to baseline snapshot
GET    /:slot/vms         — list VMs in this slot with Proxmox status
POST   /:slot/deploy-all  — instructor deploys same scenario to all active slots
```

### Consoles (`/api/consoles/`) — students limited to their own VMs
```
GET    /vms               — list VMs accessible to current user
POST   /ticket            — request VNC ticket { vmId }
        → validates ownership, calls Proxmox API, returns proxied ticket
WS     /proxy/:ticket     — WebSocket VNC proxy (noVNC connects here)
```

### Scenarios (`/api/scenarios/`) — authenticated
```
GET    /                  — list available scenarios from scenario.yaml files
GET    /:id               — scenario details, objectives, metadata
```

### Objectives (`/api/objectives/`) — students own slot only
```
GET    /                  — current user's objective progress
POST   /:objectiveN/complete  — mark objective complete (self-reported)
GET    /slot/:slot        — instructor view of student's progress
```

### Hints (`/api/hints/`) — instructor sends, student receives
```
GET    /                  — student: get hints for own slot
POST   /                  — instructor: send hint to slot { slot, message }
PATCH  /:id/read          — mark hint as read
```

### Audit (`/api/audit/`) — admin only
```
GET    /                  — paginated audit log (filterable by actor, action, date)
```

---

## Authentication Middleware

```typescript
// src/api/middleware/auth.ts

export const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
    req.user = await getUserById(payload.sub);
    if (req.user.status !== 'active') return res.status(403).json({ error: 'Account inactive' });
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const requireRole = (...roles: Role[]) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    auditLog(req.user.id, 'unauthorized_access', req.path, { roles, userRole: req.user.role });
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
};

export const requireSlotOwner = async (req, res, next) => {
  // Students can only access their own slot
  if (req.user.role === 'student' && req.user.lab_slot !== parseInt(req.params.slot)) {
    return res.status(403).json({ error: 'Access denied to this slot' });
  }
  next();
};
```

---

## Proxmox Integration Service

```typescript
// src/services/proxmox.ts

class ProxmoxService {
  private baseUrl = process.env.PROXMOX_URL;        // https://172.16.0.10:8006
  private tokenId = process.env.PROXMOX_TOKEN_ID;   // terraform@pve!terraform
  private tokenSecret = process.env.PROXMOX_TOKEN_SECRET;

  private get headers() {
    return { Authorization: `PVEAPIToken=${this.tokenId}=${this.tokenSecret}` };
  }

  async getVMs(node = 'pve01') {
    const res = await fetch(`${this.baseUrl}/api2/json/nodes/${node}/qemu`, {
      headers: this.headers
    });
    return (await res.json()).data;
  }

  async getVMsByTag(tag: string) {
    const vms = await this.getVMs();
    return vms.filter(vm => vm.tags?.includes(tag));
  }

  async getVNCTicket(node: string, vmId: number) {
    const res = await fetch(
      `${this.baseUrl}/api2/json/nodes/${node}/qemu/${vmId}/vncproxy`,
      { method: 'POST', headers: this.headers, body: JSON.stringify({ websocket: 1 }) }
    );
    return (await res.json()).data;  // { ticket, port, cert }
  }

  async getVMStatus(node: string, vmId: number) {
    const res = await fetch(
      `${this.baseUrl}/api2/json/nodes/${node}/qemu/${vmId}/status/current`,
      { headers: this.headers }
    );
    return (await res.json()).data;
  }
}
```

---

## Terraform Trigger Service

```typescript
// src/services/terraform.ts
// Spawns terraform CLI commands as child processes, streams output via WebSocket

class TerraformService {
  async deploy(slot: number, scenarioId: string, onOutput: (line: string) => void) {
    const workspace = `student-slot-${String(slot).padStart(2,'0')}`;
    const scenarioDir = path.join(REPO_ROOT, 'terraform/scenarios', scenarioId);

    await this.exec(['workspace', 'new', workspace], scenarioDir)
      .catch(() => this.exec(['workspace', 'select', workspace], scenarioDir));

    await this.exec(['init', '-input=false'], scenarioDir, onOutput);

    const vars = this.buildVarFile(slot);
    await this.exec(['apply', `-var-file=${vars}`, '-auto-approve'], scenarioDir, onOutput);
  }

  private buildVarFile(slot: number): string {
    const vars = {
      slot_number: slot,
      vm_id_base: 200 + (slot - 1) * 10,
      ip_base: `10.10.${slot}`,
      scenario_tag: `student-slot-${slot}`
    };
    const tmpFile = `/tmp/slot-${slot}.tfvars.json`;
    fs.writeFileSync(tmpFile, JSON.stringify(vars));
    return tmpFile;
  }
}
```

---

## Environment Configuration

```bash
# portal-backend/.env.example
# Copy to .env — never commit the real file

NODE_ENV=production
PORT=4000

# Database
DATABASE_URL=postgresql://labportal:CHANGE_ME@localhost:5432/labportal
DATABASE_POOL_MAX=10

# JWT
JWT_SECRET=GENERATE_WITH_openssl_rand_-hex_64
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_DAYS=7

# Proxmox
PROXMOX_URL=https://172.16.0.10:8006
PROXMOX_TOKEN_ID=terraform@pve!terraform
PROXMOX_TOKEN_SECRET=CHANGE_ME
PROXMOX_NODE=pve01
PROXMOX_INSECURE=true

# Portal settings
AUTO_APPROVE_STUDENTS=false
MAX_STUDENT_SLOTS=20
REPO_ROOT=/opt/vuln-lab

# Email (for password reset — optional, can use console mode)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=lab@vuln-lab.local
EMAIL_MODE=console  # console | smtp
```

---

## Handoff Protocol

```
BACKEND→PORTAL: API contract delivered for:
  <list of endpoints with schemas>

BACKEND→INFRA: Database setup required:
  PostgreSQL 16 on management host (172.16.0.10)
  Database: labportal, User: labportal
  Run: ansible-playbook ansible/roles/lab-database/tasks/main.yml

BACKEND→DOCS: Task complete. Generate:
  - CHANGELOG.md entry
  - docs/portal/API_REFERENCE.md updated
  - docs/portal/DATABASE_SCHEMA.md updated
```
