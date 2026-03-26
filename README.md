# Vulnerability Testing Lab

**Operator**: <Company name to be determined> 
**Platform**: Proxmox VE 8.x · Dell Precision 5820 · 64 GB RAM · 4 TB ZFS  
**Automation**: Claude Code (Opus 4.6) · Terraform · Packer · Ansible  

A professional, scenario-driven cybersecurity training environment with full ICS/SCADA
simulation. Scenarios deploy and destroy autonomously from a single command. The entire
lab is built and maintained by Claude Code agents — you describe what you want, the agents
build it.

> **⚠️ AUTHORIZED USE ONLY** — This repository contains intentionally vulnerable
> configurations designed for controlled training environments. Never deploy on a
> production network or expose to the internet.

---

## What This Lab Provides

| Capability | Detail |
|---|---|
| Network zones | Red (attacker), Blue (IT victim), OT (SCADA/ICS) — isolated by default |
| Windows targets | Active Directory domain, workstations, vulnerable services |
| Linux targets | Ubuntu/Debian VMs, Metasploitable 3 |
| ICS/SCADA | OpenPLC Runtime v3, Ignition 8.1 dev, GRFICSv2 chemical plant simulation |
| Protocols | Modbus TCP, DNP3, EtherNet/IP, OPC-UA, IEC 61850 |
| Scenarios | Deployable labs mapped to MITRE ATT&CK and ATT&CK for ICS |
| Automation | Single-command deploy and destroy via Terraform + Ansible |
| Lab UI | React dashboard for scenario management and live VM status |
| Documentation | Auto-generated changelogs, scenario cards, instructor guides |

---

## Quick Start

### Prerequisites
See [docs/setup/01_PROXMOX_SETUP.md](docs/setup/01_PROXMOX_SETUP.md) for the complete
Proxmox installation and configuration walkthrough.

| Requirement | Version | Notes |
|---|---|---|
| Proxmox VE | 8.3+ | Fully configured per setup guide |
| Node.js | 22 LTS | On your management workstation |
| Claude Code | 2.1.59+ | Requires Claude Max or API key |
| Terraform | 1.9+ | On management workstation |
| Packer | 1.11+ | On management workstation |
| Ansible Core | 2.17+ | On management workstation |
| Git | Any | For cloning and version control |

### Clone and Initialize

```bash
# Clone the repository
git clone https://github.com/YOUR-USERNAME/vuln-lab.git
cd higher-echelon-vuln-lab

# Install Claude Code
npm install -g @anthropic-ai/claude-code
claude --version  # verify >= 2.1.59

# Set up your global user memory (one time, applies to all projects)
cp user-CLAUDE.md ~/.claude/CLAUDE.md

# Configure credentials
cp scripts/lab-env.sh scripts/lab-env.local.sh
nano scripts/lab-env.local.sh   # fill in Proxmox API token and SSH key
source scripts/lab-env.local.sh  # exports env vars Claude Code inherits

# (Optional) Install MCP memory server for persistent knowledge graph
npm install -g @modelcontextprotocol/server-memory
# Then add the mcpServers block to ~/.claude.json — see SETUP_GUIDE.md Part 5
```

### Build the Lab

Launch Claude Code and build each phase:

```bash
claude

# In Claude Code:
/status          # verify project is recognized
/phase 1         # Proxmox base config
/phase 2         # ZFS storage
/phase 3         # network bridges + firewall
/phase 4         # Packer VM templates (~45 min for Windows builds)
/phase 5         # Terraform modules
/phase 6         # Ansible roles
/phase 7         # SCADA stack
/phase 8         # scenario catalog
/phase 9         # lab management UI
/phase 10        # documentation set
```

### Deploy a Scenario (after build)

```bash
./scripts/deploy.sh
# Interactive menu → select scenario → lab deploys in 3–5 min
# Student access sheet printed to terminal

# Or via Claude Code:
/orchestrate deploy cred_access_kerberoasting and print the student access sheet
```

### Destroy a Scenario

```bash
./scripts/destroy.sh scada_modbus_recon

# Or via Claude Code:
/orchestrate destroy the scada_modbus_recon scenario and clean up the workspace
```

---

## Repository Structure

```
higher-echelon-vuln-lab/
│
├── CLAUDE.md                     ← Claude Code project memory (auto-loaded every session)
├── ORCHESTRATOR.md               ← Master agent — owns phase ordering and task delegation
├── CONVENTIONS.md                ← Universal rules: versioning, git workflow, naming, IPs
├── CHANGELOG.md                  ← All changes (maintained by DOCS_AGENT automatically)
├── COMMAND_EXAMPLES.md           ← Usage examples for every slash command
├── SETUP_GUIDE.md                ← Complete Claude Code setup walkthrough
├── user-CLAUDE.md                ← Copy to ~/.claude/CLAUDE.md for global preferences
│
├── .claude/                      ← Claude Code configuration (committed to git)
│   ├── settings.json             ← Model (opus-4-6), auto-memory, permissions
│   ├── memory/                   ← Auto-populated by Claude Code (gitignored)
│   ├── rules/                    ← Context-aware rules loaded by file type
│   │   ├── terraform.md          ← Loads when editing *.tf files
│   │   ├── packer.md             ← Loads when editing *.pkr.hcl files
│   │   ├── ansible.md            ← Loads when editing *.yml files
│   │   └── frontend-go.md        ← Loads when editing *.tsx/*.go files
│   └── commands/                 ← Slash commands
│       ├── orchestrate.md        → /orchestrate  multi-agent task dispatch
│       ├── phase.md              → /phase        build a complete phase
│       ├── new-scenario.md       → /new-scenario build scenario from description
│       ├── test-all.md           → /test-all     validate everything
│       ├── status.md             → /status       project state snapshot
│       ├── fix.md                → /fix          self-healing error resolution
│       ├── snapshot.md           → /snapshot     VM baseline snapshots
│       └── agents/
│           ├── infra.md          → /infra        infrastructure tasks
│           ├── scada.md          → /scada        ICS/OT tasks
│           ├── frontend.md       → /frontend     UI tasks
│           ├── security.md       → /security     hardening/ATT&CK tasks
│           └── docs.md           → /docs         changelog and docs tasks
│
├── agents/                       ← Agent persona files (referenced with @agents/)
│   ├── INFRA_AGENT.md            ← Proxmox, Terraform, Packer, Ansible specialist
│   ├── FRONTEND_AGENT.md         ← React UI, lab dashboard, student portal
│   ├── SCADA_AGENT.md            ← ICS protocols, OpenPLC, Ignition, GRFICSv2
│   ├── SECURITY_AGENT.md         ← Hardening, CVE mapping, ATT&CK, firewall policy
│   └── DOCS_AGENT.md             ← Changelogs, scenario cards, reference docs
│
├── skills/                       ← Technical reference files (referenced with @skills/)
│   ├── PROXMOX_SKILL.md          ← CLI commands, bridge config, ZFS, API tokens
│   ├── TERRAFORM_SKILL.md        ← bpg/proxmox provider patterns, module design
│   ├── PACKER_ANSIBLE_SKILL.md   ← Template patterns, autounattend.xml, roles
│   ├── SCADA_SKILL.md            ← Protocol reference, OpenPLC, Ignition, GRFICSv2
│   └── FRONTEND_SKILL.md         ← React 19/Vite 6 patterns, design system
│
├── docs/                         ← All documentation (maintained by DOCS_AGENT)
│   ├── VERSION_MANIFEST.md       ← All pinned tool and library versions
│   ├── setup/                    ← Phase-by-phase setup guides (generated during build)
│   ├── scada/                    ← Protocol reference, PLC guides, register maps
│   ├── security/                 ← ATT&CK coverage matrix, firewall policy, hardening
│   ├── scenarios/                ← One directory per scenario with card, objectives, walkthrough
│   └── ui/                       ← Lab UI operating guide
│
├── packer/                       ← VM template builds
│   ├── variables.pkrvars.hcl.example  ← Template — copy and fill in, never commit real
│   ├── templates/                ← .pkr.hcl files (generated by /phase 4)
│   └── http/                     ← preseed.cfg, autounattend.xml served during builds
│
├── terraform/                    ← Infrastructure as code
│   ├── terraform.tfvars.example  ← Template — copy and fill in, never commit real
│   ├── modules/                  ← Reusable modules (generated by /phase 5)
│   │   ├── vm_clone/             ← Linked-clone module for all VMs
│   │   ├── network_segment/      ← Bridge + firewall rules per zone
│   │   └── scada_node/           ← Specialized OT zone VM module
│   └── scenarios/                ← One directory per scenario (generated by /phase 8+)
│
├── ansible/                      ← Configuration management
│   ├── ansible.cfg               ← Global Ansible config (generated by /phase 6)
│   ├── roles/                    ← All roles (generated by /phase 6)
│   ├── inventory/                ← Dynamic inventory from Terraform outputs
│   └── group_vars/               ← Variables by host group
│
├── lab-ui/                       ← Scenario deployment dashboard (generated by /phase 9)
│   └── src/                      ← React 19 + Vite 6 + TypeScript source
│
└── scripts/                      ← Shell utility scripts
    ├── lab-env.sh                ← Environment variable setup template
    ├── deploy.sh                 ← Interactive scenario deployment menu (generated)
    └── destroy.sh                ← Scenario teardown script (generated)
```

---

## Scenario Catalog

| ID | Name | Difficulty | Duration | Focus |
|---|---|---|---|---|
| SCEN-001 | SCADA Modbus Recon & Manipulation | Beginner | 2h | ICS/OT |
| SCEN-002 | Kerberoasting Credential Access | Intermediate | 3h | AD/Windows |
| SCEN-003 | APT Lateral Movement | Advanced | 5h | AD/Windows |
| SCEN-004 | IT→OT Pivot (Capstone) | Expert | 8h | Full chain |

Add new scenarios at any time:
```
/new-scenario <describe the attack chain and learning objectives>
```

---

## Network Architecture

```
Management (vmbr0) — 172.16.0.0/24
  Proxmox UI · Terraform · Ansible · Claude Code
  NEVER reachable from lab segments

Red Zone (vmbr1) — 10.10.1.0/24
  Kali Linux attacker platform
  Go assessment toolkits · Metasploit · Impacket

IT / Blue Zone (vmbr2) — 10.10.2.0/24
  Windows Server 2022 (AD DC) · Windows 10 workstations
  Ubuntu/Debian Linux · Metasploitable 3

OT / SCADA Zone (vmbr3) — 192.168.100.0/24
  OpenPLC Runtime (Modbus TCP :502)
  Ignition 8.1 HMI (OPC-UA :4840)
  GRFICSv2 chemical plant simulation
  InfluxDB historian

pfSense VM bridges vmbr2↔vmbr3 — blocked by default
Scenario-specific rules open specific attack paths
```

---

## Claude Code Agent System

This project uses five specialized Claude Code agents managed by an orchestrator:

| Agent | Slash Command | Responsibility |
|---|---|---|
| INFRA_AGENT | `/infra` | Proxmox, Terraform, Packer, Ansible |
| SCADA_AGENT | `/scada` | ICS protocols, OpenPLC, Ignition, GRFICSv2 |
| FRONTEND_AGENT | `/frontend` | Lab UI dashboard, student portal |
| SECURITY_AGENT | `/security` | Hardening, CVE mapping, MITRE ATT&CK |
| DOCS_AGENT | `/docs` | Changelogs, scenario cards, reference docs |

All agents use Claude Opus 4.6, configured in `.claude/settings.json`.

For complete command examples, see [COMMAND_EXAMPLES.md](COMMAND_EXAMPLES.md).

---

## MITRE ATT&CK Coverage

| Framework | Techniques Covered |
|---|---|
| ATT&CK Enterprise | T1558.003, T1021.002, T1550.002, T1566, T1078.003 |
| ATT&CK for ICS | T0836, T0846, T0855, T0819, T0842, T0817 |

Coverage matrix: [docs/security/ATT&CK_COVERAGE.md](docs/security/ATT&CK_COVERAGE.md)

---

## Security Notice

This repository is designed for authorized training use only:

- All intentionally vulnerable configurations are documented and ATT&CK-mapped
- The management network (vmbr0) is hardened and isolated from all lab segments
- No real credentials, production certificates, or live system configurations
- `lab-env.local.sh` and `*.tfvars` containing real secrets are gitignored
- See [docs/security/HARDENING_CHECKLIST.md](docs/security/HARDENING_CHECKLIST.md)

---

## Documentation

| Document | Purpose |
|---|---|
| [SETUP_GUIDE.md](SETUP_GUIDE.md) | Complete Claude Code and lab setup walkthrough |
| [COMMAND_EXAMPLES.md](COMMAND_EXAMPLES.md) | Usage examples for every slash command |
| [CONVENTIONS.md](CONVENTIONS.md) | Git workflow, naming conventions, IP plan |
| [docs/setup/](docs/setup/) | Phase-by-phase Proxmox and tool setup guides |
| [docs/scada/](docs/scada/) | ICS protocol reference and PLC programming guides |
| [docs/scenarios/](docs/scenarios/) | Scenario cards, objectives, instructor walkthroughs |
| [docs/security/](docs/security/) | Firewall policy, ATT&CK coverage, hardening checklist |

---

## License

This project is for authorized educational and training use only.  
Jason — All Rights Reserved.

Not for redistribution. Not for use on production networks.
