# terraform/scenarios/cred_access_kerberoasting/main.tf
# Scenario: SCEN-002 — Credential Access: Kerberoasting
# Difficulty: Intermediate | Duration: 3h | Focus: AD/Windows
#
# Topology:
#   vmbr1 (Red)  — kali-attacker with domain user creds
#   vmbr2 (Blue) — dc01 (lab.local DC), ws01 (domain workstation)
#
# Attack path: Domain user → Kerberoast SPN accounts → crack TGS → escalate

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

  # Dual-homed: also on Blue zone to reach AD
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

  scenario_tag = var.scenario_name
  zone_tag     = "blue"
}

# ── Domain Workstation (Blue Zone) ──────────────────────────────────────────

module "ws01" {
  source = "../../../terraform/modules/vm_clone"

  proxmox_node   = var.proxmox_node
  vm_id          = module.net.vm_id_base + 2
  vm_name        = "ws01-s${var.slot_number}"
  template_vm_id = 110 # tpl-win2022

  cpu_cores  = 2
  memory_mb  = 4096
  disk_size  = 80
  os_type    = "win11"
  cloud_init = false

  network_bridge = module.net.blue_bridge
  ip_address     = "${module.net.blue_prefix}.30"
  gateway        = module.net.blue_gateway
  ssh_public_key = local.ssh_public_key

  scenario_tag = var.scenario_name
  zone_tag     = "blue"
}

# ── Outputs ──────────────────────────────────────────────────────────────────

output "access_sheet" {
  description = "Student access information"
  value = {
    scenario       = "SCEN-002: Credential Access — Kerberoasting"
    slot           = var.slot_number
    attacker_ip    = module.attacker.ip_address
    attacker_user  = "kali"
    attacker_pass  = "kali"
    dc01_ip        = module.dc01.ip_address
    ws01_ip        = module.ws01.ip_address
    domain         = "lab.local"
    domain_user    = "jsmith"
    domain_pass    = "Password123"
    blue_network   = module.net.blue_network
    objectives     = "See: docs/scenarios/cred_access_kerberoasting/OBJECTIVES.md"
  }
}
