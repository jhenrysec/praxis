# Higher Echelon Vulnerability Lab — Claude Code Project Memory

## Project Identity
- **Project**: Cybersecurity vulnerability testing lab + student/instructor portal
- **Operator**: Jason — Cyberspace Response Assessment Instructor, Higher Echelon, Inc.
- **Model for coding tasks**: claude-opus-4-6
- **Context**: Authorized training lab only. No real production credentials. No live networks.
- **Capacity**: 20 simultaneous student slots

## Stack at a Glance
- Hypervisor: Proxmox VE 8.3+ on Dell Precision 5820 (64GB RAM, 4TB ZFS)
- IaC: Terraform >= 1.9 + bpg/proxmox provider >= 0.66
- Templates: Packer >= 1.11 + proxmox-iso builder
- Config mgmt: Ansible Core >= 2.17
- SCADA: OpenPLC Runtime v3, Ignition 8.1.x (dev), GRFICSv2, InfluxDB 2.7
- Lab UI: React 19 + Vite 6 + TypeScript + Tailwind CSS 4 (scenario dashboard)
- Portal Backend: Node.js 22 + Express 5 + TypeScript + PostgreSQL 16 (JWT auth, RBAC)
- Portal UI: React 19 + Vite 6 + TypeScript + Tailwind CSS 4 (student/instructor portal)
- Console: noVNC proxied through portal-backend WebSocket
- Networks: vmbr0=mgmt(172.16.0.0/24) vmbr1=red(10.10.x.0/24) vmbr2=blue(10.10.x.0/24) vmbr3=ot(192.168.x.0/24)
  Note: x = slot number (1-20) for per-student VLAN isolation

## Non-Negotiable Rules
- No placeholders — all code must be complete and runnable
- Pin every version explicitly — no `latest` tags
- Every completed task triggers a CHANGELOG.md entry + docs update
- All secrets via env vars — never hardcoded, never committed
- All code must be idempotent (safe to run twice)
- Intentional vulnerabilities must be ATT&CK-mapped and documented
- Management plane (vmbr0) must never be reachable from lab segments
- JWT access tokens in memory only (never localStorage)
- All SQL uses parameterized queries — zero string interpolation
- bcrypt cost factor 12 minimum for all password hashing
- Audit log entry for every instructor/admin action

## Agent Routing — use these slash commands
- `/infra`        — Proxmox, Terraform, Packer, Ansible tasks
- `/scada`        — ICS/OT, protocols, OpenPLC, Ignition, GRFICSv2
- `/frontend`     — Lab UI scenario dashboard (React)
- `/portal`       — Student/instructor portal UI (React)
- `/backend`      — API server, database, auth, Proxmox integration
- `/security`     — Hardening, CVE mapping, firewall policy, ATT&CK coverage
- `/docs`         — Changelogs, scenario cards, reference docs
- `/orchestrate`  — Multi-phase tasks, dependency resolution
- `/portal-build` — Full portal system build (all layers in order)

## Build Order (never skip phases)
### Lab Infrastructure (Phases 1-10)
1. Proxmox host config → 2. ZFS pools → 3. Network bridges + firewall
4. Packer templates → 5. Terraform modules (slot-aware) → 6. Ansible roles
7. SCADA stack → 8. Scenario catalog → 9. Lab UI → 10. Docs

### Portal System (Phases 11-16 — run after Phase 3)
11. PostgreSQL database + migrations → 12. Backend API (Express + auth + RBAC)
13. Portal UI auth layer → 14. Instructor admin dashboard
15. Student dashboard → 16. VM console viewer (noVNC)
17. Integration wiring (Ansible deploy) → 18. Security review → 19. Portal docs

## Key File Paths (reference with @path)
- @agents/INFRA_AGENT.md, @agents/SCADA_AGENT.md, @agents/FRONTEND_AGENT.md
- @agents/PORTAL_AGENT.md, @agents/BACKEND_AGENT.md
- @agents/SECURITY_AGENT.md, @agents/DOCS_AGENT.md
- @skills/PROXMOX_SKILL.md, @skills/TERRAFORM_SKILL.md
- @skills/SCADA_SKILL.md, @skills/PACKER_ANSIBLE_SKILL.md
- @skills/FRONTEND_SKILL.md, @skills/PORTAL_SKILL.md, @skills/BACKEND_SKILL.md
- @docs/VERSION_MANIFEST.md, @CHANGELOG.md

## 20-Slot Architecture
- VM IDs: slot N uses IDs 200+(N-1)*10 through 200+(N-1)*10+9
- VLANs: each slot gets isolated VLAN (101-120) on vmbr1/vmbr2/vmbr3
- TF workspaces: student-slot-01 through student-slot-20
- IP scheme: red=10.10.(N*2-1).x blue=10.10.(N*2).x ot=192.168.(100+N).x

## Roles and Permissions
- admin: full access + system config + audit logs
- instructor: all student mgmt + deploy/destroy + any VM console + lab build
- student: self-register + own lab view + own VM consoles + objectives

## Quality Gates (required before any phase is "done")
- [ ] terraform plan applies from cold state with zero errors
- [ ] All expected network paths verified, blocked paths confirmed blocked
- [ ] All ICS protocols respond to test clients
- [ ] All VMs have named baseline snapshot
- [ ] Backend: npm run build — zero TypeScript errors
- [ ] Frontend/Portal: npm run build — zero TypeScript errors
- [ ] All admin routes protected server-side (not just client-side)
- [ ] CHANGELOG.md and relevant docs are current
- [ ] SECURITY_AGENT has reviewed exposed services
