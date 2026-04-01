# packer/templates/openplc.pkr.hcl
# OpenPLC Runtime v3 on Debian 12 — ICS/SCADA PLC simulator
# Exposes Modbus TCP (502), web UI (8080)
# Template ID: 150 | Name: tpl-openplc

locals {
  template_name_openplc = "tpl-openplc"
  vm_id_openplc         = 150
}

source "proxmox-iso" "openplc" {
  proxmox_url              = var.proxmox_url
  username                 = var.proxmox_username
  token                    = var.proxmox_token
  node                     = var.proxmox_node
  insecure_skip_tls_verify = true

  vm_id   = local.vm_id_openplc
  vm_name = local.template_name_openplc

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
    "hostname=openplc-template domain=lab.local ",
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

  template_name        = local.template_name_openplc
  template_description = "OpenPLC Runtime v3 on Debian 12 — ICS/SCADA PLC — Built ${formatdate("YYYY-MM-DD", timestamp())}"
}

build {
  sources = ["source.proxmox-iso.openplc"]

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

  # ── Build dependencies for OpenPLC ─────────────────────────────────────────
  provisioner "shell" {
    inline = [
      "export DEBIAN_FRONTEND=noninteractive",
      "sudo apt-get install -y -q git build-essential python3 python3-pip python3-venv",
      "sudo apt-get install -y -q pkg-config autoconf automake libtool",
      "sudo apt-get install -y -q sqlite3 libsqlite3-dev",
      "sudo apt-get install -y -q curl wget ca-certificates gnupg",
    ]
  }

  # ── Install OpenPLC Runtime v3 ─────────────────────────────────────────────
  provisioner "shell" {
    inline = [
      "cd /opt",
      "sudo git clone https://github.com/thiagoralves/OpenPLC_v3.git openplc",
      "cd /opt/openplc",
      "sudo ./install.sh linux",
    ]
    timeout = "20m"
  }

  # ── Configure OpenPLC service ──────────────────────────────────────────────
  provisioner "shell" {
    inline = [
      "# Create systemd service for OpenPLC if not created by installer",
      "if [ ! -f /etc/systemd/system/openplc.service ]; then",
      "  sudo tee /etc/systemd/system/openplc.service > /dev/null <<'UNIT'",
      "[Unit]",
      "Description=OpenPLC Runtime v3",
      "After=network.target",
      "",
      "[Service]",
      "Type=simple",
      "WorkingDirectory=/opt/openplc",
      "ExecStart=/opt/openplc/start_openplc.sh",
      "Restart=on-failure",
      "RestartSec=5",
      "",
      "[Install]",
      "WantedBy=multi-user.target",
      "UNIT",
      "fi",
      "sudo systemctl daemon-reload",
      "sudo systemctl enable openplc.service",
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
