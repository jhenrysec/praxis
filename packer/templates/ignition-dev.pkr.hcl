# packer/templates/ignition-dev.pkr.hcl
# Ignition 8.1 Gateway (dev mode) on Debian 12 — ICS/SCADA HMI/historian
# Web UI on port 8088, OPC-UA on 62541
# Template ID: 151 | Name: tpl-ignition-dev

locals {
  template_name_ignition = "tpl-ignition-dev"
  vm_id_ignition         = 151
  ignition_version       = "8.1.44"
}

source "proxmox-iso" "ignition" {
  proxmox_url              = var.proxmox_url
  username                 = var.proxmox_username
  token                    = var.proxmox_token
  node                     = var.proxmox_node
  insecure_skip_tls_verify = true

  vm_id   = local.vm_id_ignition
  vm_name = local.template_name_ignition

  iso_file         = "local:iso/debian-12.0.0-amd64-netinst.iso"
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

  boot_command = [
    "<esc><wait>",
    "auto url=http://{{ .HTTPIP }}:{{ .HTTPPort }}/preseed-debian.cfg ",
    "hostname=ignition-template domain=lab.local ",
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

  template_name        = local.template_name_ignition
  template_description = "Ignition ${local.ignition_version} Gateway (dev) on Debian 12 — HMI/Historian — Built ${formatdate("YYYY-MM-DD", timestamp())}"
}

build {
  sources = ["source.proxmox-iso.ignition"]

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

  # ── Install Java 17 (required by Ignition) ────────────────────────────────
  provisioner "shell" {
    inline = [
      "export DEBIAN_FRONTEND=noninteractive",
      "sudo apt-get install -y -q openjdk-17-jre-headless",
      "java -version",
    ]
  }

  # ── Download and install Ignition Gateway ──────────────────────────────────
  provisioner "shell" {
    inline = [
      "cd /tmp",
      "wget -q 'https://files.inductiveautomation.com/release/ia/8.1.44/Ignition-linux-x86_64-8.1.44.zip' -O ignition.zip",
      "sudo mkdir -p /usr/local/ignition",
      "sudo unzip -q ignition.zip -d /usr/local/ignition",
      "rm ignition.zip",
      "sudo chmod +x /usr/local/ignition/*.sh",
    ]
    timeout = "10m"
  }

  # ── Configure Ignition as systemd service ──────────────────────────────────
  provisioner "shell" {
    inline = [
      "# Create ignition service user",
      "sudo useradd -r -s /usr/sbin/nologin -d /usr/local/ignition ignition || true",
      "sudo chown -R ignition:ignition /usr/local/ignition",
      "",
      "# Create systemd unit",
      "sudo tee /etc/systemd/system/ignition.service > /dev/null <<'UNIT'",
      "[Unit]",
      "Description=Ignition SCADA Gateway",
      "After=network.target",
      "",
      "[Service]",
      "Type=forking",
      "User=ignition",
      "Group=ignition",
      "WorkingDirectory=/usr/local/ignition",
      "ExecStart=/usr/local/ignition/ignition.sh start",
      "ExecStop=/usr/local/ignition/ignition.sh stop",
      "Restart=on-failure",
      "RestartSec=10",
      "LimitNOFILE=65536",
      "",
      "[Install]",
      "WantedBy=multi-user.target",
      "UNIT",
      "",
      "sudo systemctl daemon-reload",
      "sudo systemctl enable ignition.service",
    ]
  }

  # ── Configure Ignition for dev/trial mode ──────────────────────────────────
  provisioner "shell" {
    inline = [
      "# Set Ignition to accept trial license on first boot (dev mode)",
      "# The gateway.xml wrapper config enables developer mode settings",
      "sudo mkdir -p /usr/local/ignition/data",
      "sudo tee /usr/local/ignition/data/ignition.conf > /dev/null <<'CONF'",
      "# Ignition Gateway configuration",
      "# Dev mode: trial license auto-accepted, default admin creds",
      "wrapper.java.additional.1=-Dignition.allowunsignedmodules=true",
      "wrapper.java.additional.2=-Xms512m",
      "wrapper.java.additional.3=-Xmx2048m",
      "CONF",
      "sudo chown -R ignition:ignition /usr/local/ignition/data",
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
