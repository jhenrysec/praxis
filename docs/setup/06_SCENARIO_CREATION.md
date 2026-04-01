# Creating New Scenarios

**Prerequisite**: Phases 1–8 complete (lab infrastructure + baseline scenarios)
**Result**: A new, deployable scenario with Terraform, Ansible, docs, and MANIFEST.yaml

---

## Option A: From Threat Intelligence (Recommended)

Use the intel pipeline to build a scenario grounded in real-world adversary behavior:

```bash
# From a CISA advisory
/intel-scenario --source https://www.cisa.gov/news-events/cybersecurity-advisories/aa23-144a \
                --fidelity balanced

# From a MITRE ATT&CK group page
/intel-scenario --source https://attack.mitre.org/groups/G0114/ \
                --fidelity strict --difficulty Advanced

# From a pasted report
/intel-scenario --source "paste your report text here" \
                --fidelity loose
```

The intel pipeline:
1. INTEL_AGENT extracts 5 layers (attack chain, topology, infrastructure, IOCs, dressing)
2. Generates `intel_briefs/<name>.yaml`
3. ORCHESTRATOR routes each layer to the appropriate agent
4. INFRA_AGENT builds Terraform config
5. SCADA_AGENT configures ICS protocols (if applicable)
6. CONTENT_AGENT generates dressing documents
7. DOCS_AGENT writes scenario card with source citations
8. CURRICULUM_AGENT generates teaching materials
9. MANIFEST.yaml written with complete artifact catalog

## Option B: Manual Build

### Step 1: Create scenario directory structure

```bash
SCENARIO="my_new_scenario"

# Terraform
mkdir -p terraform/scenarios/${SCENARIO}

# Docs
mkdir -p docs/scenarios/${SCENARIO}

# Manifest
mkdir -p scenarios/${SCENARIO}
```

### Step 2: Write Terraform config

Copy from the template:
```bash
cp terraform/scenarios/_template/* terraform/scenarios/${SCENARIO}/
```

Edit `main.tf`:
- Define VMs using the `vm_clone` module (or `scada_node` for OT VMs)
- Set `template_vm_id` to the appropriate template (101=Kali, 103=Debian, 110=Win2022, 150=OpenPLC)
- Use `module.net` for slot-aware networking
- Define `access_sheet` output

Edit `scenario.yaml`:
```yaml
name: my_new_scenario
display_name: "My New Scenario"
description: "One-paragraph description"
difficulty: Intermediate
estimated_hours: 3
status: ready
focus_areas:
  - ad_windows
mitre_techniques:
  - T1558.003
vm_count: 3
total_cpu: 8
total_memory_mb: 8192
```

### Step 3: Write documentation

Create these files in `docs/scenarios/${SCENARIO}/`:

| File | Purpose |
|---|---|
| `SCENARIO_CARD.md` | One-page overview with credentials, objectives, ATT&CK table |
| `OBJECTIVES.md` | Student-facing objectives and success criteria |
| `WALKTHROUGH.md` | Instructor-only solution walkthrough |
| `NETWORK_MAP.md` | ASCII network topology diagram |

See existing scenarios for format examples.

### Step 4: Run dedup check

```bash
/dedup-check my_new_scenario
```

Verify your scenario adds unique ATT&CK coverage not already in the catalog.

### Step 5: Write MANIFEST.yaml

```bash
cp scenarios/MANIFEST_TEMPLATE.yaml scenarios/${SCENARIO}/MANIFEST.yaml
```

Fill in all fields — templates required, ISOs, bridges, Ansible roles, docs paths.

### Step 6: Test deployment

```bash
cd terraform/scenarios/${SCENARIO}
terraform init
terraform plan -var-file=terraform.tfvars -var="slot_number=1"
terraform apply -var-file=terraform.tfvars -var="slot_number=1" -auto-approve

# Run Ansible post-deploy
ansible-playbook -i inventory/${SCENARIO} ansible/playbooks/ad-setup.yml
```

### Step 7: Update CHANGELOG

Add an entry in `CHANGELOG.md` under `[Unreleased]`.

---

## Scenario Checklist

Before marking a scenario as `ready`:

- [ ] `terraform plan` applies cleanly from cold state
- [ ] All VMs boot and are reachable via SSH or WinRM
- [ ] Attack path is walkable end-to-end (verify with WALKTHROUGH.md)
- [ ] All ATT&CK techniques are exercisable
- [ ] SCENARIO_CARD.md has complete credentials, objectives, and vuln table
- [ ] MANIFEST.yaml lists every dependency
- [ ] Dedup check confirms unique ATT&CK coverage
- [ ] CHANGELOG.md updated

---

## Available Templates

| Template | VM ID | Use for |
|---|---|---|
| tpl-kali-2024 | 101 | Attacker VMs (Metasploit, Impacket, pymodbus) |
| tpl-ubuntu-2404 | 102 | General Linux targets |
| tpl-debian-12 | 103 | Lightweight Linux, GRFICSv2 Docker host |
| tpl-win2022 | 110 | Domain controllers, Windows workstations |
| tpl-openplc | 150 | PLC with Modbus TCP (port 502) |
| tpl-ignition-dev | 151 | SCADA HMI with OPC-UA (port 4840) |
