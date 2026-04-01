# terraform/scenarios/_template/main.tf
# TEMPLATE — Copy this directory to create a new scenario.
# Replace all <PLACEHOLDER> values with scenario-specific settings.
#
# Usage:
#   cp -r terraform/scenarios/_template terraform/scenarios/<scenario_name>
#   Edit main.tf, variables.tf, terraform.tfvars, scenario.yaml
#   terraform init && terraform plan -var-file=terraform.tfvars

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
  source      = "../../modules/network_segment"
  slot_number = var.slot_number
}

locals {
  ssh_public_key = file(var.ssh_public_key_path)
}

# ── Attacker VM (Red Zone) ───────────────────────────────────────────────────

module "attacker" {
  source = "../../modules/vm_clone"

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

  scenario_tag = var.scenario_name
  zone_tag     = "red"
}

# ── Target VM (Blue Zone) — uncomment and customize ─────────────────────────

# module "target" {
#   source = "../../modules/vm_clone"
#
#   proxmox_node   = var.proxmox_node
#   vm_id          = module.net.vm_id_base + 1
#   vm_name        = "target-s${var.slot_number}"
#   template_vm_id = 103  # tpl-debian-12
#
#   network_bridge = module.net.blue_bridge
#   ip_address     = "${module.net.blue_prefix}.20"
#   gateway        = module.net.blue_gateway
#   ssh_public_key = local.ssh_public_key
#
#   scenario_tag = var.scenario_name
#   zone_tag     = "blue"
# }

# ── SCADA Node (OT Zone) — uncomment for ICS scenarios ─────────────────────

# module "plc" {
#   source = "../../modules/scada_node"
#
#   proxmox_node   = var.proxmox_node
#   vm_id          = module.net.vm_id_base + 5
#   vm_name        = "openplc-s${var.slot_number}"
#   template_vm_id = 150  # tpl-openplc
#
#   ip_address     = "${module.net.ot_prefix}.10"
#   gateway        = module.net.ot_gateway
#   ssh_public_key = local.ssh_public_key
#
#   scenario_tag = var.scenario_name
#   scada_role   = "plc"
# }

# ── Outputs ──────────────────────────────────────────────────────────────────

output "access_sheet" {
  description = "Student access information"
  value = {
    scenario      = var.scenario_name
    slot          = var.slot_number
    attacker_ip   = module.attacker.ip_address
    attacker_user = "kali"
    attacker_pass = "kali"
    # target_ip   = module.target.ip_address
    # plc_ip      = module.plc.ip_address
    red_network   = module.net.red_network
    blue_network  = module.net.blue_network
    ot_network    = module.net.ot_network
  }
}
