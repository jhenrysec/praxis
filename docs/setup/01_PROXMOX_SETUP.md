# Phase 1: Proxmox VE Setup

**Time required**: ~1 hour
**Prerequisite**: Hardware ready, Proxmox VE 9.1 ISO on USB
**Result**: Proxmox host online with API token for Terraform

---

## 1. Install Proxmox VE 9.1

1. Boot from USB, select "Install Proxmox VE (Graphical)"
2. Accept EULA, select target disk (NVMe recommended)
3. Set country, timezone, keyboard
4. Set root password and admin email
5. Network config:
   - Management interface: your primary NIC
   - Hostname: `pve01.lab.local`
   - IP: `192.168.1.50/24` (adjust to your LAN)
   - Gateway: your router IP
   - DNS: `8.8.8.8` (or your DNS)
6. Review and install — takes ~5 minutes

## 2. Post-Install Configuration

Access the web UI at `https://192.168.1.50:8006` (accept the self-signed cert).

### Update package repositories

```bash
# SSH to pve01 as root
ssh root@192.168.1.50

# Remove enterprise repo (requires subscription)
sed -i 's/^deb/#deb/' /etc/apt/sources.list.d/pve-enterprise.list

# Add no-subscription repo
echo "deb http://download.proxmox.com/debian/pve bookworm pve-no-subscription" \
  > /etc/apt/sources.list.d/pve-no-subscription.list

# Update and upgrade
apt update && apt full-upgrade -y
```

### Set timezone and locale

```bash
timedatectl set-timezone America/New_York  # adjust to your timezone
dpkg-reconfigure locales  # select en_US.UTF-8
```

## 3. Create Terraform API Token

```bash
# Create the terraform user
pveum user add terraform@pve

# Create API token (save the output — you will not see the secret again)
pveum user token add terraform@pve terraform --privsep 0

# Grant Administrator role
pveum aclmod / -user terraform@pve -role Administrator
```

Save the token output. It looks like:
```
┌──────────────┬──────────────────────────────────────┐
│ key          │ value                                │
├──────────────┼──────────────────────────────────────┤
│ full-tokenid │ terraform@pve!terraform              │
│ info         │ {"privsep":"0"}                      │
│ value        │ xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx │
└──────────────┴──────────────────────────────────────┘
```

Add to your environment:
```bash
# In scripts/lab-env.local.sh
export PROXMOX_VE_ENDPOINT="https://192.168.1.50:8006/"
export PROXMOX_VE_API_TOKEN="terraform@pve!terraform=<paste-value-here>"
export PROXMOX_VE_INSECURE=true
```

## 4. Upload SSH Public Key

```bash
# From your management workstation
ssh-copy-id -i ~/.ssh/lab_key.pub root@192.168.1.50
```

## 5. Verify

```bash
# Test API access from management workstation
curl -k -H "Authorization: PVEAPIToken=terraform@pve!terraform=<token>" \
  https://192.168.1.50:8006/api2/json/version

# Expected: JSON with Proxmox version info
```

---

**Next**: [02_STORAGE_NETWORK.md](02_STORAGE_NETWORK.md) — ZFS pools and network bridges
