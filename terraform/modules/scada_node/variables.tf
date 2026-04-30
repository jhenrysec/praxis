# terraform/modules/scada_node/variables.tf

# ── Required ─────────────────────────────────────────────────────────────────

variable "proxmox_node" {
  type        = string
  description = "Proxmox node name"
}

variable "vm_id" {
  type        = number
  description = "Unique VM ID on Proxmox"
}

variable "vm_name" {
  type        = string
  description = "VM hostname"
}

variable "template_vm_id" {
  type        = number
  description = "Source template VM ID"
}

variable "ip_address" {
  type        = string
  description = "Static IPv4 address in OT zone"
}

variable "gateway" {
  type        = string
  description = "OT zone gateway"
}

variable "ssh_public_key" {
  type        = string
  description = "SSH public key for cloud-init"
}

variable "scenario_tag" {
  type        = string
  description = "Scenario identifier tag"
}

variable "scada_role" {
  type        = string
  description = "SCADA function: plc, hmi, historian, rtu, ems, gateway"
  validation {
    condition     = contains(["plc", "hmi", "historian", "rtu", "ems", "gateway"], var.scada_role)
    error_message = "scada_role must be one of: plc, hmi, historian, rtu, ems, gateway"
  }
}

# ── Optional with SCADA-appropriate defaults ─────────────────────────────────

variable "cpu_cores" {
  type    = number
  default = 2
}

variable "memory_mb" {
  type    = number
  default = 2048
}

variable "disk_size" {
  type    = number
  default = 40
}

variable "datastore" {
  type    = string
  default = "local-zfs"
}

variable "network_bridge" {
  type        = string
  default     = "vmbr3"
  description = "Defaults to OT bridge (vmbr3)"
}

variable "second_bridge" {
  type    = string
  default = ""
}

variable "second_ip_address" {
  type    = string
  default = ""
}

variable "second_prefix_length" {
  type    = number
  default = 24
}

variable "second_gateway" {
  type    = string
  default = ""
}

variable "prefix_length" {
  type    = number
  default = 24
}

variable "admin_user" {
  type    = string
  default = "ansible"
}

variable "os_type" {
  type    = string
  default = "l26"
}

variable "cloud_init" {
  type    = bool
  default = true
}

variable "qemu_agent" {
  type    = bool
  default = true
}

variable "extra_tags" {
  type    = list(string)
  default = []
}
