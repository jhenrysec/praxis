# Claude Code Setup Guide — <Company name to be determined> Vulnerability Lab

**For**: Jason — Instructor  
**Goal**: Claude Code builds, tests, fixes, and documents the entire lab with minimal input  
**Model**: Claude Opus 4.6 (set as default for all coding tasks)

---

## Prerequisites

| Requirement | Version | Install |
|---|---|---|
| Node.js | 22.x LTS | nodejs.org/en/download |
| Claude Max or API key | Max $100/mo recommended | claude.ai/upgrade |
| Git | Any recent | apt install git |
| Your management workstation | Linux/macOS/WSL2 | — |

Claude Max is strongly recommended over the API key for this project — the lab build will
generate hundreds of thousands of tokens across phases and you do not want per-token billing
anxiety while Claude is autonomously writing infrastructure code.

---

## Part 1 — Install Claude Code

```bash
# Install globally
npm install -g @anthropic-ai/claude-code

# Verify
claude --version
# Expected: 2.1.59 or later (required for auto-memory)

# If using API key instead of Max:
export ANTHROPIC_API_KEY="sk-ant-api03-..."
echo 'export ANTHROPIC_API_KEY="sk-ant-api03-..."' >> ~/.bashrc
source ~/.bashrc
```

---

## Part 2 — Set Up Global User Memory

This file loads into every Claude Code session on your machine. It tells Claude who you are
so you never re-explain your background or preferences.

```bash
mkdir -p ~/.claude
nano ~/.claude/CLAUDE.md
```

Paste this exactly — edit the API key export to match your actual value:

```markdown
# Jason's Global Claude Code Preferences

## Identity
- Cybersecurity instructor — 10+ years, US Army Cyber Command, <Company name to be determined>, Inc.
- Clearance: TS-SCI | Certs: GCIH, GSEC, GSTRT, CySA+, PenTest+ | MSISE (SANS, in progress)
- Expert-level: Go, Python, Bash, C, HTML — skip basic explanations

## Code Style
- Go: standard library first, zero deps unless justified in a comment
- Python: type hints always, f-strings, pathlib over os.path
- Bash: set -euo pipefail on every script, always quote variables
- No placeholder TODOs — deliver complete runnable code only
- Pin all versions explicitly — never use "latest"

## Response Style
- Skip preamble. No "certainly", "of course", "great question"
- ⚠️ RISK: prefix for anything that could break the lab host or management net
- 🔒 SECURITY: prefix for anything affecting the attack surface
- After any code task: validate → test → changelog → done

## Default Model
- claude-opus-4-6 for all coding, infrastructure, and security tasks
```

---

## Part 3 — Initialize the Project Repository

```bash
# Create the project directory
mkdir -p ~/higher-echelon-vuln-lab
cd ~/higher-echelon-vuln-lab
git init
git checkout -b main
```

### Copy in the skeleton files

From the `lab-project-skeleton.zip` downloaded earlier, copy the contents here:

```bash
# Unzip the skeleton into the project root
unzip ~/Downloads/lab-project-skeleton.zip -d .
# This gives you: agents/, skills/, docs/, CHANGELOG.md, CONVENTIONS.md, ORCHESTRATOR.md
```

---

## Part 4 — Copy the Claude Code Configuration Files

Create the `.claude/` directory structure and copy in all the config files:

```bash
mkdir -p .claude/{commands/{agents},rules,memory}
```

Now create each file below. The content for every file is in the `claude-code-setup.zip`
from this session — unzip it and copy the `.claude/` directory directly:

```bash
unzip ~/Downloads/claude-code-setup.zip -d .
# This gives you: CLAUDE.md, .claude/settings.json, .claude/commands/*, .claude/rules/*
```

### Verify the structure looks like this:
```
higher-echelon-vuln-lab/
├── CLAUDE.md                        ← loaded every session
├── CHANGELOG.md
├── CONVENTIONS.md
├── ORCHESTRATOR.md
├── .claude/
│   ├── settings.json               ← model=opus-4-6, auto-memory, permissions
│   ├── memory/                     ← Claude writes here automatically
│   ├── rules/
│   │   ├── terraform.md            ← loads when editing .tf files
│   │   ├── packer.md               ← loads when editing .pkr.hcl files
│   │   ├── ansible.md              ← loads when editing .yml files
│   │   └── frontend-go.md          ← loads when editing .tsx/.go files
│   └── commands/
│       ├── orchestrate.md          → /orchestrate
│       ├── phase.md                → /phase
│       ├── new-scenario.md         → /new-scenario
│       ├── test-all.md             → /test-all
│       ├── status.md               → /status
│       ├── fix.md                  → /fix
│       ├── snapshot.md             → /snapshot
│       └── agents/
│           ├── infra.md            → /infra
│           ├── scada.md            → /scada
│           ├── frontend.md         → /frontend
│           ├── security.md         → /security
│           └── docs.md             → /docs
├── agents/                         ← agent personas (referenced via @agents/)
├── skills/                         ← technical references (referenced via @skills/)
└── docs/
    ├── VERSION_MANIFEST.md
    └── PROJECT_STATE.md
```

---

## Part 5 — Configure the MCP Memory Server

This gives Claude a persistent knowledge graph that survives across sessions — separate from
auto-memory. It tracks built templates, deployed scenarios, known issues, and architecture
decisions as structured entities.

```bash
# Install the memory MCP server
npm install -g @modelcontextprotocol/server-memory

# Configure it in Claude Code's global config
nano ~/.claude.json
```

Add this content to `~/.claude.json` (create the file if it doesn't exist):

```json
{
  "mcpServers": {
    "memory": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-memory",
        "--memory-path",
        "/home/jason/.claude-memory"
      ]
    }
  }
}
```

Replace `/home/jason` with your actual home directory path.

```bash
# Create the memory directory
mkdir -p ~/.claude-memory
```

---

## Part 6 — First Launch and Verification

```bash
cd ~/higher-echelon-vuln-lab
claude
```

Inside the Claude Code session, run these verification steps:

```
# 1. Check Claude sees your CLAUDE.md
/memory

# 2. Verify auto-memory is enabled (look for the toggle)
# Should show: "Auto memory: ON"

# 3. Check MCP server is connected
/mcp
# Should show: memory server connected

# 4. Get a project status snapshot
/status

# 5. Verify all slash commands are available
/help
# Should list: orchestrate, phase, infra, scada, frontend, security, docs,
#              new-scenario, test-all, fix, snapshot, rollback, status
```

If `/status` returns a clean report showing the file structure is recognized, you're ready
to build.

---

## Part 7 — The Build Sequence (Minimal Input Mode)

This is the entire build sequence. Each command is self-contained — Claude Code will run
autonomously until the phase is complete, then stop and wait for the next command.

```
/phase 1
```
↓ When complete (Proxmox host fully configured):

```
/phase 2
```
↓ When complete (ZFS datasets configured):

```
/phase 3
```
↓ When complete (all four bridges + firewall default-deny in place):

```
/phase 4
```
↓ This one takes longest — Packer builds each template. Windows builds ~45 min each.
  Claude will run packer build commands and wait for completion.

```
/phase 5
```
↓ Terraform vm_clone module + workspace-per-scenario pattern + deploy.sh

```
/phase 6
```
↓ All Ansible roles: AD DC, workstation join, vulnerable services, OpenPLC, Ignition

```
/phase 7
```
↓ Full SCADA stack: OpenPLC + tank_fill_control, Ignition HMI, GRFICSv2, InfluxDB

```
/phase 8
```
↓ All 4 initial scenarios built with Terraform + Ansible + docs

```
/phase 9
```
↓ Lab UI: React 19 scenario deployment dashboard with terminal streaming

```
/phase 10
```
↓ Complete documentation set: setup guides, scenario cards, ATT&CK coverage matrix

### After each phase completes
```
/test-all
```
Claude runs all validation checks. Any failures are fixed automatically before reporting done.

---

## Part 8 — Day-to-Day Usage After the Build

### Deploy a scenario for class
```
/orchestrate deploy scenario scada_modbus_recon and print the student access sheet
```

### Add a new scenario
```
/new-scenario ransomware campaign targeting a Windows domain: initial access via phishing, lateral movement, domain-wide encryption, detection artifacts in Windows Event Log
```

### Something broke
```
/fix Terraform apply fails with: Error: 403 on proxmox_virtual_machine.attacker creation
```

### Reset a scenario between student groups
```
/rollback scada_modbus_recon baseline-20250601
```

### Check where things stand
```
/status
```

---

## Part 9 — Efficiency Tips

### Use `#` for fast memory saves
While in a Claude Code session, prefix any statement with `#` to save it directly to memory:

```
# Always use the TerraformRole API token for Proxmox — not the root token
# Proxmox host is at 172.16.0.10, SSH port 22, key at ~/.ssh/lab_key
# Windows Server 2022 template takes 45 min to build — only rebuild if Packer version changes
```

Claude saves these to the most relevant memory file immediately.

### Reference specific files in prompts
Instead of explaining context, use `@` file references:

```
Looking at @skills/SCADA_SKILL.md, add EtherNet/IP CIP support to the ics_ot_pivot scenario
```

### Context window management
When a session gets long (Claude will warn you):
```
/compact
```
CLAUDE.md reloads automatically after compaction — no context is lost.

### Parallel work across sessions
Claude Code supports multiple terminals. Run one session per major area:
```bash
# Terminal 1: Infrastructure work
cd ~/higher-echelon-vuln-lab && claude  # /infra tasks

# Terminal 2: Scenario development  
cd ~/higher-echelon-vuln-lab && claude  # /new-scenario tasks

# Terminal 3: Documentation review
cd ~/higher-echelon-vuln-lab && claude  # /docs tasks
```
All three share the same `.claude/memory/` and the same `CLAUDE.md`.

---

## Part 10 — .gitignore

Run this once to set up the correct git ignore rules:

```bash
cat > .gitignore << 'EOF'
# ── Secrets (never commit) ──────────────────────────────────
*.env
.env.*
*.tfvars
!*.tfvars.example
*.pem
*.key
*.token
*_token
variables.pkrvars.hcl
!variables.pkrvars.hcl.example

# ── Terraform ───────────────────────────────────────────────
**/.terraform/
*.tfstate
*.tfstate.backup
.terraform.lock.hcl

# ── Packer ──────────────────────────────────────────────────
packer_cache/
*.box

# ── Node / Frontend ─────────────────────────────────────────
node_modules/
dist/
.vite/
lab-ui/dist/

# ── Python ──────────────────────────────────────────────────
__pycache__/
*.pyc
.venv/

# ── Claude Code auto-memory (machine-local) ─────────────────
.claude/memory/

# ── Keep these (they ARE shareable) ─────────────────────────
!.claude/settings.json
!.claude/commands/
!.claude/rules/
!CLAUDE.md
EOF

git add .gitignore
git commit -m "chore: initialize repository with Claude Code configuration"
```

---

## Quick Reference Card

```
╔═══════════════════════════════════════════════════════════════╗
║         CLAUDE CODE QUICK REFERENCE — VULN LAB               ║
╠═══════════════════════╦═══════════════════════════════════════╣
║ BUILD PHASES          ║                                       ║
║ /phase 1              ║ Proxmox host config                   ║
║ /phase 2              ║ ZFS storage pools                     ║
║ /phase 3              ║ Network bridges + firewall            ║
║ /phase 4              ║ Packer VM templates (slow)            ║
║ /phase 5              ║ Terraform modules                     ║
║ /phase 6              ║ Ansible roles                         ║
║ /phase 7              ║ SCADA stack                           ║
║ /phase 8              ║ Scenario catalog                      ║
║ /phase 9              ║ Lab UI dashboard                      ║
║ /phase 10             ║ Documentation set                     ║
╠═══════════════════════╬═══════════════════════════════════════╣
║ DAILY OPERATIONS      ║                                       ║
║ /status               ║ Full project state snapshot           ║
║ /test-all             ║ Validate everything, fix failures     ║
║ /new-scenario <desc>  ║ Build complete scenario from text     ║
║ /fix <error>          ║ Diagnose and fix an error             ║
║ /snapshot <scenario>  ║ Baseline snapshot all scenario VMs    ║
║ /rollback <s> <snap>  ║ Reset scenario to baseline            ║
╠═══════════════════════╬═══════════════════════════════════════╣
║ AGENT DELEGATION      ║                                       ║
║ /orchestrate <task>   ║ Multi-agent coordinated task          ║
║ /infra <task>         ║ Proxmox / TF / Packer / Ansible       ║
║ /scada <task>         ║ ICS / OT / protocols / PLC            ║
║ /frontend <task>      ║ React UI / dashboard / components     ║
║ /security <task>      ║ Hardening / CVEs / ATT&CK / firewall  ║
║ /docs <description>   ║ CHANGELOG + reference docs            ║
╠═══════════════════════╬═══════════════════════════════════════╣
║ MEMORY                ║                                       ║
║ /memory               ║ Browse / edit auto-memory             ║
║ /compact              ║ Compress session (CLAUDE.md reloads)  ║
║ # <note>              ║ Save fact to memory immediately       ║
║ @skills/<file>.md     ║ Load skill into current prompt        ║
╚═══════════════════════╩═══════════════════════════════════════╝
```
