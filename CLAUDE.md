# Higher Echelon Vulnerability Lab — Claude Code Project Memory

## Project Identity
- **Project**: Cybersecurity vulnerability testing lab — Proxmox VE 8.x
- **Operator**: Jason — Cyberspace Response Assessment Instructor, Higher Echelon, Inc.
- **Model for coding tasks**: claude-opus-4-6
- **Context**: Authorized training lab only. No real production credentials. No live networks.

## Stack at a Glance
- Hypervisor: Proxmox VE 8.3+ on Dell Precision 5820 (64GB RAM, 4TB ZFS)
- IaC: Terraform >= 1.9 + bpg/proxmox provider >= 0.66
- Templates: Packer >= 1.11 + proxmox-iso builder
- Config mgmt: Ansible Core >= 2.17
- SCADA: OpenPLC Runtime v3, Ignition 8.1.x (dev), GRFICSv2, InfluxDB 2.7
- Lab UI: React 19 + Vite 6 + TypeScript + Tailwind CSS 4
- Networks: vmbr0=mgmt(172.16.0.0/24) vmbr1=red(10.10.1.0/24) vmbr2=blue(10.10.2.0/24) vmbr3=ot(192.168.100.0/24)

## Non-Negotiable Rules
- No placeholders — all code must be complete and runnable
- Pin every version explicitly — no `latest` tags
- Every completed task triggers a CHANGELOG.md entry + docs update
- All secrets via env vars — never hardcoded, never committed
- All code must be idempotent (safe to run twice)
- Intentional vulnerabilities must be ATT&CK-mapped and documented in scenario cards
- Management plane (vmbr0) must never be reachable from lab segments

## Agent Routing — use these slash commands
- `/infra` — Proxmox, Terraform, Packer, Ansible tasks
- `/scada` — ICS/OT, protocols, OpenPLC, Ignition, GRFICSv2
- `/frontend` — Lab UI, dashboards, React components
- `/security` — Hardening, CVE mapping, firewall policy, ATT&CK coverage
- `/docs` — Changelogs, scenario cards, reference docs
- `/orchestrate` — Multi-phase tasks, dependency resolution, phase gates

## Build Order (never skip phases)
1. Proxmox host config → 2. ZFS pools → 3. Network bridges + firewall
4. Packer templates → 5. Terraform modules → 6. Ansible roles
7. SCADA stack → 8. Scenario catalog → 9. Lab UI → 10. Docs

## Key File Paths (reference with @path)
- @agents/INFRA_AGENT.md — infrastructure agent persona
- @agents/SCADA_AGENT.md — ICS/OT agent persona
- @agents/FRONTEND_AGENT.md — UI agent persona
- @agents/SECURITY_AGENT.md — security agent persona
- @agents/DOCS_AGENT.md — documentation agent persona
- @skills/PROXMOX_SKILL.md — Proxmox CLI/config reference
- @skills/TERRAFORM_SKILL.md — bpg/proxmox provider patterns
- @skills/SCADA_SKILL.md — protocol reference and tooling
- @skills/PACKER_ANSIBLE_SKILL.md — template and role patterns
- @skills/FRONTEND_SKILL.md — React/Vite component patterns
- @docs/VERSION_MANIFEST.md — all pinned versions
- @CHANGELOG.md — all changes

## VM ID Allocation
- 100–149: Templates  |  200–249: Active scenario VMs
- 300–349: Infra VMs (pfSense, API)  |  900–999: Scratch

## Quality Gates (required before any phase is "done")
- [ ] terraform plan applies from cold state with zero errors
- [ ] All expected network paths verified, blocked paths confirmed blocked
- [ ] All ICS protocols respond to test clients
- [ ] All VMs have named baseline snapshot
- [ ] CHANGELOG.md and relevant docs are current
- [ ] SECURITY_AGENT has reviewed exposed services
