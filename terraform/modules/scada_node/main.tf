# terraform/modules/scada_node/main.tf
# Convenience wrapper around vm_clone for ICS/SCADA VMs.
# Sets OT-appropriate defaults: vmbr3, ot zone, smaller resources.
# Used for OpenPLC, Ignition, HMI, historian, and RTU VMs.

module "vm" {
  source = "../vm_clone"

  proxmox_node   = var.proxmox_node
  vm_id          = var.vm_id
  vm_name        = var.vm_name
  template_vm_id = var.template_vm_id

  cpu_cores = var.cpu_cores
  memory_mb = var.memory_mb
  disk_size = var.disk_size
  datastore = var.datastore

  network_bridge = var.network_bridge
  second_bridge  = var.second_bridge
  ip_address     = var.ip_address
  prefix_length  = var.prefix_length
  gateway        = var.gateway

  admin_user     = var.admin_user
  ssh_public_key = var.ssh_public_key
  os_type        = var.os_type
  cloud_init     = var.cloud_init
  qemu_agent     = var.qemu_agent

  scenario_tag = var.scenario_tag
  zone_tag     = "ot"
  extra_tags   = concat(["scada", var.scada_role], var.extra_tags)
}
