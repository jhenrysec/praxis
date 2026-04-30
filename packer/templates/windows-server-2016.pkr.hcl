# packer/templates/windows-server-2016.pkr.hcl
# Windows Server 2016 Evaluation — legacy AD forest / pre-PS 5.1 baseline
# Requires manual ISO download from Microsoft Eval Center + virtio-win.iso
# Template ID: 111 | Name: tpl-win2016
# Uses autounattend-2016.xml with the 2k16 VirtIO driver paths and
# "Windows Server 2016 SERVERDATACENTER" image name.

locals {
  template_name_win2016 = "tpl-win2016"
  vm_id_win2016         = 111
}

source "proxmox-iso" "win2016" {
  proxmox_url              = var.proxmox_url
  username                 = var.proxmox_username
  token                    = var.proxmox_token
  node                     = var.proxmox_node
  insecure_skip_tls_verify = true

  vm_id   = local.vm_id_win2016
  vm_name = local.template_name_win2016

  boot_iso {
    iso_file         = "local:iso/14393.0.161119-1705.RS1_REFRESH_SERVER_EVAL_X64FRE_EN-US.ISO"
    iso_storage_pool = "local"
    unmount          = true
  }

  additional_iso_files {
    type             = "ide"
    index            = 3
    iso_file         = "local:iso/virtio-win.iso"
    iso_storage_pool = "local"
    unmount          = true
  }

  additional_iso_files {
    type             = "sata"
    index            = 0
    cd_files         = ["${path.root}/../http/autounattend-2016.xml"]
    cd_label         = "OEMDRV"
    iso_storage_pool = "local"
  }

  # Server 2016 pre-dates the win11 os hint; use win10 (same Hyper-V type)
  os = "win10"

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

  communicator   = "winrm"
  winrm_username = "Administrator"
  winrm_password = "LabAdmin2024!"
  winrm_timeout  = "60m"
  winrm_use_ssl  = false
  winrm_insecure = true

  # Sysprep runs as the final provisioner — proxmox-iso doesn't support
  # shutdown_command. See windows-server-2022.pkr.hcl for the full rationale.

  template_name        = local.template_name_win2016
  template_description = "Windows Server 2016 Eval — legacy AD / pre-PS 5.1 baseline — Built ${formatdate("YYYY-MM-DD", timestamp())} (sysprep'd)"
}

build {
  sources = ["source.proxmox-iso.win2016"]

  provisioner "powershell" {
    inline = [
      "if (Get-Service QEMU-GA -ErrorAction SilentlyContinue) {",
      "  Write-Host 'QEMU Guest Agent: running'",
      "} else {",
      "  Write-Host 'WARNING: QEMU Guest Agent service not found'",
      "}",
    ]
  }

  provisioner "powershell" {
    inline = [
      "Set-ItemProperty -Path 'HKLM:\\System\\CurrentControlSet\\Control\\Terminal Server' -Name 'fDenyTSConnections' -Value 0",
      "Enable-NetFirewallRule -DisplayGroup 'Remote Desktop'",
      "Write-Host 'RDP enabled'",
    ]
  }

  provisioner "powershell" {
    inline = [
      "Install-WindowsFeature -Name RSAT-AD-Tools -IncludeAllSubFeature -ErrorAction SilentlyContinue",
      "Install-WindowsFeature -Name RSAT-DNS-Server -ErrorAction SilentlyContinue",
      "Install-WindowsFeature -Name RSAT-DHCP -ErrorAction SilentlyContinue",
      "Install-WindowsFeature -Name Telnet-Client -ErrorAction SilentlyContinue",
      "Write-Host 'Windows features installed'",
    ]
  }

  provisioner "powershell" {
    inline = [
      "New-Item -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate\\AU' -Force | Out-Null",
      "Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate\\AU' -Name 'NoAutoRebootWithLoggedOnUsers' -Value 1 -Type DWord",
      "Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate\\AU' -Name 'AUOptions' -Value 2 -Type DWord",
      "Write-Host 'Windows Update auto-restart disabled'",
    ]
  }

  provisioner "powershell" {
    inline = [
      "Set-Item -Path WSMan:\\localhost\\Service\\AllowUnencrypted -Value $true",
      "Set-Item -Path WSMan:\\localhost\\Service\\Auth\\Basic -Value $true",
      "Set-Item -Path WSMan:\\localhost\\MaxEnvelopeSizekb -Value 8192",
      "Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\PowerShell\\1\\ShellIds\\Microsoft.PowerShell' -Name ExecutionPolicy -Value RemoteSigned",
      "Write-Host 'WinRM configured for Ansible'",
    ]
  }

  provisioner "powershell" {
    inline = [
      "Remove-Item -Path \"$env:TEMP\\*\" -Recurse -Force -ErrorAction SilentlyContinue",
      "Remove-Item -Path 'C:\\Windows\\Temp\\*' -Recurse -Force -ErrorAction SilentlyContinue",
      "Get-EventLog -LogName * | ForEach-Object { Clear-EventLog -LogName $_.Log -ErrorAction SilentlyContinue }",
      "Optimize-Volume -DriveLetter C -Defrag -ErrorAction SilentlyContinue",
      "Write-Host 'Template cleanup complete'",
    ]
  }

  # Stage sysprep Unattend.xml — consumed by the sysprep provisioner below.
  provisioner "file" {
    source      = "${path.root}/../http/sysprep-unattend.xml"
    destination = "C:/Windows/Panther/Unattend.xml"
  }

  # Sysprep — MUST be last. Start-Process lets the session return before
  # WinRM dies; sysprep runs async and powers the VM off, which proxmox-iso
  # detects as the signal to convert the VM to a template. See
  # windows-server-2022.pkr.hcl for the full rationale.
  provisioner "powershell" {
    inline = [
      "Start-Process -FilePath C:\\Windows\\System32\\Sysprep\\Sysprep.exe -ArgumentList '/generalize','/oobe','/shutdown','/unattend:C:\\Windows\\Panther\\Unattend.xml' -NoNewWindow",
      "Start-Sleep -Seconds 5",
    ]
  }
}
