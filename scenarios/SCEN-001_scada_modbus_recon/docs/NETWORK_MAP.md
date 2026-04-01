# Network Map — SCEN-001: SCADA Modbus Recon

```
┌─────────────────────────────────────────────────────────────────┐
│                    Proxmox VE Host (pve01)                      │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  vmbr1 — Red Zone (10.10.<2N-1>.0/24)                  │    │
│  │                                                         │    │
│  │   ┌──────────────────────┐                              │    │
│  │   │  kali-attacker       │                              │    │
│  │   │  .10                 │                              │    │
│  │   │  Kali 2024.4         │                              │    │
│  │   │  pymodbus, nmap,     │──── dual-homed ───┐          │    │
│  │   │  wireshark           │                   │          │    │
│  │   └──────────────────────┘                   │          │    │
│  └─────────────────────────────────────────────│──────────┘    │
│                                                 │               │
│  ┌─────────────────────────────────────────────│──────────┐    │
│  │  vmbr3 — OT Zone (192.168.<100+N>.0/24)     │          │    │
│  │                                              │          │    │
│  │   ┌──────────────────────┐    ┌─────────────▼────────┐ │    │
│  │   │  openplc-01          │    │  historian            │ │    │
│  │   │  .10                 │    │  .20                  │ │    │
│  │   │  OpenPLC Runtime v3  │    │  Debian 12            │ │    │
│  │   │                      │    │                       │ │    │
│  │   │  Modbus TCP  :502 ◄──────── modbus-historian     │ │    │
│  │   │  Web UI      :8080   │    │  bridge (1s poll)     │ │    │
│  │   │                      │    │                       │ │    │
│  │   │  Program:             │    │  InfluxDB     :8086  │ │    │
│  │   │  tank_fill_control.st│    │  Grafana      :3000  │ │    │
│  │   └──────────────────────┘    └───────────────────────┘ │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

## IP Addressing (Slot N)

| VM | Bridge | IP | Ports |
|---|---|---|---|
| kali-attacker | vmbr1 + vmbr3 | 10.10.(2N-1).10 | — |
| openplc-01 | vmbr3 | 192.168.(100+N).10 | 502 (Modbus), 8080 (Web) |
| historian | vmbr3 | 192.168.(100+N).20 | 8086 (InfluxDB), 3000 (Grafana) |

## Data Flow

```
kali-attacker ──── Modbus TCP (FC01/03/04/05/06) ────► openplc-01:502
                                                           │
                   modbus-historian-bridge (1s poll) ◄──────┘
                          │
                          ▼
                   InfluxDB:8086 (process-data bucket)
                          │
                          ▼
                   Grafana:3000 (SCADA Process Monitor dashboard)
```

## Attack Path

1. `kali → nmap scan OT subnet` → discover openplc-01
2. `kali → pymodbus FC01/03/04` → enumerate register map
3. `kali → pymodbus FC06 (HR 1024)` → modify setpoint (T0836)
4. `kali → pymodbus FC05 (coil 0)` → disable pump (T0855)
5. `kali → Grafana dashboard` → observe process impact
