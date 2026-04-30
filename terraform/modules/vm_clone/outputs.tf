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

output "second_ip_address" {
  value       = var.second_ip_address
  description = "Second NIC IP address (empty if not dual-homed)"
}

output "second_bridge" {
  value       = var.second_bridge
  description = "Second NIC bridge (empty if not dual-homed)"
}

output "slot_tag" {
  value       = var.slot_number > 0 ? "student-slot-${var.slot_number}" : ""
  description = "Slot tag applied to the VM (empty for non-slot fixtures). Matches the tag portal-backend uses to enumerate slot VMs."
}

output "slot_number" {
  value       = var.slot_number
  description = "Slot number this VM belongs to (0 for shared fixtures)"
}
