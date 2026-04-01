# Detection Exercise — SCEN-004: ICS/OT Pivot

**Blue Team Track — Multi-Domain Detection and Timeline Correlation**

This exercise is designed for students working the defensive side of SCEN-004, or as a post-exploitation exercise for red team students. The objective is to detect the full IT-to-OT kill chain by correlating evidence across three separate domains: Active Directory events, network traffic at the IT/OT boundary, and ICS process anomalies.

---

## Prerequisites

- Access to dc01 (Windows Event Viewer or PowerShell event log queries)
- Access to eng-ws (SSH session logs, network flow data)
- Access to historian (InfluxDB queries, Grafana dashboards)
- Wireshark or tcpdump capability on the OT zone (or pre-captured PCAP)
- Understanding of Windows Security Event IDs, SSH logging, and Modbus TCP

---

## Exercise Overview

The attack traverses three detection domains. Each domain has its own data sources, its own indicators, and its own blind spots. The challenge is correlating across all three to build a single incident timeline.

```
DOMAIN 1               DOMAIN 2                DOMAIN 3
AD / Windows Events     Network / SSH           ICS / Process Data
(dc01 event logs)       (eng-ws boundary)       (historian + Modbus)

  Kerberoasting          SSH anomalies           Modbus writes
  Credential dump        Tunnel traffic          Process deviation
  Enumeration            New OT connections      Alarm suppression

         └───── CORRELATION TIMELINE ─────┘
```

---

## Domain 1: Active Directory Event Detection

### Exercise 1.1 — Detect Kerberoasting (T1558.003)

Kerberoasting generates Kerberos TGS ticket requests with RC4 encryption (type 0x17). Normal TGS requests use AES (type 0x12). A burst of RC4 TGS requests for service accounts is a strong indicator.

**Data source**: Windows Security Event Log on dc01

**Event ID 4769** — A Kerberos service ticket was requested.

**Detection query** (PowerShell on dc01):
```powershell
# Find TGS requests with RC4 encryption (Kerberoasting indicator)
Get-WinEvent -FilterHashtable @{
    LogName = 'Security'
    Id = 4769
} | Where-Object {
    $_.Properties[5].Value -eq '0x17'  # Ticket Encryption Type = RC4-HMAC
} | Select-Object TimeCreated,
    @{N='Account';E={$_.Properties[0].Value}},
    @{N='ServiceName';E={$_.Properties[2].Value}},
    @{N='ClientIP';E={$_.Properties[6].Value}},
    @{N='EncryptionType';E={$_.Properties[5].Value}} |
    Format-Table -AutoSize
```

**What to look for**:
- TGS requests for service accounts (svc_scada) with encryption type 0x17
- Requests originating from a non-standard IP (kali-attacker, not a domain workstation)
- Multiple SPN requests in rapid succession (bulk Kerberoasting)
- Time of request relative to normal business hours

**Questions**:
1. What account requested the TGS ticket?
2. What SPN was targeted?
3. What source IP made the request?
4. Is this IP a known domain-joined workstation?
5. What encryption type was used? Is this normal?

---

### Exercise 1.2 — Detect Credential Dumping (T1003.001)

LSASS memory access generates specific events when auditing is enabled.

**Data source**: Windows Security Event Log and Sysmon on dc01

**Event ID 4656** — A handle to an object was requested (LSASS process).

**Event ID 4663** — An attempt was made to access an object.

**Sysmon Event ID 10** — Process accessed (targeting lsass.exe).

**Detection query** (PowerShell):
```powershell
# Find LSASS access events
Get-WinEvent -FilterHashtable @{
    LogName = 'Security'
    Id = 4656
} | Where-Object {
    $_.Properties[6].Value -match 'lsass'
} | Select-Object TimeCreated,
    @{N='SubjectUser';E={$_.Properties[1].Value}},
    @{N='ObjectName';E={$_.Properties[6].Value}},
    @{N='ProcessName';E={$_.Properties[11].Value}} |
    Format-Table -AutoSize
```

```powershell
# Sysmon Process Access events targeting LSASS
Get-WinEvent -FilterHashtable @{
    LogName = 'Microsoft-Windows-Sysmon/Operational'
    Id = 10
} | Where-Object {
    $_.Properties[5].Value -match 'lsass\.exe'
} | Select-Object TimeCreated,
    @{N='SourceProcess';E={$_.Properties[3].Value}},
    @{N='TargetProcess';E={$_.Properties[5].Value}},
    @{N='GrantedAccess';E={$_.Properties[7].Value}} |
    Format-Table -AutoSize
```

**What to look for**:
- Processes accessing lsass.exe that are not standard system processes
- GrantedAccess values like 0x1010 or 0x1FFFFF (full access — suspicious)
- Source processes that are not SYSTEM or legitimate AV/EDR tools
- Correlation: did this happen shortly after the Kerberoasting activity?

**Questions**:
1. What process accessed LSASS?
2. What access rights were requested?
3. What user account was the process running as?
4. Was secretsdump used locally or remotely?

---

### Exercise 1.3 — Detect AD Enumeration

Standard AD enumeration commands generate identifiable event patterns.

**Detection query** (PowerShell):
```powershell
# Find net.exe and net1.exe process creation (Sysmon Event ID 1)
Get-WinEvent -FilterHashtable @{
    LogName = 'Microsoft-Windows-Sysmon/Operational'
    Id = 1
} | Where-Object {
    $_.Properties[4].Value -match '\\net1?\.exe$'
} | Select-Object TimeCreated,
    @{N='User';E={$_.Properties[12].Value}},
    @{N='CommandLine';E={$_.Properties[10].Value}} |
    Format-Table -AutoSize
```

```powershell
# Find Event 4661 — Directory service object access
Get-WinEvent -FilterHashtable @{
    LogName = 'Security'
    Id = 4661
} -MaxEvents 50 | Select-Object TimeCreated,
    @{N='SubjectUser';E={$_.Properties[1].Value}},
    @{N='ObjectType';E={$_.Properties[6].Value}} |
    Format-Table -AutoSize
```

**What to look for**:
- Burst of `net user /domain`, `net group`, `net view` commands from a single session
- Directory service object access for user and group objects
- Volume of queries: legitimate users rarely enumerate the full domain

---

### Exercise 1.4 — Detect Remote Service Usage (T1021.002)

**Detection query**:
```powershell
# Logon events — Type 3 (network) and Type 10 (remote interactive)
Get-WinEvent -FilterHashtable @{
    LogName = 'Security'
    Id = 4624
} | Where-Object {
    $_.Properties[8].Value -in @(3, 10)  # Network or RemoteInteractive
} | Select-Object TimeCreated,
    @{N='LogonType';E={$_.Properties[8].Value}},
    @{N='Account';E={$_.Properties[5].Value}},
    @{N='SourceIP';E={$_.Properties[18].Value}},
    @{N='LogonProcess';E={$_.Properties[9].Value}} |
    Format-Table -AutoSize
```

```powershell
# Service installation (PsExec creates a service)
Get-WinEvent -FilterHashtable @{
    LogName = 'System'
    Id = 7045
} | Select-Object TimeCreated,
    @{N='ServiceName';E={$_.Properties[0].Value}},
    @{N='ImagePath';E={$_.Properties[1].Value}},
    @{N='AccountName';E={$_.Properties[4].Value}} |
    Format-Table -AutoSize
```

**What to look for**:
- Network logon (type 3) from unexpected source IPs
- Service installation with suspicious names (PSEXESVC or random strings)
- Logon process names like `NtLmSsp` for NTLM-based authentication from non-standard tools

---

## Domain 2: Network Boundary Detection (eng-ws)

### Exercise 2.1 — Detect SSH Anomalies on eng-ws

The pivot through eng-ws uses SSH. Detection requires monitoring SSH session patterns.

**Data source**: SSH auth log on eng-ws (`/var/log/auth.log`)

**Detection commands** (run on eng-ws or from a log aggregator):
```bash
# Find all SSH authentication events
grep 'sshd' /var/log/auth.log | grep 'Accepted'

# Expected output format:
# Mar 31 14:23:45 eng-ws sshd[12345]: Accepted password for eng_admin from 10.10.2.10 port 49152 ssh2
```

**What to look for**:
- SSH logins from unexpected source IPs (kali-attacker's Blue zone IP, not a jump server)
- SSH logins at unusual times
- Multiple concurrent SSH sessions from the same source
- SSH sessions with unusually long duration (tunnel sessions stay open)
- Password authentication instead of key-based authentication

**Questions**:
1. What IP address initiated the SSH session to eng-ws?
2. Is this IP a known, authorized management host?
3. How long was the SSH session active? (Check session duration — tunnel sessions are unusually long)
4. Were any port forwards established? (Check for TCP connections from eng-ws to OT hosts that started after the SSH session began)

---

### Exercise 2.2 — Detect Tunnel Traffic (New OT Connections)

When the attacker sets up an SSH tunnel, eng-ws begins making TCP connections to OT hosts that it normally does not connect to (or connects to ports it normally does not use).

**Detection commands** (run on eng-ws):
```bash
# Current connections — look for new connections to OT zone
ss -tn | grep '192.168'

# Connection history (if conntrack is available)
sudo conntrack -L -d 192.168.0.0/16 2>/dev/null

# Network flow monitoring — connections from eng-ws to OT zone on port 502
# (If tcpdump is capturing)
tcpdump -r /path/to/capture.pcap 'dst port 502' -n
```

**Baseline comparison**: eng-ws may legitimately connect to historian (port 8086 for InfluxDB writes from the modbus-historian-bridge). But it should NOT normally initiate connections to openplc-01 on port 502 — that is the historian bridge's job, running on the historian host.

**What to look for**:
- New TCP connections from eng-ws to openplc-01:502 (Modbus) — this is the tunnel traffic
- New TCP connections from eng-ws to hosts/ports outside its normal baseline
- TCP connections that start shortly after an SSH login event
- Outbound connection volume anomaly — eng-ws normally has minimal OT traffic

**Questions**:
1. What new connections appeared from eng-ws to the OT zone after the SSH login?
2. Is eng-ws normally a Modbus client? (No — the historian bridge runs on the historian host)
3. What is the source port on eng-ws for the Modbus connection? (Ephemeral port = tunneled traffic)

---

### Exercise 2.3 — SSH Tunnel Detection via Process Analysis

If you have access to eng-ws during or after the attack:

```bash
# Find SSH processes with port forwarding
ps aux | grep 'ssh.*-[DL]'

# Find processes listening on localhost (SOCKS proxy indicator)
ss -tlnp | grep '127.0.0.1:1080'

# Find the SSH process and its connections
lsof -i -n -P | grep ssh
```

**What to look for**:
- SSH process with `-D` or `-L` flags (port forwarding)
- Listening socket on localhost:1080 (SOCKS proxy)
- SSH process with connections to both Blue zone (source) and OT zone (forwarded destinations)

---

## Domain 3: ICS / Process Data Detection

### Exercise 3.1 — Detect Unexpected Modbus Sources

In a properly baselined OT network, only specific hosts should be making Modbus TCP connections to PLCs (the HMI, the SCADA server, the historian bridge). A new Modbus source is a high-confidence indicator of compromise.

**Data source**: Network capture on OT zone or ICS-IDS logs

**Wireshark/tcpdump filters**:
```
# All Modbus TCP traffic to the PLC
modbus && ip.dst == 192.168.<100+N>.10

# Modbus traffic from unexpected sources (not historian)
modbus && ip.dst == 192.168.<100+N>.10 && ip.src != 192.168.<100+N>.20

# Write operations only — highest priority alert
(modbus.func_code == 5 || modbus.func_code == 6 || modbus.func_code == 15 || modbus.func_code == 16) && ip.dst == 192.168.<100+N>.10
```

**What to look for**:
- Modbus TCP connections from eng-ws IP (192.168.(100+N).x) to openplc-01 — eng-ws is not a normal Modbus client
- FC05 (Write Single Coil) and FC06 (Write Single Register) from any non-standard source
- Modbus traffic patterns that differ from the historian bridge's regular polling (bridge reads at 1-second intervals; attacker traffic is irregular)

**Questions**:
1. What source IP is making Modbus requests to openplc-01?
2. Is this IP the historian bridge (192.168.(100+N).20)? If not, it is unauthorized.
3. What Modbus function codes are being used? FC03/FC04 (reads) are reconnaissance; FC05/FC06 (writes) are manipulation.
4. What registers are being written to? (HR 1024 = setpoint, Coil 0 = pump enable)

---

### Exercise 3.2 — Detect Process Value Anomalies in InfluxDB

The historian continuously records process values. Anomalies in these values indicate process manipulation — either by an attacker or by a process malfunction (the defender must differentiate).

**Data source**: InfluxDB on historian host

**InfluxDB Flux queries** (run via Grafana Explore or `influx` CLI):

```flux
// Detect setpoint changes (should rarely change in normal operation)
from(bucket: "process-data")
  |> range(start: -2h)
  |> filter(fn: (r) => r._measurement == "openplc" and r._field == "setpoint")
  |> difference()
  |> filter(fn: (r) => r._value != 0)
  |> yield(name: "setpoint_changes")
```

```flux
// Detect tank level outside normal operating range (200-900)
from(bucket: "process-data")
  |> range(start: -2h)
  |> filter(fn: (r) => r._measurement == "openplc" and r._field == "tank_level")
  |> filter(fn: (r) => r._value < 200 or r._value > 900)
  |> yield(name: "level_out_of_range")
```

```flux
// Detect pump speed dropping to zero unexpectedly
from(bucket: "process-data")
  |> range(start: -2h)
  |> filter(fn: (r) => r._measurement == "openplc" and r._field == "pump_speed")
  |> filter(fn: (r) => r._value == 0)
  |> yield(name: "pump_stopped")
```

```flux
// Detect alarm threshold changes
from(bucket: "process-data")
  |> range(start: -2h)
  |> filter(fn: (r) => r._measurement == "openplc" and
     (r._field == "alarm_high" or r._field == "alarm_low"))
  |> difference()
  |> filter(fn: (r) => r._value != 0)
  |> yield(name: "alarm_threshold_changes")
```

```flux
// Detect rapid rate of change in tank level (faster than normal fill/drain)
from(bucket: "process-data")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "openplc" and r._field == "tank_level")
  |> derivative(unit: 1m, nonNegative: false)
  |> filter(fn: (r) => r._value > 50 or r._value < -50)
  |> yield(name: "rapid_level_change")
```

**What to look for**:
- Setpoint changes: the setpoint (HR 1024) should rarely change during normal operation. Any change is noteworthy.
- Tank level outside bounds: if the tank level drops below 200 or exceeds 900, the process is in an abnormal state.
- Pump speed zero: the pump should only stop during controlled shutdown. Unexpected zero readings indicate a coil write (pump disable attack).
- Alarm threshold changes: alarm thresholds are configuration parameters — they should change during maintenance windows, not during normal operation. Changing them to extreme values (9999 high, 0 low) is alarm suppression.
- Rate of change: sudden changes in tank level that exceed normal fill/drain rates indicate external manipulation of setpoints.

**Questions**:
1. At what time did the setpoint change occur?
2. What was the setpoint changed to? Does the new value make operational sense?
3. Did the alarm thresholds change at the same time? (Alarm suppression = sophisticated attacker)
4. How does the timestamp of the process anomaly correlate with the SSH login on eng-ws and the Kerberoasting event on dc01?

---

### Exercise 3.3 — Detect Modbus Write Patterns

**Wireshark analysis** (on OT zone capture):

```
# Filter for write operations to holding register 1024 (setpoint)
modbus.func_code == 6 && modbus.regnum16 == 1024

# Filter for coil writes (pump disable)
modbus.func_code == 5 && modbus.reference_num == 0

# Filter for any writes from non-standard sources
(modbus.func_code == 5 || modbus.func_code == 6) && ip.src != 192.168.<100+N>.20
```

**Analysis steps**:
1. Identify all Modbus write operations in the capture
2. For each write, record: timestamp, source IP, function code, register address, written value
3. Compare source IPs against the baseline (only historian:20 should be polling)
4. Map register addresses to the register map — what process parameter was modified?
5. Assess impact: what would this write do to the physical process?

---

## Cross-Domain Timeline Correlation Exercise

### Building the Unified Timeline

The most important skill in ICS incident response is correlating events across IT, network boundary, and OT data sources. Use the following template to build a single timeline from all three domains.

**Instructions**: Fill in each row using evidence from the three domains above. The goal is to show the complete attack chain as a single timeline.

| Time | Domain | Data Source | Event | ATT&CK ID | Severity |
|---|---|---|---|---|---|
| T+00:00 | IT/AD | Event 4624 | Network logon: jsmith from ______ | T1021.002 | Medium |
| T+__:__ | IT/AD | Event 4769 | TGS request for svc_scada (RC4) | T1558.003 | High |
| T+__:__ | IT/AD | Sysmon 10 | LSASS access by ______ | T1003.001 | Critical |
| T+__:__ | IT/AD | Event 4624 | Network logon: eng_admin from ______ | — | Medium |
| T+__:__ | Boundary | SSH auth.log | SSH login: eng_admin from ______ | T1021.004 | High |
| T+__:__ | Boundary | NetFlow | New TCP from eng-ws to ______:502 | — | Critical |
| T+__:__ | OT/ICS | Modbus capture | FC03 read from ______ to openplc | T0846 | Medium |
| T+__:__ | OT/ICS | Modbus capture | FC06 write HR 1024 = ______ | T0836 | Critical |
| T+__:__ | OT/ICS | Modbus capture | FC05 write Coil 0 = False | T0855 | Critical |
| T+__:__ | OT/ICS | InfluxDB | Setpoint changed: 750 → ______ | T0836 | Critical |
| T+__:__ | OT/ICS | InfluxDB | Pump speed dropped to 0 | T0855 | Critical |
| T+__:__ | OT/ICS | InfluxDB | Alarm threshold modified | T0836 | Critical |

### Correlation Questions

1. **What is the total time from initial IT foothold to OT process manipulation?**
   > [Your answer]

2. **Which domain detected the attack first? Which detected it last?**
   > [Your answer]

3. **If you only had IT/AD event logs (no OT monitoring), what would you have seen?**
   > [Your answer — what is visible vs. invisible]

4. **If you only had OT/ICS monitoring (no IT visibility), what would you have seen?**
   > [Your answer — you would see unauthorized Modbus writes but not know HOW the attacker got there]

5. **What is the single most valuable detection point that connects the IT and OT phases?**
   > [Your answer — the SSH session on eng-ws is the link]

6. **Write a detection rule (pseudocode or SIEM query) that would correlate a Kerberoasting event with a subsequent SSH login to eng-ws within a 30-minute window.**
   ```
   [Your detection rule here]
   ```

---

## Detection Rule Writing Exercise

Write detection rules for three of the following scenarios. Use pseudocode, Sigma, or SIEM query language (Splunk SPL, Elastic KQL, etc.).

### Rule 1: Kerberoasting Detection
```
Title: [Your rule title]
Data source: [Windows Security Event Log]
Logic:
[Your detection logic]

False positive considerations:
[When would this fire legitimately?]
```

### Rule 2: Unauthorized Modbus Write Source
```
Title: [Your rule title]
Data source: [ICS-IDS / network capture]
Logic:
[Your detection logic]

False positive considerations:
[When would this fire legitimately?]
```

### Rule 3: SSH Tunnel Detection on Boundary Host
```
Title: [Your rule title]
Data source: [SSH logs + NetFlow on eng-ws]
Logic:
[Your detection logic]

False positive considerations:
[When would this fire legitimately?]
```

### Rule 4: Process Value Anomaly (InfluxDB)
```
Title: [Your rule title]
Data source: [InfluxDB process-data bucket]
Logic:
[Your detection logic]

False positive considerations:
[When would this fire legitimately?]
```

### Rule 5: Cross-Domain Correlation (IT + OT)
```
Title: [Your rule title]
Data sources: [Multiple — specify all]
Logic:
[Your detection logic — must correlate events from at least two domains]

False positive considerations:
[When would this fire legitimately?]
```

---

## Deliverables

1. Completed cross-domain timeline with timestamps and evidence for each event
2. Answers to all correlation questions
3. Three detection rules (from the five options above)
4. A 1-paragraph summary: "What is the single biggest detection gap in this environment, and what would you deploy to close it?"
