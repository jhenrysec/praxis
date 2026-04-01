# terraform/variables.tf
# Shared variable definitions used across all scenarios.
# Values come from environment variables (TF_VAR_*) or per-scenario .tfvars files.

variable "proxmox_node" {
  type        = string
  default     = "pve01"
  description = "Proxmox node to deploy VMs on"
}

variable "proxmox_endpoint" {
  type        = string
  default     = "https://192.168.1.50:8006/"
  description = "Proxmox API endpoint URL"
}

variable "proxmox_api_token" {
  type        = string
  sensitive   = true
  description = "Proxmox API token (format: user@realm!tokenid=secret)"
}

variable "ssh_public_key_path" {
  type        = string
  default     = "~/.ssh/lab_key.pub"
  description = "Path to SSH public key for cloud-init injection"
}

variable "datastore" {
  type        = string
  default     = "local-zfs"
  description = "Proxmox storage pool for VM disks"
}

variable "slot_number" {
  type        = number
  default     = 1
  description = "Student slot number (1-20) — determines IP ranges and VM IDs"
  validation {
    condition     = var.slot_number >= 1 && var.slot_number <= 20
    error_message = "slot_number must be between 1 and 20"
  }
}

variable "scenario_name" {
  type        = string
  description = "Scenario identifier used for tagging and workspace naming"
}
