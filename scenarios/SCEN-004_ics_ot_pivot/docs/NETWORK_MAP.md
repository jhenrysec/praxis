# Network Map — SCEN-004: ICS/OT Pivot — IT to OT Kill Chain

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        Proxmox VE Host (pve01)                              │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐      │
│  │  vmbr1 — Red Zone (10.10.<2N-1>.0/24)                             │      │
│  │                                                                    │      │
│  │   ┌──────────────────────┐                                         │      │
│  │   │  kali-attacker       │                                         │      │
│  │   │  .10                 │──── dual-homed ────────────┐            │      │
│  │   │  Impacket, CME,      │                            │            │      │
│  │   │  hashcat, pymodbus,  │                            │            │      │
│  │   │  proxychains, nmap   │                            │            │      │
│  │   └──────────────────────┘                            │            │      │
│  └───────────────────────────────────────────────────────│────────────┘      │
│                                                           │                  │
│  ┌───────────────────────────────────────────────────────│────────────┐      │
│  │  vmbr2 — Blue Zone / IT (10.10.<2N>.0/24)             │            │      │
│  │  Domain: lab.local                                     │            │      │
│  │                                                        │            │      │
│  │   ┌──────────────────┐   ┌─────────────────────────────▼──────┐   │      │
│  │   │  dc01             │   │  eng-ws                            │   │      │
│  │   │  .20              │   │  .50                               │   │      │
│  │   │  DC, DNS, KDC     │   │  Engineering workstation           │   │      │
│  │   │  svc_scada (SPN)  │   │  DUAL-HOMED — pivot point         │──│──┐   │
│  │   │  eng_admin (creds) │   │  SSH enabled                      │   │  │   │
│  │   └──────────────────┘   └────────────────────────────────────┘   │  │   │
│  └───────────────────────────────────────────────────────────────────┘  │   │
│                                                                          │   │
│  ┌───────────────────────────────────────────────────────────────────────│──┐│
│  │  vmbr3 — OT Zone (192.168.<100+N>.0/24)                              │  ││
│  │  *** ISOLATED — no direct route from Red or Blue ***                  │  ││
│  │                                                                       │  ││
│  │   ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────────▼┐││
│  │   │  openplc-01       │  │  historian        │  │  grfics-host        │││
│  │   │  .10              │  │  .20              │  │  .30                │││
│  │   │  Modbus TCP :502  │  │  InfluxDB :8086   │  │  GRFICSv2 Docker   │││
│  │   │  Web UI :8080     │  │  Grafana :3000    │  │  PLC sim :502      │││
│  │   │  tank_fill_control│  │  Process historian │  │  HMI :8080        │││
│  │   └──────────────────┘  └──────────────────┘  └──────────────────────┘││
│  └───────────────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────────┘
```

## IP Addressing (Slot N)

| VM | Bridge(s) | IP Address(es) | Key Ports |
|---|---|---|---|
| kali-attacker | vmbr1 + vmbr2 | 10.10.(2N-1).10 + 10.10.(2N).x | — |
| dc01 | vmbr2 | 10.10.(2N).20 | 88, 389, 445, 636 |
| eng-ws | vmbr2 + vmbr3 | 10.10.(2N).50 + 192.168.(100+N).x | 22 |
| openplc-01 | vmbr3 | 192.168.(100+N).10 | 502, 8080 |
| historian | vmbr3 | 192.168.(100+N).20 | 8086, 3000 |
| grfics-host | vmbr3 | 192.168.(100+N).30 | 502, 8080 |

## Zone Boundaries

```
Red Zone ──────► Blue Zone ──────► OT Zone
(external)       (corporate IT)    (industrial control)

  kali can        kali can          ONLY reachable
  reach Blue      reach dc01       through eng-ws
  via dual-home   and eng-ws       (dual-homed pivot)
```

## Attack Path

```
Phase 1 — IT Foothold:
  1. kali → psexec/winrm → dc01 (jsmith creds)               [T1021.002]

Phase 2 — Credential Escalation:
  2. dc01 → GetUserSPNs → svc_scada TGS ticket               [T1558.003]
  3. kali → hashcat → crack svc_scada password
  4. dc01 → enumerate eng_admin access (CME, LSASS, shares)   [T1003.001]

Phase 3 — OT Pivot:
  5. kali → SSH → eng-ws (eng_admin creds)                    [T1021.004]
  6. eng-ws → ip addr → discover 192.168.(100+N).x interface
  7. kali → SSH tunnel (-L or -D) through eng-ws              [pivot]

Phase 4 — ICS Exploitation:
  8. kali (via tunnel) → nmap → OT zone discovery             [T0846]
  9. kali (via tunnel) → pymodbus FC03 → read registers       [T0842]
  10. kali (via tunnel) → pymodbus FC06 → write setpoint      [T0855/T0836]
```

## Data Flow Diagram

```
                    Modbus TCP
  openplc-01 ◄────────────────────► modbus-historian-bridge
  (PLC :502)                         (on historian)
       │                                    │
       │  FC01/FC03/FC04                    │  InfluxDB writes
       │  coils, registers                  ▼
       │                             InfluxDB (:8086)
       │                                    │
       ▼                                    ▼
  Physical process                   Grafana (:3000)
  (tank simulation)                  (SCADA dashboard)

  grfics-host ◄──────────────────► modbus-historian-bridge
  (GRFICSv2 :502)                   (polls grfics too)
       │
       ▼
  HMI (:8080)
  (ScadaBR web interface)
```
