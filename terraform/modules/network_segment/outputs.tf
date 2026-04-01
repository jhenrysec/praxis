# terraform/modules/network_segment/outputs.tf

# ── Networks ─────────────────────────────────────────────────────────────────

output "red_network" {
  value       = local.red_network
  description = "Red zone CIDR (attacker network)"
}

output "blue_network" {
  value       = local.blue_network
  description = "Blue zone CIDR (victim/IT network)"
}

output "ot_network" {
  value       = local.ot_network
  description = "OT zone CIDR (ICS/SCADA network)"
}

# ── Gateways ─────────────────────────────────────────────────────────────────

output "red_gateway" {
  value       = local.red_gateway
  description = "Red zone gateway IP"
}

output "blue_gateway" {
  value       = local.blue_gateway
  description = "Blue zone gateway IP"
}

output "ot_gateway" {
  value       = local.ot_gateway
  description = "OT zone gateway IP"
}

# ── IP Helpers (use these to assign host IPs) ────────────────────────────────
# Convention: .1 = gateway, .10-.19 = VMs, .250-.254 = infrastructure

output "red_prefix" {
  value       = "10.10.${local.red_third_octet}"
  description = "Red zone first three octets (append .N for host IP)"
}

output "blue_prefix" {
  value       = "10.10.${local.blue_third_octet}"
  description = "Blue zone first three octets (append .N for host IP)"
}

output "ot_prefix" {
  value       = "192.168.${local.ot_third_octet}"
  description = "OT zone first three octets (append .N for host IP)"
}

# ── VM IDs ───────────────────────────────────────────────────────────────────

output "vm_id_base" {
  value       = local.vm_id_base
  description = "Base VM ID for this slot (add 0-9 for individual VMs)"
}

output "vlan_tag" {
  value       = local.vlan_tag
  description = "VLAN tag for this slot (101-120)"
}

output "workspace_name" {
  value       = local.workspace_name
  description = "Terraform workspace name for this slot"
}

# ── Bridge Assignments (constants, but grouped with slot for convenience) ────

output "red_bridge" {
  value       = "vmbr1"
  description = "Proxmox bridge for red zone"
}

output "blue_bridge" {
  value       = "vmbr2"
  description = "Proxmox bridge for blue zone"
}

output "ot_bridge" {
  value       = "vmbr3"
  description = "Proxmox bridge for OT zone"
}
