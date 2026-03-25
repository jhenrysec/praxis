# Changelog

All notable changes to the Vulnerability Lab are documented here.

Format per entry: `[YYYY-MM-DD] — [AGENT] — [TYPE] — Description`  
Types: `ADD` | `CHANGE` | `FIX` | `REMOVE` | `SECURITY` | `DOCS`

---

## [Unreleased]

*(Entries move here first, then to a dated section on release/phase completion)*

---

## Template Entry Reference

```
## [YYYY-MM-DD] — INFRA_AGENT — ADD
- Added Terraform module `modules/vm_clone` — linked-clone, cloud-init, qemu-agent
- Pinned bpg/proxmox provider to 0.66.3 in .terraform.lock.hcl
- Verified: terraform plan completes cleanly against pve01

## [YYYY-MM-DD] — SECURITY_AGENT — SECURITY
- Enabled Proxmox datacenter + node firewall; default INPUT/FORWARD policy: DROP
- Added explicit allow: TCP/8006 and TCP/22 from 172.16.0.0/24 only
- Verified: web UI and SSH accessible from mgmt subnet; blocked from vmbr1

## [YYYY-MM-DD] — SCADA_AGENT — ADD
- Built OpenPLC Runtime v3 Packer template: tpl-openplc on pve01
- Loaded tank_fill_control.st; Modbus TCP verified on port 502
- Register map: docs/scada/registers/openplc_REGISTER_MAP.md

## [YYYY-MM-DD] — FRONTEND_AGENT — ADD
- Scaffolded lab-ui with React 19 + Vite 6 + TypeScript
- Implemented ScenarioCard, StatusBadge, Terminal components
- API client connected to backend /api/scenarios and /api/deploy/:id

## [YYYY-MM-DD] — DOCS_AGENT — DOCS
- Created SCENARIO_CARD.md for SCEN-001 (scada_modbus_recon)
- Updated ATT&CK_COVERAGE.md with T0836, T0846 coverage
- Updated VERSION_MANIFEST.md with current tool versions
```
