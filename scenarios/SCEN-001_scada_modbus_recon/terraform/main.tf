# terraform/scenarios/scada_modbus_recon/main.tf
# Scenario: SCEN-001 — SCADA Modbus Recon & Manipulation
# Difficulty: Beginner | Duration: 2h | Focus: ICS/OT
#
# Topology:
#   vmbr1 (Red)  — kali-attacker → direct access to OT zone
#   vmbr3 (OT)   — openplc-01 (Modbus TCP 502), historian (InfluxDB + Grafana)
#
# Attack path: Enumerate Modbus registers → identify setpoints → manipulate process

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

# ── Slot-aware networking ────────────────────────────────────────────────────

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

  # Dual-homed: also on OT zone for direct Modbus access
  second_bridge = module.net.ot_bridge

  scenario_tag = var.scenario_name
  zone_tag     = "red"
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

# ── Historian VM (OT Zone) — InfluxDB + Grafana ─────────────────────────────

module "historian" {
  source = "../../../terraform/modules/scada_node"

  proxmox_node   = var.proxmox_node
  vm_id          = module.net.vm_id_base + 6
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
  second_ip_address    = "192.168.4.${100 + (var.slot_number - 1) * 10 + 6}"
  second_prefix_length = 24

  scenario_tag = var.scenario_name
  scada_role   = "historian"
}

# ── Outputs ──────────────────────────────────────────────────────────────────

output "access_sheet" {
  description = "Student access information"
  value = {
    scenario      = "SCEN-001: SCADA Modbus Recon"
    slot          = var.slot_number
    attacker_ip   = module.attacker.ip_address
    attacker_user = "labuser"
    attacker_pass = "labuser"
    plc_ip        = module.plc.ip_address
    plc_modbus    = "${module.plc.ip_address}:502"
    plc_web       = "http://${module.plc.ip_address}:8080"
    historian_ip  = module.historian.ip_address
    grafana       = "http://${module.historian.ip_address}:3000"
    ot_network    = module.net.ot_network
    objectives    = "See: docs/scenarios/scada_modbus_recon/OBJECTIVES.md"
  }
}
