# Skill: Packer — Proxmox ISO Builder

**Applies to**: INFRA_AGENT  
**Plugin**: hashicorp/proxmox (packer plugin)  
**Version target**: Packer >= 1.15.0, proxmox plugin >= 1.1.x  
**Last reviewed**: 2025-06

---

## Plugin Initialization

```hcl
# packer/packer.pkr.hcl
packer {
  required_version = ">= 1.15.0"
  required_plugins {
    proxmox = {
      version = ">= 1.1.8"
      source  = "github.com/hashicorp/proxmox"
    }
  }
}
```

```bash
packer init .
packer validate -var-file=variables.pkrvars.hcl <template>.pkr.hcl
packer build   -var-file=variables.pkrvars.hcl <template>.pkr.hcl
```

---

## Shared Variables File

```hcl
# packer/variables.pkrvars.hcl
proxmox_url          = "https://172.16.0.10:8006/api2/json"
proxmox_username     = "terraform@pve"
proxmox_token        = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
proxmox_node         = "pve01"
proxmox_storage_pool = "local-zfs"
ssh_public_key       = "ssh-ed25519 AAAA... ansible@lab"
```

---

## Linux Template Pattern (Kali / Ubuntu / Debian)

```hcl
# packer/templates/kali-2024.pkr.hcl

variable "proxmox_url"   { type = string }
variable "proxmox_username" { type = string }
variable "proxmox_token" { type = string }
variable "proxmox_node"  { type = string }
variable "proxmox_storage_pool" { type = string }
variable "ssh_public_key" { type = string }

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

  iso_url          = "https://cdimage.kali.org/current/kali-linux-2024.3-installer-amd64.iso"
  iso_checksum     = "sha256:<current-sha256-from-kali.org>"
  iso_storage_pool = "local"
  unmount_iso      = true

  cpu_type = "host"
  cores    = 4
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
    bridge = "vmbr0"   # Build on management network
    model  = "virtio"
  }

  cloud_init              = true
  cloud_init_storage_pool = var.proxmox_storage_pool

  boot_command = [
    "<esc><wait>",
    "auto url=http://{{ .HTTPIP }}:{{ .HTTPPort }}/preseed.cfg ",
    "hostname=kali-template domain=lab.local ",
    "net.ifnames=0 biosdevname=0 <enter>"
  ]
  boot_wait = "5s"

  http_directory = "http"  # Serves preseed.cfg from packer/http/

  ssh_username         = "kali"
  ssh_password         = "kali"  # Changed by Ansible in production
  ssh_timeout          = "30m"
  ssh_handshake_attempts = 20

  qemu_agent = true

  template_name        = local.template_name
  template_description = "Kali Linux 2024.3 — Attacker platform — Built by Packer ${formatdate("YYYY-MM-DD", timestamp())}"
}

build {
  sources = ["source.proxmox-iso.kali"]

  # Update and install base packages
  provisioner "shell" {
    inline = [
      "export DEBIAN_FRONTEND=noninteractive",
      "sudo apt update -q",
      "sudo apt upgrade -y -q",
      "sudo apt install -y -q qemu-guest-agent cloud-init cloud-initramfs-growroot",
      "sudo systemctl enable qemu-guest-agent",
    ]
  }

  # Install Go (for Go toolkit suite)
  provisioner "shell" {
    inline = [
      "wget -q https://go.dev/dl/go1.23.4.linux-amd64.tar.gz -O /tmp/go.tar.gz",
      "sudo tar -C /usr/local -xzf /tmp/go.tar.gz",
      "echo 'export PATH=$PATH:/usr/local/go/bin' | sudo tee /etc/profile.d/go.sh",
      "rm /tmp/go.tar.gz",
    ]
  }

  # Install security tools
  provisioner "shell" {
    inline = [
      "export DEBIAN_FRONTEND=noninteractive",
      "sudo apt install -y -q metasploit-framework impacket-scripts crackmapexec",
      "sudo apt install -y -q python3-pymodbus python3-pip nmap wireshark-cli",
      "pip3 install --quiet pymodbus opcua pycomm3",
    ]
  }

  # Clean up for templating
  provisioner "shell" {
    inline = [
      "sudo cloud-init clean",
      "sudo truncate -s 0 /etc/machine-id",
      "sudo rm -f /var/lib/dbus/machine-id",
      "sudo ln -s /etc/machine-id /var/lib/dbus/machine-id",
      "sudo apt autoremove -y",
      "sudo apt clean",
      "sudo sync",
    ]
  }
}
```

---

## Windows Template Pattern

### autounattend.xml (key sections)
```xml
<!-- packer/http/autounattend.xml -->
<?xml version="1.0" encoding="utf-8"?>
<unattend xmlns="urn:schemas-microsoft-com:unattend">
  <settings pass="windowsPE">
    <component name="Microsoft-Windows-Setup" ...>
      <DiskConfiguration>
        <Disk wcm:action="add">
          <CreatePartitions>
            <CreatePartition wcm:action="add">
              <Order>1</Order><Type>Primary</Type><Extend>true</Extend>
            </CreatePartition>
          </CreatePartitions>
          <DiskID>0</DiskID><WillWipeDisk>true</WillWipeDisk>
        </Disk>
      </DiskConfiguration>
      <ImageInstall>
        <OSImage>
          <InstallFrom>
            <MetaData wcm:action="add">
              <Key>/IMAGE/NAME</Key>
              <Value>Windows Server 2022 SERVERDATACENTERCORE</Value>
            </MetaData>
          </InstallFrom>
          <WillShowUI>Never</WillShowUI>
        </OSImage>
      </ImageInstall>
      <UserData>
        <AcceptEula>true</AcceptEula>
        <FullName>Lab Admin</FullName>
        <Organization>Cyber Range</Organization>
      </UserData>
    </component>
    <!-- VirtIO drivers from secondary CD-ROM -->
    <component name="Microsoft-Windows-PnpCustomizationsWinPE" ...>
      <DriverPaths>
        <PathAndCredentials wcm:action="add"><Path>E:\amd64\w11</Path></PathAndCredentials>
        <PathAndCredentials wcm:action="add"><Path>E:\NetKVM\w11\amd64</Path></PathAndCredentials>
      </DriverPaths>
    </component>
  </settings>
  <settings pass="specialize">
    <component name="Microsoft-Windows-Shell-Setup" ...>
      <ComputerName>WIN-TEMPLATE</ComputerName>
      <TimeZone>Eastern Standard Time</TimeZone>
    </component>
  </settings>
  <settings pass="oobeSystem">
    <component name="Microsoft-Windows-Shell-Setup" ...>
      <AutoLogon>
        <Password><Value>LabAdmin2024!</Value><PlainText>true</PlainText></Password>
        <Enabled>true</Enabled><Username>Administrator</Username>
      </AutoLogon>
      <OOBE><HideEULAPage>true</HideEULAPage><SkipMachineOOBE>true</SkipMachineOOBE></OOBE>
      <UserAccounts>
        <AdministratorPassword>
          <Value>LabAdmin2024!</Value><PlainText>true</PlainText>
        </AdministratorPassword>
      </UserAccounts>
      <FirstLogonCommands>
        <!-- Enable WinRM for Packer/Ansible -->
        <SynchronousCommand wcm:action="add">
          <Order>1</Order>
          <CommandLine>cmd /c winrm quickconfig -q</CommandLine>
        </SynchronousCommand>
        <SynchronousCommand wcm:action="add">
          <Order>2</Order>
          <CommandLine>cmd /c winrm set winrm/config/service @{AllowUnencrypted="true"}</CommandLine>
        </SynchronousCommand>
        <SynchronousCommand wcm:action="add">
          <Order>3</Order>
          <CommandLine>cmd /c winrm set winrm/config/service/auth @{Basic="true"}</CommandLine>
        </SynchronousCommand>
        <SynchronousCommand wcm:action="add">
          <Order>4</Order>
          <CommandLine>cmd /c netsh advfirewall firewall add rule name="WinRM 5985" protocol=TCP dir=in localport=5985 action=allow</CommandLine>
        </SynchronousCommand>
      </FirstLogonCommands>
    </component>
  </settings>
</unattend>
```

---

# Skill: Ansible — Lab Configuration Management

**Applies to**: INFRA_AGENT  
**Version target**: Ansible Core >= 2.19, ansible.windows >= 2.4  
**Last reviewed**: 2025-06

---

## ansible.cfg

```ini
[defaults]
inventory          = ./inventory
remote_user        = ansible
private_key_file   = ~/.ssh/lab_key
host_key_checking  = False      # Lab VMs have rotating host keys
forks              = 10
gathering          = smart
fact_caching       = jsonfile
fact_caching_connection = /tmp/ansible_facts_cache
fact_caching_timeout = 3600
stdout_callback    = yaml

[privilege_escalation]
become       = True
become_method = sudo

[ssh_connection]
pipelining = True
ssh_args   = -o ControlMaster=auto -o ControlPersist=60s

[winrm]
transport = ntlm
```

---

## Dynamic Inventory from Terraform

```python
#!/usr/bin/env python3
# inventory/terraform_inventory.py
# Reads Terraform outputs and generates Ansible inventory JSON

import json, subprocess, sys

def get_tf_outputs(workspace):
    result = subprocess.run(
        ["terraform", "output", "-json"],
        capture_output=True, text=True,
        cwd=f"../scenarios/{workspace}"
    )
    return json.loads(result.stdout)

def build_inventory(workspace):
    outputs = get_tf_outputs(workspace)
    access = outputs.get("access_sheet", {}).get("value", {})

    inventory = {
        "all": { "vars": { "ansible_ssh_private_key_file": "~/.ssh/lab_key" } },
        "_meta": { "hostvars": {} }
    }
    # Add hosts dynamically from Terraform outputs...
    return inventory

if __name__ == "__main__":
    workspace = sys.argv[1] if len(sys.argv) > 1 else "default"
    print(json.dumps(build_inventory(workspace), indent=2))
```

---

## Key Role: ad-domain-controller

```yaml
# roles/ad-domain-controller/tasks/main.yml

---
- name: "[AD-DC] Install AD DS, DNS, and DHCP roles"
  ansible.windows.win_feature:
    name: ["AD-Domain-Services", "DNS", "DHCP"]
    include_management_tools: true
    state: present
  register: ad_feature_install
  notify: reboot_if_pending

- name: "[AD-DC] Flush handlers before promotion"
  ansible.builtin.meta: flush_handlers

- name: "[AD-DC] Promote to domain controller"
  microsoft.ad.domain:
    dns_domain_name: "{{ ad_domain_name }}"       # "lab.local"
    domain_netbios_name: "{{ ad_netbios_name }}"  # "LAB"
    safe_mode_password: "{{ ad_dsrm_password }}"
    state: domain_controller
  register: ad_promotion
  notify: reboot_after_promotion

- name: "[AD-DC] Flush handlers — wait for reboot"
  ansible.builtin.meta: flush_handlers

- name: "[AD-DC] Wait for AD DS to be ready"
  ansible.windows.win_shell: |
    Import-Module ActiveDirectory
    Get-ADDomain
  register: ad_ready
  retries: 10
  delay: 30
  until: ad_ready.rc == 0

- name: "[AD-DC] Create lab OU structure"
  microsoft.ad.ou:
    name: "{{ item.name }}"
    path: "{{ item.path }}"
    state: present
  loop:
    - { name: "Lab Users", path: "DC=lab,DC=local" }
    - { name: "Lab Computers", path: "DC=lab,DC=local" }
    - { name: "Service Accounts", path: "DC=lab,DC=local" }

- name: "[AD-DC] Create lab user accounts"
  microsoft.ad.user:
    name: "{{ item.name }}"
    upn: "{{ item.username }}@{{ ad_domain_name }}"
    sam_account_name: "{{ item.username }}"
    password: "{{ item.password }}"
    password_never_expires: true
    path: "OU=Lab Users,DC=lab,DC=local"
    state: present
  loop: "{{ ad_users }}"
  no_log: true
```

---

## Role: openplc-configure

```yaml
# roles/openplc-configure/tasks/main.yml

---
- name: "[OPENPLC] Wait for OpenPLC web interface"
  ansible.builtin.uri:
    url: "http://{{ ansible_host }}:8080"
    status_code: 200
  register: openplc_ready
  retries: 15
  delay: 10
  until: openplc_ready.status == 200

- name: "[OPENPLC] Upload ladder logic program"
  ansible.builtin.uri:
    url: "http://{{ ansible_host }}:8080/upload-program"
    method: POST
    body_format: form-multipart
    body:
      file:
        filename: "{{ openplc_program }}"
        content: "{{ lookup('file', 'files/' + openplc_program) }}"
    headers:
      Cookie: "{{ openplc_session_cookie }}"

- name: "[OPENPLC] Start PLC runtime"
  ansible.builtin.uri:
    url: "http://{{ ansible_host }}:8080/start-plc"
    method: GET
    headers:
      Cookie: "{{ openplc_session_cookie }}"

- name: "[OPENPLC] Verify Modbus TCP is responding"
  ansible.builtin.wait_for:
    host: "{{ ansible_host }}"
    port: 502
    timeout: 30
    msg: "Modbus TCP port 502 not responding on {{ ansible_host }}"
```
