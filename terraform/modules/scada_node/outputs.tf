# terraform/modules/scada_node/outputs.tf

output "vm_id" {
  value       = module.vm.vm_id
  description = "Proxmox VM ID"
}

output "vm_name" {
  value       = module.vm.vm_name
  description = "VM hostname"
}

output "ip_address" {
  value       = module.vm.ip_address
  description = "Assigned IP in OT zone"
}

output "mac_address" {
  value       = module.vm.mac_address
  description = "Primary NIC MAC address"
}

output "scada_role" {
  value       = var.scada_role
  description = "SCADA function (plc, hmi, historian, etc.)"
}
