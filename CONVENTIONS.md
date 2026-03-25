# Lab Project Conventions

**Project**:  Vulnerability Testing Lab  
**Operator**: Jason — Cyberspace Response Assessment Instructor  
**Organization**: <TBD>  
**Classification**: AUTHORIZED LAB ENVIRONMENT — for training use only

---

## Universal Rules (All Agents)

1. **No placeholders.** Deliver complete, working code. No `# TODO`, no `<INSERT_HERE>`, no `YOUR_PASSWORD`. If a value is unknown, use an explicit environment variable with a documented description.

2. **Version pins always.** Every dependency, provider, plugin, and package must have an explicit pinned version. Document the pin in `docs/VERSION_MANIFEST.md`.

3. **Document everything.** Every deliverable triggers a CHANGELOG.md entry and relevant doc update. Non-negotiable.

4. **Idempotent by default.** All Terraform, Packer, and Ansible code must be safe to run multiple times without side effects.

5. **Secrets never in git.** API tokens, passwords, and keys are stored in `.env` files (gitignored), Ansible Vault, or passed via environment variables. `.gitignore` must block: `*.tfvars` (if it contains secrets), `*.env`, `*.pem`, `*.key`, `inventory/terraform.tfstate`.

6. **Vulnerable by design, not by accident.** Intentional vulnerabilities are documented, mapped to ATT&CK, and reversible. Accidental misconfigurations get fixed immediately.

---

## Git Workflow

```
main          — stable, tested, deployable
develop       — integration branch
feature/*     — agent-specific feature branches
hotfix/*      — emergency fixes to main
```

### Commit Message Format
```
<type>(<scope>): <subject>

<body — optional>

ATT&CK: <T-number> (if applicable)
Agent: <AGENT_NAME>
```

Types: `feat`, `fix`, `docs`, `refactor`, `security`, `test`, `chore`

Examples:
```
feat(terraform): add vm_clone module with linked-clone support
Agent: INFRA_AGENT

security(proxmox): enable datacenter firewall with default-DROP policy
ATT&CK: defense-in-depth
Agent: SECURITY_AGENT

docs(scenarios): add SCENARIO_CARD for scada_modbus_recon
Agent: DOCS_AGENT
```

---

## File Naming

| Asset type | Convention | Example |
|---|---|---|
| Terraform module | `snake_case/` | `modules/vm_clone/` |
| Terraform scenario | `snake_case/` | `scenarios/scada_modbus_recon/` |
| Packer template | `kebab-case.pkr.hcl` | `kali-2024.pkr.hcl` |
| Ansible role | `kebab-case/` | `roles/ad-domain-controller/` |
| Markdown docs | `SCREAMING_SNAKE.md` | `SCENARIO_CARD.md` |
| React components | `PascalCase.tsx` | `ScenarioCard.tsx` |
| Hooks/utilities | `camelCase.ts` | `useLabStore.ts` |

---

## IP Address Plan

| Zone | Subnet | Gateway | DHCP? |
|---|---|---|---|
| Management (vmbr0) | 172.16.0.0/24 | 172.16.0.1 | Static only |
| Red/Attacker (vmbr1) | 10.10.1.0/24 | 10.10.1.1 | Static via Terraform |
| IT/Blue (vmbr2) | 10.10.2.0/24 | 10.10.2.1 | Static via Terraform |
| OT/SCADA (vmbr3) | 192.168.100.0/24 | 192.168.100.1 | Static via Terraform |

Static assignments are defined in each scenario's `terraform.tfvars`. No DHCP — all addresses are deterministic and documented in scenario cards.

---

## Proxmox VM ID Allocation (repeat from TERRAFORM_SKILL)

| Range | Purpose |
|---|---|
| 100–149 | Templates |
| 200–249 | Active scenario VMs |
| 300–349 | Infrastructure VMs (pfSense, API server) |
| 900–999 | Scratch/test |
