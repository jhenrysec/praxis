# Phase 4: Packer VM Templates

**Time required**: ~2 hours (mostly unattended build time)
**Prerequisite**: Phases 1–3, ISOs uploaded to Proxmox
**Result**: 6 VM templates ready for Terraform cloning

---

## 1. Verify ISOs

```bash
# Check which ISOs are available and which are missing
./scripts/iso-manage.sh ensure-list packer/iso-requirements.txt

# Auto-download available ISOs
./scripts/iso-manage.sh --download --upload
```

**Manual downloads required:**
- Windows Server 2022 Evaluation: [Microsoft Eval Center](https://www.microsoft.com/en-us/evalcenter/evaluate-windows-server-2022)
  - Upload to Proxmox: Datacenter → pve01 → local → ISO Images → Upload

## 2. Configure Packer Variables

```bash
cp packer/variables.pkrvars.hcl.example packer/variables.pkrvars.hcl
```

Edit `packer/variables.pkrvars.hcl`:
```hcl
proxmox_url          = "https://192.168.1.50:8006/api2/json"
proxmox_username     = "terraform@pve"
proxmox_token        = "your-api-token-here"
proxmox_node         = "pve01"
proxmox_storage_pool = "local-zfs"
ssh_public_key       = "ssh-ed25519 AAAA... ansible@lab"
```

## 3. Initialize Packer Plugins

```bash
cd packer
packer init .
```

## 4. Build Templates

Build order matters — build base templates first, then specialized ones.

### Linux templates (~15 min each)

```bash
# Debian 12 — base for OpenPLC and Ignition
packer build -var-file=variables.pkrvars.hcl templates/debian-12.pkr.hcl

# Ubuntu 24.04
packer build -var-file=variables.pkrvars.hcl templates/ubuntu-2404.pkr.hcl

# Kali 2024 (larger — includes security tools)
packer build -var-file=variables.pkrvars.hcl templates/kali-2024.pkr.hcl
```

### Windows template (~45 min)

```bash
packer build -var-file=variables.pkrvars.hcl templates/windows-server-2022.pkr.hcl
```

### Specialized templates (~20 min each)

```bash
# OpenPLC Runtime
packer build -var-file=variables.pkrvars.hcl templates/openplc.pkr.hcl

# Ignition Gateway
packer build -var-file=variables.pkrvars.hcl templates/ignition-dev.pkr.hcl
```

## 5. Template Inventory

| Template | VM ID | Built from | Key software |
|---|---|---|---|
| tpl-kali-2024 | 101 | Kali 2024.4 ISO | Metasploit, Impacket, CrackMapExec, Go 1.23, pymodbus |
| tpl-ubuntu-2404 | 102 | Ubuntu 24.04.2 ISO | cloud-init, qemu-guest-agent |
| tpl-debian-12 | 103 | Debian 12.9 ISO | cloud-init, qemu-guest-agent |
| tpl-win2022 | 110 | Windows Server 2022 ISO | WinRM, VirtIO, RSAT-AD-Tools, RDP |
| tpl-openplc | 150 | Debian 12.9 ISO | OpenPLC Runtime v3, Modbus TCP |
| tpl-ignition-dev | 151 | Debian 12.9 ISO | Ignition 8.1.44 Gateway, OPC-UA |

## 6. Verify Templates

```bash
# List templates on Proxmox
pvesh get /nodes/pve01/qemu --output-format table | grep tpl-

# Each should show as "stopped" with the correct VM ID
```

---

**Next**: [04_TERRAFORM_USAGE.md](04_TERRAFORM_USAGE.md) — Deploy scenarios with Terraform
