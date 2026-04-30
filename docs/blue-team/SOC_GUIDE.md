# Blue Team SOC Guide — Shared Wazuh Deployment

Wazuh 4.9 all-in-one (Manager + Indexer + Dashboard) provides SIEM and
host-based detection for the lab. A single shared instance serves all 20
student slots. Scenario VMs forward host logs to the manager over a
dedicated SIEM bridge (vmbr4) so the management plane on vmbr0 stays
isolated from lab segments.

## Architecture

```
┌──────────────────────────────────────────┐      ┌──────────────────────────────┐
│  vmbr0 — mgmt subnet (192.168.1.0/24)    │      │  vmbr4 — SIEM (192.168.4.0/24)│
│                                          │      │  isolated, no uplink          │
│  ┌──────────────────────────────┐        │      │                               │
│  │  wazuh-shared                │        │      │  scenario VM agents ───┐      │
│  │  • eth0 192.168.1.60 ◀──────analysts  │      │  (192.168.4.100-199)   │      │
│  │  • eth1 192.168.4.10 ◀───────── agents-────────────────────────────────┘     │
│  │  VM ID 310                   │        │      │                               │
│  │  4 CPU / 8GB / 100GB         │        │      │                               │
│  │  • Manager   :1514,1515/tcp  │        │      │                               │
│  │  • Indexer                   │        │      │                               │
│  │  • Dashboard :443/tcp        │        │      │                               │
│  └──────────────────────────────┘        │      │                               │
└──────────────────────────────────────────┘      └──────────────────────────────┘
```

**Separation rationale**: analysts log in via vmbr0 (the management
plane); agents only ever touch vmbr4. vmbr4 has no physical uplink and
no gateway — an attacker who pops a scenario VM cannot pivot from the
SIEM NIC into mgmt, because there is no route from 192.168.4.0/24 to
192.168.1.0/24 anywhere on the host.

## Prerequisites

- `tpl-ubuntu-2404` (VM ID 102) built on Proxmox
- Proxmox API token with `VM.Allocate`, `VM.Clone`, `VM.Config.*`, `VM.Monitor`
- SSH keypair at `~/.ssh/lab_key` / `~/.ssh/lab_key.pub`
- Mgmt subnet (192.168.1.0/24) reachable from the Ansible control host

## Deploy Sequence

### 1. Create the SIEM Bridge (`vmbr4`)

`proxmox-bridge` provisions `vmbr4` on the Proxmox host as an isolated
Linux bridge with no uplink. Run once per host:

```bash
cd ansible
ansible-playbook -i inventory/hosts.yml playbooks/proxmox-bridges.yml
```

Verify on the Proxmox host:

```bash
ssh root@192.168.1.50 "ip -br addr show vmbr4"
# vmbr4  UNKNOWN  192.168.4.1/24
```

### 2. Provision the VM (dual-homed)

```bash
cd terraform/fixtures/wazuh-shared
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars and set proxmox_api_token

terraform init
terraform plan
terraform apply -auto-approve
```

Expected outputs:
```
wazuh_ip            = "192.168.1.60"   # vmbr0 — analyst dashboard
wazuh_agent_ip      = "192.168.4.10"   # vmbr4 — agent traffic
wazuh_vmid          = 310
wazuh_dashboard_url = "https://192.168.1.60"
```

### 3. Configure with Ansible

The static inventory at `ansible/inventory/hosts.yml` already has the
`wazuh_shared` group pointing at 192.168.1.60. Run:

```bash
cd ansible
ansible-playbook -i inventory/hosts.yml playbooks/wazuh-shared.yml
```

The `wazuh-manager` role runs the official `wazuh-install.sh -a` installer
via `async: 2400 poll: 30`. The full install takes 10–15 minutes; the
playbook stays attached and prints progress every 30 seconds. After the
installer finishes, the role deploys `local_rules.xml` (see **Detection
Rules** below) and notifies the `restart wazuh-manager` handler so the
rules take effect immediately.

### 4. Retrieve the Admin Password

```bash
ssh -i ~/.ssh/lab_key ansible@192.168.1.60 \
  "sudo cat /root/wazuh-install-files/wazuh-passwords.txt"
```

Save the `admin` user's password.

### 5. Browse the Dashboard

Open `https://192.168.1.60` in a browser. Accept the self-signed cert
warning, log in as `admin`. Before agents are deployed the dashboard is
empty — the custom rules are live but have no events to match against.

## Operational Notes

### Services

```bash
systemctl status wazuh-manager wazuh-indexer wazuh-dashboard
journalctl -u wazuh-manager -f
```

### Ports

| Port  | Protocol | Purpose                 |
|-------|----------|-------------------------|
| 1514  | TCP      | Agent event forwarding  |
| 1515  | TCP      | Agent enrollment        |
| 55000 | TCP      | Wazuh API               |
| 443   | TCP      | Dashboard (HTTPS)       |

### Idempotency

The role guards on `/usr/share/wazuh-dashboard`. Re-running the playbook
skips the installer and only ensures services are started and credentials
are extracted. Safe to run any number of times.

### Resource Footprint

4 CPU / 8GB RAM / 100GB disk — 12.5% of the 64GB host budget. The fixture
can be safely shut down between class sessions to reclaim RAM.

## Phase 2 — Agent Deployment and Detection Rules

Phase 2 adds agents on scenario VMs, a dedicated SIEM network path, and
lab-specific detection content. The mgmt-plane isolation rule is
preserved: scenario VMs reach the manager over vmbr4 only, not vmbr0.

### Network path

Scenario VMs dual-home onto vmbr4 via the `second_bridge` parameter on
the `vm_clone` module. vmbr4 has no gateway and no uplink — an attacker
who compromises a scenario VM cannot route from 192.168.4.0/24 into
192.168.1.0/24. The shared Wazuh fixture is the only host with NICs on
both bridges, and it does not forward IP between them.

```hcl
# terraform/scenarios/<name>/main.tf — per-VM dual-homing
module "dc01" {
  source         = "../../modules/vm_clone"
  # ... slot-scoped vars ...
  second_bridge  = "vmbr4"
  second_ip      = "192.168.4.${100 + var.slot_number}"
  second_prefix  = 24
}
```

### Agent roles

Two roles install and enroll the Wazuh 4.9 agent against the shared
manager:

| Role | OS target | Enrollment |
|---|---|---|
| `wazuh-agent-linux` | Ubuntu / Debian / Kali | apt package → `agent-auth` → enroll with slot group |
| `wazuh-agent-windows` | Windows Server 2022 / Win10 | MSI install-time `WAZUH_*` props; re-enrolls if group set changes |

Per-slot inventories include the agent group variable that tags every
forwarded event with the student's slot:

```yaml
# inventory/slot-03.ini (generated by scripts/build)
wazuh_manager_address: "192.168.4.10"
wazuh_agent_groups: ["default", "slot-03"]
```

In the dashboard, analysts filter by `agent.groups: slot-03` to see a
single student's events, or by scenario tag to see everyone running the
same scenario.

### Detection Rules

`wazuh-manager/templates/local_rules.xml.j2` is deployed to
`/var/ossec/etc/rules/local_rules.xml` (owner `root`, group `wazuh`,
mode `0640`) and the manager is restarted via handler. Current rule
allocation in the local reserved range (100000–120000):

| Rule IDs | Technique | Description |
|---|---|---|
| 100100 / 100101 | T1558.003 | Kerberoasting — 4769 with RC4 TGS; 100101 correlates 5+ in 60s from same principal |
| 100110 | T1003.001 | LSASS credential access — Sysmon 10 with credential-dumping handle masks |
| 100120 – 100123 | T0836 | Modbus write function codes (FC05/06/15/16) on OT segments |

The Modbus rules consume JSON alerts from a Suricata/Zeek sensor on the
OT zone; they are dormant without a sensor but do not break anything.
See the template header for the expected alert schema.

### Phase 2 status

- [x] vmbr4 SIEM bridge provisioned by `proxmox-bridge` role
- [x] `vm_clone.second_bridge` / `second_ip` extension
- [x] wazuh-shared fixture dual-homed on vmbr0 + vmbr4
- [x] `wazuh-agent-linux` + `wazuh-agent-windows` roles
- [x] Lab-specific rule pack (Kerberoasting / LSASS / Modbus)
- [ ] Per-slot VLAN tagging on vmbr4 (401–420) — deferred
- [ ] SCEN-001 through SCEN-005 Terraform updated to dual-home — deferred

## Phase 3 Preview (Not Yet Implemented)

- Portal-backend reverse proxy: `/blue-team/*` → `https://192.168.1.60`
- Portal-ui "Blue Team SOC" button (instructor + admin roles)
- Student dashboard view scoped to their own slot's events

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Installer exits in first minute | Insufficient RAM | Bump `memory_mb` in fixture main.tf |
| Install hangs > 20 min | Indexer cluster bootstrap issue | `journalctl -u wazuh-indexer -f` on the VM |
| Dashboard returns 502 | `wazuh-dashboard` not up yet | `systemctl restart wazuh-dashboard` |
| "Cannot GET /" in browser | Dashboard still initializing | Wait 60s, refresh |
| Admin password lost | `wazuh-passwords.txt` was deleted | On VM: `/usr/share/wazuh-indexer/plugins/opensearch-security/tools/wazuh-passwords-tool.sh -u admin -p NEW_PASS` |

## Destruction

```bash
cd terraform/fixtures/wazuh-shared
terraform destroy
```

Removes the VM permanently. All ingested events, saved searches, and
dashboards are lost — the fixture is stateless by design.
