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
  winrm_timeout  = "45m"
  winrm_use_ssl  = false
  winrm_insecure = true

  template_name        = local.template_name_win
  template_description = "Windows Server 2022 Eval — AD/workstation base — Built ${formatdate("YYYY-MM-DD", timestamp())}"
}

build {
  sources = ["source.proxmox-iso.windows"]

  # ── Install VirtIO guest agent ─────────────────────────────────────────────
  provisioner "powershell" {
    inline = [
      "# Install QEMU Guest Agent from VirtIO ISO",
      "$installer = Get-ChildItem -Path 'D:\\guest-agent\\' -Filter 'qemu-ga-x86_64.msi' -Recurse | Select-Object -First 1",
      "if ($installer) {",
      "  Start-Process msiexec.exe -ArgumentList \"/i `\"$($installer.FullName)`\" /qn\" -Wait -NoNewWindow",
      "  Write-Host 'QEMU Guest Agent installed'",
      "} else {",
      "  Write-Host 'WARNING: QEMU Guest Agent installer not found on VirtIO ISO'",
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

  # ── Configure PowerShell and WinRM for Ansible ────────────────────────────
  provisioner "powershell" {
    inline = [
      "# Ensure WinRM is configured for Ansible",
      "Set-Item -Path WSMan:\\localhost\\Service\\AllowUnencrypted -Value $true",
      "Set-Item -Path WSMan:\\localhost\\Service\\Auth\\Basic -Value $true",
      "Set-Item -Path WSMan:\\localhost\\MaxEnvelopeSizekb -Value 8192",
      "",
      "# Set PowerShell execution policy",
      "Set-ExecutionPolicy RemoteSigned -Force",
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
}
