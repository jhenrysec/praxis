# packer/templates/kali-2024.pkr.hcl
# Kali Linux 2024.4 — Attacker platform template
# Includes: Go 1.23, Metasploit, Impacket, CrackMapExec, ICS tools
# Template ID: 101 | Name: tpl-kali-2024

locals {
  template_name = "tpl-kali-2024"
  vm_id         = 101
}

source "proxmox-iso" "kali" {
  proxmox_url              = var.proxmox_url
  username                 = var.proxmox_username
  token                    = var.proxmox_token
  node                     = var.proxmox_node
  insecure_skip_tls_verify = true

  vm_id   = local.vm_id
  vm_name = local.template_name

  iso_file         = "local:iso/kali-linux-2026.1-installer-amd64.iso"
  iso_storage_pool = "local"
  unmount_iso      = true

  cpu_type = "host"
  cores    = 4
  sockets  = 1
  memory   = 4096

  scsi_controller = "virtio-scsi-single"

  disks {
    disk_size    = "60G"
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

  # Kali 2026.x syslinux BIOS menu:
  #   Graphical Install (default) → ↓ → Install
  # Select "Install", press Tab to edit boot params, append preseed URL
  boot_command = [
    "<wait10><wait10>",
    "<down><wait1>",
    "<tab><wait1>",
    " auto=true priority=critical",
    " url=http://{{ .HTTPIP }}:{{ .HTTPPort }}/preseed.cfg",
    " hostname=kali-template domain=lab.local",
    " net.ifnames=0 biosdevname=0",
    " locale=en_US.UTF-8 keymap=us",
    "<enter>"
  ]
  boot_wait = "10s"

  http_directory = "${path.root}/../http"

  ssh_username           = "labuser"
  ssh_password           = "labuser"
  ssh_timeout            = "30m"
  ssh_handshake_attempts = 20

  qemu_agent = true

  template_name        = local.template_name
  template_description = "Kali Linux 2024.4 — Attacker platform — Built ${formatdate("YYYY-MM-DD", timestamp())}"
}

build {
  sources = ["source.proxmox-iso.kali"]

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
      "sudo systemctl enable qemu-guest-agent",
    ]
  }

  # ── Go 1.23.4 ─────────────────────────────────────────────────────────────
  provisioner "shell" {
    inline = [
      "wget -q https://go.dev/dl/go1.23.4.linux-amd64.tar.gz -O /tmp/go.tar.gz",
      "sudo tar -C /usr/local -xzf /tmp/go.tar.gz",
      "echo 'export PATH=$PATH:/usr/local/go/bin' | sudo tee /etc/profile.d/go.sh",
      "rm /tmp/go.tar.gz",
    ]
  }

  # ── Security tools ────────────────────────────────────────────────────────
  provisioner "shell" {
    inline = [
      "export DEBIAN_FRONTEND=noninteractive",
      "sudo apt-get install -y -q metasploit-framework impacket-scripts crackmapexec",
      "sudo apt-get install -y -q python3-pymodbus python3-pip nmap tshark",
      "sudo apt-get install -y -q enum4linux smbclient nbtscan hydra john hashcat",
      "sudo apt-get install -y -q tcpdump netcat-openbsd socat dnsutils whois",
    ]
  }

  # ── ICS/SCADA Python tools ────────────────────────────────────────────────
  provisioner "shell" {
    inline = [
      "sudo pip3 install --quiet --break-system-packages opcua==0.98.13 pycomm3==1.2.14",
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
