# terraform/modules/vm_clone/main.tf
# Reusable linked-clone VM module for all lab scenarios.
# Creates a Proxmox VM from a template with cloud-init networking.
# Supports both Linux (cloud-init) and Windows (no cloud-init) VMs.

terraform {
  required_providers {
    proxmox = {
      source  = "bpg/proxmox"
      version = ">= 0.99.0"
    }
  }
}

resource "proxmox_virtual_environment_vm" "this" {
  node_name = var.proxmox_node
  name      = var.vm_name
  vm_id     = var.vm_id

  clone {
    vm_id   = var.template_vm_id
    full    = var.full_clone
    retries = 3
  }

  cpu {
    cores   = var.cpu_cores
    sockets = 1
    type    = "host"
  }

  memory {
    dedicated = var.memory_mb
  }

  # Primary disk — inherits template size, can be resized
  disk {
    interface    = "scsi0"
    datastore_id = var.datastore
    size         = var.disk_size
    discard      = "on"
    iothread     = true
  }

  # Cloud-init drive is inherited from the template (ide0) for linked clones.
  # The initialization block below handles cloud-init configuration.
  # Do NOT add an explicit ide2 disk — it conflicts with the template's existing drive.

  # Network adapters — primary + optional second NIC for dual-homed VMs
  network_device = var.second_bridge != "" ? [
    {
      bridge       = var.network_bridge
      model        = "virtio"
      disconnected = false
      enabled      = true
      firewall     = false
      mac_address  = null
      mtu          = null
      queues       = null
      rate_limit   = null
      trunks       = null
      vlan_id      = null
    },
    {
      bridge       = var.second_bridge
      model        = "virtio"
      disconnected = false
      enabled      = true
      firewall     = false
      mac_address  = null
      mtu          = null
      queues       = null
      rate_limit   = null
      trunks       = null
      vlan_id      = null
    },
  ] : [
    {
      bridge       = var.network_bridge
      model        = "virtio"
      disconnected = false
      enabled      = true
      firewall     = false
      mac_address  = null
      mtu          = null
      queues       = null
      rate_limit   = null
      trunks       = null
      vlan_id      = null
    },
  ]

  # Cloud-init configuration (Linux VMs)
  dynamic "initialization" {
    for_each = var.cloud_init ? [1] : []
    content {
      datastore_id = var.datastore

      ip_config {
        ipv4 {
          address = "${var.ip_address}/${var.prefix_length}"
          gateway = var.gateway
        }
      }

      user_account {
        username = var.admin_user
        keys     = [var.ssh_public_key]
      }
    }
  }

  operating_system {
    type = var.os_type
  }

  agent {
    enabled = var.qemu_agent
    trim    = true
  }

  tags = concat(
    [var.scenario_tag, var.zone_tag, "lab"],
    var.extra_tags,
  )

  # Don't replace VM on post-creation changes to cloud-init or MAC
  lifecycle {
    ignore_changes = [
      initialization[0].ip_config,
      network_device,
    ]
  }
}
