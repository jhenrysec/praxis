# Version Manifest

**Last updated**: (update on each change)  
**Maintained by**: INFRA_AGENT + DOCS_AGENT

---

## Hypervisor & Host

| Component | Version | Source | Notes |
|---|---|---|---|
| Proxmox VE | 9.1.x | proxmox.com/downloads | Verify: `pveversion` |
| Debian base | 12 (Bookworm) | Included in Proxmox ISO | |
| ZFS | 2.2.x | Included in Proxmox | Verify: `zfs version` |

---

## Infrastructure as Code

| Tool | Version | Install source | Pin command |
|---|---|---|---|
| Terraform | 1.9.x | releases.hashicorp.com | `terraform version` |
| bpg/proxmox provider | 0.66.x | registry.terraform.io | Lock: `.terraform.lock.hcl` |
| Packer | 1.11.x | releases.hashicorp.com | `packer version` |
| Packer proxmox plugin | 1.1.x | registry.packer.io | Lock: `.packer_cache` |
| Ansible Core | 2.17.x | pip install | `ansible --version` |
| ansible.windows | 2.4.x | ansible-galaxy | `ansible-galaxy collection list` |
| microsoft.ad | 1.7.x | ansible-galaxy | `ansible-galaxy collection list` |
| pywinrm | 0.4.x | pip | `pip show pywinrm` |

---

## SCADA/ICS

| Component | Version | Source |
|---|---|---|
| OpenPLC Runtime | v3 (latest) | github.com/thiagoralves/OpenPLC_v3 |
| Ignition Gateway | 8.1.x | inductiveautomation.com |
| GRFICSv2 | latest | github.com/mosse-security/grficsv2 |
| InfluxDB | 2.7.x | influxdata.com |
| Grafana | 11.x | grafana.com |
| pymodbus | 3.7.x | pip |
| open62541 (OPC-UA) | 1.3.x | github.com/open62541/open62541 |

---

## Frontend / Lab UI

| Package | Version | Pin |
|---|---|---|
| Node.js | 22.x LTS | nodejs.org |
| React | 19.x | npm |
| Vite | 6.x | npm |
| TypeScript | 5.6.x | npm |
| Tailwind CSS | 4.x | npm |
| Zustand | 5.x | npm |
| TanStack Query | 5.x | npm |
| xterm.js | 5.x | npm |
| Recharts | 2.x | npm |
| Lucide React | latest | npm |

---

## Portal Backend

| Component | Version | Source | Verify |
|---|---|---|---|
| Node.js | 22.x LTS | nodejs.org | `node --version` |
| Express | 5.0.x | npm | `npm list express` |
| PostgreSQL | 16.x | postgresql.org | `psql --version` |
| node-pg-migrate | 7.7.x | npm | `npm list node-pg-migrate` |
| jsonwebtoken | 9.0.x | npm | `npm list jsonwebtoken` |
| bcrypt | 5.1.x | npm | `npm list bcrypt` |
| zod | 3.23.x | npm | `npm list zod` |
| helmet | 8.0.x | npm | `npm list helmet` |
| express-rate-limit | 7.4.x | npm | `npm list express-rate-limit` |
| ws (WebSocket) | 8.18.x | npm | `npm list ws` |
| http-proxy-middleware | 3.0.x | npm | `npm list http-proxy-middleware` |
| PM2 | 5.x | npm global | `pm2 --version` |

## Portal UI (additions to existing frontend table)

| Component | Version | Source |
|---|---|---|
| react-router-dom | 7.0.x | npm |
| @novnc/novnc | 1.5.x | npm |
| nginx | 1.24.x | apt | `nginx -v` |

## Database

| Component | Version | Notes |
|---|---|---|
| PostgreSQL 16 | 16.x | Installed via pgdg apt repo |
| Database name | labportal | |
| DB user | labportal | password in portal-backend/.env |

# Project State

**Last updated**: (update at start/end of every session)  
**Maintained by**: ORCHESTRATOR

---

## Phase Completion

- [ ] Phase 1: Proxmox host configuration
- [ ] Phase 2: ZFS storage pools
- [ ] Phase 3: Network bridges + firewall
- [ ] Phase 4: Packer template builds
- [ ] Phase 5: Terraform modules
- [ ] Phase 6: Ansible roles
- [ ] Phase 7: SCADA stack deployment
- [ ] Phase 8: Scenario catalog (initial 4)
- [ ] Phase 9: Lab management UI
- [ ] Phase 10: Documentation set

---

## Active Tasks

| Task ID | Description | Assigned Agent | Status | Blocking |
|---|---|---|---|---|
| — | — | — | — | — |

---

## Blocked Tasks

| Task ID | Reason | Resolution needed from |
|---|---|---|
| — | — | — |

---

## Known Issues

See `docs/KNOWN_ISSUES.md` for details.

| Issue ID | Summary | Severity | Status |
|---|---|---|---|
| — | — | — | — |

---

## Next Session Goals

1. (fill in before each session)
