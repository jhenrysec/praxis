# Project State

**Project**: Vulnerability Testing Lab
**Last updated**: 2026-04-01 (Phase 19 complete — portal docs)
**Maintained by**: ORCHESTRATOR — update with `/status` or `/orchestrate`

---

## Phase Completion

### Lab Infrastructure (Phases 1–10)
- [ ] Phase 1: Proxmox VE 9.x base configuration
- [ ] Phase 2: ZFS storage pool and dataset setup
- [ ] Phase 3: Network bridges (vmbr0–3) + firewall default-deny
- [x] Phase 4: Packer VM template library (6 templates — code complete, awaiting ISOs + build)
- [x] Phase 5: Terraform modules (vm_clone, network_segment, scada_node) + scenario template + deploy.sh
- [x] Phase 6: Ansible roles (7 roles + 5 playbooks + ladder logic)
- [x] Phase 7: SCADA stack (OpenPLC, Ignition, GRFICSv2, InfluxDB, protocol validation)
- [x] Phase 8: Initial scenario catalog (SCEN-001 through SCEN-004)
- [x] Phase 9: Lab management UI (React dashboard — 8 components, 3 pages, 4 stores)
- [x] Phase 10: Complete documentation set (README, 6 setup guides, ATT&CK matrix, UI guide)

### Portal System (Phases 11–19)
- [x] Phase 11: Portal database — PostgreSQL migrations (7 tables) + seed + db pool + Express scaffold
- [x] Phase 12: Portal API — 8 route modules, 6 services, JWT auth, RBAC, WebSocket status feed
- [x] Phase 13: Portal UI auth — login/register, auth store, protected routes, role-based routing
- [x] Phase 14: Instructor admin dashboard — users, slots, scenarios, audit log
- [x] Phase 15: Student dashboard — scenario view, objectives, VMs, hints
- [x] Phase 16: VM console viewer — noVNC RFB wrapper, ticket flow, fullscreen
- [x] Phase 17: Curriculum materials — 20 files across 4 scenarios (lesson plans, slides, exercises)
- [x] Phase 18: Security review — 3 CRITICAL, 4 HIGH, 2 MEDIUM fixes applied
- [x] Phase 19: Portal documentation — API reference, DB schema, deployment guide, READMEs

---

## Active Tasks

| Task ID | Description | Assigned Agent | Status | Blocking |
|---|---|---|---|---|
| — | No active tasks | — | — | — |

---

## Built Templates (Phase 4 tracking)

| Template Name | Proxmox ID | Packer File | Status | Last Built |
|---|---|---|---|---|
| tpl-kali-2024 | 101 | `packer/templates/kali-2024.pkr.hcl` | ✅ Code complete | — |
| tpl-ubuntu-2404 | 102 | `packer/templates/ubuntu-2404.pkr.hcl` | ✅ Code complete | — |
| tpl-debian-12 | 103 | `packer/templates/debian-12.pkr.hcl` | ✅ Code complete | — |
| tpl-win2022 | 110 | `packer/templates/windows-server-2022.pkr.hcl` | ✅ Code complete | — |
| tpl-openplc | 150 | `packer/templates/openplc.pkr.hcl` | ✅ Code complete | — |
| tpl-ignition-dev | 151 | `packer/templates/ignition-dev.pkr.hcl` | ✅ Code complete | — |

**ISO status**: Run `./scripts/iso-manage.sh ensure-list packer/iso-requirements.txt` to verify.
Windows Server 2022 ISO requires manual download from Microsoft Eval Center.

---

## Scenario Status

| ID | Name | TF | Ansible | Docs | Curriculum | Tested |
|---|---|---|---|---|---|---|
| SCEN-001 | scada_modbus_recon | ✅ | ✅ | ✅ | ✅ | ⬜ |
| SCEN-002 | cred_access_kerberoasting | ✅ | ✅ | ✅ | ✅ | ⬜ |
| SCEN-003 | apt_lateral_movement | ✅ | ✅ | ✅ | ✅ | ⬜ |
| SCEN-004 | ics_ot_pivot | ✅ | ✅ | ✅ | ✅ | ⬜ |
| SCEN-005 | browser_exploit_cve_2026_2441 | ✅ | ✅ | ✅ | ✅ | ⬜ |

---

## Portal Documentation Status

| Document | Path | Status |
|---|---|---|
| Portal Overview | `docs/portal/PORTAL_OVERVIEW.md` | ✅ |
| Instructor Guide | `docs/portal/INSTRUCTOR_GUIDE.md` | ✅ |
| Student Guide | `docs/portal/STUDENT_GUIDE.md` | ✅ |
| API Reference | `docs/portal/API_REFERENCE.md` | ✅ |
| Database Schema | `docs/portal/DATABASE_SCHEMA.md` | ✅ |
| Deployment Guide | `docs/portal/DEPLOYMENT_GUIDE.md` | ✅ |
| Backend README | `portal-backend/README.md` | ✅ |
| Frontend README | `portal-ui/README.md` | ✅ |

---

## Security Review Summary (Phase 18)

All CRITICAL/HIGH/MEDIUM issues resolved. Key hardening:
- WebSocket `/ws/status` requires JWT auth with role-scoped broadcasts
- Proxmox credentials mandatory (no fallback defaults)
- DB SSL defaults to `rejectUnauthorized: true`
- CSP `connectSrc` restricted to `'self'`
- Rate limiting: auth 15/15min, console 10/min, global 200/min
- Audit logging on all mutations including logout and objective completion

---

## Known Issues

See `docs/KNOWN_ISSUES.md` for full details.

---

## Next Steps

1. Ensure ISOs on Proxmox: `./scripts/iso-manage.sh ensure-list packer/iso-requirements.txt`
2. Manual download: Windows Server 2022 Eval ISO from Microsoft
3. Build templates on Proxmox: `cd packer && packer init . && packer build -var-file=variables.pkrvars.hcl templates/<name>.pkr.hcl`
4. Deploy portal: run Ansible playbook for nginx + PM2 setup on management host
5. End-to-end testing: deploy a scenario, verify student flow, verify console access
6. Build SCEN-005 Ansible roles: `browser-victim-setup`, `vulnerable-webapp`, artifact staging roles
7. Build additional intel-grounded scenarios: `/intel-scenario` with a CISA advisory or ATT&CK group page
