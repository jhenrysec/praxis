# Skill: Terraform + bpg/proxmox Provider

**Applies to**: INFRA_AGENT  
**Provider**: bpg/proxmox — https://registry.terraform.io/providers/bpg/proxmox  
**Version target**: bpg/proxmox >= 0.66.0  
**Terraform version**: >= 1.9.0  
**Last reviewed**: 2025-06

---

## Provider Configuration

```hcl
# providers.tf
terraform {
  required_version = ">= 1.9.0"
  required_providers {
    proxmox = {
      source  = "bpg/proxmox"
      version = ">= 0.66.0, < 1.0.0"
    }
  }
}

provider "proxmox" {
  endpoint  = var.proxmox_endpoint  # "https://172.16.0.10:8006/"
  api_token = var.proxmox_api_token # "terraform@pve!terraform=<secret>"
  insecure  = true                  # Self-signed cert — replace with false after adding cert

  ssh {
    agent       = false
    username    = "root"
    private_key = file(var.ssh_private_key_path)
    # Required for tasks Proxmox API can't do (e.g., uploading ISOs via SCP)
  }
}
```

### Environment Variable Auth (preferred for CI/CD)
```bash
export PROXMOX_VE_ENDPOINT="https://172.16.0.10:8006/"
export PROXMOX_VE_API_TOKEN="terraform@pve!terraform=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
export PROXMOX_VE_INSECURE=true
```

---

## Core Resource: proxmox_virtual_machine

### Linked Clone (fast — sub-30 second deploy)
```hcl
# modules/vm_clone/main.tf

resource "proxmox_virtual_machine" "this" {
  node_name = var.proxmox_node  # "pve01"
  name      = var.vm_name
  vm_id     = var.vm_id         # Must be unique across the node

  clone {
    vm_id   = var.template_vm_id
    full    = false              # Linked clone — shares template disk
    retries = 3
  }

  cpu {
    cores   = var.cpu_cores     # default: 2
    sockets = 1
    type    = "host"            # Pass-through CPU flags for better perf
  }

  memory {
    dedicated = var.memory_mb   # in MB, default: 2048
  }

  # Primary disk — inherits template size, can be resized
  disk {
    interface    = "scsi0"
    datastore_id = var.datastore  # "local-zfs"
    size         = var.disk_size  # in GB
    discard      = "on"           # ZFS thin provisioning
    iothread     = true
  }

  # Cloud-init drive (Linux only)
  disk {
    interface    = "ide2"
    datastore_id = var.datastore
    file_format  = "raw"
    size         = 4
  }

  network_device {
    bridge  = var.network_bridge  # "vmbr2"
    model   = "virtio"
  }

  # Cloud-init configuration
  initialization {
    datastore_id = var.datastore

    ip_config {
      ipv4 {
        address = "${var.ip_address}/${var.prefix_length}"
        gateway = var.gateway
      }
    }

    user_account {
      username = var.admin_user
      keys     = [var.ssh_public_key]
    }
  }

  operating_system {
    type = var.os_type  # "l26" for Linux, "win11" for Win10/11/Server2022
  }

  agent {
    enabled = true   # Requires qemu-guest-agent in template
    trim    = true
  }

  tags = [var.scenario_name, var.zone_tag, "lab"]

  # Don't replace VM if IP changes after initial creation
  lifecycle {
    ignore_changes = [
      initialization[0].ip_config,
      network_device[0].mac_address,
    ]
  }
}
```

### Windows VM Clone (no cloud-init)
```hcl
resource "proxmox_virtual_machine" "windows" {
  node_name = var.proxmox_node
  name      = var.vm_name
  vm_id     = var.vm_id

  clone {
    vm_id = var.template_vm_id
    full  = false
  }

  cpu {
    cores   = 4
    sockets = 1
    type    = "host"
  }

  memory {
    dedicated = 4096
  }

  disk {
    interface    = "scsi0"
    datastore_id = "local-zfs"
    size         = 80
    discard      = "on"
    iothread     = true
  }

  network_device {
    bridge = var.network_bridge
    model  = "virtio"
  }

  operating_system {
    type = "win11"  # Use win11 for Server 2022 and Win10
  }

  # Windows: use Ansible WinRM post-deploy for configuration
  # No initialization block — Windows uses autounattend.xml in Packer

  tags = [var.scenario_name, "windows", "lab"]
}
```

---

## Module Pattern — vm_clone

### variables.tf
```hcl
variable "proxmox_node"     { type = string; description = "Proxmox node name" }
variable "vm_id"            { type = number; description = "Unique VM ID (100–999)" }
variable "vm_name"          { type = string; description = "VM hostname" }
variable "template_vm_id"   { type = number; description = "Source template VM ID" }
variable "cpu_cores"        { type = number; default = 2; description = "vCPU count" }
variable "memory_mb"        { type = number; default = 2048; description = "RAM in MB" }
variable "disk_size"        { type = number; default = 40; description = "Disk size in GB" }
variable "datastore"        { type = string; default = "local-zfs"; description = "Proxmox storage ID" }
variable "network_bridge"   { type = string; description = "Proxmox bridge: vmbr1/vmbr2/vmbr3" }
variable "ip_address"       { type = string; description = "Static IPv4 address" }
variable "prefix_length"    { type = number; default = 24 }
variable "gateway"          { type = string; description = "Default gateway IP" }
variable "admin_user"       { type = string; default = "ansible" }
variable "ssh_public_key"   { type = string; description = "Public key for cloud-init" }
variable "os_type"          { type = string; default = "l26"; description = "l26=Linux, win11=Windows" }
variable "scenario_name"    { type = string; description = "Scenario tag for this VM" }
variable "zone_tag"         { type = string; description = "red|blue|ot" }
```

### outputs.tf
```hcl
output "vm_id"         { value = proxmox_virtual_machine.this.vm_id }
output "vm_name"       { value = proxmox_virtual_machine.this.name }
output "ip_address"    { value = var.ip_address; description = "Assigned IP address" }
output "mac_address"   { value = proxmox_virtual_machine.this.network_device[0].mac_address }
```

---

## Workspace-Per-Scenario Pattern

```bash
# Create and select workspace for a scenario
terraform workspace new scada_modbus_recon
terraform workspace select scada_modbus_recon

# List workspaces
terraform workspace list

# Apply with scenario-specific vars
terraform init
terraform plan  -var-file=terraform.tfvars
terraform apply -var-file=terraform.tfvars -auto-approve

# Destroy scenario
terraform destroy -var-file=terraform.tfvars -auto-approve

# After destroy, clean up workspace
terraform workspace select default
terraform workspace delete scada_modbus_recon
```

---

## Scenario main.tf Template

```hcl
# scenarios/scada_modbus_recon/main.tf
# Scenario: SCADA Modbus Recon & Manipulation (SCEN-001)
# Updated: <date>

module "attacker" {
  source            = "../../modules/vm_clone"
  proxmox_node      = var.proxmox_node
  vm_id             = 201
  vm_name           = "kali-attacker"
  template_vm_id    = 101  # tpl-kali-2024
  cpu_cores         = 4
  memory_mb         = 4096
  network_bridge    = "vmbr2"    # Routes to OT via pfSense for this scenario
  ip_address        = "10.10.2.10"
  gateway           = "10.10.2.1"
  ssh_public_key    = file(var.ssh_public_key_path)
  scenario_name     = "scada-modbus-recon"
  zone_tag          = "red"
}

module "plc" {
  source            = "../../modules/vm_clone"
  proxmox_node      = var.proxmox_node
  vm_id             = 210
  vm_name           = "openplc-01"
  template_vm_id    = 150  # tpl-openplc
  cpu_cores         = 2
  memory_mb         = 2048
  network_bridge    = "vmbr3"
  ip_address        = "192.168.100.10"
  gateway           = "192.168.100.1"
  ssh_public_key    = file(var.ssh_public_key_path)
  scenario_name     = "scada-modbus-recon"
  zone_tag          = "ot"
}

output "access_sheet" {
  description = "Student access information"
  value = {
    scenario      = "SCEN-001: SCADA Modbus Recon"
    attacker_ip   = module.attacker.ip_address
    plc_ip        = module.plc.ip_address
    attacker_creds = "kali / kali"
    objectives    = "See: docs/scenarios/scada_modbus_recon/OBJECTIVES.md"
  }
}
```

---

## VM ID Allocation

Reserve ID ranges to avoid conflicts across scenarios:

| Range | Purpose |
|---|---|
| 100–149 | Templates (never cloned from by number — use name) |
| 200–249 | Active scenario VMs |
| 250–299 | Reserved for Terraform (auto-assign) |
| 300–349 | Infrastructure VMs (pfSense, Ansible controller) |
| 900–999 | Test/scratch VMs |
