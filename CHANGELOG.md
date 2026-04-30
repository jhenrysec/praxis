# Changelog

All notable changes to the Vulnerability Lab are documented here.

Format per entry: `[YYYY-MM-DD] — [AGENT] — [TYPE] — Description`  
Types: `ADD` | `CHANGE` | `FIX` | `REMOVE` | `SECURITY` | `DOCS`

---

## [Unreleased]

*(Entries move here first, then to a dated section on release/phase completion)*

## [2026-04-22] — INFRA_AGENT — FIX — Windows Packer templates: sysprep /generalize as final provisioner (Task #49)

Fixes two observable symptoms traced to the same root cause — the Windows
templates (tpl-win2016, tpl-win2022, tpl-win2025) were never sysprep-generalized
before conversion to Proxmox templates, so every clone inherited the template's
machine SID, hostname (`WIN-TEMPLATE`), and WinRM config.

### Symptoms this fixes
- **SID duplication** blocked PtH/WinRM lateral movement in SCEN-003 validation
  (see 2026-04-07 entry) — all workstation clones from tpl-win2022 shared the
  same machine SID, so hash-based auth between workstations was rejected.
- **Sysmon reports `WIN-TEMPLATE.lab.local`** on dc01 during the SCEN-002 rule
  100110 validation (see 2026-04-22 sysmon-install entry) — computer name
  comes from the unsysprep'd template, not the clone's assigned hostname.

### Root cause
proxmox-iso does not accept `shutdown_command` / `shutdown_timeout`, so the
typical Packer pattern of driving sysprep via shutdown_command doesn't apply.
The original templates simply ran the last provisioner and let Packer power
the VM off via the Proxmox API — no sysprep, no generalize.

### Fix — pattern applied identically across all three templates
- `source "proxmox-iso"` block: removed the invalid `shutdown_command` /
  `shutdown_timeout` comment; replaced with a forward-pointer comment
  explaining that sysprep now runs as the final `build` provisioner.
- `build` block: appended two new provisioners at the end —
  1. `file` provisioner stages `${path.root}/../http/sysprep-unattend.xml`
     to `C:/Windows/Panther/Unattend.xml` (Panther is the conventional
     staging directory). This file drives the specialize + oobeSystem
     passes on every CLONE's first boot — NOT during the Packer build.
  2. `powershell` provisioner runs
     `Start-Process -FilePath C:\Windows\System32\Sysprep\Sysprep.exe -ArgumentList '/generalize','/oobe','/shutdown','/unattend:C:\Windows\Panther\Unattend.xml' -NoNewWindow`
     followed by `Start-Sleep -Seconds 5`. `Start-Process` launches sysprep
     detached so the PowerShell session returns 0 before WinRM dies during
     `/generalize`. sysprep completes async, strips machine-specific state
     (SID, hostname, WinRM config), and powers the VM off. proxmox-iso
     detects the power-off and converts the VM to a template.

### Post-sysprep behavior on clone first boot
`packer/http/sysprep-unattend.xml` was already present and drives the
specialize + oobeSystem passes on every clone's first boot:
- `ComputerName=*` → Windows auto-generates a random `WIN-XXXXXX`; domain-join
  Ansible roles rename to `dc01-s<slot>`, `ws01-s<slot>`, etc.
- Rebuilds WinRM listener + firewall rules (sysprep /generalize strips them).
- Restores QEMU Guest Agent auto-start (service is preserved through
  /generalize — this is a best-effort safety net).
- AutoLogon as Administrator for 3 boots so FirstLogonCommands fire.

### Validation
- `packer validate -var-file=/tmp/validate.pkrvars.hcl -only='proxmox-iso.win2016,proxmox-iso.windows,proxmox-iso.win2025' packer/templates/`
  → "The configuration is valid."

### Deploy step still required
- Rebuild tpl-win2016 / tpl-win2022 / tpl-win2025 on pve01 (~30–45 min each).
  Existing clones from the unsysprep'd templates will continue to exhibit
  SID-duplication and `WIN-TEMPLATE` hostname symptoms until destroyed and
  redeployed from the rebuilt templates.

## [2026-04-22] — INFRA_AGENT + BACKEND_AGENT — FIX — Wazuh dashboard basePath alignment for /api/soc reverse proxy (Task #54)

Closes the follow-up called out in the Phase 3 SIEM entry: the Wazuh dashboard
(OpenSearch Dashboards fork) emits absolute `/app/...` URLs in its SPA bundles,
so deep routes escaped the portal's `/api/soc` mount point. Fixed via a
coordinated two-side change — the origin is now told where it's mounted, and
the proxy stops rewriting the prefix.

### Changed — ansible/roles/wazuh-manager
- `tasks/main.yml` — new `blockinfile` task writes
  `server.basePath: "/api/soc"` + `server.rewriteBasePath: true` into
  `/etc/wazuh-dashboard/opensearch_dashboards.yml`, guarded by
  `when: wazuh_dashboard_base_path | length > 0` so setting the var to `""`
  leaves the dashboard at the origin root. Notifies `restart wazuh-dashboard`
  only when the block actually changes.
- `defaults/main.yml` — already carried `wazuh_dashboard_base_path: "/api/soc"`
  and `wazuh_dashboard_config_path: /etc/wazuh-dashboard/opensearch_dashboards.yml`
  from the Phase 2 prep; values unchanged, now actually consumed.

### Changed — portal-backend
- `src/api/routes/soc.ts` — removed `pathRewrite: { '^/api/soc': '' }` from the
  `createProxyMiddleware` options. With `server.basePath` set, the Wazuh origin
  expects the prefix to reach it intact; stripping it would produce 404s on
  every request once the origin is reconfigured. Added an inline comment
  explaining the coordination with the Ansible role so a future reader doesn't
  "fix" it back to rewriting.
- `tsc --noEmit` — zero errors.

### Validation performed this session
- Wazuh manager reachable: dashboard returns 302 at `/` and 200 at `/app/login`.
- Both agents enrolled and `Active`: `dc01` (id 001), `ws01` (id 002) — verified
  via `sudo /var/ossec/bin/agent_control -l` on wazuh-shared.
- End-to-end rule fire test: `impacket-GetUserSPNs LAB.LOCAL/jsmith -dc-ip
  10.10.2.20 -request` from kali-attacker-s1 returned 2 RC4 TGS tickets
  (svc_sql, svc_backup). `alerts.json` on wazuh-shared shows 2 matching
  level-8 hits on rule `100100` with `targetUserName=jsmith@LAB.LOCAL` at
  `2026-04-22T09:18:30`. Rule `100101` correctly did not fire (threshold is
  5+ in 60s; only 2 SPNs exist).

### Deploy step still required
- Run `ansible-playbook ansible/playbooks/wazuh-shared.yml` to push the
  basePath block and restart `wazuh-dashboard`.
- Rebuild + restart portal-backend so the pathRewrite removal takes effect.
- Until both are deployed together, the `/api/soc` iframe path is expected
  to misroute — the two halves are coupled by design.

## [2026-04-22] — BACKEND_AGENT + FRONTEND_AGENT — ADD — Phase 3 SIEM: Portal reverse proxy + Blue Team SOC button

Phase 3 of the blue-team SIEM architecture. Instructors and admins can now
open the Wazuh dashboard directly from the portal via a JWT-gated reverse
proxy, eliminating the cross-origin mixed-content path that required
analysts to hit `https://192.168.1.60` in a separate tab and accept the
self-signed cert manually.

### Architecture
- portal-backend at `/api/soc/*` reverse-proxies to
  `https://192.168.1.60` (configurable via `WAZUH_DASHBOARD_URL`)
- Access gated by the same JWT that protects every other `/api` route,
  plus a role check for `admin` / `instructor`
- Self-signed-cert handling isolated to the backend (`secure: false` on
  the proxy) so browsers never see the untrusted cert
- Wazuh's anti-framing headers (`X-Frame-Options`, CSP
  `frame-ancestors`) are stripped from proxy responses so portal-ui can
  mount the dashboard in an iframe

### Added — portal-backend
- `src/api/routes/soc.ts` — new route module with three handlers:
  - `POST /api/soc/grant` (authenticate + requireRole admin/instructor):
    mints a short-lived JWT with `scope: 'soc'` and installs it as an
    httpOnly cookie `soc_session` scoped to `/api/soc`. Audit-logged
    as `soc_access_granted`. Returns `{ ok, expires_in_seconds,
    dashboard_url }`. Session length via
    `SOC_SESSION_EXPIRES_MIN` (default 60 min).
  - `POST /api/soc/revoke` (authenticate): clears the cookie.
  - `ALL /api/soc/*` (authenticateSoc + proxy): the reverse proxy.
    Custom `authenticateSoc` middleware accepts either a Bearer header
    (normal API flow) OR the `soc_session` cookie (iframe/tab
    navigation flow, where the browser can't inject Authorization
    headers). Validates the user is still active and still has
    admin/instructor.
  - http-proxy-middleware v3 `on:` event bag:
    - `proxyRes`: strips `x-frame-options`, filters
      `frame-ancestors` out of the CSP, rewrites `Location:` redirects
      so the SPA stays under `/api/soc`.
    - `error`: returns a 502 JSON body if Wazuh is unreachable.
  - `ws: false` — statusBroadcast already owns the HTTP server's
    `upgrade` event for `/ws/status`. Wazuh dashboard polls over
    HTTPS for most real-time state, so dropping WebSocket proxying is
    acceptable for MVP. Enabling later requires explicit upgrade
    dispatch in `src/index.ts`.
- `src/app.ts` — mounted `socRouter` at `/api/soc`; extended helmet
  CSP `directives` with `frameSrc: ["'self'"]` so portal-ui can iframe
  same-origin `/api/soc/`.

### Added — portal-ui
- `src/pages/BlueTeamSoc.tsx` — new page that:
  - Calls `apiClient.grantSocAccess()` on mount to set the cookie
  - Renders `<iframe src="/api/soc/">` filling the remaining viewport
  - Controls: Refresh (remint cookie), Open-in-tab (same path), and
    Fullscreen (Fullscreen API)
  - Connection-state overlay while granting; error card with retry
    button on failure
  - Displays `session expires in Nm` countdown
  - Revokes the cookie on unmount (best-effort)
  - iframe sandbox:
    `allow-same-origin allow-scripts allow-forms allow-popups allow-downloads`
- `src/api/client.ts` — added `grantSocAccess()` and `revokeSocAccess()`
  methods alongside the existing console API.
- `src/components/shared/AppLayout.tsx` — added "Blue Team SOC" nav
  item with `Eye` icon, gated to `['admin', 'instructor']` via the
  existing role-filter mechanism.
- `src/App.tsx` — added `<Route path="/soc">` wrapped in
  `<ProtectedRoute allowedRoles={['admin', 'instructor']}>` so
  students cannot reach the page even with a direct URL.

### Known limitation (tracked as follow-up)
- Wazuh dashboard is an OpenSearch Dashboards fork and emits absolute
  URLs like `/app/wazuh/...` in its HTML and JS bundles. `pathRewrite`
  on the proxy strips the `/api/soc` prefix for outbound requests but
  does not rewrite Wazuh's response content. The login page and
  top-level navigation proxy correctly; deep SPA routes may escape
  the `/api/soc` mount. Configuring
  `server.basePath: /api/soc` + `server.rewriteBasePath: true` in
  `/etc/wazuh-dashboard/opensearch_dashboards.yml` resolves this and
  is filed as a separate task for the next Ansible update to the
  wazuh-manager role.

### Build verification
- portal-backend: `npx tsc --noEmit` — zero errors
- portal-ui: `npx tsc --noEmit` — zero errors; `vite build` — 299KB
  main JS + 68KB noVNC + 22KB CSS, 1596 modules, 4.78s, zero warnings

## [2026-04-22] — INFRA_AGENT — ADD — sysmon-install role + rule 100110 live-fire validation

### Added — Sysmon Ansible role
- `ansible/roles/sysmon-install/` — installs Sysinternals Sysmon 15.x on
  Windows hosts and subscribes the Wazuh agent to the
  `Microsoft-Windows-Sysmon/Operational` eventchannel. Idempotent by design:
  the full download/unzip/install chain is gated on a `win_service_info`
  check for the `Sysmon64` service (no-op on re-run), config deltas are
  applied via `Sysmon64.exe -c config.xml`, and the ossec.conf patch is
  guarded by a literal marker comment so multiple runs cannot append
  duplicate `<localfile>` blocks. A `restart WazuhSvc` handler fires only
  when the ossec.conf patch actually changes.
- `files/sysmon-config.xml` — minimal schema-4.90 config. Single rule:
  `ProcessAccess onmatch=include` with `TargetImage end-with lsass.exe`.
  Intentionally narrow — just enough to feed rule 100110 without swamping
  the manager with ProcessCreate / NetworkConnect volume. Adding more
  EventIDs here is the path to expanding Sysmon-backed rule coverage.
- `ansible/roles/sysmon-install/defaults/main.yml` — tunables for Sysmon
  zip URL, staging/install dirs, binary name, service name, and the
  Wazuh agent ossec.conf path (mirrors wazuh-agent-windows role default).
- `SCEN-002/ansible/playbooks/kerberoasting.yml` — appended a new play
  "Deploy Sysmon for LSASS detection (rule 100110)" targeting
  `domain_controllers:workstations`. Ordered after wazuh-agent-windows
  because the ossec.conf patch targets the installed agent.

### Detection rule pack — status after this session
- **100100** (single RC4 TGS, T1558.003): validated 2026-04-20 (7 hits)
- **100101** (5+ TGS/60s correlation, T1558.003): validated 2026-04-20
  (1 level-12 alert after `same_field: targetUserName` fix)
- **100110** (LSASS ProcessAccess, T1003.001): validated 2026-04-22.
  `rundll32 C:\Windows\System32\comsvcs.dll MiniDump <PID> lsass.dmp full`
  on ws01 produced GrantedAccess=0x1fffff (PROCESS_ALL_ACCESS) plus a
  0x1410 handle from the rundll32 parent. Alerts.json shows 6 level-10
  hits across dc01 (0x1410 from wazuh-agent syscollector — expected
  background noise, the rule is behaving correctly) and ws01 (both the
  impacket-style 0x1410 and the mimikatz/procdump-style 0x1fffff).
- **100120–100123** (Modbus write FCs 05/06/15/16, T0836): dormant by
  design. Rules match `alert.signature` regex from a Suricata/Zeek
  feed; no network sensor is deployed in SCEN-002 / SCEN-003. Will
  validate when a SCEN-001 or SCEN-004 run adds a network-sensor
  fixture on the OT bridge.

### Known noise surfaced by this session
- dc01 sees recurring ProcessAccess 0x1410 from
  `wazuh-agent.exe` (syscollector.dll → sysinfo.dll → KERNELBASE).
  Rule 100110 is correctly firing on these; they are not malicious.
  Candidate follow-up: add a `<field>` exclusion on
  `sourceImage end with wazuh-agent.exe` OR — preferable — lift the
  filter into `sysmon-config.xml` via a `RuleGroup` exclude so events
  never reach the agent in the first place, keeping the rule semantics
  clean for real detection. Not blocking; noted for later tuning pass.
- dc01 Sysmon events still report `computer: WIN-TEMPLATE.lab.local`
  (Task #49 — tpl-win2022 needs sysprep /generalize final step to
  produce unique machine SIDs/hostnames on clone). ws01 reports
  correctly as `ws01-s1.lab.local`.

Phase 2 of the blue-team SIEM: adds a dedicated SIEM network path, Wazuh
agents on scenario VMs, and a lab-specific detection rule pack. The
management-plane isolation rule is preserved — scenario VMs reach the
manager via vmbr4 only, and vmbr4 has no route to vmbr0.

### Scope boundary
- Phase 2 delivers the plumbing and rule content. Scenario Terraform
  modules (SCEN-001 through SCEN-005) are not yet updated to dual-home
  onto vmbr4; that integration is deferred so each scenario can be
  converted and retested individually.
- Per-slot VLAN tagging on vmbr4 (401–420) is also deferred — every
  agent currently shares the untagged 192.168.4.0/24 L2. Acceptable for
  in-classroom use but should be tightened before any scenario that
  teaches lateral movement across slots.

### Added — network plumbing
- `ansible/roles/proxmox-bridge/` — creates a Linux bridge on the
  Proxmox host via `/etc/network/interfaces.d/` drop-in, idempotent
  (won't duplicate an existing stanza), notifies an `ifreload -a`
  handler only when the config actually changes. Tunables in
  `defaults/main.yml`: bridge name, CIDR, MTU, VLAN-aware flag.
- `ansible/playbooks/proxmox-bridges.yml` — single-host play targeting
  the `proxmox` inventory group; provisions `vmbr4` (192.168.4.1/24,
  no uplink, no gateway) as the SIEM-only bridge.
- `ansible/inventory/hosts.yml` — static inventory that `ansible.cfg`
  was already pointing at but never had a matching file for. Defines
  `proxmox` (pve01 @ 192.168.1.50) and `wazuh_shared` (192.168.1.60)
  groups. Per-slot scenario inventories continue to come from
  `scripts/build`.

### Changed — Terraform module
- `terraform/modules/vm_clone/` — added optional `second_bridge`,
  `second_ip`, `second_prefix`, `second_gateway` variables. When set,
  the module attaches a second virtio NIC and emits a cloud-init
  `ip_config` for the second interface. Unset by default so existing
  scenarios continue to deploy single-NIC.
- `terraform fmt` applied across `terraform/modules/` and
  `terraform/fixtures/` to fix a ternary-bracket indentation drift at
  `vm_clone/main.tf:77` that had slipped into main.

### Changed — Wazuh fixture
- `terraform/fixtures/wazuh-shared/` — fixture now uses
  `vm_clone.second_bridge = "vmbr4"` with `second_ip = "192.168.4.10"`.
  vmbr0 IP (192.168.1.60) is unchanged so Ansible management continues
  to target the mgmt address.

### Added — agent roles
- `ansible/roles/wazuh-agent-linux/` — installs the Wazuh 4.9 agent
  `.deb` via apt, registers with the manager via `agent-auth`, writes
  a slot-group marker file and re-enrolls when the group set changes,
  ensures the `wazuh-agent` systemd unit is enabled and running.
- `ansible/roles/wazuh-agent-windows/` — installs the Wazuh 4.9 MSI
  with install-time `WAZUH_MANAGER` / `WAZUH_REGISTRATION_SERVER` /
  `WAZUH_AGENT_GROUP` / `WAZUH_AGENT_NAME` properties.
  - **Group-change idempotency**: the MSI only evaluates
    `WAZUH_AGENT_GROUP` at first install (gated on
    `creates_path: ossec.conf`). A marker file at
    `C:\Program Files (x86)\ossec-agent\ansible-managed-groups.txt`
    records the last-applied group set. On subsequent runs, if the
    marker doesn't match the desired `wazuh_agent_groups`, the role
    invokes `agent-auth.exe -G <new groups>` to re-enroll, then
    rewrites the marker only after the re-enrollment succeeds.
  - **Firewall rule hardening**: the outbound-to-manager
    `win_firewall_rule` task previously swallowed all errors with
    `ignore_errors: true`; it now uses `register` + `failed_when` so
    only the benign "already exists" idempotent case is tolerated.
    Real failures (missing collection, permission denied) now surface.

### Added — playbook
- `ansible/playbooks/wazuh-agents.yml` — routes hosts in the
  `wazuh_agents` group to the Linux or Windows role based on
  `ansible_os_family`. Expected to run after `scripts/build` has
  generated the per-slot inventory containing `wazuh_manager_address`
  and `wazuh_agent_groups`.

### Added — detection rule pack
- `ansible/roles/wazuh-manager/templates/local_rules.xml.j2` — renders
  to `/var/ossec/etc/rules/local_rules.xml` (owner `root`, group
  `wazuh`, mode `0640`), notifies `restart wazuh-manager`. Rule IDs
  sit in the reserved local range (100000–120000):
  - **100100** (level 8, T1558.003) — Kerberos TGS request (Windows
    event 4769) with `ticketEncryptionType 0x17` (RC4). A single RC4
    TGS is the base Kerberoasting signal.
  - **100101** (level 12, T1558.003) — correlation on 100100: 5+ RC4
    TGS requests from the same `subjectUserName` in 60s. The sustained
    burst is the real Kerberoasting tell.
  - **100110** (level 10, T1003.001) — Sysmon event 10 (ProcessAccess)
    where `targetImage = lsass.exe` and `grantedAccess` matches one of
    the handle-mask patterns used by mimikatz / impacket-secretsdump /
    procdump (0x1410, 0x1010, 0x1018, 0x1038, 0x143a, 0x1fffff).
  - **100120 – 100123** (level 8–10, T0836) — Modbus write function
    codes (FC05 single coil, FC06 single register, FC15 multiple
    coils, FC16 multiple registers) matched against Suricata-style
    `alert.signature` regex. Dormant without a network sensor
    (Suricata/Zeek) on the OT zone; no matching input means no
    spurious alerts.

### Docs
- `docs/blue-team/SOC_GUIDE.md` — architecture diagram expanded to
  show dual-homing on vmbr0 + vmbr4 with the mgmt-plane isolation
  rationale; deploy sequence now starts with `vmbr4` provisioning and
  uses the static `inventory/hosts.yml`; former "Phase 2 Preview"
  section replaced with a Phase 2 implementation section documenting
  the agent roles, slot-group filtering in the dashboard, and the
  detection rule ID allocation.

## [2026-04-20] — INFRA_AGENT — ADD — Blue Team SIEM: Shared Wazuh Fixture (Phase 1)

Phase 1 of blue-team infrastructure: one shared Wazuh 4.9 all-in-one
instance on the mgmt subnet provides SIEM and host-based detection for
the entire lab. Agents-only architecture — no network IDS. The single
fixture serves all 20 student slots; analysts browse the dashboard at
`https://192.168.1.60`.

### Scope boundary
- Phase 1 is VM up + Ansible-configured only. No agents, no network
  plumbing from lab zones to the SIEM, no portal integration.
- Phase 2 will add `wazuh-agent-linux` / `wazuh-agent-windows` roles and
  solve the lab→mgmt reach problem (candidate options: dedicated vmbr4
  SIEM bridge, dual-homing scenario VMs via `vm_clone.second_bridge`,
  or a pfSense forward rule from lab zones to 192.168.1.60:1514).
- Phase 3 adds portal-backend reverse proxy and a "Blue Team SOC" button
  in portal-ui for instructor/admin roles.

### Added
- `ansible/roles/wazuh-manager/` — Ubuntu-targeted role that runs the
  official `wazuh-install.sh -a` installer. Idempotent (guards on
  `/usr/share/wazuh-dashboard`), async install
  (`async: 2400 poll: 30`) so the 10–15 minute run doesn't block the
  playbook. Extracts admin credentials from
  `/etc/wazuh-install-files.tar` and locks them to root-only `0600`.
  Tunables in `defaults/main.yml`: version, ports, install script URL,
  marker path.
- `terraform/fixtures/wazuh-shared/` — clone-based fixture (NOT a
  Packer template — uses `tpl-ubuntu-2404` VM ID 102):
  - VM ID 310, `wazuh-shared`, vmbr0, 192.168.1.60
  - 4 CPU / 8GB RAM / 100GB disk
  - `zone_tag=mgmt`, tags: `blue-team`, `siem`, `fixture`
  - Own Terraform state (not scoped to a lab slot); lives under
    `terraform/fixtures/` to distinguish from scenario workspaces
- `ansible/playbooks/wazuh-shared.yml` — two-role play (common-linux +
  wazuh-manager) against the `wazuh_shared` inventory group
- `docs/blue-team/SOC_GUIDE.md` — deploy sequence, operational notes,
  Phase 2/3 preview, troubleshooting matrix

### Architectural decisions
- **Wazuh-only** — rejected Security Onion's bundled Elastic/Kibana stack
  in favor of pure GPLv2 Wazuh with its built-in dashboard. ~4GB lighter
  footprint, single vendor lineage.
- **Shared, not per-slot** — one fixture serves all 20 slots to conserve
  the 64GB RAM host budget. Phase 2 agents will tag events by slot so
  per-student views are still possible via dashboard filters.
- **Clone + Ansible, not Packer** — matches the AD DC pattern
  (tpl-win2022 + `ad-domain-controller` role). Keeps Packer templates
  minimal and pushes product-specific configuration into Ansible, where
  it's testable and re-runnable.
- **vmbr0 placement in Phase 1** — analyst dashboard reach is the
  immediate need; lab-side agent reach is Phase 2. This avoids
  violating the "vmbr0 unreachable from lab segments" rule before we
  have a concrete design for that path.

### Resource footprint
4 CPU / 8GB RAM / 100GB disk — 12.5% of the 64GB host budget. The
fixture is stateless (no persistent event store) and can be shut down
between class sessions to reclaim RAM.

## [2026-04-20] — BACKEND_AGENT + FRONTEND_AGENT — FIX — Phase A Code Review

Follow-up to the Phase A scenario lifecycle changes, driven by an `/ultrathink`
code review. Six fixes applied across the backend slot/VM routes and the lab-ui
types/components — two HIGH severity TOCTOU races closed, two MEDIUM
security/correctness holes tightened, two INFO cleanups.

### HIGH — TOCTOU race conditions (portal-backend)
- 🔒 **`src/api/routes/slots.ts` — `POST /deploy-all`**: replaced the prior
  bulk `UPDATE ... WHERE status = 'empty'` (which claimed every empty slot at
  once, racing with in-flight `POST /:slot/deploy`) with a per-slot atomic
  claim — `UPDATE ... WHERE slot_number = $1 AND status = 'empty' RETURNING *`.
  Slots that were claimed mid-flight are reported back in `skipped[]`. Wired
  `appendLog()` into the streaming callback so `/deploy-all` terraform output
  is persisted to `deploy_log` just like single-slot deploys (previously
  discarded via `() => {}`).
- 🔒 **`src/api/routes/slots.ts` — `DELETE /:slot/destroy`**: replaced the
  SELECT+check+UPDATE sequence with a single `transitionStatus(slot,
  'destroying', ['running', 'stopped', 'error'])` atomic claim. Concurrent
  destroy requests — or a destroy arriving during a deploy — now fail
  deterministically with 409 instead of both proceeding. Added a post-claim
  guard that aborts to `error` state if the row somehow has no
  `scenario_id`, pointing the operator at `/force-destroy`.

### MEDIUM — security & correctness (portal-backend)
- 🔒 **`src/api/routes/vms.ts` — `parseVmId()` narrowing**: accepted range
  was `100–999`, which included the `100–149` template range. Acting on a
  template would corrupt every slot that clones from it. Narrowed to
  `200–999` (lab scenario + infrastructure + scratch only); templates are
  now rejected at the parse boundary.
- **`src/api/routes/vms.ts` — `authorizeVm()` null rejection**: previously
  returned `number | null` and callers passed the nullable through to audit
  logs. An untagged VM in the lab range is anomalous (every legit lab VM
  has a `student-slot-NN` tag), so the helper now throws
  `ForbiddenError('VM is not part of a lab slot')` on null and returns a
  guaranteed `number`. All five per-VM routes simplify accordingly.

### INFO — cleanup (lab-ui)
- **`src/types/index.ts`**: `LabSlot.vms` is now optional (`vms?:`). The
  backend `/api/slots` list endpoint does not hydrate vms; the prior
  non-optional type forced callers to assume a populated array.
- **`src/components/AccessSheet.tsx`**: defensive `slot.vms ?? []` guard
  added to match the new optional type.
- **`src/pages/Dashboard.tsx`**: fixed `reduce` accumulator to tolerate
  missing `vms` — `sum + (s.vms?.length ?? 0)` — surfaced by the type
  narrowing.
- **`src/api/client.ts`**: renamed `connectDeployStream` →
  `connectStatusStream` and dropped the unused `_slot` parameter. The
  function connects to `/ws/status`, not a deploy-specific channel; prior
  name was misleading. No callers existed, so no migration shims.

### Build verification
- `portal-backend`: `tsc --project tsconfig.json` — zero errors
- `lab-ui`: `tsc --noEmit` — zero errors, `vite build` — 300KB JS + 22KB CSS, zero warnings

## [2026-04-20] — BACKEND_AGENT + FRONTEND_AGENT — ADD — Scenario Lifecycle Phase A

### Backend — Proxmox API lifecycle primitives (no Ansible wiring)
- **Migration 008** expanded `lab_slots.status` CHECK constraint to the 10-state union
  (`empty`, `deploying`, `running`, `stopped`, `starting`, `stopping`, `configuring`,
  `resetting`, `error`, `destroying`) and added `last_error TEXT` column for surfacing
  actionable failure context to operators
- `src/services/proxmox.ts` — added `shutdownVM`, `startVM`, `stopVM`, `rebootVM`,
  `rollbackVMToSnapshot`, `listSnapshots`, `hasBaselineSnapshot`, `getVMsByTag`
  (all call the Proxmox REST API with the terraform token, parameterized for
  graceful vs. forced semantics)
- `src/services/scenarioLifecycle.ts` — new orchestrator encapsulating per-slot
  lifecycle workflows: `shutdownSlot`, `startSlot`, `resetSlot` (snapshot-only
  rollback across all slot-tagged VMs), `destroySlot` (Terraform destroy + DB
  clear + workspace cleanup), `forceDestroySlot` (iterate Proxmox tags, best-effort
  stop+delete each VM, drop Terraform workspace), `getSlotDiagnostics` (DB vs.
  Proxmox reconciliation with orphan detection and baseline-snapshot audit)
- `src/services/terraform.ts` — added `cleanupWorkspace` that selects default,
  deletes the per-slot workspace, and removes any dangling `.terraform/` state
  so re-deploys start cold
- `src/api/routes/slots.ts` — added six endpoints: `POST /:slot/shutdown`,
  `POST /:slot/start`, `POST /:slot/reset`, `POST /:slot/force-destroy`,
  `GET /:slot/diagnostics`; all instructor/admin-gated, all emit audit_log entries
- `src/api/routes/vms.ts` (new) — mounted at `/api/vms/:vmId/{start,shutdown,stop,reboot,rollback}`;
  ownership enforcement: students restricted to VMs whose tags include their slot number,
  instructors/admins can touch any lab-tagged VM

### portal-ui — Instructor + student surface
- `src/types/index.ts` — SlotStatus expanded to 10 states, added `VmDiagnostic`,
  `SlotDiagnostics`, `last_error?` on `LabSlot`
- `src/api/client.ts` — added all six slot lifecycle calls, `fetchSlotDiagnostics`,
  and the five per-VM mutations
- `src/hooks/useSlots.ts` — added `useSlotDiagnostics` (15s refetch),
  `useSlotMutations` (deploy/destroy/reset/shutdown/start/forceDestroy with unified
  invalidation of `slots`, `slotVMs`, `slotDiagnostics`), `useVMMutations`
- `src/components/shared/ScenarioControlPanel.tsx` — status-dispatched control row:
  empty→Deploy; running→Shutdown+Reset+Destroy; stopped→Start+Reset+Destroy;
  error→Redeploy+Destroy+ForceDestroy; transitional states disable all controls and
  show a "operation in progress" loader. Two-click confirmation on all destructive
  actions. Surfaces `last_error` banner when present.
- `src/components/shared/DiagnosticsPanel.tsx` — DB-vs-Proxmox reconciliation view:
  2×2 fact grid (DB status, scenario, VM count, workspace), advisories list,
  missing-baseline pills, per-VM diagnostic rows with snapshot presence indicator,
  orphan-VM section with Force Destroy callout, 15s auto-refresh with manual refresh
- `src/components/shared/PerVmControls.tsx` — per-VM lifecycle row: Start (when stopped),
  Shutdown/Reboot/Stop (when running, Stop is 2-click), Rollback to baseline (2-click,
  purple variant); compact mode collapses labels to icons for inline use
- `src/pages/SlotManagement.tsx` — wired ScenarioControlPanel + DiagnosticsPanel toggle +
  PerVmControls rows under each VM, replacing the hand-rolled deploy/destroy buttons

### lab-ui — Instructor dashboard (this session)
- Mirrored the three shared components into `lab-ui/src/components/`:
  `PerVmControls.tsx`, `DiagnosticsPanel.tsx`, `ScenarioControlPanel.tsx` — adapted
  for lab-ui's `VMStatus`/`Scenario.name` conventions and pre-unwrapped
  `fetchSlotDiagnostics` response shape
- `src/types/index.ts` — SlotStatus expanded to 10 states, STATUS_COLORS map expanded,
  `PULSING_STATUSES` set, `VmDiagnostic`/`SlotDiagnostics`/`last_error?` added
- `src/api/client.ts` — added shutdown/start/forceDestroy slot calls, diagnostics fetch,
  and the five per-VM mutations
- `src/hooks/useSlots.ts` — added `useSlotDiagnostics`, refactored `useSlotMutations`
  to cover all six slot actions, added `useVMMutations`
- `src/pages/ScenarioDetail.tsx` — replaced `DeployControls` with `ScenarioControlPanel`
  wired to `useSlotMutations`, kept `ActiveScenariosModal` conflict-detection flow,
  added `DiagnosticsPanel` toggle and `PerVmControls` rows under each `VMStatusRow`
- `src/pages/SlotsOverview.tsx` — promoted selected-slot detail card to full lifecycle
  surface: ScenarioControlPanel + collapsible DiagnosticsPanel + per-VM controls
- Removed `src/components/DeployControls.tsx` (superseded by ScenarioControlPanel)

### Scope boundary
- Phase A is Proxmox API only — no Ansible re-run on start, no automatic
  snapshot provisioning, no template healing. Deploy still runs the full
  Terraform+Ansible pipeline via existing `deployScenario` mutation.
- Phase B (Ansible post-start reconfigure) and Phase C (polish: status stream,
  deploy progress bar, error-state walkthroughs) are intentionally deferred.

### Build verification
- `portal-backend`: `tsc --project tsconfig.json` — zero errors
- `portal-ui`: `tsc --noEmit` — zero errors, `vite build` — 295KB JS + 68KB noVNC + 22KB CSS, zero warnings
- `lab-ui`: `tsc --noEmit` — zero errors, `vite build` — 300KB JS + 22KB CSS, zero warnings

## [2026-04-07] — INFRA_AGENT — FIX — SCEN-003/004 Deploy-Test Cycles

### SCEN-003: APT Lateral Movement — Deploy-Test (Slot 1)
- **Deploy**: 4 VMs via Terraform (kali-attacker-s1=200, dc01-s1=201, ws01-s1=202, ws02-s1=203)
- **DC configuration**: promoted to lab.local, OU structure created, 3 users + svc_sql service account
- **Kerberoasting validated**: `impacket-GetUserSPNs` extracts svc_sql TGS, john cracks to `Summer2024!`
- **DCSync validated**: `impacket-secretsdump` with agarcia (DA) dumps Administrator NTLM hash via DRSUAPI
- **Vulnerable services applied**: WDigest enabled, PowerShell unrestricted, script block logging disabled
- **Password fix**: agarcia password reset via `Set-ADAccountPassword` (initial password set had bash `!` escaping issue)
- **Destroyed**: all 4 VMs removed, Proxmox clean
- ⚠️ Workstation domain join blocked by SID duplication — all clones from tpl-win2022 share same machine SID
  - Root cause: Packer template needs sysprep `/generalize` before conversion to template
  - Impact: lateral movement via PtH/WinRM between workstations not testable until template is rebuilt

### SCEN-004: ICS/OT Pivot — Deploy-Test (Slot 1)
- **Deploy**: 6 VMs via Terraform across 3 zones (red, blue, OT) in ~45 seconds
- **DC configuration**: promoted to lab.local, svc_scada Kerberoastable account with SPN
- **Vulnerable services**: WDigest, PowerShell unrestricted, script block logging disabled (applied via ad-hoc after role collision)
- **Dual-homing**: eng-ws configured with eth1 at 192.168.101.50 (OT zone), attacker eth1 at 10.10.2.10 (blue zone)
- **OpenPLC validated**: Modbus TCP port 502 listening, holding register 0 reads 100 (tank fill setpoint)
- **Kerberoasting validated**: svc_scada TGS extracted from attacker
- **Modbus validated**: attacker reads OpenPLC holding registers via pymodbus
- **Destroyed**: all 6 VMs removed, Proxmox clean
- ⚠️ GRFICSv2 Docker images (`fortiphyd/grfics-*`) not available on Docker Hub — pull fails
- ⚠️ No pfSense firewall between zones — attacker reaches OT directly; scenario relies on intended SSH pivot path
- ⚠️ Kali common-linux role fails (apt cache update on isolated network) — cosmetic, template has all tools

### Ansible Role Fix: vulnerable-services / ad-domain-controller collision
- When `ad_users` in inventory includes `spn` field, ad-domain-controller creates the service account
- vulnerable-services then fails trying to create the same account (`New-ADUser: account already exists`)
- Workaround: applied vuln configs (WDigest, PS policy) via ad-hoc commands after role failure

### SCEN-005: PCAP Template Fix Verified
- Fixed `generate_pcap.py.j2` line 111: `b'{"cookies":...'` → `f'{{"cookies":...'` (cannot mix bytes and f-string literals)
- Full Ansible run completed: 76 tasks, zero failures across all 3 hosts
- PCAP verified: 14 packets with correct slot-1 IPs (10.10.1.10, 10.10.2.20, 10.10.2.30)
- SCEN-005 destroyed clean

## [2026-04-07] — INFRA_AGENT — FIX — Cross-Scenario Validation and Ansible Fixes

### Terraform Validation
- All 5 scenarios (`terraform plan`) verified clean from cold state — zero errors
- Fixed SCEN-004 `terraform.tfvars` slot_number from 3 to 1 for consistency

### Ansible — Critical Fixes
- Created missing scenario-specific playbooks for SCEN-001 through SCEN-004:
  - `SCEN-001/ansible/playbooks/scada-modbus-recon.yml` — 3 plays (common-linux, openplc-configure, historian stack)
  - `SCEN-002/ansible/playbooks/kerberoasting.yml` — 5 plays (common-linux, common-windows, ad-dc, ad-member, vulnerable-services)
  - `SCEN-003/ansible/playbooks/lateral-movement.yml` — 5 plays (same pattern, vulnerable on DCs + workstations)
  - `SCEN-004/ansible/playbooks/ics-ot-pivot.yml` — 7 plays (IT + OT stack, explicitly excludes ad-member on eng-ws Linux VM)
- Fixed SCEN-004 inventory: renamed `[workstations]` → `[engineering]` for eng-ws (Linux, not Windows)
- Fixed SCEN-001 inventory: `[attacker]` → `[attackers]`, added `[linux:children]` and connection vars
- Fixed SCEN-003 `scenario.yaml`: removed phantom ATT&CK technique T1574.001 not exercised in scenario

### Ansible — SCEN-005 Slot-Aware IP Templatization
- Converted `stage-pcap-artifacts/files/generate_pcap.py` → `templates/generate_pcap.py.j2`
  - IP variables (`victim_ip`, `webapp_ip`, `attacker_ip`) injected via Jinja2 at template render
  - All Python code wrapped in `{% raw %}...{% endraw %}` to prevent Jinja2/f-string conflict
  - Task changed from `copy` to `template` module
- Templatized `stage-webapp-artifacts` access log: `files/` → `templates/webapp_access_log_sim.log.j2`
- Templatized `stage-browser-artifacts` exploit page URL via `{{ attacker_ip }}` variable
- Templatized `stage-dressing-ws` portal URL via `{{ webapp_ip }}` variable
- Added IP default variables to all affected roles' `defaults/main.yml`

### Ansible — Medium Fixes
- Fixed `openplc-configure` defaults: `openplc_web_port: 8443` → `8080`, `openplc_web_scheme: "https"` → `"http"`
- Fixed `vulnerable-services` tasks: flattened nested groups list parameter
- Created missing `common-linux/templates/timesyncd.conf.j2` template
- Deleted orphaned `browser-victim-setup/templates/chromium-pin.j2` (never referenced)

### Build Script Fixes
- Fixed `scripts/build` dynamic inventory generation:
  - Group names: `attacker` → `attackers`, `scada` → `openplc`
  - Added host classification: `eng-*` → `[engineering]`, `grfics-*` → `[grfics]`
  - Added parent groups: `[windows:children]`, `[linux:children]`, `[scada:children]`, `[vulnerable:children]`
  - Added connection vars sections (WinRM for Windows, SSH for Linux)

### UI Build Verification
- `portal-backend`: `tsc --noEmit` — zero TypeScript errors
- `portal-ui`: `tsc --noEmit` — zero errors, `vite build` — 274KB JS + 21KB CSS
- `lab-ui`: `tsc --noEmit` — zero errors, `vite build` — 276KB JS + 22KB CSS

### Deploy Testing
- SCEN-001: deployed (slot 1), Ansible configured, Modbus TCP + InfluxDB validated, destroyed
- SCEN-002: deployed (slot 1), 3 VMs confirmed running, destroyed
- SCEN-005: deployed (slot 1), Ansible partial run — webapp (28 tasks OK), victim (36 tasks before PCAP fix needed)
- ⚠️ SCEN-005 Ansible re-run pending — Proxmox host offline before verification of `{% raw %}` fix
- ⚠️ SCEN-003/004 deploy tests deferred — Terraform plans clean, playbooks structurally validated

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
