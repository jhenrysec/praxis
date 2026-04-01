# Phase 2–3: Storage and Network Configuration

**Time required**: ~30 minutes
**Prerequisite**: Phase 1 (Proxmox host online)
**Result**: ZFS datasets for templates/scenarios/backups, four network bridges configured

---

## Part A: ZFS Storage (Phase 2)

### Create ZFS pool (if not using install default)

If you selected ZFS during Proxmox installation, `rpool` already exists. Create lab datasets:

```bash
# Create datasets with lz4 compression
zfs create -o compression=lz4 rpool/labdata
zfs create -o compression=lz4 rpool/labdata/templates
zfs create -o compression=lz4 rpool/labdata/scenarios
zfs create -o compression=lz4 rpool/labdata/backups

# Verify
zfs list -r rpool/labdata
```

### Add ZFS storage to Proxmox

In the web UI: Datacenter → Storage → Add → ZFS:
- ID: `local-zfs`
- ZFS Pool: `rpool/labdata`
- Content: Disk image, Container
- Thin provisioning: Yes

Or via CLI:
```bash
pvesm add zfspool local-zfs --pool rpool/labdata --content images,rootdir --sparse 1
```

### Verify storage

```bash
pvesm status
# Should show local-zfs with available space
```

---

## Part B: Network Bridges (Phase 3)

The lab uses four bridges. `vmbr0` (management) is created during install.
Create `vmbr1`, `vmbr2`, and `vmbr3` for lab traffic.

### Create bridges via CLI

```bash
cat >> /etc/network/interfaces << 'EOF'

# Red Zone — Attacker network
auto vmbr1
iface vmbr1 inet manual
    bridge-ports none
    bridge-stp off
    bridge-fd 0
    bridge-vlan-aware yes

# Blue Zone — IT/Corporate network
auto vmbr2
iface vmbr2 inet manual
    bridge-ports none
    bridge-stp off
    bridge-fd 0
    bridge-vlan-aware yes

# OT Zone — SCADA/ICS network
auto vmbr3
iface vmbr3 inet manual
    bridge-ports none
    bridge-stp off
    bridge-fd 0
    bridge-vlan-aware yes
EOF

# Apply without reboot
ifreload -a
```

### Verify bridges

```bash
ip link show type bridge
# Should show: vmbr0, vmbr1, vmbr2, vmbr3

brctl show
```

### Network zone architecture

| Bridge | Zone | IP Scheme (per slot N) | Purpose |
|---|---|---|---|
| vmbr0 | Management | 192.168.1.0/24 | Proxmox UI, Terraform, Ansible |
| vmbr1 | Red | 10.10.(2N-1).0/24 | Attacker platforms |
| vmbr2 | Blue | 10.10.(2N).0/24 | IT victim networks |
| vmbr3 | OT | 192.168.(100+N).0/24 | SCADA/ICS systems |

### Enable Proxmox firewall (default-deny)

```bash
# Enable datacenter-level firewall
cat > /etc/pve/firewall/cluster.fw << 'EOF'
[OPTIONS]
enable: 1
policy_in: DROP
policy_out: ACCEPT

[RULES]
IN ACCEPT -source 192.168.1.0/24 -p tcp -dport 8006 -log nolog
IN ACCEPT -source 192.168.1.0/24 -p tcp -dport 22 -log nolog
IN ACCEPT -source 192.168.1.0/24 -p tcp -dport 3128 -log nolog
EOF

# Enable node-level firewall
cat > /etc/pve/nodes/pve01/host.fw << 'EOF'
[OPTIONS]
enable: 1
EOF
```

### Verify firewall

```bash
# From management workstation — should work
curl -k https://192.168.1.50:8006/api2/json/version

# From any lab VM (if one existed) — should be blocked
# vmbr1/2/3 cannot reach vmbr0 port 8006
```

---

**Next**: [03_PACKER_TEMPLATES.md](03_PACKER_TEMPLATES.md) — Build VM templates
