# packer/templates/rhel-9.pkr.hcl
# Red Hat Enterprise Linux 9.5 — enterprise Linux baseline
# Requires manual ISO download from developers.redhat.com
# (free Red Hat Developer Subscription — up to 16 hosts for individuals)
# Template ID: 120 | Name: tpl-rhel-9
# Uses packer/http/ks.cfg kickstart delivered via OEMDRV CD for unattended install.

locals {
  template_name_rhel_9 = "tpl-rhel-9"
  vm_id_rhel_9         = 120
}

source "proxmox-iso" "rhel_9" {
  proxmox_url              = var.proxmox_url
  username                 = var.proxmox_username
  token                    = var.proxmox_token
  node                     = var.proxmox_node
  insecure_skip_tls_verify = true

  vm_id   = local.vm_id_rhel_9
  vm_name = local.template_name_rhel_9

  boot_iso {
    iso_file         = "local:iso/rhel-9.5-x86_64-dvd.iso"
    iso_storage_pool = "local"
    unmount          = true
  }

  # Kickstart via OEMDRV CD — Anaconda auto-discovers /ks.cfg on this volume
  additional_iso_files {
    type             = "sata"
    index            = 0
    cd_files         = ["${path.root}/../http/ks.cfg"]
    cd_label         = "OEMDRV"
    iso_storage_pool = "local"
  }

  os = "l26"

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

  # RHEL 9 GRUB2 boot: edit first entry, append kickstart source, Ctrl+X to boot
  boot_command = [
    "<up><wait>",
    "e<wait>",
    "<down><down><end>",
    " inst.ks=hd:LABEL=OEMDRV:/ks.cfg",
    "<leftCtrlOn>x<leftCtrlOff>"
  ]
  boot_wait = "5s"

  ssh_username           = "ansible"
  ssh_password           = "ansible"
  ssh_timeout            = "40m"
  ssh_handshake_attempts = 20

  qemu_agent = true

  template_name        = local.template_name_rhel_9
  template_description = "RHEL 9.5 — Enterprise Linux baseline — Built ${formatdate("YYYY-MM-DD", timestamp())}"
}

build {
  sources = ["source.proxmox-iso.rhel_9"]

  provisioner "shell" {
    inline = [
      "sudo dnf -y update",
      "sudo dnf -y install qemu-guest-agent cloud-init cloud-utils-growpart",
      "sudo systemctl enable qemu-guest-agent",
      "sudo systemctl enable cloud-init cloud-init-local cloud-config cloud-final",
    ]
  }

  provisioner "shell" {
    inline = [
      "sudo dnf -y install python3 curl wget ca-certificates tar rsync",
    ]
  }

  provisioner "shell" {
    inline = [
      "sudo cloud-init clean",
      "sudo truncate -s 0 /etc/machine-id",
      "sudo rm -f /var/lib/dbus/machine-id",
      "sudo ln -s /etc/machine-id /var/lib/dbus/machine-id",
      "sudo dnf clean all",
      "sudo rm -rf /tmp/* /var/tmp/*",
      "sudo rm -f /root/.bash_history /home/ansible/.bash_history",
      "sudo sync",
    ]
  }
}
