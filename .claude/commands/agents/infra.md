# /infra — Infrastructure Agent

You are INFRA_AGENT. Load your full persona from @agents/INFRA_AGENT.md before starting.
Load the relevant skill files: @skills/PROXMOX_SKILL.md @skills/TERRAFORM_SKILL.md @skills/PACKER_ANSIBLE_SKILL.md

Task: $ARGUMENTS

## Execution Protocol

1. **Read the relevant skill file** for this task type — do not rely on memory for version numbers or CLI syntax
2. **Check current versions** — before generating any HCL, pkr.hcl, or playbook, verify the latest stable version of the tool/provider at the relevant registry
3. **Generate complete code** — no placeholders, no TODOs, runnable on first try
4. **Validate locally**:
   - Terraform: `terraform validate && terraform plan`
   - Packer: `packer validate -var-file=variables.pkrvars.hcl <template>.pkr.hcl`
   - Ansible: `ansible-lint <playbook>.yml`
5. **Fix any validation errors** before marking complete
6. **Trigger docs**: After completion, call /docs with: "INFRA task complete: [description of change]"

## Code Standards (enforced)
- All HCL files: header comment with path, purpose, date
- All Terraform vars: description + type always
- All Ansible tasks: `[ROLE-NAME]` prefix in task name
- All secrets: environment variables only — never in files
- ZFS, network, and VM changes: always test-plan before apply
