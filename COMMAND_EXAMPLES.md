# Command Usage Examples — Vulnerability Lab

All examples are typed directly into the Claude Code terminal prompt.

---

## BUILD PHASES

### `/phase 1` — Proxmox host config
```
/phase 1
```
Runs the full Proxmox VE 8.x base configuration: updates package repos, disables
enterprise subscription nag, configures ZFS ashift, creates the four network bridges,
sets up the Proxmox firewall with default-deny, and creates the Terraform API token.
No arguments needed — phase 1 is always the same.

---

### `/phase 4` — Packer VM templates (slow)
```
/phase 4
```
Builds all 8 VM templates sequentially. Claude runs each `packer build` command,
streams the output, and waits for completion. If a build fails mid-way (ISO checksum
mismatch, SSH timeout), Claude diagnoses and retries automatically.

To build a single template instead of all 8:
```
/infra build only the OpenPLC packer template — skip the others
```

To rebuild one template that broke without re-running the whole phase:
```
/infra rebuild the Windows Server 2022 packer template — the previous build
failed during VirtIO driver installation
```

---

### `/phase 8` — Scenario catalog
```
/phase 8
```
Builds all 4 initial scenarios with Terraform files, Ansible roles, and full
documentation. Each scenario gets its own terraform workspace and scenario card.

To add extra scenarios during this phase:
```
/phase 8
# When it finishes the 4 default scenarios, continue with:
/new-scenario credential stuffing attack against an Nginx reverse proxy with
weak HTTP Basic Auth in front of an internal Gitea instance
```

---

## DAILY OPERATIONS

### `/status` — Full project state snapshot

Basic check at the start of a work session:
```
/status
```

Check only a specific area:
```
/status packer templates — show which ones are built and which are missing
```

Check before handing the lab to students:
```
/status check if all 4 scenarios are deployed and VMs are running
```

---

### `/test-all` — Validate everything, fix failures

Run after every significant change to catch regressions:
```
/test-all
```

Run scoped to just infrastructure code before a class:
```
/test-all terraform and ansible only — skip the frontend build
```

Run after adding a new scenario to verify it's deployment-ready:
```
/test-all scenarios/ics_ot_pivot only
```

Run as a pre-class checklist the morning before training:
```
/test-all full validation — I have students in 2 hours, fix anything broken
```

---

### `/new-scenario <description>` — Build complete scenario from text

**Basic ICS attack scenario:**
```
/new-scenario Modbus TCP replay attack against an OpenPLC reactor controller —
students capture legitimate Modbus traffic with Wireshark, then replay coil
writes to disable the safety shutoff at a critical process boundary
```

**Windows Active Directory scenario:**
```
/new-scenario AS-REP Roasting against a misconfigured AD domain — one user
account has pre-authentication disabled, students use Impacket GetNPUsers to
extract the hash and crack it offline with hashcat
```

**Multi-stage IT/OT pivot:**
```
/new-scenario spear phishing campaign targeting an Ignition HMI engineer —
initial access via macro-enabled Excel attachment, lateral movement through
the IT network to the engineering workstation, then Modbus manipulation of
a simulated water treatment plant flow rate setpoint. Map to ICS MITRE T0817,
T0836, T0855. Advanced difficulty, 6-hour estimated duration.
```

**Blue team / defender scenario:**
```
/new-scenario defensive scenario — students are SOC analysts responding to
a Splunk alert for lateral movement in the lab.local domain. Pre-stage the
attack artifacts: failed logons in Event Log 4625, Kerberoasting TGS requests
in 4769, and a scheduled task backdoor. Students must triage, contain, and
write an incident report.
```

**Network forensics:**
```
/new-scenario packet capture analysis lab — provide students with a pre-captured
PCAP file containing a DNP3 session with embedded coil manipulation commands.
Students use Wireshark ICS dissectors to identify the attack, determine which
registers were written, and calculate the timing between the recon scan and
the manipulation attempt.
```

**SCADA credential access:**
```
/new-scenario OPC-UA anonymous endpoint exploitation — Ignition gateway is
running with anonymous authentication enabled on the OPC-UA server. Students
discover the endpoint with a node-opcua scanner, browse the tag namespace,
identify writable tags, and modify a reactor temperature setpoint to trigger
a high-temperature alarm. Beginner difficulty, 2 hours.
```

---

### `/fix <error>` — Diagnose and fix an error

**Terraform provider auth failure:**
```
/fix terraform apply fails with: Error creating VM: 403 Forbidden on POST
https://172.16.0.10:8006/api2/json/nodes/pve01/qemu
```

**Packer ISO checksum mismatch:**
```
/fix packer build for kali-2024 fails: checksums don't match — expected
sha256:abc123 but got sha256:def456
```

**Ansible WinRM connection refused:**
```
/fix ansible playbook ad-domain-controller fails at first task with:
WinRM connection refused on 10.10.2.20:5985 — the VM is running and
I can ping it but WinRM isn't responding
```

**TypeScript build error in the lab UI:**
```
/fix npm run build fails with: Type 'string | undefined' is not assignable
to type 'string' in src/components/ScenarioCard.tsx line 47
```

**Proxmox networking issue:**
```
/fix VMs on vmbr2 can ping each other but cannot reach the pfSense gateway
at 10.10.2.1 — the bridge is up and VMs have correct IPs via cloud-init
```

**ZFS pool issue:**
```
/fix zpool status shows DEGRADED on the labdata pool after a hard reboot —
one disk shows FAULTED with checksum errors
```

**Ansible role partially applied:**
```
/fix the ad-domain-controller role ran successfully but the OU structure
wasn't created — the domain was promoted but the task after reboot never
ran. Need to re-run just the OU creation tasks without re-promoting the DC.
```

**OpenPLC not responding on Modbus:**
```
/fix OpenPLC is running and the web interface is accessible on port 8080
but modpoll gets no response on port 502 — the tank_fill_control program
shows as running in the web UI
```

---

### `/snapshot <scenario>` — Baseline snapshot all scenario VMs

Snapshot before a class begins (so you can reset between student groups):
```
/snapshot scada_modbus_recon
```

Snapshot after fully configuring a scenario for the first time:
```
/snapshot ics_ot_pivot — this is the post-configuration baseline, label it
baseline-configured-20250601
```

Snapshot all currently running scenarios at once:
```
/snapshot all running scenarios — take a named snapshot of every active VM
across all workspaces before the training week starts
```

---

### `/rollback <scenario> <snapshot>` — Reset scenario to baseline

Reset between back-to-back student groups:
```
/rollback scada_modbus_recon baseline-20250601
```

Roll back to a specific named snapshot after a student broke something:
```
/rollback ics_ot_pivot baseline-configured-20250601 — a student accidentally
destroyed the pfSense firewall config, need to restore the full scenario
```

Roll back only specific VMs (not the entire scenario):
```
/rollback roll back only the openplc-01 VM in scada_modbus_recon to its
baseline — leave the kali attacker VM as-is
```

---

## AGENT DELEGATION

### `/orchestrate <task>` — Multi-agent coordinated task

Deploy a specific scenario and generate the student handout:
```
/orchestrate deploy the cred_access_kerberoasting scenario, verify all VMs
are running and responding, then generate a printed student access sheet
with IPs, credentials, and the first objective
```

Update all scenarios to use a newer Windows Server template after a Packer rebuild:
```
/orchestrate the Windows Server 2022 packer template was rebuilt as
tpl-win-server-2022-v2. Update all scenario Terraform configs that reference
the old template ID 102 to use the new template ID 103, validate all
affected scenarios, and update the changelog.
```

Full lab readiness check before a training event:
```
/orchestrate pre-training checklist — verify Proxmox host health, confirm
all 8 templates exist and are marked as templates, run terraform validate
on all 4 scenarios, check that the lab UI is accessible on port 3001, and
produce a go/no-go report
```

Add a new Ansible role that applies to multiple existing scenarios:
```
/orchestrate create a new ansible role called 'windows-event-logging' that
enables PowerShell ScriptBlock logging, Process Creation logging (4688),
and Sysmon with the SwiftOnSecurity config. Apply it to all existing Windows
scenarios and update their scenario cards to note the new detection artifacts.
```

---

### `/infra <task>` — Proxmox / Terraform / Packer / Ansible

**Proxmox administration:**
```
/infra increase the memory allocation on all running ics_ot_pivot VMs from
2GB to 4GB — the Ignition HMI is OOMing under load
```

```
/infra create a new ZFS dataset for capturing scenario PCAPs:
labdata/captures with lz4 compression and a 500GB quota
```

```
/infra rotate the Terraform API token — the current one is 90 days old.
Generate a new token, update the lab-env.sh template, and document the
rotation in the CHANGELOG
```

**Terraform:**
```
/infra add a second attacker VM (kali-02) to the apt_lateral_movement scenario
for two-student team exercises — both attackers on vmbr1, same template as kali-01
```

```
/infra write a terraform module called 'pfsense_boundary' that deploys a
pfSense VM on two bridges and outputs the WAN and LAN interface IPs
```

**Packer:**
```
/infra update the kali-2024 packer template to include the Go assessment
toolkit suite — clone from github.com/higher-echelon/toolkit and run go build
in the provisioner
```

```
/infra the Windows 10 workstation template needs Microsoft Office 2019
trial installed via Chocolatey during the Packer build — add the provisioner
```

**Ansible:**
```
/infra write an ansible role called 'smb-null-sessions' that enables null
session access on the Windows Server target — SMB shares browsable without
auth, IPC$ accessible. Map to MITRE T1135.
```

```
/infra the ad-domain-controller role is taking 18 minutes to run. Profile
it and optimize — the reboot waiter is sleeping too long between retries
```

---

### `/scada <task>` — ICS / OT / protocols / PLC

**PLC programming:**
```
/scada write a new ladder logic program for OpenPLC called 'reactor_pressure_control'
— monitors analog input IW0 as pressure (0-4095 = 0-300 PSI), controls a relief
valve output Q0.0, triggers a shutdown alarm output Q0.1 if pressure exceeds
the setpoint in holding register QW0. Include the full Modbus register map.
```

```
/scada add a second PLC program to the ics_ot_pivot scenario: a pump speed
controller that takes a VFD speed reference from Modbus register QW1 (0-1000 = 0-100
Hz) and has a safety interlock that ignores writes above 600 (60 Hz)
```

**Protocol configuration:**
```
/scada configure DNP3 on a new Ubuntu VM — run OpenDNP3 outstation on port 20000,
expose the same coil map as the OpenPLC Modbus endpoint so students can compare
the protocols side by side
```

```
/scada add OPC-UA anonymous authentication to the Ignition gateway config —
disable certificate validation and enable the anonymous endpoint on port 4840
so it's exploitable in the ics_ot_pivot scenario
```

**GRFICSv2:**
```
/scada the GRFICSv2 simulation is running but the reactor pressure readout
on the HMI shows 0.0 — the historian isn't receiving tag updates. Diagnose
and fix the Modbus polling between the PLC container and the historian.
```

```
/scada document the full GRFICSv2 attack surface: list every Modbus register
that controls a safety-critical parameter, the normal operating range, and
the value that triggers an emergency shutdown
```

**Scenario design:**
```
/scada design a 4-hour SCADA attack/defend exercise where the red team
tries to manipulate the GRFICSv2 reactor temperature beyond safe limits
and the blue team monitors InfluxDB historian trends and Wireshark captures
for anomalous Modbus writes. Include IOCs and detection criteria.
```

---

### `/frontend <task>` — React UI / dashboard / components

**New features:**
```
/frontend add a 'VM Console' panel to the scenario dashboard — clicking a
VM node in the topology diagram opens an xterm.js terminal with a noVNC-style
connection to the Proxmox VM console via the Proxmox websocket API
```

```
/frontend build a real-time Modbus register viewer component — connects to
a configurable IP:port via a WebSocket proxy, displays coil states as green/red
indicators and holding registers as numeric values that update every 500ms
```

```
/frontend the scenario deployment dashboard needs a 'class timer' feature —
a countdown clock the instructor sets (30 min, 1hr, 2hr) that shows on the
student portal and plays a chime at 10 minutes remaining
```

**Design and layout:**
```
/frontend the scenario card grid is showing 4 columns on wide monitors
which makes the cards too narrow. Change it to a responsive 2-column layout
with a fixed 380px card minimum width.
```

```
/frontend add ATT&CK technique badges to each scenario card — small pill
badges showing the MITRE technique IDs (e.g. T1558.003) pulled from the
scenario.yaml metadata, colored amber for ICS techniques and blue for
Enterprise techniques
```

**Student portal:**
```
/frontend build the student access portal page — read-only view showing:
current scenario name and objectives as a checklist, network diagram of
their assigned segment, credential table (no passwords until they click
'reveal'), and a progress tracker with self-reported checkboxes
```

---

### `/security <task>` — Hardening / CVEs / ATT&CK / firewall

**Firewall policy:**
```
/security the ics_ot_pivot scenario needs a specific firewall rule in pfSense:
allow TCP/502 (Modbus) from 10.10.2.30 (engineering workstation) to
192.168.100.10 (OpenPLC) only — all other cross-zone Modbus traffic stays blocked.
Write the Ansible task to configure this via the pfSense API.
```

```
/security audit the current Proxmox host firewall rules — output a table of
every allow rule with source, destination, port, and whether it should be
there according to the management-plane-only policy
```

**Vulnerability documentation:**
```
/security document all intentional vulnerabilities in the apt_lateral_movement
scenario — format as the required table with host, ATT&CK ID, description,
severity, how to introduce, and how to reverse. Add to the scenario card.
```

```
/security review the scada_modbus_recon scenario for unintended attack surface
— check if the OpenPLC web interface (port 8080) is reachable from the red zone.
If it is, that's too easy — document it and add a firewall rule to block it.
```

**Hardening:**
```
/security harden the Proxmox host SSH config — key-only auth, disable root
password login, restrict to management subnet 172.16.0.0/24, set MaxAuthTries 3,
install and configure fail2ban with a 15-minute ban on 5 failed attempts.
Write the Ansible playbook to apply this.
```

```
/security the Kali template has default credentials kali/kali — write an
Ansible task that forces a password change on first login and injects the
student's SSH public key via cloud-init so password auth is disabled
```

**ATT&CK coverage:**
```
/security update the ATT&CK coverage matrix after adding the new
reactor_pressure_control SCADA scenario — it covers T0836 (Modify Parameter)
and T0855 (Unauthorized Command). Add both to ATT&CK_COVERAGE.md with
the scenario name and implementation notes.
```

---

### `/docs <description>` — CHANGELOG + reference docs

After completing infrastructure work:
```
/docs INFRA task complete: added terraform module modules/scada_node for
deploying OT zone VMs with Modbus firewall rules pre-configured. Pinned
bpg/proxmox to 0.66.3.
```

After adding a new scenario:
```
/docs new scenario complete: SCEN-005 reactor_pressure_attack — Advanced,
4 hours, covers T0836 and T0855. Create full scenario card, objectives,
instructor walkthrough, and network map. Update ATT&CK coverage matrix.
```

After a bug fix:
```
/docs fix complete: resolved WinRM connection timeout in ad-domain-controller
Ansible role — increased wait_for timeout from 30s to 120s and added 5 retries.
Add to CHANGELOG under [FIX] and update the KNOWN_ISSUES.md to close issue #3.
```

After a security change:
```
/docs security change: enabled Proxmox datacenter firewall with default-DROP
policy. Updated FIREWALL_POLICY.md with the new rule table. Added hardening
checklist entry for this host.
```

Manually triggering a weekly documentation review:
```
/docs review all scenario cards and flag any that are missing: MITRE technique
table, intentional vulnerability table, or instructor walkthrough section.
Output a list of what needs to be written.
```

---

## MEMORY

### `/memory` — Browse / edit auto-memory

Open and browse what Claude has learned:
```
/memory
```
Then use the auto-memory toggle to verify it's ON, and browse topic files like
`debugging.md`, `api-conventions.md`, and `build-commands.md` that Claude
has populated over previous sessions.

Edit a memory entry that's become stale:
```
/memory
# Navigate to the file and edit: the Proxmox host IP changed from 172.16.0.10
# to 172.16.0.20 after a network reconfiguration
```

---

### `/compact` — Compress session (CLAUDE.md reloads automatically)

Use this when Claude warns you the context window is getting full, or proactively
after a long infrastructure session:
```
/compact
```

After compaction, verify the project context is still intact:
```
/status
# CLAUDE.md reloads automatically — all agent personas, skill references,
# and project rules are re-injected fresh from disk
```

---

### `# <note>` — Save fact to memory immediately

Save a one-off discovery so it persists into future sessions:
```
# The Windows Server 2022 packer build fails if the VirtIO ISO is not mounted
as the SECOND CD-ROM drive — it must be ide1, not ide0
```

```
# Proxmox API returns 596 errors under load when more than 8 VMs are being
cloned simultaneously — stagger clones with a 10-second delay between each
```

```
# GRFICSv2 historian container must be started LAST — if it starts before
the PLC container, the Modbus polling configuration fails silently
```

```
# The Ignition gateway takes 90 seconds to fully start after the service
starts — Ansible wait_for tasks need at least 120s timeout for port 8088
```

---

### `@skills/<file>.md` — Load skill into current prompt

Reference a skill to get protocol-accurate answers:
```
Looking at @skills/SCADA_SKILL.md, what is the correct pymodbus 3.x syntax
to write multiple holding registers in a single FC16 request to the OpenPLC
reactor controller?
```

```
Using @skills/TERRAFORM_SKILL.md as reference, show me how to add a second
network interface to an existing proxmox_virtual_machine resource without
destroying and recreating the VM
```

```
Check @skills/PROXMOX_SKILL.md and tell me the correct ZFS command to see
how much space each VM disk is actually using on disk after thin provisioning
```

```
Per @skills/PACKER_ANSIBLE_SKILL.md, write the autounattend.xml section
that installs the VirtIO balloon and SCSI drivers during the Windows PE phase
```
