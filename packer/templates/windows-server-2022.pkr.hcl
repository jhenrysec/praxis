# packer/templates/windows-server-2022.pkr.hcl
# Windows Server 2022 Evaluation — AD/workstation base template
# Requires manual ISO download from Microsoft Eval Center
# Also requires virtio-win.iso for VirtIO drivers
# Template ID: 110 | Name: tpl-win2022

locals {
  template_name_win = "tpl-win2022"
  vm_id_win         = 110
}

source "proxmox-iso" "windows" {
  proxmox_url              = var.proxmox_url
  username                 = var.proxmox_username
  token                    = var.proxmox_token
  node                     = var.proxmox_node
  insecure_skip_tls_verify = true

  vm_id   = local.vm_id_win
  vm_name = local.template_name_win

  boot_iso {
    iso_file         = "local:iso/SERVER_EVAL_x64FRE_en-us.iso"
    iso_storage_pool = "local"
    unmount          = true
  }

  # VirtIO drivers ISO mounted as secondary CD-ROM
  additional_iso_files {
    type             = "ide"
    index            = 3
    iso_file         = "local:iso/virtio-win.iso"
    iso_storage_pool = "local"
    unmount          = true
  }

  # Deliver autounattend.xml as a generated ISO
  additional_iso_files {
    type             = "sata"
    index            = 0
    cd_files         = ["${path.root}/../http/autounattend.xml"]
    cd_label         = "OEMDRV"
    iso_storage_pool = "local"
  }

  os = "win11"

  cpu_type = "host"
  cores    = 4
  sockets  = 1
  memory   = 4096

  scsi_controller = "virtio-scsi-single"

  disks {
    disk_size    = "80G"
    storage_pool = var.proxmox_storage_pool
    type         = "scsi"
    discard      = true
    io_thread    = true
  }

  network_adapters {
    bridge = "vmbr0"
    model  = "virtio"
  }

  communicator   = "winrm"
  winrm_username = "Administrator"
  winrm_password = "LabAdmin2024!"
  winrm_timeout  = "60m"
  winrm_use_ssl  = false
  winrm_insecure = true

  # Sysprep /generalize runs as the final PROVISIONER, not shutdown_command —
  # proxmox-iso doesn't accept shutdown_command. The build-block provisioner
  # below uses Start-Process so the session returns before WinRM dies; sysprep
  # then completes async, strips machine-specific state (SID, hostname, WinRM
  # config), and shuts the VM down. proxmox-iso detects power-off via the
  # Proxmox API and converts the VM to a template.

  template_name        = local.template_name_win
  template_description = "Windows Server 2022 Eval — AD/workstation base — Built ${formatdate("YYYY-MM-DD", timestamp())} (sysprep'd)"
}

build {
  sources = ["source.proxmox-iso.windows"]

  # ── Verify QEMU Guest Agent is running (installed via autounattend) ────────
  provisioner "powershell" {
    inline = [
      "if (Get-Service QEMU-GA -ErrorAction SilentlyContinue) {",
      "  Write-Host 'QEMU Guest Agent: running'",
      "} else {",
      "  Write-Host 'WARNING: QEMU Guest Agent service not found'",
      "}",
    ]
  }

  # ── Enable RDP ─────────────────────────────────────────────────────────────
  provisioner "powershell" {
    inline = [
      "Set-ItemProperty -Path 'HKLM:\\System\\CurrentControlSet\\Control\\Terminal Server' -Name 'fDenyTSConnections' -Value 0",
      "Enable-NetFirewallRule -DisplayGroup 'Remote Desktop'",
      "Write-Host 'RDP enabled'",
    ]
  }

  # ── Install Windows features commonly needed in lab scenarios ──────────────
  provisioner "powershell" {
    inline = [
      "# Pre-install AD tools and PowerShell features used across scenarios",
      "Install-WindowsFeature -Name RSAT-AD-Tools -IncludeAllSubFeature -ErrorAction SilentlyContinue",
      "Install-WindowsFeature -Name RSAT-DNS-Server -ErrorAction SilentlyContinue",
      "Install-WindowsFeature -Name RSAT-DHCP -ErrorAction SilentlyContinue",
      "Install-WindowsFeature -Name Telnet-Client -ErrorAction SilentlyContinue",
      "Write-Host 'Windows features installed'",
    ]
  }

  # ── Disable Windows Update auto-restart (lab VMs should not auto-reboot) ──
  provisioner "powershell" {
    inline = [
      "# Disable auto-restart for Windows Update in lab environment",
      "New-Item -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate\\AU' -Force | Out-Null",
      "Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate\\AU' -Name 'NoAutoRebootWithLoggedOnUsers' -Value 1 -Type DWord",
      "Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate\\AU' -Name 'AUOptions' -Value 2 -Type DWord",
      "Write-Host 'Windows Update auto-restart disabled'",
    ]
  }

  # ── Configure WinRM for Ansible ────────────────────────────────────────────
  provisioner "powershell" {
    inline = [
      "# Ensure WinRM is configured for Ansible",
      "Set-Item -Path WSMan:\\localhost\\Service\\AllowUnencrypted -Value $true",
      "Set-Item -Path WSMan:\\localhost\\Service\\Auth\\Basic -Value $true",
      "Set-Item -Path WSMan:\\localhost\\MaxEnvelopeSizekb -Value 8192",
      "",
      "# Set PowerShell execution policy via registry (avoids GPO conflict)",
      "Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\PowerShell\\1\\ShellIds\\Microsoft.PowerShell' -Name ExecutionPolicy -Value RemoteSigned",
      "",
      "Write-Host 'WinRM configured for Ansible'",
    ]
  }

  # ── Cleanup ────────────────────────────────────────────────────────────────
  provisioner "powershell" {
    inline = [
      "# Clean temp files",
      "Remove-Item -Path \"$env:TEMP\\*\" -Recurse -Force -ErrorAction SilentlyContinue",
      "Remove-Item -Path 'C:\\Windows\\Temp\\*' -Recurse -Force -ErrorAction SilentlyContinue",
      "",
      "# Clear event logs for clean template state",
      "Get-EventLog -LogName * | ForEach-Object { Clear-EventLog -LogName $_.Log -ErrorAction SilentlyContinue }",
      "",
      "# Optimize disk (compact for thin provisioning)",
      "Optimize-Volume -DriveLetter C -Defrag -ErrorAction SilentlyContinue",
      "",
      "Write-Host 'Template cleanup complete'",
    ]
  }

  # ── Stage sysprep Unattend.xml — runs BEFORE the sysprep provisioner ──────
  # Panther is the conventional staging directory for unattend files. This
  # file drives the specialize + oobeSystem passes on every CLONE's first
  # boot — NOT the Packer build. It restores auto-login + WinRM + QEMU-GA
  # after sysprep /generalize strips them.
  provisioner "file" {
    source      = "${path.root}/../http/sysprep-unattend.xml"
    destination = "C:/Windows/Panther/Unattend.xml"
  }

  # ── Sysprep — MUST be the LAST provisioner ────────────────────────────────
  # proxmox-iso doesn't accept shutdown_command, so sysprep runs here. WinRM
  # dies during generalize — if this PowerShell session waited for sysprep to
  # finish, Packer's WinRM driver would hang. Start-Process launches sysprep
  # detached; this session returns 0 after the 5-second sleep, sysprep
  # continues async, strips machine-specific state, and shuts the VM down.
  # proxmox-iso detects the power-off via the Proxmox API and converts the
  # VM to a template.
  provisioner "powershell" {
    inline = [
      "Start-Process -FilePath C:\\Windows\\System32\\Sysprep\\Sysprep.exe -ArgumentList '/generalize','/oobe','/shutdown','/unattend:C:\\Windows\\Panther\\Unattend.xml' -NoNewWindow",
      "Start-Sleep -Seconds 5",
    ]
  }
}
