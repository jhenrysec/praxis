# Scenario Card — ICS/OT Pivot: IT to OT Kill Chain

**ID**: SCEN-004
**Difficulty**: Expert
**Duration**: 5 hours
**Last updated**: 2026-03-31
**Status**: Ready

---

## Overview

Students execute a full IT-to-OT kill chain: starting from an external attacker position, they compromise Active Directory credentials, pivot through a dual-homed engineering workstation into the OT zone, and ultimately manipulate industrial control processes via Modbus TCP. This scenario spans all three network zones (Red, Blue/IT, OT) and exercises the most dangerous real-world ICS attack pattern — one that has been observed in incidents from TRITON/TRISIS, CRASHOVERRIDE, and Volt Typhoon campaigns.

## Prerequisites
- Knowledge: Active Directory, Windows authentication, Linux pivoting, Modbus TCP fundamentals
- Tools: Impacket suite, crackmapexec, SSH tunneling, pymodbus, nmap
- Prior completion of SCEN-002 (Kerberoasting) and SCEN-001 (SCADA Modbus Recon) recommended

## Network Topology
```
vmbr1 (Red zone)
  └── kali-attacker     <red_prefix>.10  (dual-homed to Blue)

vmbr2 (Blue zone — lab.local domain)
  ├── dc01              <blue_prefix>.20  (Domain Controller)
  └── eng-ws            <blue_prefix>.50  (Engineering workstation, dual-homed to OT)

vmbr3 (OT zone)
  ├── openplc-01        <ot_prefix>.10   (OpenPLC Runtime — Modbus TCP 502)
  ├── historian         <ot_prefix>.20   (InfluxDB + Grafana)
  └── grfics-host       <ot_prefix>.30   (GRFICSv2 chemical plant simulator)
```

## Credentials (Instructor Reference)
| Host | Username | Password | Notes |
|---|---|---|---|
| kali-attacker | kali | kali | Initial access |
| dc01 | LAB\Administrator | LabAdmin2024! | Domain admin |
| dc01 | LAB\jsmith | Password123 | Domain user, foothold via phishing |
| dc01 | LAB\eng_admin | Eng1neer2024! | Engineering team lead, local admin on eng-ws |
| dc01 | LAB\svc_scada | Scada$vc2024 | Service account with SPN, Kerberoastable |
| eng-ws | labuser | labuser | Local account with SSH, dual-homed |
| openplc-01 | openplc | openplc | OpenPLC web UI (port 8080) |
| historian | labuser | labuser | InfluxDB/Grafana host |
| historian | admin | LabGrafana2024! | Grafana admin |

## Objectives
1. [ ] Gain initial foothold on dc01 or another Blue zone host using jsmith credentials
2. [ ] Enumerate Active Directory to discover the eng_admin account and its privileges
3. [ ] Obtain eng_admin credentials via Kerberoasting (svc_scada) or credential dumping
4. [ ] Access the engineering workstation (eng-ws) using eng_admin credentials
5. [ ] Discover the OT network from eng-ws (dual-homed interface reconnaissance)
6. [ ] Pivot through eng-ws to reach the OT zone (SSH tunnel or SOCKS proxy)
7. [ ] Perform Modbus reconnaissance on openplc-01 (read coils, registers, discover process)
8. [ ] Manipulate the industrial process — write to Modbus setpoint or disable pump
9. [ ] **Bonus**: Observe attack impact on Grafana historian dashboards
10. [ ] **Bonus**: Access GRFICSv2 HMI to observe chemical plant process manipulation

## MITRE ATT&CK Coverage
| Tactic | Technique | ID | Matrix |
|---|---|---|---|
| Lateral Movement | Remote Services: SMB/Windows Admin Shares | T1021.002 | Enterprise |
| Credential Access | OS Credential Dumping: LSASS Memory | T1003.001 | Enterprise |
| Credential Access | Steal or Forge Kerberos Tickets: Kerberoasting | T1558.003 | Enterprise |
| Lateral Movement | Remote Services: SSH | T1021.004 | Enterprise |
| Discovery | Remote System Discovery | T0846 | ICS |
| Collection | Network Sniffing | T0842 | ICS |
| Impair Process Control | Unauthorized Command Message | T0855 | ICS |
| Impair Process Control | Modify Parameter | T0836 | ICS |

## Intentional Vulnerabilities
| ID | Host | ATT&CK ID | Description | Introduced by |
|---|---|---|---|---|
| V001 | dc01 | T1558.003 | Kerberoastable service account svc_scada with weak password | Ansible: vulnerable-services |
| V002 | dc01 | T1003.001 | WDigest enabled — eng_admin cleartext in LSASS after logon | Ansible: vulnerable-services |
| V003 | eng-ws | T1021.004 | SSH accessible from Blue zone with password auth | Default Debian config |
| V004 | eng-ws | — | Dual-homed (Blue + OT) with no host firewall rules | Intentional topology |
| V005 | openplc-01 | T0855 | Modbus TCP (502) accepts unauthenticated writes | OpenPLC default config |
| V006 | openplc-01 | T0836 | Process setpoints writable via Modbus FC06 | OpenPLC default config |

## Flag / Success Criteria
Student has successfully completed the scenario when:
- [ ] Has obtained domain credentials beyond the initial jsmith foothold
- [ ] Has established a session on eng-ws via lateral movement
- [ ] Has discovered and mapped the OT network from eng-ws
- [ ] Has read Modbus registers from openplc-01 via pivot through eng-ws
- [ ] Has written to a Modbus register to manipulate the process (pump disable or setpoint change)

## Instructor Notes
- The key pivot point is eng-ws. It has interfaces on both vmbr2 (Blue) and vmbr3 (OT). Students must discover this through interface enumeration (`ip addr` or similar) after gaining access.
- The eng_admin account can be obtained two ways: (1) Kerberoasting svc_scada whose password cracks to reveal access patterns, then checking eng_admin's cached creds on a Blue zone host, or (2) direct credential dumping if WDigest is enabled. Both paths are valid.
- Students need to set up SSH port forwarding or a SOCKS proxy through eng-ws to reach OT zone hosts. This is the most technically challenging step — have SSH tunneling hints ready.
- Once in the OT zone, the Modbus attack is straightforward (same as SCEN-001). The difficulty is in getting there.
- GRFICSv2 runs as Docker containers on grfics-host. If students access the HMI (port 8080), they can visually see the chemical plant state change when they manipulate Modbus registers.
- For the debrief, emphasize: (1) Why engineering workstations should never be dual-homed without strict firewall rules, (2) Why OT networks need independent authentication (not just network segmentation), (3) The Purdue Model and how this attack violates every level boundary.

## Ansible Post-Deploy
```bash
# Phase 1: AD setup with vulnerabilities
ansible-playbook -i inventory/ics_ot_pivot playbooks/ad-setup.yml \
  -e "vuln_kerberoast=true vuln_wdigest=true"

# Phase 2: SCADA stack
ansible-playbook -i inventory/ics_ot_pivot playbooks/scada-full.yml
```

## Changelog
- 2026-03-31: Initial scenario created (Phase 8)
