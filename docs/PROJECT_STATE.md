# Project State

**Project**: Vulnerability Testing Lab  
**Last updated**: (update at start/end of every session)  
**Maintained by**: ORCHESTRATOR — update with `/status` or `/orchestrate`

---

## Phase Completion

- [ ] Phase 1: Proxmox VE 9.x base configuration
- [ ] Phase 2: ZFS storage pool and dataset setup
- [ ] Phase 3: Network bridges (vmbr0–3) + firewall default-deny
- [ ] Phase 4: Packer VM template library (8 templates)
- [ ] Phase 5: Terraform modules + workspace-per-scenario pattern + deploy.sh
- [ ] Phase 6: Ansible roles (common, AD, vulnerable-services, OpenPLC, Ignition)
- [ ] Phase 7: SCADA stack (OpenPLC, Ignition, GRFICSv2, InfluxDB, protocol validation)
- [ ] Phase 8: Initial scenario catalog (SCEN-001 through SCEN-004)
- [ ] Phase 9: Lab management UI (React dashboard + student portal)
- [ ] Phase 10: Complete documentation set

---

## Active Tasks

| Task ID | Description | Assigned Agent | Status | Blocking |
|---|---|---|---|---|
| — | No active tasks | — | — | — |

---

## Blocked Tasks

| Task ID | Reason | Resolution needed from |
|---|---|---|
| — | — | — |

---

## Built Templates (Phase 4 tracking)

| Template Name | Proxmox ID | Status | Last Built |
|---|---|---|---|
| tpl-kali-2024 | 101 | ⬜ Not built | — |
| tpl-win-server-2022 | 102 | ⬜ Not built | — |
| tpl-win10-workstation | 103 | ⬜ Not built | — |
| tpl-ubuntu-2204 | 110 | ⬜ Not built | — |
| tpl-debian-12 | 111 | ⬜ Not built | — |
| tpl-metasploitable3 | 120 | ⬜ Not built | — |
| tpl-openplc | 130 | ⬜ Not built | — |
| tpl-ignition-dev | 131 | ⬜ Not built | — |

---

## Scenario Status

| ID | Name | TF Ready | Ansible Ready | Docs Ready | Tested |
|---|---|---|---|---|---|
| SCEN-001 | scada_modbus_recon | ⬜ | ⬜ | ⬜ | ⬜ |
| SCEN-002 | cred_access_kerberoasting | ⬜ | ⬜ | ⬜ | ⬜ |
| SCEN-003 | apt_lateral_movement | ⬜ | ⬜ | ⬜ | ⬜ |
| SCEN-004 | ics_ot_pivot | ⬜ | ⬜ | ⬜ | ⬜ |

---

## Known Issues

See `docs/KNOWN_ISSUES.md` for full details.

| Issue ID | Summary | Severity | Status |
|---|---|---|---|
| — | — | — | — |

---

## Next Session Goals

1. Start Phase 1 — run `/phase 1` in Claude Code
2. Verify Proxmox API connectivity with `source scripts/lab-env.local.sh`
3. Confirm all tool versions match `docs/VERSION_MANIFEST.md`
