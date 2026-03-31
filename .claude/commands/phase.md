# /phase — Build a Complete Phase

Execute a full build phase with all agents coordinated.

Phase requested: $ARGUMENTS
(Pass a number 1-10 or a phase name like "proxmox" or "packer-templates")

## Phase Map
- 1 or "proxmox" → /infra "Configure Proxmox VE 9.x base: package repos, ZFS pool, four network bridges, API token for Terraform"
- 2 or "storage" → /infra "Configure ZFS datasets: labdata/templates, labdata/scenarios, labdata/backups with lz4 compression"
- 3 or "network" → /infra "Configure SDN zones and bridges vmbr1-3" then /security "Review firewall baseline and default-deny policy"
- 4 or "packer" → First run `./scripts/check-isos.sh` to verify all ISOs are available. If any are missing and auto-downloadable, run `./scripts/check-isos.sh --download --upload`. If any require manual download, STOP and print instructions. Once all ISOs are confirmed: /infra "Build all Packer templates: Kali 2024, Windows Server 2022, Ubuntu 24.04, Debian 12, OpenPLC, Ignition dev"
- 5 or "terraform" → /infra "Build Terraform modules: vm_clone, network_segment, scada_node. Build workspace-per-scenario pattern and deploy.sh"
- 6 or "ansible" → /infra "Build Ansible roles: common-linux, common-windows, ad-domain-controller, ad-member-workstation, vulnerable-services, openplc-configure, ignition-configure"
- 7 or "scada" → /scada "Deploy full SCADA stack: OpenPLC Runtime + tank_fill_control program, Ignition 8.1 dev mode, GRFICSv2 containers, InfluxDB historian, protocol validation for all 5 protocols"
- 8 or "scenarios" → /orchestrate "Build initial scenario catalog: scada_modbus_recon, cred_access_kerberoasting, apt_lateral_movement, ics_ot_pivot. For each scenario, run /dedup-check and write MANIFEST.yaml after build."
- 9 or "ui" → /frontend "Build lab-ui: Scenario deployment dashboard with deploy/destroy buttons, live VM status panel, terminal output streaming, network topology SVG"
- 10 or "docs" → /docs "Generate complete documentation set: README.md, all setup guides, scenario cards for all 4 scenarios, ATT&CK coverage matrix"

## Portal Phases (run after Phase 3)
- 11 or "portal-db" → /portal-build "backend" — PostgreSQL + migrations + seed
- 12 or "portal-api" → /portal-build "backend" — Express API with all routes
- 13 or "portal-auth" → /portal-build "auth" — Portal UI auth layer
- 14 or "portal-admin" → /portal-build "admin" — Instructor admin dashboard
- 15 or "portal-student" → /portal-build "student" — Student dashboard
- 16 or "portal-console" → /portal-build "console" — VM console viewer (noVNC)

## Curriculum Phase (run after Phase 8)
- 17 or "curriculum" → /curriculum "Generate teaching materials for all built scenarios: lesson plans, slides, exercises, rubrics"

After each phase: verify quality gates from CLAUDE.md, then update PROJECT_STATE.md.
