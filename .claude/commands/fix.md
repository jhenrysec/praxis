# /fix — Self-Healing Error Resolution

Diagnose and fix an error autonomously.

Error or problem: $ARGUMENTS

## Diagnosis Protocol

1. **Read the full error message** — parse every line, not just the last one
2. **Identify the error type**:
   - Terraform: provider version mismatch, resource attribute error, state conflict, network timeout
   - Packer: ISO checksum mismatch, SSH timeout, boot command failure, provisioner error
   - Ansible: connection refused (WinRM/SSH), module not found, variable undefined, privilege error
   - TypeScript: type error, missing import, interface mismatch
   - Go: import cycle, undefined variable, type assertion failure
   - Runtime: Proxmox API 401/403/500, ZFS pool degraded, bridge not found

3. **Check the relevant skill file** for known solutions:
   - Proxmox errors → @skills/PROXMOX_SKILL.md (Common Pitfalls section)
   - Terraform errors → @skills/TERRAFORM_SKILL.md
   - Packer errors → @skills/PACKER_ANSIBLE_SKILL.md
   - SCADA errors → @skills/SCADA_SKILL.md

4. **Fix the root cause** — not just the symptom. If a version is wrong, update VERSION_MANIFEST.md too.

5. **Re-run the failing command** to verify the fix worked.

6. **If the fix changes any config file**: /docs "fix: [what broke and how it was fixed]"

## Common Error Patterns and Fixes

### Terraform: Provider version constraint not met
```bash
# Update .terraform.lock.hcl
rm .terraform.lock.hcl
terraform init -upgrade
terraform validate
```

### Packer: ISO checksum mismatch
```bash
# Fetch current checksum from official source
# For Kali: https://www.kali.org/get-kali/#kali-installer-images
# Update the iso_checksum field in the .pkr.hcl file
```

### Ansible: WinRM connection refused
```bash
# Verify WinRM is running on the Windows VM
# Test from management host:
curl -s -o /dev/null -w "%{http_code}" http://<vm-ip>:5985/wsman
# Should return 200. If not, check autounattend.xml WinRM commands ran
```

### Proxmox API: 403 Forbidden
```bash
# Token may have missing privileges
pveum user permissions terraform@pve --path /
# Re-add missing privileges to TerraformRole
pveum role modify TerraformRole -privs "... <missing_priv>"
```

### TypeScript: Cannot find module
```bash
cd lab-ui
npm install  # reinstall dependencies
npm run build  # re-check
```

## Escalation
If the fix requires a change to a CLAUDE.md rule, skills file, or agent persona — make that change too so the same mistake doesn't recur.
