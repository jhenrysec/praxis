# packer/templates/debian-12.pkr.hcl
# Debian 12 (Bookworm) — Lightweight server template
# Template ID: 103 | Name: tpl-debian-12

locals {
  template_name_debian = "tpl-debian-12"
  vm_id_debian         = 103
}

source "proxmox-iso" "debian" {
  proxmox_url              = var.proxmox_url
  username                 = var.proxmox_username
  token                    = var.proxmox_token
  node                     = var.proxmox_node
  insecure_skip_tls_verify = true

  vm_id   = local.vm_id_debian
  vm_name = local.template_name_debian

  iso_file         = "local:iso/debian-12.0.0-amd64-netinst.iso"
  iso_storage_pool = "local"
  unmount_iso      = true

  cpu_type = "host"
  cores    = 2
  sockets  = 1
  memory   = 2048

  scsi_controller = "virtio-scsi-single"

  disks {
    disk_size    = "40G"
    storage_pool = var.proxmox_storage_pool
    type         = "scsi"
    discard      = true
    io_thread    = true
  }

  network_adapters {
    bridge = "vmbr0"
    model  = "virtio"
  }

  cloud_init              = true
  cloud_init_storage_pool = var.proxmox_storage_pool

  boot_command = [
    "<esc><wait>",
    "auto url=http://{{ .HTTPIP }}:{{ .HTTPPort }}/preseed-debian.cfg ",
    "hostname=debian-template domain=lab.local ",
    "net.ifnames=0 biosdevname=0 ",
    "<enter>"
  ]
  boot_wait = "5s"

  http_directory = "${path.root}/../http"

  ssh_username           = "labuser"
  ssh_password           = "labuser"
  ssh_timeout            = "30m"
  ssh_handshake_attempts = 20

  qemu_agent = true

  template_name        = local.template_name_debian
  template_description = "Debian 12.9 (Bookworm) — Lightweight server — Built ${formatdate("YYYY-MM-DD", timestamp())}"
}

build {
  sources = ["source.proxmox-iso.debian"]

  # ── System update ──────────────────────────────────────────────────────────
  provisioner "shell" {
    inline = [
      "export DEBIAN_FRONTEND=noninteractive",
      "sudo apt-get update -q",
      "sudo apt-get upgrade -y -q",
    ]
  }

  # ── Core packages ──────────────────────────────────────────────────────────
  provisioner "shell" {
    inline = [
      "export DEBIAN_FRONTEND=noninteractive",
      "sudo apt-get install -y -q qemu-guest-agent cloud-init cloud-initramfs-growroot",
      "sudo apt-get install -y -q python3 curl wget ca-certificates gnupg",
      "sudo systemctl enable qemu-guest-agent",
    ]
  }

  # ── Cleanup for templating ────────────────────────────────────────────────
  provisioner "shell" {
    inline = [
      "sudo cloud-init clean",
      "sudo truncate -s 0 /etc/machine-id",
      "sudo rm -f /var/lib/dbus/machine-id",
      "sudo ln -s /etc/machine-id /var/lib/dbus/machine-id",
      "sudo apt-get autoremove -y",
      "sudo apt-get clean",
      "sudo rm -rf /tmp/* /var/tmp/*",
      "sudo sync",
    ]
  }
}
