# /new-scenario — Create a New Lab Scenario from Scratch

Create a complete, deployable scenario with all required artifacts.

Scenario description: $ARGUMENTS

## What to build (in this order)

1. **Security review** (/security): identify required attack surface, map to MITRE ATT&CK
2. **Infrastructure** (/infra):
   - Create `scenarios/<scenario_name>/main.tf` using vm_clone module
   - Create `scenarios/<scenario_name>/terraform.tfvars`
   - Create `scenarios/<scenario_name>/scenario.yaml` with metadata
3. **Ansible** (/infra): create required roles for this scenario's specific vulnerabilities
4. **SCADA** (/scada) if OT is involved: configure protocol endpoints and PLC programs
5. **Documentation** (/docs):
   - `docs/scenarios/<n>/SCENARIO_CARD.md` — full template
   - `docs/scenarios/<n>/OBJECTIVES.md` — student-facing objectives
   - `docs/scenarios/<n>/WALKTHROUGH.md` — instructor-only solution
   - `docs/scenarios/<n>/NETWORK_MAP.md`
   - CHANGELOG.md entry

## scenario.yaml format
```yaml
id: SCEN-<number>
name: <Human readable name>
description: <One paragraph>
difficulty: Beginner|Intermediate|Advanced|Expert
estimated_hours: <number>
vm_count: <number>
networks: [red, blue, ot]  # include only zones used
mitre_enterprise: [T1234.001, ...]
mitre_ics: [T0836, ...]
templates_required: [tpl-kali-2024, tpl-openplc, ...]
ansible_roles: [ad-domain-controller, openplc-configure, ...]
```

After building: run `terraform validate` and `terraform plan` in the scenario directory.
