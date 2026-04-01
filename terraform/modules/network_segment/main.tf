# terraform/modules/network_segment/main.tf
# Per-slot network segment calculator.
# Does NOT create Proxmox resources — bridges and VLANs are pre-configured
# by Ansible in Phase 3. This module computes IP ranges and gateway addresses
# for a given student slot, providing consistent addressing to vm_clone modules.
#
# 20-Slot IP Scheme (from CLAUDE.md):
#   Red zone:  10.10.(slot*2-1).0/24   (vmbr1)
#   Blue zone: 10.10.(slot*2).0/24     (vmbr2)
#   OT zone:   192.168.(100+slot).0/24 (vmbr3)
#
# VM ID scheme:
#   Slot N uses IDs 200 + (N-1)*10 through 200 + (N-1)*10 + 9

locals {
  # IP range computation
  red_third_octet  = var.slot_number * 2 - 1
  blue_third_octet = var.slot_number * 2
  ot_third_octet   = 100 + var.slot_number

  red_network  = "10.10.${local.red_third_octet}.0/24"
  blue_network = "10.10.${local.blue_third_octet}.0/24"
  ot_network   = "192.168.${local.ot_third_octet}.0/24"

  red_gateway  = "10.10.${local.red_third_octet}.1"
  blue_gateway = "10.10.${local.blue_third_octet}.1"
  ot_gateway   = "192.168.${local.ot_third_octet}.1"

  # VM ID base for this slot
  vm_id_base = 200 + (var.slot_number - 1) * 10

  # VLAN tag for this slot (101-120)
  vlan_tag = 100 + var.slot_number

  # Terraform workspace name
  workspace_name = "student-slot-${format("%02d", var.slot_number)}"
}
