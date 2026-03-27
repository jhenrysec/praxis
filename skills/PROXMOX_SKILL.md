# Skill: Proxmox VE 9.x

**Applies to**: INFRA_AGENT  
**Version target**: Proxmox VE 9.1+ (Debian 13 Trixie base)  
**Last reviewed**: 2025-06

---

## Installation & Initial Setup

### ISO and Boot
```bash
# Download from:
# https://www.proxmox.com/en/downloads/proxmox-virtual-environment/iso

# Flash with dd (Linux):
dd if=proxmox-ve_9.1-1.iso of=/dev/sdX bs=4M status=progress && sync

# Dell Precision 5820 BIOS settings:
# Advanced → CPU Config → Intel Virtualization Technology: Enabled
# Advanced → CPU Config → VT for Direct I/O (VT-d): Enabled
# Advanced → CPU Config → SR-IOV: Enabled (future NIC passthrough)
# Boot → Secure Boot: Disabled
```

### ZFS Installer Options
- Select ZFS (RAID0) for single-disk — enables zvol snapshots and compression
- ashift=12 for 4K-sector drives (default in PVE 9 — verify: `zdb | grep ashift`)
- Do NOT select RAID1 unless you have two identical disks

### Package Repository Configuration
```bash
# /etc/apt/sources.list.d/pve-enterprise.list — disable:
# deb https://enterprise.proxmox.com/debian/pve trixie pve-enterprise

# /etc/apt/sources.list — add:
deb http://download.proxmox.com/debian/pve trixie pve-no-subscription

# /etc/apt/sources.list.d/ceph.list — add (if using Ceph):
# deb https://download.proxmox.com/debian/ceph-quincy trixie no-subscription

apt update && apt full-upgrade -y
```

---

## Network Configuration

### /etc/network/interfaces — Four-Bridge Pattern
```bash
# /etc/network/interfaces
# Updated: <date> — Lab four-zone bridge configuration

auto lo
iface lo inet loopback

# Physical NIC (adjust interface name: ip link show)
auto eno1
iface eno1 inet manual

# vmbr0 — Management (Proxmox UI, Terraform, Ansible)
auto vmbr0
iface vmbr0 inet static
    address 172.16.0.10/24
    gateway 172.16.0.1
    bridge-ports eno1
    bridge-stp off
    bridge-fd 0
    bridge-vlan-aware yes
    # Management network only — no VM access

# vmbr1 — Red zone (attacker platform)
auto vmbr1
iface vmbr1 inet manual
    bridge-ports none
    bridge-stp off
    bridge-fd 0
    bridge-vlan-aware yes
    # Internal only — no uplink

# vmbr2 — Blue IT zone (Windows/Linux victims)
auto vmbr2
iface vmbr2 inet manual
    bridge-ports none
    bridge-stp off
    bridge-fd 0
    bridge-vlan-aware yes

# vmbr3 — OT/SCADA zone (fully isolated)
auto vmbr3
iface vmbr3 inet manual
    bridge-ports none
    bridge-stp off
    bridge-fd 0
    bridge-vlan-aware yes
    # No gateway — isolated by default
```

```bash
# Apply without reboot:
ifreload -a
# Verify:
ip link show | grep -E "vmbr|state"
bridge link show
```

---

## ZFS Dataset Management

```bash
# Check pool status and health
zpool status
zpool list
zfs list

# Create dataset structure
zfs create -o compression=lz4 rpool/data/templates
zfs create -o compression=lz4 rpool/data/scenarios
zfs create -o compression=lz4 rpool/data/backups

# Verify compression active
zfs get compression rpool/data/templates

# Take a named snapshot
zfs snapshot rpool/data/templates/vm-101-disk-0@baseline-2025-06-01
# List snapshots
zfs list -t snapshot
# Rollback to snapshot
zfs rollback rpool/data/templates/vm-101-disk-0@baseline-2025-06-01
# Clone snapshot to new VM disk
zfs clone rpool/data/templates/vm-101-disk-0@baseline rpool/data/scenarios/vm-201-disk-0
```

---

## VM Management (CLI Reference)

```bash
# Create VM from template (linked clone — fast)
qm clone 101 201 --name kali-attacker --full 0 --storage local-zfs
# Full clone (independent copy)
qm clone 101 202 --name kali-backup --full 1 --storage local-zfs

# Start/stop/status
qm start 201
qm stop 201
qm shutdown 201
qm status 201

# Snapshot management
qm snapshot 201 baseline "Clean baseline before scenario"
qm listsnapshot 201
qm rollback 201 baseline

# Cloud-init configuration
qm set 201 --ciuser kali --cipassword '<hash>' --sshkeys /root/.ssh/lab_key.pub
qm set 201 --ipconfig0 ip=10.10.1.10/24,gw=10.10.1.1
qm cloudinit dump 201 user
# Regenerate cloud-init drive after changes
qm cloudinit update 201

# Import OVA/OVF
qm importovf 300 metasploitable3.ovf local-zfs --format qcow2
```

---

## API Token Management

```bash
# Create Terraform service user
pveum user add terraform@pve --comment "Terraform automation user"

# Create and assign roles
pveum role add TerraformRole \
  -privs "VM.Allocate VM.Clone VM.Config.CDROM VM.Config.CPU VM.Config.Disk \
          VM.Config.HWType VM.Config.Memory VM.Config.Network VM.Config.Options \
          VM.Monitor VM.Audit VM.PowerMgmt Datastore.AllocateSpace \
          Datastore.Audit SDN.Use Sys.Audit Sys.Modify Pool.Audit"

pveum acl modify / -user terraform@pve -role TerraformRole

# Create API token (--privsep=0 means token inherits full user privileges)
pveum user token add terraform@pve terraform --privsep 0
# Output: tokenid and secret — SAVE SECRET, shown only once

# Test token
curl -s -k -H "Authorization: PVEAPIToken=terraform@pve!terraform=<secret>" \
  https://172.16.0.10:8006/api2/json/version
```

---

## Firewall Configuration

```bash
# Enable at datacenter level
# /etc/pve/firewall/cluster.fw
[OPTIONS]
enable: 1
policy_in: DROP
policy_out: ACCEPT

[RULES]
# Management access only
IN ACCEPT -source 172.16.0.0/24 -p tcp --dport 8006 -log nolog  # Web UI
IN ACCEPT -source 172.16.0.0/24 -p tcp --dport 22 -log nolog    # SSH
IN ACCEPT -source 172.16.0.0/24 -p icmp -log nolog              # ICMP

# Node-level firewall
# /etc/pve/nodes/pve01/host.fw
[OPTIONS]
enable: 1
```

---

## Useful Diagnostics

```bash
# Proxmox version
pveversion -v

# Resource usage
pvesh get /nodes/pve01/status
qm list

# Network troubleshooting
tcpdump -i vmbr2 -n port 445    # Capture SMB on IT zone
bridge fdb show dev vmbr3        # MAC table for OT bridge
ip route show table main

# ZFS performance
zpool iostat -v 5
zfs get all rpool/data | grep -E "compress|dedup|used|avail"

# Storage status from Proxmox
pvesm status
pvesm list local-zfs
```

---

## Common Pitfalls

| Issue | Cause | Fix |
|---|---|---|
| Linked clone fails | Template not marked as template in UI | `qm template <vmid>` |
| Cloud-init not applying | No cloud-init drive attached | `qm set <id> --ide2 local-zfs:cloudinit` |
| VM won't start after clone | Duplicate MAC address | `qm set <id> --net0 virtio,bridge=vmbr2` (auto-generates new MAC) |
| ZFS pool degraded | Wrong ashift on import | Check: `zdb <pool> | grep ashift` — recreate if mismatch |
| API token permission denied | Missing SDN.Use priv | Re-add priv: `pveum role modify TerraformRole -privs "... SDN.Use"` |
