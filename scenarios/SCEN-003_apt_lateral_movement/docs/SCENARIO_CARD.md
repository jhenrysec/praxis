# Scenario Card — APT Lateral Movement

**ID**: SCEN-003
**Difficulty**: Advanced
**Duration**: 4 hours
**Last updated**: 2026-03-31
**Status**: Ready

---

## Overview

Students simulate an APT-style intrusion into a Windows Active Directory environment. Starting with a compromised domain user account on a workstation, they must dump cached credentials from LSASS, move laterally to additional workstations using pass-the-hash or Kerberos techniques, and ultimately compromise the domain controller. This scenario exercises the full lateral movement kill chain in an enterprise AD environment.

## Prerequisites
- Knowledge: Active Directory, Windows authentication (NTLM, Kerberos), credential dumping concepts
- Tools: Impacket suite, Mimikatz/pypykatz, crackmapexec, Metasploit
- Prior completion of SCEN-002 (Kerberoasting) recommended

## Network Topology
```
vmbr1 (Red zone)
  └── kali-attacker     <red_prefix>.10  (dual-homed to Blue)

vmbr2 (Blue zone — lab.local domain)
  ├── dc01              <blue_prefix>.20  (Domain Controller)
  ├── ws01              <blue_prefix>.30  (Foothold workstation)
  └── ws02              <blue_prefix>.40  (Pivot target)
```

## Credentials (Instructor Reference)
| Host | Username | Password | Notes |
|---|---|---|---|
| kali-attacker | kali | kali | Initial access |
| dc01 | LAB\Administrator | LabAdmin2024! | Domain admin |
| ws01 | LAB\jsmith | Password123 | Foothold user, local admin on ws01 |
| ws01 | LAB\svc_sql | Summer2024! | Cached creds from Kerberoastable service account |
| ws02 | LAB\agarcia | Welcome2024! | IT admin, local admin on ws02 + dc01 |

## Objectives
1. [ ] Gain initial access to ws01 using jsmith credentials
2. [ ] Dump LSASS memory to extract cached NTLM hashes or cleartext creds (WDigest)
3. [ ] Identify lateral movement targets using the dumped credentials
4. [ ] Move laterally to ws02 using pass-the-hash or cleartext credentials
5. [ ] Dump credentials on ws02 to find domain admin or privileged account hashes
6. [ ] Compromise the domain controller using the escalated credentials
7. [ ] **Bonus**: Extract NTDS.dit from dc01 to dump all domain password hashes

## MITRE ATT&CK Coverage
| Tactic | Technique | ID |
|---|---|---|
| Execution | Command and Scripting: PowerShell | T1059.001 |
| Credential Access | OS Credential Dumping: LSASS Memory | T1003.001 |
| Credential Access | OS Credential Dumping: NTDS | T1003.003 |
| Credential Access | Steal or Forge Kerberos Tickets: Kerberoasting | T1558.003 |
| Lateral Movement | Remote Services: SMB/Windows Admin Shares | T1021.002 |
| Persistence | Hijack Execution Flow: DLL Search Order Hijacking | T1574.001 |

## Intentional Vulnerabilities
| ID | Host | ATT&CK ID | Description | Introduced by |
|---|---|---|---|---|
| V001 | ws01 | T1003.001 | WDigest cleartext credential storage enabled | Ansible: vulnerable-services |
| V002 | ws01 | T1021.002 | Open admin shares (C$, ADMIN$) | Default Windows configuration |
| V003 | ws01 | T1059.001 | PowerShell unrestricted execution policy | Ansible: vulnerable-services |
| V004 | dc01 | T1558.003 | Kerberoastable service accounts | Ansible: vulnerable-services |
| V005 | ws02 | T1574.001 | Unquoted service path vulnerability | Ansible: vulnerable-services |

## Flag / Success Criteria
Student has successfully completed the scenario when:
- [ ] Has extracted NTLM hashes from ws01 LSASS memory
- [ ] Has obtained a shell or SMB session on ws02 via lateral movement
- [ ] Has obtained Domain Admin credentials (Administrator hash or cleartext)
- [ ] Has demonstrated DC compromise (e.g., secretsdump against dc01)

## Instructor Notes
- WDigest is enabled on ws01 via registry key `UseLogonCredential=1`. This stores cleartext passwords in LSASS memory. Real-world: WDigest was enabled by default on Windows Server 2008/2012 and many organizations still haven't disabled it.
- The `agarcia` account on ws02 has local admin on both ws02 and dc01, creating the escalation path. Students must discover this through credential dumping, not through pre-provided creds.
- If students struggle with credential dumping, direct them to `pypykatz` (Python Mimikatz alternative) which runs natively on Kali without needing to execute on the Windows host.
- For blue team extension: have students review Windows Security events 4624 (logon), 4648 (explicit credentials), and 4672 (special privileges assigned) to trace the lateral movement path.

## Ansible Post-Deploy
```bash
ansible-playbook -i inventory/apt_lateral_movement playbooks/ad-setup.yml \
  -e "vuln_kerberoast=true vuln_wdigest=true vuln_weak_passwords=true vuln_powershell_unrestricted=true vuln_unquoted_path=true"
```

## Changelog
- 2026-03-31: Initial scenario created (Phase 8)
