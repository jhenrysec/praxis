# MITRE ATT&CK Coverage Matrix

**Maintained by**: SECURITY_AGENT
**Frameworks**: ATT&CK Enterprise v15 · ATT&CK for ICS v2
**Last updated**: 2026-04-01 (SCEN-005 added)

---

## ATT&CK Enterprise Coverage

| Tactic | Technique | ID | Scenario(s) | Implementation |
|---|---|---|---|---|
| Execution | Command and Scripting: PowerShell | T1059.001 | SCEN-003 | Unrestricted execution policy on ws01 |
| Credential Access | Steal or Forge Kerberos Tickets: Kerberoasting | T1558.003 | SCEN-002, SCEN-003, SCEN-004 | Weak SPN service accounts (svc_sql, svc_scada) |
| Credential Access | OS Credential Dumping: LSASS Memory | T1003.001 | SCEN-003, SCEN-004 | WDigest enabled — cleartext creds in LSASS |
| Credential Access | OS Credential Dumping: NTDS | T1003.003 | SCEN-003 | secretsdump -just-dc against domain controller |
| Credential Access | Brute Force: Password Cracking | T1110.002 | SCEN-002 | Offline hashcat cracking of TGS tickets |
| Discovery | Account Discovery: Domain Account | T1087.002 | SCEN-002 | net user /domain, GetUserSPNs enumeration |
| Discovery | Permission Groups Discovery: Domain Groups | T1069.002 | SCEN-002 | Domain Admins group enumeration |
| Lateral Movement | Remote Services: SMB/Windows Admin Shares | T1021.002 | SCEN-003, SCEN-004 | PsExec, pass-the-hash via Impacket |
| Lateral Movement | Remote Services: SSH | T1021.004 | SCEN-004 | SSH to dual-homed eng-ws for OT pivot |
| Persistence | Hijack Execution Flow: DLL Search Order Hijacking | T1574.001 | SCEN-003 | Unquoted service path on ws02 |
| Initial Access | Drive-by Compromise | T1189 | SCEN-005 | Watering hole page hosting CVE-2026-2441 exploit |
| Execution | Exploitation for Client Execution | T1203 | SCEN-005 | CVE-2026-2441 Chrome Blink CSS UAF triggers renderer code exec |
| Execution | Command and Scripting: JavaScript | T1059.007 | SCEN-005 | Injected JS payload for post-exploitation C2 |
| Credential Access | Steal Web Session Cookie | T1539 | SCEN-005 | JavaScript harvests document.cookie, sessionStorage |
| Collection | Input Capture: Keylogging | T1056.001 | SCEN-005 | JS keydown/input event listeners capture typed creds |
| Exfiltration | Exfiltration Over Web Service | T1567 | SCEN-005 | Stolen data exfiltrated via HTTPS POST to attacker C2 |

---

## ATT&CK for ICS Coverage

| Tactic | Technique | ID | Scenario(s) | Implementation |
|---|---|---|---|---|
| Discovery | Remote System Discovery | T0846 | SCEN-001, SCEN-004 | nmap scan of OT subnet, Modbus device discovery |
| Collection | Network Sniffing | T0842 | SCEN-001, SCEN-004 | Wireshark/tcpdump capture of Modbus TCP traffic |
| Lateral Movement | Default Credentials | T0812 | SCEN-001 | OpenPLC web interface (openplc/openplc) |
| Impair Process Control | Modify Parameter | T0836 | SCEN-001, SCEN-004 | Modbus FC06 write to setpoint register (HR 1024) |
| Impair Process Control | Unauthorized Command Message | T0855 | SCEN-001, SCEN-004 | Modbus FC05 write to coil (pump disable) |

---

## Scenario → Technique Matrix

| Scenario | Difficulty | Enterprise Techniques | ICS Techniques |
|---|---|---|---|
| SCEN-001: scada_modbus_recon | Beginner | — | T0846, T0842, T0812, T0836, T0855 |
| SCEN-002: cred_access_kerberoasting | Intermediate | T1558.003, T1087.002, T1069.002, T1110.002 | — |
| SCEN-003: apt_lateral_movement | Advanced | T1059.001, T1003.001, T1003.003, T1021.002, T1574.001 | — |
| SCEN-004: ics_ot_pivot | Expert | T1558.003, T1003.001, T1021.002, T1021.004 | T0846, T0842, T0836, T0855 |
| SCEN-005: browser_exploit_cve_2026_2441 | Intermediate | T1189, T1203, T1539, T1056.001, T1567, T1059.007 | — |

### Technique Frequency

| Technique | Count | Scenarios |
|---|---|---|
| T1558.003 Kerberoasting | 3 | SCEN-002, SCEN-003, SCEN-004 |
| T1021.002 SMB/Admin Shares | 2 | SCEN-003, SCEN-004 |
| T1003.001 LSASS Memory | 2 | SCEN-003, SCEN-004 |
| T0836 Modify Parameter | 2 | SCEN-001, SCEN-004 |
| T0855 Unauthorized Command | 2 | SCEN-001, SCEN-004 |
| T0846 Remote System Discovery | 2 | SCEN-001, SCEN-004 |
| T0842 Network Sniffing | 2 | SCEN-001, SCEN-004 |
| T1189 Drive-by Compromise | 1 | SCEN-005 |
| T1203 Exploitation for Client Execution | 1 | SCEN-005 |
| T1539 Steal Web Session Cookie | 1 | SCEN-005 |
| T1056.001 Input Capture: Keylogging | 1 | SCEN-005 |
| T1567 Exfiltration Over Web Service | 1 | SCEN-005 |
| T1059.007 JavaScript | 1 | SCEN-005 |

---

## Coverage Statistics

| Metric | Count |
|---|---|
| Enterprise techniques covered | 16 |
| ICS techniques covered | 5 |
| Total unique techniques | 21 |
| Enterprise tactics spanned | 9 of 14 |
| ICS tactics spanned | 4 of 12 |
| Scenarios | 5 |

---

## Coverage Gaps (Planned)

| Technique | ID | Matrix | Planned Scenario |
|---|---|---|---|
| Persistence: Scheduled Task | T1053.005 | Enterprise | Future persistence scenario |
| Privilege Escalation: Token Impersonation | T1134.001 | Enterprise | Future privesc scenario |
| Command and Control: Application Layer Protocol | T1071 | Enterprise | Future C2 scenario |
| Defense Evasion: Indicator Removal | T1070 | Enterprise | Future forensics scenario |
| Persistence: Browser Extensions | T1176 | Enterprise | Future browser persistence scenario |
| ICS: Block Reporting Message | T0804 | ICS | Future DNP3 scenario |
| ICS: Denial of Control | T0813 | ICS | Future EtherNet/IP scenario |
| ICS: Manipulate I/O Image | T0835 | ICS | Future advanced ICS scenario |
| ICS: Program Download | T0843 | ICS | Future PLC reprogramming scenario |
