# packer/templates/ubuntu-2404.pkr.hcl
# Ubuntu Server 24.04 LTS — General purpose server template
# Template ID: 102 | Name: tpl-ubuntu-2404

locals {
  template_name_ubuntu = "tpl-ubuntu-2404"
  vm_id_ubuntu         = 102
}

source "proxmox-iso" "ubuntu" {
  proxmox_url              = var.proxmox_url
  username                 = var.proxmox_username
  token                    = var.proxmox_token
  node                     = var.proxmox_node
  insecure_skip_tls_verify = true

  vm_id   = local.vm_id_ubuntu
  vm_name = local.template_name_ubuntu

  iso_file         = "local:iso/ubuntu-24.04.4-live-server-amd64.iso"
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

  # Ubuntu 24.04 autoinstall boot command
  boot_command = [
    "<wait>e<wait>",
    "<down><down><down><end>",
    " autoinstall ds=nocloud-net\\;s=http://{{ .HTTPIP }}:{{ .HTTPPort }}/autoinstall/",
    "<f10>"
  ]
  boot_wait = "5s"

  http_directory = "${path.root}/../http"

  ssh_username           = "labuser"
  ssh_password           = "labuser"
  ssh_timeout            = "30m"
  ssh_handshake_attempts = 20

  qemu_agent = true

  template_name        = local.template_name_ubuntu
  template_description = "Ubuntu Server 24.04.2 LTS — General purpose — Built ${formatdate("YYYY-MM-DD", timestamp())}"
}

build {
  sources = ["source.proxmox-iso.ubuntu"]

  # ── System update ──────────────────────────────────────────────────────────
  provisioner "shell" {
    inline = [
      "export DEBIAN_FRONTEND=noninteractive",
      "sudo apt-get update -q",
      "sudo apt-get upgrade -y -q",
    ]
  }

  # ── Ensure core packages ───────────────────────────────────────────────────
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
