# Rule: Packer Templates

Applies to: **/*.pkr.hcl, **/packer/**

When working on Packer files:
- Always run `packer validate -var-file=variables.pkrvars.hcl <file>` after edits
- ssh_timeout: minimum 30m for all templates, 45m for Windows
- All secrets via environment variables — never in .pkrvars.hcl committed to git
- Every template must end with a cleanup provisioner: cloud-init clean, truncate machine-id, apt clean, sync
- qemu_agent = true required on all Linux templates (install qemu-guest-agent in provisioner)
- template_description must include build date: `formatdate("YYYY-MM-DD", timestamp())`
- ISO checksums: always sha256, always fetched from the official source page
