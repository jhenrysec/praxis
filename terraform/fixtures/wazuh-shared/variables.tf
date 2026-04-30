# terraform/fixtures/wazuh-shared/variables.tf

variable "proxmox_endpoint" {
  type        = string
  default     = "https://192.168.1.50:8006/"
  description = "Proxmox API endpoint"
}

variable "proxmox_api_token" {
  type        = string
  sensitive   = true
  description = "Proxmox API token — format: user@realm!tokenid=secret"
}

variable "proxmox_node" {
  type        = string
  default     = "pve01"
  description = "Proxmox node name"
}

variable "ssh_private_key_path" {
  type        = string
  default     = "~/.ssh/lab_key"
  description = "SSH private key used by the provider for scp/remote tasks"
}

variable "ssh_public_key_path" {
  type        = string
  default     = "~/.ssh/lab_key.pub"
  description = "SSH public key injected into the VM via cloud-init"
}

variable "wazuh_ip_address" {
  type        = string
  default     = "192.168.1.60"
  description = "Static IP for the Wazuh VM on the mgmt subnet"
}

variable "wazuh_gateway" {
  type        = string
  default     = "192.168.1.1"
  description = "Default gateway for the mgmt subnet"
}

variable "wazuh_agent_bridge" {
  type        = string
  default     = "vmbr4"
  description = "Proxmox bridge for agent-facing NIC. Must exist on the host (see ansible/playbooks/proxmox-bridges.yml)."
}

variable "wazuh_agent_ip_address" {
  type        = string
  default     = "192.168.4.10"
  description = "Static IP for Wazuh on the SIEM bridge. Agents enroll and forward events to this address."
}
