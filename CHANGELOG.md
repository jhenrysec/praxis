# Changelog

All notable changes to the Vulnerability Lab are documented here.

Format per entry: `[YYYY-MM-DD] — [AGENT] — [TYPE] — Description`  
Types: `ADD` | `CHANGE` | `FIX` | `REMOVE` | `SECURITY` | `DOCS`

---

## [Unreleased]

*(Entries move here first, then to a dated section on release/phase completion)*

## [2026-04-07] — INFRA_AGENT — FIX — SCEN-005 End-to-End Lifecycle Test

### Fixes
- **terraform.ts**: Added `resolveScenarioDir()` — resolves scenario IDs in any format (`SCEN-005`, `browser_exploit_cve_2026_2441`, or full directory name) against unified `scenarios/` structure with backward-compat symlink fallback
- **browser-exploit.yml**: Fixed Ansible host group mismatch — `hosts: attacker` → `hosts: attackers` to match inventory `[attackers]` group
- **auto-browse.service.j2**: Fixed X display access failure — service now runs as `labuser` (not root) with `XAUTHORITY` and `DBUS_SESSION_BUS_ADDRESS` env vars; added `ExecStartPre=/bin/sleep 10` for lightdm startup race
- **auto-browse.sh.j2**: Removed `su - labuser` wrapper (redundant now that service runs as labuser); replaced infinite `while` display wait with bounded 30-attempt loop; chromium now runs directly without shell wrapper

### Infrastructure Fixes
- **vm_clone module**: Removed conflicting `ide2` cloud-init disk block — templates already have cloud-init on `ide0`; the extra disk caused `you can't resize a cdrom` errors during clone
- Cleaned up 15 orphaned VMs from previous scenarios (SCEN-001 through SCEN-004) that were blocking VMID reuse

### End-to-End Lifecycle Test (Deploy → Test → Destroy)
- **Deploy** (slot 1): `terraform apply` — 3 VMs created in 34 seconds (linked clones from templates 101, 102)
- **Ansible configure**: playbook `browser-exploit.yml` — 76 tasks, zero failures across all 3 hosts
- **Student test — network recon**: nmap discovers webapp (10.10.2.20:3000) and victim (10.10.2.30) from attacker
- **Student test — T1539 verified**: `POST /api/auth/login` returns `nexustrack_token` and `nexustrack_session` cookies without HttpOnly flag; stolen cookies grant full API access (5 client projects, user identity)
- **Student test — session replay**: attacker at 10.10.2.10 accesses `/api/projects` with stolen cookies — 200 OK with full project data
- **Forensic artifacts validated** (all deployed by Ansible):
  - IOC-001: `~/.config/chromium/Crashpad/reports/crash_report_sim.dmp` — CSSFontFeatureValuesMap use-after-free stack trace
  - IOC-002: `~/artifacts/network_capture.pcap` — scapy-generated PCAP
  - IOC-003: `/var/log/webapp/access.log` — pre-staged session replay entries (python-requests UA from 10.10.1.10) + live entries from auto-browse
  - IOC-004: `~/.config/chromium/Default/History` — 7 SQLite entries with exploit page visit embedded
- **Auto-browse service**: active and cycling (Chromium opens URLs, types credentials on login forms)
- **Phishing template**: deployed at `/home/labuser/payloads/phishing_template.txt` on attacker
- **Destroy**: `terraform destroy` — all 3 VMs removed; Proxmox verified clean (only templates + mgmt remain)

## [2026-04-06] — BACKEND_AGENT — FIX — Code Review: Functionality and Security Fixes

### Priority 1 — Functionality Fixes
- **scenarios.ts**: Fixed `SCENARIOS_DIR` from `terraform/scenarios` (old path) to `scenarios` (unified structure)
- **scenarios.ts**: Fixed YAML field mapping — `estimated_hours` from scenario.yaml now correctly maps to `duration_hours` in `ScenarioMeta`
- **email.ts**: Fixed infinite recursion when `EMAIL_MODE` is not `console` — fallback now sets mode to `console` instead of recursing
- **package.json**: Fixed seed script path from `tsx database/seeds/seed.ts` to `tsx seeds/seed.ts` (file is at `seeds/seed.ts`)
- **lab-ui/api/client.ts**: Fixed response unwrapping — backend returns `{ scenarios: [...] }`, `{ slots: [...] }`, `{ vms: [...] }` wrappers; client now unwraps correctly
- **lab-ui/api/client.ts**: Added JWT auth header support (`Authorization: Bearer <token>`)
- **lab-ui/api/client.ts**: Fixed WebSocket URL to use `/ws/status` with token query param instead of non-existent `/ws/deploy/:slot`
- **lab-ui/api/client.ts**: Removed non-existent `/vms` and `/slots/:slot/access-sheet` endpoints
- **VncViewer.tsx**: Fixed `isAllowedWsUrl` rejecting all VNC connections — backend returns direct `wss://` URLs to Proxmox (port 8006), which never matched `window.location.host`; now allows Proxmox API paths

### Priority 2 — Security Fixes
- **users.ts PATCH**: Replaced dynamic SQL column interpolation (`${key} = $N`) with explicit column whitelist (`ALLOWED_COLUMNS` map) — prevents column name injection even though Zod constrains the input shape
- **slots.ts POST deploy**: Eliminated TOCTOU race condition — replaced separate SELECT + UPDATE with atomic `UPDATE ... WHERE status IN ('empty', 'error') RETURNING *`; concurrent deploy requests now safely fail instead of both proceeding
- **authStore.ts**: Fixed token refresh race — interval-based refresh now routes through `apiClient.scheduledRefresh()` which uses the same dedup guard (`refreshPromise`) as 401-triggered refreshes, preventing both from rotating the token simultaneously

### Build Verification
- `tsc --noEmit` — zero errors (portal-backend, portal-ui, lab-ui)
- `vite build` — zero warnings (portal-ui: 274KB JS + 21KB CSS; lab-ui: 276KB JS + 22KB CSS)
- `tsc --project tsconfig.json` — portal-backend compiles cleanly

## [2026-04-06] — FRONTEND_AGENT — ADD — Active Scenario Conflict Detection

- Added `ActiveScenariosModal` to lab-ui (`lab-ui/src/components/ActiveScenariosModal.tsx`)
  - Intercepts deploy action when other slots have running/deploying scenarios
  - Shows selectable list of active slots with status, scenario name, and VM count
  - Three actions: "Shut down selected and deploy", "Deploy anyway", "Cancel"
  - Two-click confirmation on destructive shutdown action
  - Select all/none helpers for bulk slot selection
- Modified `DeployControls.tsx` to check slot store for active scenarios before deploying
  - Sequentially destroys selected slots before triggering new deploy
  - Terminal output shows shutdown progress per slot
- Added `ActiveScenariosModal` to portal-ui (`portal-ui/src/components/shared/ActiveScenariosModal.tsx`)
  - Same conflict detection for both single-slot deploy and deploy-all flows
  - Portal-ui variant uses CSS custom properties for consistent theming
- Modified `SlotManagement.tsx` to integrate conflict check into both deploy paths
  - Single slot deploy: checks other active slots, shows modal if conflicts
  - Deploy-all: checks all active slots, shows modal before bulk deploy
  - Uses `mutateAsync` for sequential slot destruction before deploy
- Build verified: `tsc --noEmit` zero errors + `vite build` zero warnings (both UIs)

## [2026-04-02] — INFRA_AGENT — ADD — SCEN-005 Deployed and Validated (Slot 4)

- Deployed 3 VMs via Terraform: kali-attacker-s4 (230), victim-ws-s4 (231), webapp-server-s4 (232)
- Configured attacker dual-homed: eth0 10.10.7.10 (red), eth1 10.10.8.10 (blue), persistent
- Created kali user on attacker VM (template uses labuser), deployed phishing template
- NexusTrack Express.js webapp active on webapp-server:3000 with intentional cookie vulnerabilities
- Victim workstation: XFCE desktop, Chromium 146 (snap), auto-browse service enabled
- Fixed Chromium install: Ubuntu 24.04 snap transitional package fails; uses `snap install chromium` with fallback + `chromium-lab` wrapper script
- Pre-staged artifacts: crash dump (IOC-001), browser History DB (IOC-004), network PCAP, webapp access logs, dressing documents
- Baseline snapshots taken for all 3 VMs
- Validated: attacker reaches webapp (HTTP 302) and victim (ping OK), tools available (nmap, msfconsole, python3)

## [2026-04-02] — INFRA_AGENT — ADD — SCEN-004 Deployed and Validated (Slot 3)

- Deployed 6 VMs via Terraform across 3 zones: kali-attacker-s3 (220), dc01-s3 (221), eng-ws-s3 (222), openplc-s3 (225), grfics-s3 (226), historian-s3 (227)
- Promoted dc01 to lab.local domain controller, created Kerberoastable svc_scada service account
- Configured eng-ws dual-homed: eth0 10.10.6.30 (blue), eth1 192.168.103.30 (OT), persistent
- Configured attacker dual-homed: eth0 10.10.5.10 (red), eth1 10.10.6.10 (blue), persistent
- OpenPLC Runtime running with tank_fill_control.st, Modbus TCP port 502 verified
- Validated Modbus reads from eng-ws to OpenPLC (holding registers readable via pymodbus)
- Windows DC required manual static IP + WinRM configuration via QEMU agent (APIPA on clone)
- Baseline snapshots taken for all 6 VMs
- ⚠️ Note: No pfSense firewall — attacker can reach OT zone directly; scenario relies on students following intended SSH pivot path

## [2026-04-02] — INFRA_AGENT — ADD — SCEN-003 Deployed and Validated (Slot 2)

- Deployed 4 VMs via Terraform: kali-attacker-s2 (210), dc01-s2 (211), ws01-s2 (212), ws02-s2 (213)
- Promoted dc01 to lab.local domain controller with Lab Users, Lab Computers, Service Accounts OUs
- Domain-joined ws01 and ws02 (resolved reboot handler hang by manual verification via QEMU agent)
- Created vulnerable services: svc_sql (Kerberoastable, SPN MSSQLSvc/dc01.lab.local:1433), WDigest enabled, PowerShell Unrestricted
- Created domain users: jsmith (domain user), agarcia (Domain Admin — lateral movement target)
- Validated Kerberoasting: GetUserSPNs extracts svc_sql TGS, John cracks to Summer2024!
- Validated secretsdump/DCSync: agarcia DA account dumps Administrator NTLM hash
- Fixed agarcia password via Set-ADAccountPassword (bash `!` escaping issue with initial password set)
- Baseline snapshots taken for all 4 VMs

## [2026-04-02] — INFRA_AGENT — ADD — SCEN-002 Deployed and Validated (Slot 1)

- Deployed 3 VMs via Terraform: kali-attacker-s1 (200), dc01-s1 (201), ws01-s1 (202)
- Promoted dc01 to lab.local domain controller (Windows2016 functional level)
- Created AD OU structure: Lab Users, Lab Computers, Service Accounts, Workstations, Servers
- Created domain user jsmith (OU=Lab Users)
- Domain-joined ws01 (resolved SID duplication via sysprep /generalize)
- Created Kerberoastable service accounts via vulnerable-services role:
  - svc_sql with SPN MSSQLSvc/dc01.lab.local:1433
  - svc_backup with SPN WBEM/dc01.lab.local
- Validated end-to-end: GetUserSPNs extracts both TGS tickets, John cracks both passwords
- Made attacker eth1 (10.10.2.10) persistent, disabled cloud-init network override

## [2026-04-02] — INFRA_AGENT — FIX — Ansible Role Fixes

- Fixed `common-windows` role: replaced `Set-ExecutionPolicy` (fails with GPO conflict) with `win_regedit` approach
- Fixed `ad-domain-controller` role: removed unsupported `state: domain_controller` param from microsoft.ad.domain, added `reboot: true`
- Fixed `ad-domain-controller` role: rewrote DNS forwarders Jinja2 template from broken `regex_replace` to for loop

## [2026-04-01] — INFRA_AGENT — CHANGE — Unified Scenario Structure + Build System

- Reorganized all 5 scenarios into self-contained `scenarios/SCEN-XXX_<name>/` directories
  - Each scenario root now contains: `terraform/`, `ansible/`, `docs/`, `curriculum/`, `intel/`, `scenario.yaml`, `MANIFEST.yaml`
  - Previously scattered across `terraform/scenarios/`, `docs/scenarios/`, `scenarios/`, `intel_briefs/`
- Created `scripts/build` — one-command deployment pipeline
  - Usage: `build SCEN-005 [--slot N]` deploys templates → Terraform → Ansible
  - Subcommands: `--list`, `--status`, `--destroy`, `--plan-only`, `--ansible-only`, `--terraform-only`
  - Auto-detects required Packer templates from `main.tf` and builds missing ones via Proxmox API check
  - Generates dynamic Ansible inventory from Terraform outputs
  - Accepts scenario input as `SCEN-005`, `scen-005`, `5`, `005`, or `browser_exploit_cve_2026_2441`
- Created `packer/template-registry.yaml` — maps template VM IDs to Packer build files
  - 6 templates registered: tpl-kali-2024 (101), tpl-ubuntu-2404 (102), tpl-debian-12 (103), tpl-win2022 (110), tpl-openplc (150), tpl-ignition-dev (151)
- Updated Terraform module source paths from `../../modules/` to `../../../terraform/modules/` in all scenarios
- Created backward-compatibility symlinks: `terraform/scenarios/<name>` → unified dirs, `docs/scenarios/<name>` → unified dirs
- Old scattered directories removed; `scenarios/_shared/` holds shared Ansible role templates

## [2026-04-01] — INFRA_AGENT — ADD — SCEN-005 Ansible Roles

- Created 6 scenario-specific Ansible roles (29 files) for SCEN-005 browser exploit scenario:
  - `browser-victim-setup` — Ubuntu desktop + pinned Chromium 144.x + auto-browse service
    - Systemd service simulates victim browsing behavior (visits URLs from configurable list)
    - xdotool types NexusTrack credentials on login pages (feeds keylogger capture)
    - Chromium pinned and held at vulnerable version (blocks auto-update)
    - LightDM autologin for headless desktop operation
  - `vulnerable-webapp` — NexusTrack Express.js app with intentional vulnerabilities
    - Session cookies NOT HttpOnly (enables T1539 — Steal Web Session Cookie)
    - Additional `nexustrack_token` cookie readable by JavaScript
    - 5 fake client projects with realistic consulting descriptions
    - Login page, dashboard, project API, auth logging for forensic artifacts
    - Deployed as systemd service with Node.js 22
  - `stage-browser-artifacts` — Chromium crash dump (IOC-001) + browser history (IOC-004)
    - Simulated SIGSEGV crash dump with CSSFontFeatureValuesMap stack trace
    - SQLite History database with exploit page visit embedded in normal browsing
  - `stage-pcap-artifacts` — Network capture with exploit delivery + C2 beacons (IOC-002)
    - Scapy-generated PCAP: normal browsing, exploit CSS, Base64 POST beacons, session replay
  - `stage-webapp-artifacts` — Pre-staged access logs showing session replay (IOC-003)
    - Same session token used from victim IP (Chrome UA) then attacker IP (python-requests)
  - `stage-dressing-ws` — NexusTrack user guide + phishing email template (DRESS-002, DRESS-003)
- Created orchestration playbook: `ansible/playbooks/browser-exploit.yml`
  - 3 plays: webapp config, victim config, attacker staging
  - Integrates common-linux shared role with all scenario-specific roles
- Updated `docs/PROJECT_STATE.md` — SCEN-005 Ansible column marked complete

## [2026-04-01] — INTEL_AGENT — ADD — SCEN-005: Browser Exploit CVE-2026-2441

- Generated intel brief: `intel_briefs/cve_2026_2441_browser_exploit_2026-04-01.yaml`
  - Source: CVE-2026-2441 PoC (Chrome Blink CSS CSSFontFeatureValuesMap use-after-free)
  - Fidelity: balanced — exploitation simulated, post-exploitation techniques preserved
  - 6-phase attack chain: T1189 → T1203 → T1539 → T1056.001 → T1567 → T1059.007
  - Substitution: Chrome/Windows → Chromium/Ubuntu (same Blink engine, technique preserved)
  - Org dressing: "Nexus Digital Solutions" tech consulting firm with NexusTrack internal app
- Built Terraform scenario: 3 VMs (kali-attacker, victim-ws, webapp-server) across vmbr1/vmbr2
  - `terraform/scenarios/browser_exploit_cve_2026_2441/` — main.tf, variables.tf, terraform.tfvars, scenario.yaml
- Created scenario documentation:
  - `docs/scenarios/browser_exploit_cve_2026_2441/SCENARIO_CARD.md` — full scenario card
  - `docs/scenarios/browser_exploit_cve_2026_2441/OBJECTIVES.md` — 7 objectives (6 + bonus)
  - `docs/scenarios/browser_exploit_cve_2026_2441/WALKTHROUGH.md` — instructor solution guide
  - `docs/scenarios/browser_exploit_cve_2026_2441/NETWORK_MAP.md` — ASCII topology + attack flow
- Generated curriculum materials (5 files):
  - `LESSON_PLAN.md` — 3-hour instructor guide, 6 phases with detection checkpoints
  - `SLIDES_CONTENT.md` — slide deck content covering CVE mechanics, attack phases, defenses
  - `QUICK_REFERENCE.md` — one-page student reference (no spoilers)
  - `INCIDENT_REPORT_TEMPLATE.md` — blank student report with grading section
  - `DETECTION_EXERCISE.md` — blue team track (traffic analysis, browser forensics, session detection)
- Created scenario manifest: `scenarios/browser_exploit_cve_2026_2441/MANIFEST.yaml`
- Updated `docs/security/ATT&CK_COVERAGE.md` — 6 new Enterprise techniques (16 total, 21 with ICS)
- Updated `docs/PROJECT_STATE.md` — SCEN-005 row added to scenario status table
- Dedup verified: zero ATT&CK overlap with SCEN-001 through SCEN-004
- Ansible roles pending: browser-victim-setup, vulnerable-webapp, artifact staging

## [2026-04-01] — DOCS_AGENT — DOCS — Phase 19: Portal Documentation

- Created `docs/portal/API_REFERENCE.md` — complete API endpoint reference (1165 lines)
  - All 8 route groups with request/response schemas, auth requirements, error codes
  - Example curl commands for key endpoints
  - WebSocket `/ws/status` protocol documentation
  - Rate limit tiers and authentication flow
- Created `docs/portal/DATABASE_SCHEMA.md` — database schema reference (630 lines)
  - ASCII entity-relationship diagram with all FK relationships
  - 7 tables with column definitions, constraints, and rationale
  - State machine diagrams for user.status and lab_slots.status
  - Index listing with query patterns, migration file inventory
- Created `docs/portal/DEPLOYMENT_GUIDE.md` — deployment and operations guide (436 lines)
  - Prerequisites, database setup, backend/frontend deployment steps
  - nginx configuration with API proxy, WebSocket proxy, SPA fallback
  - PM2 process management, dev mode instructions
  - Operations: restart, redeploy, backup/restore, admin password reset
  - Troubleshooting: startup failures, blank page, 502, WebSocket issues
- Created `portal-backend/README.md` — backend project README
  - Stack overview, quick start, scripts, project structure, API summary
  - Environment variables, security notes
- Created `portal-ui/README.md` — frontend project README
  - Stack overview, quick start, project structure, pages by role
  - Design system, security notes, build output sizes
- Updated `docs/PROJECT_STATE.md` — all phases 11–19 marked complete
  - Added portal documentation status table
  - Added security review summary
  - Updated next steps for deployment and testing

## [2026-04-01] — SECURITY_AGENT — SECURITY — Phase 18: Portal Security Review

### CRITICAL fixes
- **WebSocket auth**: Added JWT verification to `/ws/status` WebSocket endpoint (`statusBroadcast.ts`)
  - Connections require `?token=<jwt>` query param — unauthenticated connections rejected with close code 4401
  - User lookup on connect populates role/slot for permission-scoped broadcasts
- **Role-scoped WebSocket broadcasts**: Students only receive their own slot status; instructors/admins see all
  - Prevents information leakage of other students' lab deployment state
- **Proxmox credential hardening**: Removed hardcoded `terraform@pve!terraform` fallback from `proxmox.ts`
  - Service now throws on startup if `PROXMOX_TOKEN_ID` or `PROXMOX_TOKEN_SECRET` env vars are missing
- **DB SSL verification**: Changed `pool.ts` SSL from `rejectUnauthorized: false` to default `true`
  - Added `DATABASE_SSL_REJECT_UNAUTHORIZED=false` opt-out for self-signed certs (explicit > implicit)
- **401 auto-refresh**: Added automatic token refresh to `portal-ui/src/api/client.ts`
  - API client intercepts 401, refreshes access token, retries original request once
  - Deduplicates concurrent refresh attempts via shared promise
  - Excludes `/auth/` paths from retry to prevent infinite loops

### HIGH fixes
- **WebSocket URL validation**: Added `isAllowedWsUrl()` in `VncViewer.tsx`
  - Rejects non-same-origin WebSocket URLs before noVNC connection
- **CSP WebSocket restriction**: Narrowed `connectSrc` from `ws: wss:` (any origin) to `'self'` only
- **Auth rate limiting**: `/api/auth/login`, `/api/auth/register`, `/api/auth/refresh` — 15 requests per 15 minutes
- **VNC ticket rate limiting**: Added `consoleLimiter` (10/min) to `/api/consoles/ticket`
- **Route shadowing fix**: Moved `/deploy-all` route above `/:slot` in `slots.ts`

### MEDIUM fixes
- **Audit logging gaps closed**:
  - `auth.ts /logout` — now logs `logout` action with user ID
  - `objectives.ts /complete` — now logs `objective_completed` with slot/scenario context

### Verified — no issues found
- JWT access tokens in memory only (never localStorage) — `authStore.ts`
- Refresh tokens in sessionStorage (cleared on tab close), hashed with SHA-256 before DB storage
- bcrypt cost factor 12 on all password hashing — `auth.ts`, `users.ts`
- All SQL uses parameterized queries — zero string interpolation across all routes
- Refresh token rotation on use (old revoked, new issued) — `auth.ts /refresh`
- Error handler returns generic message — no stack trace leaks
- All admin routes protected server-side with `requireRole('admin')` — `audit.ts`
- All instructor routes protected with `requireRole('admin', 'instructor')` — `users.ts`, `slots.ts`
- Student slot ownership enforced on console access — `consoles.ts`
- Zod validation on all routes accepting request bodies
- Helmet + CORS properly configured; no hardcoded secrets in committed code
- Build verified: `tsc --noEmit` zero errors (backend + frontend), `vite build` zero warnings

## [2026-04-01] — CURRICULUM_AGENT — ADD — Phase 17: Curriculum Materials (all 4 scenarios)

- Generated 20 curriculum files across 4 scenarios (5 files each):
  LESSON_PLAN.md, SLIDES_CONTENT.md, QUICK_REFERENCE.md, INCIDENT_REPORT_TEMPLATE.md, DETECTION_EXERCISE.md

## [2026-04-01] — CURRICULUM_AGENT — ADD — SCEN-001 Curriculum Materials

- Created `docs/scenarios/scada_modbus_recon/curriculum/LESSON_PLAN.md` — 2-hour instructor guide
  - 5 phases: Briefing (15m), Reconnaissance (20m), Modbus Enumeration (25m), Process Manipulation (20m), Debrief (30m)
  - Optional Phase 4: Alarm Suppression (10m bonus)
  - Detection checkpoints after every offensive phase
  - 3-level graduated hints per phase, real-world parallels (Oldsmar, TRITON)
  - Assessment rubric: 100 points (+10 bonus) with verifiable criteria
  - Contingency plans for early/stuck students and infrastructure failure
- Created `docs/scenarios/scada_modbus_recon/curriculum/SLIDES_CONTENT.md` — 16 slides
  - Modbus protocol history and data model, lab topology diagram
  - Per-phase slides with pymodbus commands and expected output
  - Register map table, detection opportunities matrix
  - Real-world parallels: Oldsmar FL (2021), TRITON/TRISIS (2017)
  - ICS constraint table (lifecycle, patching, CPU, downtime), ATT&CK ICS mapping
- Created `docs/scenarios/scada_modbus_recon/curriculum/QUICK_REFERENCE.md` — one-page student reference
  - ASCII network diagram (3 VMs on OT subnet), credentials table
  - nmap, pymodbus, Wireshark command reference, Modbus function code table
  - Register map and ATT&CK technique table, no spoilers
- Created `docs/scenarios/scada_modbus_recon/curriculum/INCIDENT_REPORT_TEMPLATE.md` — blank student report
  - 6 sections: Reconnaissance, Modbus Enumeration, Process Manipulation, Alarm Suppression (bonus),
    ATT&CK Mapping, Real-World Impact Analysis
  - Instructor grading section matching assessment rubric
- Created `docs/scenarios/scada_modbus_recon/curriculum/DETECTION_EXERCISE.md` — blue team track
  - Exercise 1: Network traffic analysis with tshark (FC read vs write differentiation)
  - Exercise 2: Suricata IDS rule writing for Modbus FC05/FC06 detection
  - Exercise 3: InfluxDB Flux queries for historian anomaly detection (setpoint + threshold changes)
  - Exercise 4: Defense architecture design proposal (network, host, monitoring, process controls)
  - 60-point assessment rubric for detection track

## [2026-03-31] — CURRICULUM_AGENT — ADD — SCEN-004 Curriculum Materials

- Created `docs/scenarios/ics_ot_pivot/curriculum/LESSON_PLAN.md` — 5-hour instructor teaching guide
  - 4-phase lesson flow: IT Foothold, Credential Escalation, OT Zone Pivot, ICS Exploitation
  - 30-minute briefing with IT/OT convergence context and Purdue Model
  - 30-minute debrief with TRITON, CRASHOVERRIDE, Volt Typhoon, Oldsmar parallels
  - 3-level graduated hints per phase, extra detail on SSH tunneling (Phase 3)
  - Assessment rubric: 150 points across 14 criteria with verifiable evidence requirements
  - Time management table with hard stops and compression guidance
- Created `docs/scenarios/ics_ot_pivot/curriculum/SLIDES_CONTENT.md` — 14 slides
  - IT/OT convergence threat timeline (2010-2023)
  - Purdue Enterprise Reference Architecture diagram
  - Per-phase slides with commands and expected output
  - SSH tunneling diagram with SOCKS and local forward options
  - Real-world incident comparison table (TRITON, CRASHOVERRIDE, Volt Typhoon, Oldsmar)
  - Cross-domain detection matrix (IT SOC / Boundary / OT SOC)
  - Defensive architecture slide with jump server and data diode controls
- Created `docs/scenarios/ics_ot_pivot/curriculum/QUICK_REFERENCE.md` — one-page student reference
  - ASCII network diagram (3 zones, 6 VMs)
  - ATT&CK technique table (4 Enterprise + 4 ICS)
  - Tool commands by phase (AD, Kerberos, SSH tunneling, Modbus)
  - Modbus register map for tank_fill_control.st
  - Wireshark filters, no spoilers
- Created `docs/scenarios/ics_ot_pivot/curriculum/INCIDENT_REPORT_TEMPLATE.md` — blank template
  - 12 sections: exec summary, timeline, credential chain, pivot path, zone activity,
    ICS impact assessment, ATT&CK mapping (Enterprise + ICS), Purdue Model violation analysis,
    detection opportunities, recommendations, real-world comparison, evidence appendix
- Created `docs/scenarios/ics_ot_pivot/curriculum/DETECTION_EXERCISE.md` — blue team track
  - Domain 1: AD event detection (4769 Kerberoasting, 4656/Sysmon 10 LSASS, enumeration)
  - Domain 2: SSH boundary detection (auth.log, tunnel traffic, process analysis)
  - Domain 3: ICS process detection (InfluxDB Flux queries, Modbus write patterns, Wireshark)
  - Cross-domain timeline correlation exercise
  - Detection rule writing exercise (5 rule templates: Kerberoasting, Modbus source, SSH tunnel,
    process anomaly, cross-domain correlation)

## [2026-03-31] — CURRICULUM_AGENT — ADD — SCEN-003 Curriculum Materials

- Created `docs/scenarios/apt_lateral_movement/curriculum/LESSON_PLAN.md` — 4-hour instructor guide
  - 5 phases: Mission Briefing (15m), Initial Foothold (40m), Credential Dumping (50m), Lateral Movement (45m), Domain Compromise (40m), Debrief (30m), Buffer (20m)
  - Per-phase: student task, instructor walkthrough, detection checkpoint, 3-level graduated hints
  - Assessment rubric: 100 points across 10 verifiable criteria
  - Contingency plans for stuck students, infrastructure failures, and early finishers
  - Debrief covers tiered administration, credential guard, LAPS, APT29/APT28/Conti real-world context
- Created `docs/scenarios/apt_lateral_movement/curriculum/SLIDES_CONTENT.md` — 22 slides
  - Windows auth overview (NTLM vs Kerberos, LSASS internals, WDigest)
  - Lateral movement kill chain visualization
  - Per-phase slides with commands and expected output
  - Detection slides: Event IDs 4624/4648/4672/4776, Sysmon ID 10, PtH indicators
  - Defense-in-depth: tiered admin, credential guard, protected users, LAPS, PAW
  - Real-world APT context: APT29 SolarWinds, APT28 DNC, Conti, BlackCat
- Created `docs/scenarios/apt_lateral_movement/curriculum/QUICK_REFERENCE.md` — one-page reference
  - ASCII network diagram (4 VMs, Red/Blue zones)
  - Tool commands: impacket-psexec, secretsdump, evil-winrm, crackmapexec, hashcat
  - ATT&CK technique table, objectives checklist
  - No spoilers (credentials, credential chain, or solution steps)
- Created `docs/scenarios/apt_lateral_movement/curriculum/INCIDENT_REPORT_TEMPLATE.md` — blank template
  - Executive summary, incident timeline table, credential chain diagram (blank)
  - Systems compromised inventory, ATT&CK mapping table (blank)
  - Detection opportunities per phase, evidence artifacts table
  - Remediation recommendations (preventive + detective), CISO recommendation prompt
- Created `docs/scenarios/apt_lateral_movement/curriculum/DETECTION_EXERCISE.md` — blue team guide
  - Exercise 1: Windows Security Event ID analysis (4624 Type 3, 4648, 4672, 4776)
  - Exercise 2: LSASS access detection via Sysmon Event ID 10 with classification whitelist
  - Exercise 3: Pass-the-hash detection patterns (NTLM vs Kerberos baseline, service installation 7045)
  - Exercise 4: Cross-host event correlation timeline and detection rule proposals
  - Exercise 5: NTDS.dit extraction detection (VSS shadow copy, Event ID 4662 DCSync)
  - Full PowerShell queries provided for each exercise

## [2026-04-01] — CURRICULUM_AGENT — ADD — SCEN-002 Curriculum Materials

- Created `docs/scenarios/cred_access_kerberoasting/curriculum/LESSON_PLAN.md` — full instructor teaching guide
  - 4-phase lesson flow (Enumeration, Kerberoasting, Cracking, BloodHound bonus) with 20-min briefing and 30-min debrief
  - Each phase: student task, instructor walkthrough, detection checkpoint, 3-level hints
  - Assessment rubric with 7 verifiable criteria (100 points total)
  - Contingency plans for early finishers, stuck students, infrastructure failure
- Created `docs/scenarios/cred_access_kerberoasting/curriculum/SLIDES_CONTENT.md` — 14 slides
  - Kerberos authentication overview, SPN mechanics, attack flow diagram
  - Per-phase command slides, detection (Event ID 4769), defense stack, full kill chain
- Created `docs/scenarios/cred_access_kerberoasting/curriculum/QUICK_REFERENCE.md` — one-page student reference
  - ASCII network diagram, tool commands (GetUserSPNs, hashcat 13100, crackmapexec), ATT&CK IDs
  - No spoilers: no passwords or specific answers included
- Created `docs/scenarios/cred_access_kerberoasting/curriculum/INCIDENT_REPORT_TEMPLATE.md` — blank student report
  - Executive summary, timeline, ATT&CK mapping table, evidence sections, defense recommendations
- Created `docs/scenarios/cred_access_kerberoasting/curriculum/DETECTION_EXERCISE.md` — blue team detection guide
  - Event ID 4769 analysis with PowerShell scripts for RC4 detection and bulk TGS hunting
  - Sigma rule template, Splunk SPL query, scheduled PowerShell detection script
  - Honeypot SPN design and deployment guide with discussion questions
  - Encryption type reference table (RC4 vs AES)

## [2026-04-01] — PORTAL_AGENT — ADD — Phase 16: VM Console Viewer (noVNC)

- Created `portal-ui/src/components/console/VncViewer.tsx` — React wrapper for noVNC RFB
  - Dynamic import to avoid Rollup top-level await issue at parse time
  - Connection lifecycle management with state callbacks (connecting/connected/disconnected/error)
  - Configurable: viewOnly, scaleViewport, clipViewport, background color
  - Auto-cleanup on unmount or URL change
- Created `portal-ui/src/types/novnc.d.ts` — TypeScript declarations for `@novnc/novnc/lib/rfb`
  - Full RFB class: constructor, properties, methods, event listeners
- Created `portal-ui/src/pages/ConsolePage.tsx` — full VM console viewer page
  - VM sidebar: lists accessible VMs (students see own slot, instructors see all lab VMs)
  - Console area: noVNC viewer with connection status overlay
  - Controls: connect/disconnect, view-only toggle, fullscreen (Fullscreen API)
  - Connection indicator: color-coded state (green=connected, amber=connecting, red=error)
  - Error state with retry button, empty state with feature hints
  - Ticket flow: POST `/api/consoles/ticket` → get wsUrl → connect RFB
- Updated `portal-ui/vite.config.ts` — resolved noVNC Rollup build compatibility
  - `build.commonjsOptions.exclude` skips CJS→ESM transform for noVNC (top-level await)
  - `build.target: 'es2022'` enables top-level await in output
  - `optimizeDeps.include` ensures noVNC is pre-bundled via esbuild in dev
- Wired `/console` route in App.tsx, replacing Phase 16 placeholder
- Build verified: `tsc --noEmit` — zero errors, `vite build` — 268KB JS + 69KB noVNC + 18KB CSS

## [2026-03-31] — PORTAL_AGENT — ADD — Phase 15: Student Dashboard

- Rebuilt `portal-ui/src/pages/StudentDashboard.tsx` — full student dashboard
  - Scenario panel: active scenario display with description, difficulty, duration, focus areas
  - Objectives panel: self-reported completion checklist with visual progress counter
  - VMs panel: per-slot VM list with CPU/memory/uptime stats and console links
  - Hints panel: instructor hints with unread badge, mark-read functionality, reverse-chronological
  - No-slot-assigned state with clear guidance to contact instructor
- Created `portal-ui/src/hooks/useStudent.ts` — student-facing TanStack Query hooks
  - useMySlot (10s), useMySlotVMs (10s), useMyObjectives (30s), useMyHints (15s)
  - useCompleteObjective mutation, useMarkHintRead mutation, useScenarioDetail (60s stale)
- Build verified: `tsc --noEmit` — zero errors, `vite build` — 256KB JS + 18KB CSS, zero warnings

## [2026-03-31] — PORTAL_AGENT — ADD — Phase 14: Instructor Admin Dashboard

- Built `portal-ui/src/pages/UserManagement.tsx` — full user management page
  - Role and status filter dropdowns with paginated user table
  - Action buttons: approve (pending), lock/unlock, reset-password (temp password display), delete
  - CreateUserModal with full_name, email, username, password, student_id, role selector
- Built `portal-ui/src/pages/SlotManagement.tsx` — 20-slot lab management
  - Visual slot grid (4×5) with status dots and scenario labels
  - Slot detail panel: deploy (scenario selector), destroy, reset controls
  - Per-slot VM list with CPU/memory bars and uptime
  - Deploy-all modal for bulk scenario deployment
- Built `portal-ui/src/pages/ScenarioBrowser.tsx` — scenario catalog
  - Cards with difficulty badge (color-coded), duration, VM count
  - Focus areas and ATT&CK technique tags
  - Available to all authenticated roles
- Built `portal-ui/src/pages/AuditLog.tsx` — admin-only audit log
  - Paginated table with action filter
  - Color-coded action badges (green=create, amber=auth, red=delete)
  - Target type/ID, IP address, JSON details columns
- Built `portal-ui/src/hooks/useAdmin.ts` — TanStack Query hooks
  - useUsers (30s), usePendingUsers (15s), useSlots (10s), useSlotVMs (5s), useScenarios (60s stale), useAuditLog (30s)
  - useUserMutations (7 mutations), useSlotMutations (4 mutations), useHintMutation
- Built `portal-ui/src/components/shared/StatusBadge.tsx` — reusable status pill with pulsing dot
- Extended `portal-ui/src/api/client.ts` — 20+ admin API methods (users, slots, scenarios, hints, audit, consoles)
- Extended `portal-ui/src/types/index.ts` — LabSlot, VMInfo, Scenario, Hint, AuditEntry, Pagination, ObjectiveProgress
- Wired all pages into App.tsx with role-based ProtectedRoute guards
- Added Audit Log nav item (admin-only) to AppLayout sidebar
- Build verified: `tsc --noEmit` — zero TypeScript errors, `vite build` — zero warnings

## [2026-03-31] — PORTAL_AGENT — ADD — Phase 13: Portal UI Auth Layer

- Scaffolded `portal-ui/` with React 19 + Vite 6 + TypeScript + Tailwind CSS 4
  - `tsconfig.json` — ES2022 target, bundler moduleResolution, strict mode
  - `index.html` — JetBrains Mono + Rajdhani fonts, dark body background
  - `src/index.css` — CSS custom properties matching lab-ui design system
  - `src/main.tsx` — QueryClient + BrowserRouter + StrictMode
- Created auth type definitions (`src/types/index.ts`):
  - User, Role, UserStatus, AuthTokens, LoginResponse, RegisterResponse, ApiError
- Created API client (`src/api/client.ts`):
  - Typed fetch wrapper with Bearer token injection
  - login, register, logout, refresh, getMe methods
- Created Zustand auth store (`src/stores/authStore.ts`):
  - Access tokens in memory only (never localStorage)
  - Refresh tokens in sessionStorage (cleared on tab close)
  - Auto-refresh every 12 minutes (for 15m token lifetime)
  - Session restoration on page load via token refresh
- Created auth components (`src/components/auth/`):
  - `LoginForm` — email/password form with error display, SOC-style dark theme
  - `RegisterForm` — full registration with password confirmation, success state
  - `ProtectedRoute` — role-based route guard with loading state and role redirects
- Created app shell (`src/components/shared/AppLayout.tsx`):
  - Sidebar with role-filtered navigation (student: dashboard; instructor: admin, users, slots)
  - User section with name, role badge, sign-out button
  - Responsive main content area with `<Outlet />`
- Created pages:
  - `AuthPage` — login/register toggle with auth redirect
  - `StudentDashboard` — placeholder cards (scenario, objectives, console)
  - `AdminDashboard` — placeholder cards (users, slots, scenarios, audit)
- Created routing (`src/App.tsx`):
  - Role-based route guards: student→/dashboard, instructor/admin→/admin
  - Placeholder routes for Phases 14-16 (users, slots, scenarios, console)
  - Catch-all redirect based on auth state and role
- Build verified: `tsc --noEmit` — zero errors; `vite build` — 209KB JS + 13KB CSS

## [2026-03-31] — BACKEND_AGENT — ADD — Phase 12: Portal API — Express Routes + Services

- Created 3 auth middleware in `src/api/middleware/`:
  - `auth.ts` — JWT verification (`authenticate`), role-based access (`requireRole`), slot ownership (`requireSlotOwner`), token signing (access + refresh)
  - `validate.ts` — Zod schema validation wrapper for body and query params
  - `auditLog.ts` — `writeAuditLog()` helper + auto-logging middleware for mutating requests
- Created 8 route modules in `src/api/routes/`:
  - `auth.ts` — register, login, logout, refresh, me (public + authenticated)
  - `users.ts` — CRUD, approve, lock/unlock, reset-password (instructor+ only), paginated list with filters
  - `slots.ts` — list/detail, deploy, destroy, reset, list VMs, deploy-all (instructor+ for mutations, slot-owner for reads)
  - `consoles.ts` — list accessible VMs, request VNC ticket with ownership validation
  - `scenarios.ts` — list/detail from scenario.yaml files on disk
  - `objectives.ts` — self-reported objective completion, instructor view per slot
  - `hints.ts` — instructor sends hints to slots, student reads own hints
  - `audit.ts` — paginated audit log with actor/action/date filters (admin only)
- Created 6 services in `src/services/`:
  - `proxmox.ts` — Proxmox VE API client (token auth, VM list, VM status, VNC ticket)
  - `terraform.ts` — Terraform CLI wrapper (deploy/destroy with stdout streaming)
  - `console.ts` — VNC ticket + WebSocket URL builder for noVNC
  - `email.ts` — console mode (log to stdout) + SMTP stub for password resets
  - `scenarios.ts` — scenario.yaml file discovery and parsing
  - `statusBroadcast.ts` — WebSocket server at `/ws/status` pushing slot status every 5s
- Created utility modules:
  - `src/utils/crypto.ts` — `generateToken()` + `hashToken()` for refresh token management
  - `src/utils/request.ts` — Express 5 helpers (`getIp`, `param`) for type-safe param extraction
  - `src/types/index.ts` — complete type definitions (UserRow, SlotRow, JWTPayload, ScenarioMeta, etc.)
- Wired all routes into `src/app.ts`, WebSocket broadcast into `src/index.ts`
- All admin routes protected server-side with `requireRole('admin')`
- All instructor routes protected with `requireRole('admin', 'instructor')`
- All student routes enforce slot ownership via `requireSlotOwner`
- Audit log entry written for every instructor/admin mutation
- Build verified: `tsc --noEmit` — zero TypeScript errors

## [2026-03-31] — BACKEND_AGENT — ADD — Phase 11: Portal Database + Migrations + Seed

- Created 7 SQL migrations in `portal-backend/migrations/`:
  - `001_create-users.sql` — users table with UUID PK, RBAC role CHECK, status CHECK, lab_slot 1-20
  - `002_create-refresh-tokens.sql` — refresh_tokens with CASCADE delete, IP/user-agent tracking
  - `003_create-lab-slots.sql` — 20-slot table with status FSM, pre-populated via generate_series
  - `004_create-scenario-assignments.sql` — scenario-to-slot assignment tracking
  - `005_create-audit-log.sql` — JSONB details, INET ip_address, 3 indexes
  - `006_create-objectives-progress.sql` — per-user per-slot objective completion with UNIQUE constraint
  - `007_create-hints.sql` — instructor-to-slot hint messaging with read tracking
- Created `src/db/pool.ts` — pg Pool singleton with typed `query<T>()` and `queryOne<T>()` helpers
- Created `src/utils/errors.ts` — typed error classes (Unauthorized, Forbidden, NotFound, Conflict)
- Created `src/api/middleware/errorHandler.ts` — Zod + AppError + 500 fallback handler
- Created `src/app.ts` — Express 5 app with helmet, CORS, rate limiting, JSON body limit, health check
- Created `src/index.ts` — server entry point with DB connectivity check, graceful shutdown
- Created `seeds/seed.ts` — admin@lab.local (bcrypt cost 12), 20 lab slot verification
- Build verified: `tsc --noEmit` — zero TypeScript errors

## [2026-03-31] — DOCS_AGENT — DOCS — Phase 10: Complete Documentation Set

- Updated `README.md` — corrected scenario catalog (difficulty, duration, VM counts), updated tool versions, ATT&CK summary
- Created 6 setup guides in `docs/setup/`:
  - `01_PROXMOX_SETUP.md` — Proxmox VE 9.1 install, post-install config, API token creation
  - `02_STORAGE_NETWORK.md` — ZFS datasets (labdata/templates/scenarios/backups), 4 bridges, firewall default-deny
  - `03_PACKER_TEMPLATES.md` — ISO verification, Packer variable config, build order, template inventory
  - `04_TERRAFORM_USAGE.md` — Module architecture, deploy/destroy workflow, multi-slot deployment
  - `05_ANSIBLE_ROLES.md` — Role inventory (11 roles), playbooks, vulnerability variables, verification commands
  - `06_SCENARIO_CREATION.md` — Intel pipeline and manual build workflows, scenario checklist
- Updated `docs/security/ATT&CK_COVERAGE.md` — complete technique matrix from all 4 scenarios:
  - 10 Enterprise techniques, 5 ICS techniques, 15 total unique
  - Technique frequency table, coverage statistics, gap analysis
- Created `docs/ui/LAB_UI_GUIDE.md` — dashboard pages, component catalog, design system, API endpoints, build verification

## [2026-03-31] — FRONTEND_AGENT — ADD — Phase 9: Lab Management UI

- Scaffolded `lab-ui/` with React 19 + Vite 6 + TypeScript + Tailwind CSS 4
- Created complete dark-themed instructor dashboard with SOC-style visual design
  - Background: #0a0c0f, accent green (#00e5a0), blue (#6c8fff), amber (#facc15), red (#fb7185)
  - Typography: JetBrains Mono (code/labels) + Rajdhani (headings)
- Built 8 reusable components:
  - `StatusBadge` — slot/VM status with pulsing indicator dots
  - `DifficultyBadge` — color-coded scenario difficulty
  - `ScenarioCard` — scenario catalog card with ATT&CK techniques, stats, focus areas
  - `VMStatusRow` — per-VM row with CPU/memory bars, zone badge, uptime
  - `SlotGrid` — 20-slot visual grid with selection state
  - `NetworkTopology` — auto-generated SVG network diagram with zone backgrounds, VM nodes, pivot path animations
  - `TerminalPanel` — streaming terminal output panel with color-coded stdout/stderr/system lines
  - `DeployControls` — Deploy/Reset/Destroy buttons with confirmation dialogs and WebSocket streaming
  - `AccessSheet` — per-slot VM access table with copy-to-clipboard IP addresses
- Built 3 page components:
  - `Dashboard` — stats overview, slot grid, scenario catalog
  - `ScenarioDetail` — scenario info, slot selector, deploy controls, VM status, network topology, access sheet
  - `SlotsOverview` — all 20 slots with drill-down VM detail
- State management: 4 Zustand stores (scenario, slot, terminal, UI)
- API client: typed fetch wrapper for scenarios, slots, VMs, deploy/destroy/reset with WebSocket deploy streaming
- TanStack Query v5 with auto-refetch (15s scenarios, 10s slots, 5s VMs)
- Build output: 270KB JS bundle, 22KB CSS — zero TypeScript errors, zero build warnings

## [2026-03-31] — INFRA_AGENT — ADD — Phase 8: Scenario Catalog

- Built 4 scenarios with complete Terraform, docs, and manifests:
  - **SCEN-001: scada_modbus_recon** (Beginner, 2h) — ICS/OT focus
    - 3 VMs: kali-attacker, openplc-01, historian
    - ATT&CK ICS: T0846, T0842, T0836, T0855, T0812
    - Modbus TCP enumeration, register read/write, process manipulation
  - **SCEN-002: cred_access_kerberoasting** (Intermediate, 3h) — AD/Windows focus
    - 3 VMs: kali-attacker, dc01, ws01
    - ATT&CK Enterprise: T1558.003, T1087.002, T1069.002, T1110.002
    - SPN enumeration, TGS ticket extraction, offline hash cracking
  - **SCEN-003: apt_lateral_movement** (Advanced, 4h) — AD lateral movement focus
    - 4 VMs: kali-attacker, dc01, ws01, ws02
    - ATT&CK Enterprise: T1021.002, T1003.001, T1003.003, T1558.003, T1059.001
    - Credential dumping, pass-the-hash, NTDS.dit extraction
  - **SCEN-004: ics_ot_pivot** (Expert, 5h) — IT/OT convergence focus
    - 6 VMs across 3 zones: kali-attacker, dc01, eng-ws (dual-homed), openplc-01, grfics-host, historian
    - ATT&CK Enterprise + ICS: T1021.002, T1003.001, T1558.003, T1021.004, T0855, T0836, T0846, T0842
    - Full IT→OT kill chain: AD compromise → eng-ws pivot → Modbus manipulation
- Each scenario includes: main.tf, variables.tf, terraform.tfvars, scenario.yaml
- Each scenario includes docs: SCENARIO_CARD.md, OBJECTIVES.md, WALKTHROUGH.md, NETWORK_MAP.md
- Each scenario includes MANIFEST.yaml with full dependency catalog
- Dedup verified: no ATT&CK technique overlap between scenarios (each adds unique coverage)
- All scenarios use slot-aware networking via network_segment module

## [2026-03-31] — SCADA_AGENT — ADD — Phase 7: SCADA Stack

- Created Ansible role `grficsv2-deploy` — Docker Compose deployment of GRFICSv2 chemical plant simulator
  - Three containers: PLC simulator (Modbus TCP 502), HMI (ScadaBR 8080), process simulation
  - Jinja2-templated docker-compose.yml with configurable IPs and ports
  - Auto-installs Docker Engine and Compose plugin on Debian target
- Created Ansible role `influxdb-setup` — InfluxDB 2.7.10 process historian
  - Automated initial setup via REST API (org, bucket, retention, admin credentials)
  - Token generation and secure storage at `/etc/influxdb2/lab-token`
  - Creates additional buckets: `scada-alerts` (90d), `grfics-data` (30d)
- Created Ansible role `grafana-scada` — Grafana 11.3.1 with provisioned SCADA dashboards
  - Auto-provisioned InfluxDB Flux datasource
  - SCADA Process Monitor dashboard with tank level, pump speed, alarm status, GRFICSv2 reactor panels
- Created Ansible role `modbus-historian-bridge` — Modbus TCP → InfluxDB data bridge
  - Python service polling OpenPLC and GRFICSv2 registers at 1s intervals
  - Writes to InfluxDB `process-data` and `grfics-data` buckets
  - Runs as systemd service with graceful shutdown
- Created `ansible/playbooks/scada-full.yml` — full SCADA stack orchestration playbook
- Created `docs/scada/registers/openplc_REGISTER_MAP.md` — complete Modbus register map
  - Coil map, input registers, holding registers, OpenPLC address mapping
  - Attack scenarios with pymodbus examples, Wireshark filters, InfluxDB queries
- Created protocol validation suite in `scripts/scada-validation/`:
  - `validate-modbus.py` — OpenPLC + GRFICSv2 Modbus register validation
  - `validate-opcua.py` — Ignition OPC-UA anonymous access and browsing
  - `validate-dnp3.py` — DNP3 outstation TCP and data link layer
  - `validate-ethernetip.py` — EtherNet/IP CIP ListIdentity
  - `validate-iec61850.py` — IEC 61850/MMS COTP connection
  - `validate-all.sh` — master runner for all five protocols

## [2026-03-31] — INFRA_AGENT — ADD — Phase 6: Ansible Roles
- Created 7 Ansible roles in `ansible/roles/`:
  - `common-linux` — base packages, SSH hardening, qemu-guest-agent, NTP, timezone
  - `common-windows` — WinRM config, RDP, firewall rules, update policy, PS remoting
  - `ad-domain-controller` — AD DS promotion, DNS forwarders, OU structure, user/SPN creation
  - `ad-member-workstation` — domain join, local admin, credential caching, network discovery
  - `vulnerable-services` — ATT&CK-mapped intentional vulns (Kerberoast, WDigest, open shares, weak creds)
  - `openplc-configure` — upload ladder logic, compile, start runtime, verify Modbus TCP (502)
  - `ignition-configure` — start gateway, accept trial license, configure dev mode, verify OPC-UA
- Created `ansible/roles/openplc-configure/files/tank_fill_control.st` — IEC 61131-3 ladder logic
- Created 5 playbooks:
  - `ansible/site.yml` — master playbook (all roles by group)
  - `ansible/playbooks/linux.yml` — Linux base config
  - `ansible/playbooks/windows.yml` — Windows base config
  - `ansible/playbooks/ad-setup.yml` — Full AD lifecycle (DC + join + vulns)
  - `ansible/playbooks/scada-setup.yml` — SCADA stack (OpenPLC + Ignition)

## [2026-03-31] — INFRA_AGENT — ADD — Phase 5: Terraform Modules
- Created `terraform/modules/vm_clone/` — reusable linked-clone module
  - Cloud-init support (Linux), WinRM-ready (Windows)
  - Dual-NIC support for jump boxes and firewalls
  - Tag-based organization (scenario, zone, lab)
  - Lifecycle rules to prevent replacement on IP/MAC drift
- Created `terraform/modules/network_segment/` — per-slot IP/VLAN calculator
  - Computes red/blue/OT IP ranges for slots 1-20
  - Outputs gateways, prefixes, VM ID base, VLAN tags, workspace names
  - IP scheme: red=10.10.(N*2-1).x, blue=10.10.(N*2).x, ot=192.168.(100+N).x
- Created `terraform/modules/scada_node/` — SCADA VM convenience wrapper
  - Wraps vm_clone with OT-zone defaults (vmbr3, scada tags)
  - Role validation: plc, hmi, historian, rtu, ems, gateway
- Created `terraform/variables.tf` — shared root-level variable definitions
- Created `terraform/scenarios/_template/` — slot-aware scenario starter
  - main.tf with attacker, target, SCADA module examples
  - variables.tf, terraform.tfvars, scenario.yaml metadata
- Pre-existing: deploy.sh, destroy.sh, backend.tf, providers.tf (from earlier work)

## [2026-03-31] — INFRA_AGENT — ADD — Phase 4: Packer Templates
- Created Packer plugin config (`packer/packer.pkr.hcl`) — proxmox plugin >= 1.1.8
- Created ISO requirements file (`packer/iso-requirements.txt`) for `iso-manage.sh ensure-list`
- Created HTTP provisioning files:
  - `packer/http/preseed.cfg` — Kali automated install
  - `packer/http/preseed-debian.cfg` — Debian 12 automated install
  - `packer/http/autoinstall/user-data` + `meta-data` — Ubuntu 24.04 cloud-init autoinstall
  - `packer/http/autounattend.xml` — Windows Server 2022 unattended install with VirtIO drivers
- Built 6 Packer templates:
  - `tpl-kali-2024` (VM 101) — Kali 2024.4, Go 1.23, Metasploit, Impacket, CrackMapExec, ICS tools
  - `tpl-ubuntu-2404` (VM 102) — Ubuntu Server 24.04.2 LTS, cloud-init, general purpose
  - `tpl-debian-12` (VM 103) — Debian 12.9 Bookworm, cloud-init, lightweight server
  - `tpl-win2022` (VM 110) — Windows Server 2022 Eval, WinRM, VirtIO, RSAT-AD-Tools, RDP
  - `tpl-openplc` (VM 150) — Debian 12 + OpenPLC Runtime v3, Modbus TCP (502), web UI (8080)
  - `tpl-ignition-dev` (VM 151) — Debian 12 + Ignition 8.1.44 Gateway, dev mode, OPC-UA
- All Linux templates: cloud-init enabled, qemu-guest-agent, cleanup provisioners
- Windows template: 45m WinRM timeout, VirtIO drivers via secondary ISO, autounattend.xml

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
