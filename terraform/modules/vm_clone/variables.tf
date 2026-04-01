# terraform/modules/vm_clone/variables.tf

# ── Required ─────────────────────────────────────────────────────────────────

variable "proxmox_node" {
  type        = string
  description = "Proxmox node name (e.g., pve01)"
}

variable "vm_id" {
  type        = number
  description = "Unique VM ID on Proxmox (use slot_vm_id() helper for slot-aware IDs)"
}

variable "vm_name" {
  type        = string
  description = "VM hostname"
}

variable "template_vm_id" {
  type        = number
  description = "Source template VM ID to clone from"
}

variable "network_bridge" {
  type        = string
  description = "Primary Proxmox bridge: vmbr0, vmbr1, vmbr2, or vmbr3"
}

variable "ip_address" {
  type        = string
  description = "Static IPv4 address (without CIDR prefix)"
}

variable "gateway" {
  type        = string
  description = "Default gateway IPv4 address"
}

variable "ssh_public_key" {
  type        = string
  description = "SSH public key for cloud-init user injection"
}

variable "scenario_tag" {
  type        = string
  description = "Scenario identifier tag (e.g., scada-modbus-recon)"
}

variable "zone_tag" {
  type        = string
  description = "Network zone: red, blue, ot, or mgmt"
  validation {
    condition     = contains(["red", "blue", "ot", "mgmt"], var.zone_tag)
    error_message = "zone_tag must be one of: red, blue, ot, mgmt"
  }
}

# ── Optional with defaults ───────────────────────────────────────────────────

variable "cpu_cores" {
  type        = number
  default     = 2
  description = "Number of vCPU cores"
}

variable "memory_mb" {
  type        = number
  default     = 2048
  description = "RAM in megabytes"
}

variable "disk_size" {
  type        = number
  default     = 40
  description = "Root disk size in GB"
}

variable "datastore" {
  type        = string
  default     = "local-zfs"
  description = "Proxmox storage pool for disks and cloud-init"
}

variable "prefix_length" {
  type        = number
  default     = 24
  description = "CIDR prefix length for IP address"
}

variable "admin_user" {
  type        = string
  default     = "ansible"
  description = "Cloud-init admin username"
}

variable "os_type" {
  type        = string
  default     = "l26"
  description = "OS type: l26 (Linux 2.6+), win11 (Windows 10/11/Server 2022)"
}

variable "cloud_init" {
  type        = bool
  default     = true
  description = "Enable cloud-init drive and initialization (false for Windows)"
}

variable "qemu_agent" {
  type        = bool
  default     = true
  description = "Enable QEMU guest agent communication"
}

variable "full_clone" {
  type        = bool
  default     = false
  description = "Use full clone instead of linked clone (slower but independent of template)"
}

variable "second_bridge" {
  type        = string
  default     = ""
  description = "Optional second NIC bridge for dual-homed VMs"
}

variable "extra_tags" {
  type        = list(string)
  default     = []
  description = "Additional tags to apply to the VM"
}
