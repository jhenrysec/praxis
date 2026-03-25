# MITRE ATT&CK Coverage Matrix

**Maintained by**: SECURITY_AGENT  
**Frameworks**: ATT&CK Enterprise v15 · ATT&CK for ICS v2  
**Updated**: automatically after each `/security` task or new scenario

---

## ATT&CK Enterprise Coverage

| Tactic | Technique | ID | Scenario | Implementation |
|---|---|---|---|---|
| Initial Access | Phishing | T1566 | SCEN-003 | Macro-enabled document delivery simulation |
| Credential Access | Kerberoasting | T1558.003 | SCEN-002 | Weak SPN service account, offline crack |
| Lateral Movement | SMB/Windows Admin Shares | T1021.002 | SCEN-003 | Pass-the-hash via CrackMapExec |
| Lateral Movement | Pass the Hash | T1550.002 | SCEN-003 | Mimikatz → lateral movement |
| Defense Evasion | Valid Accounts: Local | T1078.003 | SCEN-003 | Local admin reuse across workstations |

*Table grows as scenarios are added. Run `/security update ATT&CK coverage matrix` after each new scenario.*

---

## ATT&CK for ICS Coverage

| Tactic | Technique | ID | Scenario | Implementation |
|---|---|---|---|---|
| Initial Access | Exploit Public-Facing Application | T0819 | SCEN-001 | OpenPLC web interface (default creds) |
| Discovery | Remote System Discovery | T0846 | SCEN-001 | nmap scan of OT subnet |
| Discovery | Network Sniffing | T0842 | SCEN-001 | Wireshark capture of Modbus traffic |
| Lateral Movement | Default Credentials | T0812 | SCEN-001, SCEN-004 | OpenPLC admin/admin |
| Impair Process Control | Modify Parameter | T0836 | SCEN-001, SCEN-004 | Modbus FC06 write to setpoint register |
| Impair Process Control | Unauthorized Command | T0855 | SCEN-001, SCEN-004 | Modbus FC05 write to coil (pump disable) |
| Initial Access | Spear Phishing | T0817 | SCEN-004 | Engineering workstation as entry point |

---

## Coverage Gaps (Planned)

| Technique | ID | Planned Scenario |
|---|---|---|
| Persistence: Scheduled Task | T1053.005 | Future persistence scenario |
| Privilege Escalation: Token Impersonation | T1134.001 | Future privesc scenario |
| Command and Control: C2 Frameworks | T1071 | Future C2/Havoc scenario |
| ICS: Block Reporting Message | T0804 | Future DNP3 scenario |
| ICS: Denial of Control | T0813 | Future EtherNet/IP scenario |

---

## Scenario → Technique Map

| Scenario | Enterprise Techniques | ICS Techniques |
|---|---|---|
| SCEN-001: scada_modbus_recon | — | T0819, T0846, T0842, T0812, T0836, T0855 |
| SCEN-002: cred_access_kerberoasting | T1558.003 | — |
| SCEN-003: apt_lateral_movement | T1566, T1021.002, T1550.002, T1078.003 | — |
| SCEN-004: ics_ot_pivot | T1566, T1021.002 | T0817, T0812, T0836, T0855 |
