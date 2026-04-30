# terraform/fixtures/wazuh-shared/main.tf
# Shared Wazuh SIEM fixture — one VM, not scoped to any lab slot.
# Serves all 20 student slots via agents (Phase 2) and analyst dashboard access.

terraform {
  required_version = ">= 1.14.0"
  required_providers {
    proxmox = {
      source  = "bpg/proxmox"
      version = ">= 0.99.0, < 1.0.0"
    }
  }
}

provider "proxmox" {
  endpoint  = var.proxmox_endpoint
  api_token = var.proxmox_api_token
  insecure  = true

  ssh {
    agent       = false
    username    = "root"
    private_key = file(var.ssh_private_key_path)
  }
}

module "wazuh" {
  source = "../../modules/vm_clone"

  proxmox_node   = var.proxmox_node
  vm_id          = 310
  vm_name        = "wazuh-shared"
  template_vm_id = 102 # tpl-ubuntu-2404

  cpu_cores = 4
  memory_mb = 8192
  disk_size = 100

  network_bridge = "vmbr0"
  ip_address     = var.wazuh_ip_address
  gateway        = var.wazuh_gateway

  # Dual-home onto the SIEM bridge so scenario-VM agents can reach
  # the manager at 1514/1515 without traversing vmbr0.
  second_bridge     = var.wazuh_agent_bridge
  second_ip_address = var.wazuh_agent_ip_address
  # No gateway on the second NIC — default route stays on vmbr0.

  ssh_public_key = file(var.ssh_public_key_path)
  admin_user     = "ansible"

  scenario_tag = "wazuh-shared"
  zone_tag     = "mgmt"
  extra_tags   = ["blue-team", "siem", "fixture"]
}

output "wazuh_ip" {
  value       = module.wazuh.ip_address
  description = "Wazuh VM IP address on vmbr0 mgmt subnet"
}

output "wazuh_vmid" {
  value       = module.wazuh.vm_id
  description = "Proxmox VM ID for the Wazuh fixture"
}

output "wazuh_dashboard_url" {
  value       = "https://${module.wazuh.ip_address}"
  description = "Wazuh dashboard URL (self-signed cert)"
}

output "wazuh_agent_ip" {
  value       = module.wazuh.second_ip_address
  description = "Wazuh IP on the SIEM bridge — agents enroll and forward to this address"
}

output "wazuh_agent_bridge" {
  value       = module.wazuh.second_bridge
  description = "Proxmox bridge carrying agent traffic"
}
