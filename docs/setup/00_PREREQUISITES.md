# Prerequisites

**Phase**: Before Phase 1  
**Time required**: ~30 minutes  
**Purpose**: Confirm all hardware, software, and accounts are ready before starting the build

---

## Hardware

### Dell Precision 5820 (or equivalent)

| Component | Minimum | Recommended | Verify |
|---|---|---|---|
| CPU | Intel Xeon W / Core i9 | Xeon W-2145 or better | `lscpu | grep "Model name"` |
| RAM | 32 GB | 64 GB | `free -h` |
| Storage | 2 TB NVMe | 4 TB NVMe | `lsblk` |
| Network | 1 GbE | 2.5 GbE or dual NIC | `ip link show` |

**BIOS settings** (verify before installing Proxmox):
- Intel Virtualization Technology (VT-x): **Enabled**
- VT for Direct I/O (VT-d): **Enabled**
- SR-IOV: **Enabled**
- Secure Boot: **Disabled**
- Boot order: USB first (for install), then NVMe

---

## Management Workstation

The workstation you run Claude Code, Terraform, Packer, and Ansible from.
This is a separate machine from the Proxmox host.

| Tool | Version | Install | Verify |
|---|---|---|---|
| Node.js | 22.x LTS | [nodejs.org](https://nodejs.org/en/download) | `node --version` |
| Claude Code | ≥ 2.1.59 | `npm install -g @anthropic-ai/claude-code` | `claude --version` |
| Terraform | ≥ 1.9.0 | [releases.hashicorp.com](https://releases.hashicorp.com/terraform/) | `terraform version` |
| Packer | ≥ 1.11.0 | [releases.hashicorp.com](https://releases.hashicorp.com/packer/) | `packer version` |
| Ansible Core | ≥ 2.17.0 | `pip3 install ansible-core==2.17.*` | `ansible --version` |
| Python 3 | ≥ 3.11 | System package manager | `python3 --version` |
| Git | Any recent | System package manager | `git --version` |
| jq | Any recent | `apt install jq` | `jq --version` |
| curl | Any recent | Pre-installed on most systems | `curl --version` |

**Additional Python packages:**
```bash
pip3 install pywinrm ansible-lint
ansible-galaxy collection install ansible.windows microsoft.ad
```

---

## Accounts and Credentials

| Account | Purpose | Where to get |
|---|---|---|
| Claude Max subscription | Claude Code (recommended) | claude.ai/upgrade |
| *or* Anthropic API key | Claude Code alternative | console.anthropic.com |
| GitHub account | Repository hosting | github.com |
| Microsoft evaluation ISO | Windows Server 2022 template | microsoft.com/en-us/evalcenter |
| Microsoft evaluation ISO | Windows 10 22H2 template | microsoft.com/en-us/evalcenter |

---

## Network Planning

Before installing Proxmox, confirm your management network:

| Item | Your value | Notes |
|---|---|---|
| Management workstation IP | ____________ | Static, on the management LAN |
| Proxmox host IP | 172.16.0.10 | Default in lab config — change if needed |
| Gateway | 172.16.0.1 | Your router/switch |
| DNS | ____________ | 8.8.8.8 works for initial setup |

If you change the default `172.16.0.x` management subnet, update these files:
- `CLAUDE.md` (LAB_MGMT_NET line)
- `scripts/lab-env.sh` (PROXMOX_HOST and LAB_MGMT_NET)
- `ansible/group_vars/all/main.yml`

---

## ISOs to Download

Download before starting Phase 4 (Packer templates) — some are large.

| ISO | Size | Source | Used for |
|---|---|---|---|
| Proxmox VE 8.x | ~1.1 GB | proxmox.com/downloads | Host OS (Phase 1) |
| Kali Linux 2024.x installer | ~4.1 GB | kali.org/get-kali | Attacker template |
| Windows Server 2022 eval | ~5.4 GB | microsoft.com/evalcenter | DC + victim templates |
| Windows 10 22H2 eval | ~5.8 GB | microsoft.com/evalcenter | Workstation template |
| Ubuntu 22.04 LTS server | ~1.5 GB | ubuntu.com/download/server | Linux victim templates |
| Debian 12 netinst | ~400 MB | debian.org/distrib/netinst | Debian template |
| VirtIO drivers for Windows | ~500 MB | fedorapeople.org/groups/virt/virtio-win | Required for Windows Packer builds |

---

## SSH Key Setup

Generate a dedicated key pair for lab automation:

```bash
# Generate key (use no passphrase for unattended Ansible/Packer use)
ssh-keygen -t ed25519 -f ~/.ssh/lab_key -N "" -C "vuln-lab"

# Verify
ls -la ~/.ssh/lab_key*
# lab_key (private) and lab_key.pub (public)

# Note the public key — you'll need it in lab-env.local.sh
cat ~/.ssh/lab_key.pub
```

---

## Pre-flight Checklist

Complete all of these before running `/phase 1`:

- [ ] BIOS settings verified on Proxmox hardware
- [ ] Proxmox VE 8.x ISO downloaded and USB flashed
- [ ] Management workstation on same LAN as Proxmox host (or planned to be)
- [ ] All tools installed and version-verified on management workstation
- [ ] Python packages installed (pywinrm, ansible-lint, collections)
- [ ] SSH key pair generated at `~/.ssh/lab_key`
- [ ] Claude Max or API key available
- [ ] Windows evaluation ISOs downloaded (or download queued)
- [ ] VirtIO drivers ISO downloaded
- [ ] `scripts/lab-env.local.sh` created with real Proxmox credentials
  (do this after Phase 1 when the Proxmox API token is created)
- [ ] GitHub repository created and this repo cloned locally
- [ ] `user-CLAUDE.md` copied to `~/.claude/CLAUDE.md`

Once all boxes are checked: open Claude Code in the repo directory and run `/phase 1`.
