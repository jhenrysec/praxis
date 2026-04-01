# Objectives — SCEN-004: ICS/OT Pivot — IT to OT Kill Chain

## Your Mission

You are a penetration tester simulating an advanced persistent threat targeting a small utility's IT and OT infrastructure. Through a phishing campaign, you obtained valid domain credentials for `jsmith` — a standard domain user. Your objective is to traverse the IT network, locate and compromise the engineering workstation that bridges IT and OT zones, pivot into the isolated OT network, and demonstrate the ability to manipulate industrial control processes.

## Objectives

### Phase 1: IT Foothold
1. **Access the IT network** — Use jsmith credentials to establish a remote session on a Blue zone host (WinRM, SMB, or PsExec against dc01)
2. **Enumerate Active Directory** — Discover domain users, groups, service accounts, and computer objects. Identify accounts with engineering or SCADA-related roles

### Phase 2: IT Credential Escalation
3. **Kerberoast service accounts** — Request TGS tickets for SPN-enabled accounts and crack them offline
4. **Obtain engineering credentials** — Through Kerberoasting, credential dumping, or share enumeration, obtain credentials for an account with access to the engineering workstation

### Phase 3: OT Zone Pivot
5. **Access the engineering workstation** — Use escalated credentials to gain a session on eng-ws
6. **Discover the OT network** — Enumerate network interfaces on eng-ws to discover the dual-homed connection to the OT zone
7. **Establish OT connectivity** — Set up a pivot (SSH tunnel, SOCKS proxy, or port forward) through eng-ws to reach OT zone hosts

### Phase 4: ICS Exploitation
8. **Reconnaissance** — Scan the OT zone from your pivot to discover ICS devices and open ports (Modbus TCP 502, Grafana 3000, HMI 8080)
9. **Modbus enumeration** — Read coils and registers from OpenPLC to understand the running process (tank level, pump status, setpoints)
10. **Process manipulation** — Write to Modbus registers to alter setpoints, disable the pump, or trigger alarm conditions

### Bonus Objectives
11. **Observe impact** — Access the Grafana dashboard on the historian to watch your Modbus writes affect process readings in real-time
12. **HMI access** — Reach the GRFICSv2 HMI web interface to visualize the chemical plant process state

## Tools Available
- `impacket` suite (psexec, GetUserSPNs, secretsdump)
- `crackmapexec` — AD enumeration and credential validation
- `hashcat` / `john` — Offline password cracking
- `nmap` — Network scanning and service discovery
- `ssh` — Tunneling and port forwarding
- `proxychains` — SOCKS proxy routing
- `pymodbus` — Modbus TCP client library
- `wireshark` / `tcpdump` — Network traffic analysis

## Success Criteria
- Documented full attack chain from IT foothold to OT process manipulation
- Evidence of Modbus register write on openplc-01 (screenshot or command output)
- Written attack timeline with MITRE ATT&CK technique IDs (both Enterprise and ICS) for each step
- Network diagram showing the pivot path through all three zones
