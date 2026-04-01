# Scenario Card — SCADA Modbus Recon & Manipulation

**ID**: SCEN-001
**Difficulty**: Beginner
**Duration**: 2 hours
**Last updated**: 2026-03-31
**Status**: Ready

---

## Overview

Students take the role of a red team operator who has gained network access to an OT segment running a water tank fill control system. The target is an OpenPLC Runtime v3 controller managing tank level, pump speed, and alarm thresholds via Modbus TCP. Students enumerate the Modbus register map, identify writable setpoints, and manipulate process parameters to demonstrate ICS attack impact. A historian (InfluxDB + Grafana) provides real-time process visibility for observing attack effects.

## Prerequisites
- Knowledge: TCP/IP networking, basic Linux command line, familiarity with SCADA concepts
- Tools: pymodbus (pre-installed on Kali), Wireshark, nmap
- Lab access: Scenario must be deployed with `./scripts/deploy.sh`

## Network Topology
```
vmbr1 (Red zone)
  └── kali-attacker     <red_prefix>.10  (dual-homed to OT)

vmbr3 (OT zone 192.168.10x.0/24)
  ├── openplc-01        <ot_prefix>.10   (Modbus TCP 502, Web UI 8080)
  └── historian          <ot_prefix>.20   (InfluxDB 8086, Grafana 3000)
```

## Credentials (Instructor Reference)
| Host | Username | Password | Notes |
|---|---|---|---|
| kali-attacker | kali | kali | Initial attacker access |
| openplc-01 | openplc | openplc | Web UI default creds (T0812) |
| historian | labuser | labuser | SSH access |
| Grafana | admin | LabGrafana2024! | Dashboard access |

## Objectives
1. [ ] Identify the PLC on the OT network using nmap
2. [ ] Read all Modbus coils (FC01) and identify pump status
3. [ ] Read all holding registers (FC03) and identify the tank level setpoint
4. [ ] Write to the setpoint register (FC06) to set an unsafe value (>900)
5. [ ] Disable the pump by writing FALSE to coil 0 (FC05)
6. [ ] Observe attack impact on the Grafana dashboard
7. [ ] **Bonus**: Suppress the high-level alarm by modifying the alarm threshold register

## MITRE ATT&CK for ICS Coverage
| Tactic | Technique | ID |
|---|---|---|
| Discovery | Remote System Discovery | T0846 |
| Discovery | Network Sniffing | T0842 |
| Lateral Movement | Default Credentials | T0812 |
| Impair Process Control | Modify Parameter | T0836 |
| Impair Process Control | Unauthorized Command Message | T0855 |

## Intentional Vulnerabilities
| ID | Host | ATT&CK ID | Description | Introduced by |
|---|---|---|---|---|
| V001 | openplc-01 | T0812 | Default web UI credentials (openplc/openplc) | Packer: openplc.pkr.hcl |
| V002 | openplc-01 | T0836 | Modbus TCP has no authentication — any client can read/write | Protocol design (inherent) |
| V003 | openplc-01 | T0855 | Writable coils allow direct pump enable/disable | Protocol design (inherent) |

## Flag / Success Criteria
Student has successfully completed the scenario when:
- [ ] Has read the tank level setpoint value (750) from holding register 1024
- [ ] Has written an unsafe setpoint (>900) to holding register 1024
- [ ] Has written FALSE to coil 0 to disable the pump
- [ ] Can describe the real-world impact of these actions on a water treatment facility

## Instructor Notes
- The historian VM provides visual feedback — have students open the Grafana dashboard before starting attacks so they can observe the process impact in real time.
- Modbus has zero authentication by design. This is not a misconfiguration — it reflects real-world ICS protocol limitations. Use this as a teaching moment about defense-in-depth and network segmentation as the primary ICS security control.
- After the attack portion, discuss detection: what would an IDS see? What InfluxDB queries could detect the anomaly?
- For advanced students, introduce the alarm suppression attack (objective 7) — this demonstrates why monitoring setpoint changes is critical.

## Ansible Post-Deploy
```bash
ansible-playbook -i inventory/scada_modbus_recon playbooks/scada-full.yml
```

## Changelog
- 2026-03-31: Initial scenario created (Phase 8)
