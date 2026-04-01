# Phase 6: Ansible Roles

**Time required**: ~10 minutes (roles are pre-built — this covers usage)
**Prerequisite**: Phases 1–5 (VMs deployed via Terraform)
**Result**: Deployed VMs configured with AD, vulnerabilities, SCADA services

---

## 1. Role Inventory

### Shared roles (used across scenarios)

| Role | Target | Purpose |
|---|---|---|
| `common-linux` | All Linux VMs | SSH hardening, qemu-guest-agent, NTP, base packages |
| `common-windows` | All Windows VMs | WinRM config, RDP, firewall rules, PS remoting |
| `ad-domain-controller` | dc01 | AD DS promotion, DNS, OU structure, user/SPN creation |
| `ad-member-workstation` | ws01, ws02 | Domain join, local admin, credential caching |
| `vulnerable-services` | Windows VMs | ATT&CK-mapped intentional vulns (Kerberoast, WDigest, etc.) |
| `openplc-configure` | openplc-01 | Upload ladder logic, compile, start runtime, verify Modbus |
| `ignition-configure` | ignition VMs | Start gateway, accept trial, configure dev mode, OPC-UA |

### SCADA stack roles

| Role | Target | Purpose |
|---|---|---|
| `grficsv2-deploy` | grfics-host | Docker Compose GRFICSv2 chemical plant simulator |
| `influxdb-setup` | historian | InfluxDB 2.7.10, org/bucket/token setup |
| `grafana-scada` | historian | Grafana 11.3.1 with provisioned SCADA dashboards |
| `modbus-historian-bridge` | historian | Python service polling Modbus → InfluxDB |

## 2. Playbooks

| Playbook | Runs roles | Use case |
|---|---|---|
| `ansible/site.yml` | All roles by group | Full environment setup |
| `ansible/playbooks/linux.yml` | common-linux | Linux base config only |
| `ansible/playbooks/windows.yml` | common-windows | Windows base config only |
| `ansible/playbooks/ad-setup.yml` | AD DC + join + vulns | Full AD lifecycle |
| `ansible/playbooks/scada-setup.yml` | OpenPLC + Ignition | SCADA stack only |
| `ansible/playbooks/scada-full.yml` | All SCADA + historian | Complete SCADA + monitoring |

## 3. Running Ansible Post-Deploy

After Terraform creates the VMs, run the appropriate playbook:

### AD scenarios (SCEN-002, SCEN-003)

```bash
ansible-playbook -i inventory/cred_access_kerberoasting ansible/playbooks/ad-setup.yml \
  -e "vuln_kerberoast=true"
```

### SCADA scenarios (SCEN-001)

```bash
ansible-playbook -i inventory/scada_modbus_recon ansible/playbooks/scada-full.yml
```

### IT/OT pivot (SCEN-004)

```bash
# Phase 1: AD infrastructure
ansible-playbook -i inventory/ics_ot_pivot ansible/playbooks/ad-setup.yml \
  -e "vuln_kerberoast=true vuln_wdigest=true"

# Phase 2: SCADA stack
ansible-playbook -i inventory/ics_ot_pivot ansible/playbooks/scada-full.yml
```

## 4. Vulnerability Variables

The `vulnerable-services` role accepts these boolean variables:

| Variable | Default | ATT&CK ID | Effect |
|---|---|---|---|
| `vuln_kerberoast` | false | T1558.003 | Creates SPN accounts with weak passwords |
| `vuln_wdigest` | false | T1003.001 | Enables WDigest cleartext cred storage |
| `vuln_weak_passwords` | false | T1110.002 | Sets crackable passwords on domain accounts |
| `vuln_powershell_unrestricted` | false | T1059.001 | Sets PowerShell execution policy to Unrestricted |
| `vuln_unquoted_path` | false | T1574.001 | Creates service with unquoted binary path |
| `vuln_open_shares` | false | T1021.002 | Makes admin shares accessible |

## 5. Verifying Configuration

```bash
# Verify AD is running
ansible dc01 -m win_shell -a "Get-ADDomain" -i inventory/apt_lateral_movement

# Verify OpenPLC Modbus port
ansible openplc -m wait_for -a "host={{ ansible_host }} port=502 timeout=30" \
  -i inventory/scada_modbus_recon

# Verify Grafana
ansible historian -m uri -a "url=http://localhost:3000/api/health" \
  -i inventory/scada_modbus_recon
```

---

**Next**: [06_SCENARIO_CREATION.md](06_SCENARIO_CREATION.md) — Build your own scenarios
