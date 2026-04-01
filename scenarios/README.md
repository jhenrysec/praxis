# Scenarios

Each `SCEN-XXX_<name>/` directory is a self-contained scenario with all build,
documentation, and teaching artifacts.

## Directory Layout

```
SCEN-XXX_<name>/
  scenario.yaml          Metadata (difficulty, VMs, MITRE techniques)
  MANIFEST.yaml          Full dependency manifest for deployment
  terraform/             Terraform configs (main.tf, variables.tf, terraform.tfvars)
  ansible/               Scenario-specific Ansible roles and playbooks
  docs/                  SCENARIO_CARD.md, OBJECTIVES.md, WALKTHROUGH.md, NETWORK_MAP.md
  curriculum/            LESSON_PLAN.md, SLIDES_CONTENT.md, QUICK_REFERENCE.md, etc.
  intel/                 Source intel brief (YAML)
```

## Build

```bash
# List all scenarios
./scripts/build --list

# Deploy a scenario to slot 1
./scripts/build SCEN-005

# Deploy to a specific student slot
./scripts/build SCEN-005 --slot 3

# Plan only (no apply)
./scripts/build SCEN-005 --plan-only

# Destroy a deployed scenario
./scripts/build SCEN-005 --destroy --slot 3

# Check Proxmox template status
./scripts/build --status
```

## Shared Infrastructure

- `terraform/modules/` — reusable Terraform modules (vm_clone, network_segment, scada_node)
- `ansible/roles/` — shared Ansible roles (common-linux, ad-domain-controller, etc.)
- `packer/templates/` — Packer template definitions (auto-built by `build` if missing)
- `_shared/` — shared Ansible role stubs for artifact staging
- `_template/` — boilerplate for creating new scenarios

## Scenario Catalog

| ID       | Name                        | Difficulty   | Hours | VMs | Focus             |
|----------|-----------------------------|-------------|-------|-----|-------------------|
| SCEN-001 | SCADA Modbus Recon          | Beginner    | 2     | 3   | ICS/OT            |
| SCEN-002 | Kerberoasting               | Intermediate| 3     | 3   | AD/Windows        |
| SCEN-003 | APT Lateral Movement        | Advanced    | 4     | 4   | AD/Windows        |
| SCEN-004 | ICS/OT Pivot                | Expert      | 5     | 6   | IT/OT Convergence |
| SCEN-005 | Browser Exploit CVE-2026-2441| Intermediate| 3     | 3   | Red Team/Forensics|
