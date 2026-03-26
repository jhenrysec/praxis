# Rule: Terraform Files

Applies to: **/*.tf, **/*.tfvars, **/*.hcl

When editing Terraform files:
- Always validate with `terraform validate` after any edit
- Never use `latest` for provider versions — check registry.terraform.io
- `full_clone = false` is the default for lab VMs — only set true when explicitly needed
- Every `proxmox_virtual_machine` resource must have `tags` including scenario name and zone
- Output blocks must have `description` — they become the student access sheet
- Sensitive data (passwords, tokens): use `sensitive = true` on variable declarations
- State: local backend for single-node, never commit .tfstate or .tfstate.backup to git
