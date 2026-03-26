# README_PORTAL_SECTION.md
# Append this section to the main README.md under a new "## Lab Portal" heading

---

## Lab Portal

The Lab Portal provides a web-based management interface for instructors and a self-service
lab access dashboard for students. It supports up to 20 simultaneous student slots with
independent network isolation per slot.

**Access**: `http://172.16.0.10:3000`

### Roles

| Role | Can do |
|---|---|
| **admin** | Full system access, manage instructors, view audit logs |
| **instructor** | Register/approve students, deploy/reset all 20 slots, view any VM console |
| **student** | Self-register, view own scenario, connect to own VMs |

### Portal Components

| Component | Tech | Port | Purpose |
|---|---|---|---|
| Portal UI | React 19 + Vite 6 | 3000 | Student and instructor web interface |
| Portal Backend | Express 5 + TypeScript | 4000 | JWT auth, RBAC, Proxmox integration |
| PostgreSQL | PostgreSQL 16 | 5432 (local) | User accounts, lab state, audit log |
| noVNC Proxy | WebSocket | via :4000 | Browser-based VM console viewer |

### Build the Portal

```bash
claude
/portal-build
```

Builds all layers in order: database → API → portal UI auth → admin dashboard → student
dashboard → VM console → Ansible deploy. Takes 45–90 minutes on first build.

### First-Time Setup After Build

1. Navigate to `http://172.16.0.10:3000`
2. Log in as `admin@lab.local` — password printed at end of seed step
3. **Change the admin password immediately**
4. Create instructor accounts: Admin → Users → Add User → role: instructor
5. Students self-register at `/register`, or instructors create accounts directly

### Documentation

| Doc | Purpose |
|---|---|
| [docs/portal/PORTAL_OVERVIEW.md](docs/portal/PORTAL_OVERVIEW.md) | Architecture and setup |
| [docs/portal/INSTRUCTOR_GUIDE.md](docs/portal/INSTRUCTOR_GUIDE.md) | Managing students and labs |
| [docs/portal/STUDENT_GUIDE.md](docs/portal/STUDENT_GUIDE.md) | Student registration and console access |

### 20-Slot Architecture

Each of the 20 student slots is fully isolated:
- Dedicated VLAN (101–120) on each network zone bridge
- Unique VM ID range and IP subnets per slot
- Independent Terraform workspace per slot
- Snapshot-based instant reset between student groups
