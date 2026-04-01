# terraform/scenarios/apt_lateral_movement/variables.tf

variable "proxmox_node" {
  type    = string
  default = "pve01"
}

variable "proxmox_endpoint" {
  type    = string
  default = "https://192.168.1.50:8006/"
}

variable "ssh_public_key_path" {
  type    = string
  default = "~/.ssh/lab_key.pub"
}

variable "ssh_private_key_path" {
  type    = string
  default = "~/.ssh/lab_key"
}

variable "datastore" {
  type    = string
  default = "local-zfs"
}

variable "slot_number" {
  type        = number
  default     = 1
  description = "Student slot (1-20)"
  validation {
    condition     = var.slot_number >= 1 && var.slot_number <= 20
    error_message = "slot_number must be between 1 and 20"
  }
}

variable "scenario_name" {
  type        = string
  description = "Scenario identifier for tags and workspace"
}
