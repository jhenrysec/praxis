# terraform/scenarios/ics_ot_pivot/main.tf
# Scenario: SCEN-004 — ICS/OT Pivot: IT to OT Kill Chain
# Difficulty: Expert | Duration: 5h | Focus: IT/OT convergence
#
# Topology:
#   vmbr1 (Red)  — kali-attacker (external access)
#   vmbr2 (Blue) — dc01 (AD), eng-ws (engineering workstation, dual-homed)
#   vmbr3 (OT)   — openplc-01, grfics-host, historian
#
# Attack path: AD compromise → pivot through eng-ws → OT zone → process manipulation

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
  endpoint = var.proxmox_endpoint
  insecure = true

  ssh {
    agent       = false
    username    = "root"
    private_key = file(var.ssh_private_key_path)
  }
}

module "net" {
  source      = "../../../terraform/modules/network_segment"
  slot_number = var.slot_number
}

locals {
  ssh_public_key = file(var.ssh_public_key_path)
}

# ── Attacker VM (Red Zone) ───────────────────────────────────────────────────

module "attacker" {
  source = "../../../terraform/modules/vm_clone"

  proxmox_node   = var.proxmox_node
  vm_id          = module.net.vm_id_base + 0
  vm_name        = "kali-attacker-s${var.slot_number}"
  template_vm_id = 101 # tpl-kali-2024

  cpu_cores = 4
  memory_mb = 4096
  disk_size = 60

  network_bridge = module.net.red_bridge
  ip_address     = "${module.net.red_prefix}.10"
  gateway        = module.net.red_gateway
  ssh_public_key = local.ssh_public_key

  # Attacker can reach Blue zone (simulating corporate network access)
  second_bridge = module.net.blue_bridge

  scenario_tag = var.scenario_name
  zone_tag     = "red"
}

# ── Domain Controller (Blue Zone) ───────────────────────────────────────────

module "dc01" {
  source = "../../../terraform/modules/vm_clone"

  proxmox_node   = var.proxmox_node
  vm_id          = module.net.vm_id_base + 1
  vm_name        = "dc01-s${var.slot_number}"
  template_vm_id = 110 # tpl-win2022

  cpu_cores  = 4
  memory_mb  = 4096
  disk_size  = 80
  os_type    = "win11"
  cloud_init = false

  network_bridge = module.net.blue_bridge
  ip_address     = "${module.net.blue_prefix}.20"
  gateway        = module.net.blue_gateway
  ssh_public_key = local.ssh_public_key

  # SIEM NIC on vmbr4 — Windows has no cloud-init; wazuh-agent-windows role
  # sets the static IP via PowerShell. Kept here so per-slot IP math is in one place.
  second_bridge        = "vmbr4"
  second_ip_address    = "192.168.4.${100 + (var.slot_number - 1) * 10 + 1}"
  second_prefix_length = 24

  scenario_tag = var.scenario_name
  zone_tag     = "blue"
}

# ── Engineering Workstation (Blue + OT — dual-homed pivot point) ────────────

module "eng_ws" {
  source = "../../../terraform/modules/vm_clone"

  proxmox_node   = var.proxmox_node
  vm_id          = module.net.vm_id_base + 2
  vm_name        = "eng-ws-s${var.slot_number}"
  template_vm_id = 103 # tpl-debian-12

  cpu_cores = 2
  memory_mb = 2048
  disk_size = 40

  network_bridge = module.net.blue_bridge
  ip_address     = "${module.net.blue_prefix}.50"
  gateway        = module.net.blue_gateway
  ssh_public_key = local.ssh_public_key

  # Dual-homed: also on OT zone (the pivot point)
  second_bridge = module.net.ot_bridge

  scenario_tag = var.scenario_name
  zone_tag     = "blue"
  extra_tags   = ["dual-homed", "pivot"]
}

# ── OpenPLC (OT Zone) ───────────────────────────────────────────────────────

module "plc" {
  source = "../../../terraform/modules/scada_node"

  proxmox_node   = var.proxmox_node
  vm_id          = module.net.vm_id_base + 5
  vm_name        = "openplc-01-s${var.slot_number}"
  template_vm_id = 150 # tpl-openplc

  cpu_cores = 2
  memory_mb = 2048
  disk_size = 40

  ip_address     = "${module.net.ot_prefix}.10"
  gateway        = module.net.ot_gateway
  ssh_public_key = local.ssh_public_key

  # SIEM NIC on vmbr4 for Wazuh agent reach
  second_bridge        = "vmbr4"
  second_ip_address    = "192.168.4.${100 + (var.slot_number - 1) * 10 + 5}"
  second_prefix_length = 24

  scenario_tag = var.scenario_name
  scada_role   = "plc"
}

# ── GRFICSv2 Host (OT Zone) ────────────────────────────────────────────────

module "grfics" {
  source = "../../../terraform/modules/scada_node"

  proxmox_node   = var.proxmox_node
  vm_id          = module.net.vm_id_base + 6
  vm_name        = "grfics-host-s${var.slot_number}"
  template_vm_id = 103 # tpl-debian-12

  cpu_cores = 2
  memory_mb = 4096
  disk_size = 40

  ip_address     = "${module.net.ot_prefix}.30"
  gateway        = module.net.ot_gateway
  ssh_public_key = local.ssh_public_key

  # SIEM NIC on vmbr4 for Wazuh agent reach
  second_bridge        = "vmbr4"
  second_ip_address    = "192.168.4.${100 + (var.slot_number - 1) * 10 + 6}"
  second_prefix_length = 24

  scenario_tag = var.scenario_name
  scada_role   = "hmi"
}

# ── Historian (OT Zone) ────────────────────────────────────────────────────

module "historian" {
  source = "../../../terraform/modules/scada_node"

  proxmox_node   = var.proxmox_node
  vm_id          = module.net.vm_id_base + 7
  vm_name        = "historian-s${var.slot_number}"
  template_vm_id = 103 # tpl-debian-12

  cpu_cores = 2
  memory_mb = 2048
  disk_size = 40

  ip_address     = "${module.net.ot_prefix}.20"
  gateway        = module.net.ot_gateway
  ssh_public_key = local.ssh_public_key

  # SIEM NIC on vmbr4 for Wazuh agent reach
  second_bridge        = "vmbr4"
  second_ip_address    = "192.168.4.${100 + (var.slot_number - 1) * 10 + 7}"
  second_prefix_length = 24

  scenario_tag = var.scenario_name
  scada_role   = "historian"
}

# ── Outputs ──────────────────────────────────────────────────────────────────

output "access_sheet" {
  description = "Student access information"
  value = {
    scenario      = "SCEN-004: ICS/OT Pivot — IT to OT Kill Chain"
    slot          = var.slot_number
    attacker_ip   = module.attacker.ip_address
    attacker_user = "labuser"
    attacker_pass = "labuser"
    dc01_ip       = module.dc01.ip_address
    eng_ws_ip     = module.eng_ws.ip_address
    plc_ip        = module.plc.ip_address
    grfics_ip     = module.grfics.ip_address
    historian_ip  = module.historian.ip_address
    domain        = "lab.local"
    foothold_user = "jsmith"
    foothold_pass = "Password123"
    blue_network  = module.net.blue_network
    ot_network    = module.net.ot_network
    objectives    = "See: docs/scenarios/ics_ot_pivot/OBJECTIVES.md"
  }
}
