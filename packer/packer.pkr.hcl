# packer/packer.pkr.hcl
# Shared plugin requirements and variable definitions for all templates.
# Run `packer init .` from the packer/ directory to install plugins.

packer {
  required_version = ">= 1.15.0"
  required_plugins {
    proxmox = {
      version = ">= 1.1.8, < 2.0.0"
      source  = "github.com/hashicorp/proxmox"
    }
  }
}

# ── Shared Variables ─────────────────────────────────────────────────────────
# Set via packer/variables.pkrvars.hcl or environment variables (PKR_VAR_*)

variable "proxmox_url" {
  type        = string
  description = "Proxmox API endpoint (https://host:8006/api2/json)"
}

variable "proxmox_username" {
  type        = string
  description = "Proxmox API user (e.g., terraform@pve)"
}

variable "proxmox_token" {
  type        = string
  sensitive   = true
  description = "Proxmox API token secret"
}

variable "proxmox_node" {
  type        = string
  default     = "pve01"
  description = "Proxmox node name to build on"
}

variable "proxmox_storage_pool" {
  type        = string
  default     = "local-zfs"
  description = "Proxmox storage pool for VM disks and cloud-init"
}

variable "ssh_public_key" {
  type        = string
  sensitive   = true
  description = "SSH public key injected via cloud-init for Ansible access"
}
