# Scenario Card — Credential Access: Kerberoasting

**ID**: SCEN-002
**Difficulty**: Intermediate
**Duration**: 3 hours
**Last updated**: 2026-03-31
**Status**: Ready

---

## Overview

Students have obtained low-privilege domain credentials (`jsmith` / `Password123`) through a simulated phishing campaign. Their objective is to enumerate the Active Directory environment, identify service accounts with Service Principal Names (SPNs), request Kerberos TGS tickets for those accounts, and crack the ticket hashes offline to obtain service account passwords. This simulates one of the most common real-world Active Directory attack techniques.

## Prerequisites
- Knowledge: Active Directory basics, Kerberos authentication flow, Linux command line
- Tools: Impacket (GetUserSPNs.py), hashcat or john, BloodHound (optional)
- Lab access: Scenario must be deployed with `./scripts/deploy.sh`

## Network Topology
```
vmbr1 (Red zone)
  └── kali-attacker     <red_prefix>.10  (dual-homed to Blue)

vmbr2 (Blue zone — lab.local domain)
  ├── dc01              <blue_prefix>.20  (Domain Controller, DNS)
  └── ws01              <blue_prefix>.30  (Domain workstation)
```

## Credentials (Instructor Reference)
| Host | Username | Password | Notes |
|---|---|---|---|
| kali-attacker | kali | kali | Initial access |
| dc01 | Administrator | LabAdmin2024! | DC local admin |
| dc01 | LAB\jsmith | Password123 | Low-priv domain user (student starting point) |
| dc01 | LAB\svc_sql | Summer2024! | Kerberoastable service account (weak password) |
| dc01 | LAB\svc_backup | B4ckup$ecure2024 | Kerberoastable service account (stronger) |
| ws01 | Administrator | LabAdmin2024! | Local admin |

## Objectives
1. [ ] Enumerate domain users and identify service accounts with SPNs
2. [ ] Request TGS tickets for all SPN accounts using GetUserSPNs.py
3. [ ] Crack at least one TGS ticket hash offline using hashcat or john
4. [ ] Use the cracked service account password to access a restricted resource
5. [ ] **Bonus**: Use BloodHound to map the full AD attack path from jsmith to Domain Admin

## MITRE ATT&CK Coverage
| Tactic | Technique | ID |
|---|---|---|
| Discovery | Account Discovery: Domain Account | T1087.002 |
| Discovery | Permission Groups Discovery: Domain Groups | T1069.002 |
| Credential Access | Steal or Forge Kerberos Tickets: Kerberoasting | T1558.003 |
| Credential Access | Brute Force: Password Cracking | T1110.002 |

## Intentional Vulnerabilities
| ID | Host | ATT&CK ID | Description | Introduced by |
|---|---|---|---|---|
| V001 | dc01 | T1558.003 | Service account svc_sql has SPN and weak password | Ansible: vulnerable-services |
| V002 | dc01 | T1558.003 | Service account svc_backup has SPN (stronger password) | Ansible: vulnerable-services |
| V003 | dc01 | T1110.002 | svc_sql password is dictionary-crackable (Summer2024!) | Ansible: vulnerable-services |

## Flag / Success Criteria
Student has successfully completed the scenario when:
- [ ] Has extracted TGS ticket hashes for svc_sql and svc_backup
- [ ] Has cracked the svc_sql password (Summer2024!)
- [ ] Can authenticate as svc_sql to access the SQL admin share on dc01
- [ ] Can explain why Kerberoasting works and how to defend against it

## Instructor Notes
- The `svc_sql` password is intentionally weak and crackable in <5 minutes with rockyou.txt. The `svc_backup` password is stronger — most students will only crack svc_sql.
- The AD environment is configured by the `ad-domain-controller` and `vulnerable-services` Ansible roles. The `vuln_kerberoast` flag must be set to `true`.
- Discuss Managed Service Accounts (gMSA) as the primary defense — they use 120-character randomly generated passwords that rotate automatically.
- For blue team extension: have students examine Windows Security Event ID 4769 (Kerberos Service Ticket Operations) to detect Kerberoasting.

## Ansible Post-Deploy
```bash
ansible-playbook -i inventory/cred_access_kerberoasting playbooks/ad-setup.yml \
  -e "vuln_kerberoast=true vuln_weak_passwords=true"
```

## Changelog
- 2026-03-31: Initial scenario created (Phase 8)
