# terraform/modules/vm_clone/outputs.tf

output "vm_id" {
  value       = proxmox_virtual_environment_vm.this.vm_id
  description = "Proxmox VM ID"
}

output "vm_name" {
  value       = proxmox_virtual_environment_vm.this.name
  description = "VM hostname"
}

output "ip_address" {
  value       = var.ip_address
  description = "Assigned static IP address"
}

output "mac_address" {
  value       = try(proxmox_virtual_environment_vm.this.network_device[0].mac_address, "")
  description = "Primary NIC MAC address"
}

output "network_bridge" {
  value       = var.network_bridge
  description = "Primary network bridge"
}

output "zone_tag" {
  value       = var.zone_tag
  description = "Network zone assignment"
}
