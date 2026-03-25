# Skill: SCADA/ICS Lab Environment

**Applies to**: SCADA_AGENT  
**Protocols**: Modbus TCP, DNP3, EtherNet/IP, OPC-UA, IEC 61850  
**Platforms**: OpenPLC Runtime v3, Ignition 8.1.x, GRFICSv2, InfluxDB 2.x  
**Reference**: ICS-CERT, MITRE ATT&CK for ICS v2, NIST SP 800-82r3  
**Last reviewed**: 2025-06

---

## Protocol Reference

### Modbus TCP (Port 502)

**Function Codes (attack-relevant)**
| FC | Name | Direction | Notes |
|---|---|---|---|
| 01 | Read Coils | R | Read digital outputs |
| 02 | Read Discrete Inputs | R | Read digital inputs |
| 03 | Read Holding Registers | R | Read analog outputs/setpoints |
| 04 | Read Input Registers | R | Read analog sensor values |
| 05 | Write Single Coil | W | **Primary attack vector** — enable/disable outputs |
| 06 | Write Single Register | W | **Setpoint manipulation** |
| 15 | Write Multiple Coils | W | Batch coil writes |
| 16 | Write Multiple Registers | W | Batch register writes |

**Security posture**: NO authentication, NO encryption (Modbus TCP default)

**Testing tools**:
```bash
# modpoll (C tool — install: apt install libmodbus-dev && build from source)
modpoll -m tcp -p 502 -t 0 192.168.100.10           # Read coils
modpoll -m tcp -p 502 -t 4 192.168.100.10           # Read holding registers
modpoll -m tcp -p 502 -t 0 -c 1 -0 192.168.100.10 1  # Write coil 0 = ON

# pymodbus 3.x (Python)
from pymodbus.client import ModbusTcpClient
client = ModbusTcpClient("192.168.100.10", port=502)
client.connect()
rr = client.read_coils(0, 8, slave=1)              # Read 8 coils from address 0
client.write_coil(0, True, slave=1)                # Write coil 0 = True (pump ON)
rr = client.read_holding_registers(0, 4, slave=1)  # Read 4 holding registers
client.write_register(0, 75, slave=1)              # Write setpoint register = 75
client.close()
```

---

### DNP3 (Port 20000 TCP/UDP)

Used in electric utilities, water/wastewater, oil and gas pipelines.

**Key concepts**:
- Master station polls Outstation
- Unsolicited responses: Outstation pushes data without being asked (event-driven)
- Data classes: Class 0 (static), Class 1/2/3 (events by priority)

**Testing tools**:
```bash
# OpenDNP3 master test client
# Install: sudo apt install opendnp3-master-simulator

# Scan outstation
dnp3_master_adapter --ip 192.168.100.11 --port 20000 --master-addr 1 --outstation-addr 10
```

**Attack surface**: 
- No auth in DNP3 Level 1 (most deployed version)
- DNP3 Secure Authentication v5 (SAv5) is rarely deployed in legacy systems
- Unsolicited response spoofing (UDP mode)

---

### EtherNet/IP / CIP (Port 44818 TCP)

Rockwell/Allen-Bradley's industrial protocol. Based on Common Industrial Protocol (CIP).

**Testing tools**:
```python
# pycomm3 — Python library for EtherNet/IP
from pycomm3 import LogixDriver

with LogixDriver("192.168.100.12") as plc:
    tag_list = plc.get_tag_list()
    value = plc.read("PumpSpeed")
    plc.write(("PumpEnable", True))
```

**Attack surface**:
- Default: no authentication required for tag read/write
- Forward Open (CIP): can be used to cause DoS

---

### OPC-UA (Port 4840)

Modern industrial standard. Has authentication and encryption options — but often misconfigured.

**Testing tools**:
```bash
# UaExpert GUI client (download from unified-automation.com — free)
# python-opcua
pip install opcua

from opcua import Client
client = Client("opc.tcp://192.168.100.10:4840/")
client.connect()
# Browse server
root = client.get_root_node()
objects = client.get_objects_node()
# Read a tag value
node = client.get_node("ns=2;s=PumpEnable")
value = node.get_value()
# Write a value
node.set_value(True)
client.disconnect()
```

**Attack surface**:
- Anonymous endpoint enabled (common in dev/lab deployments)
- Certificate validation disabled
- Username: admin / password: (blank) or admin/admin is common default

---

## OpenPLC Runtime v3

### Installation (Ubuntu 22.04)
```bash
# Install dependencies
sudo apt update && sudo apt install -y git

# Clone and install
git clone https://github.com/thiagoralves/OpenPLC_v3.git
cd OpenPLC_v3
sudo ./install.sh linux

# Service management
sudo systemctl enable openplc
sudo systemctl start openplc

# Web interface: http://<ip>:8080
# Default credentials: openplc / openplc (CHANGE IN SCENARIO CARD)
# For vulnerable scenarios: leave as default
```

### Modbus TCP Configuration
OpenPLC exposes Modbus TCP on port 502 by default when a program is running.

**Coil mapping (OpenPLC default)**:
- `%QX0.0` through `%QX0.7` → Modbus coils 0–7
- `%QW0` through `%QW99` → Modbus holding registers 0–99
- `%IX0.0` through `%IX0.7` → Modbus discrete inputs 0–7
- `%IW0` through `%IW99` → Modbus input registers 0–99

### Uploading a Program via API
```bash
# OpenPLC has a REST API (undocumented but functional)
# Login and get session cookie
curl -c cookies.txt -X POST http://192.168.100.10:8080/login \
  -d "username=openplc&password=openplc"

# Upload program file
curl -b cookies.txt -X POST http://192.168.100.10:8080/upload-program \
  -F "file=@tank_fill_control.st"

# Start program
curl -b cookies.txt http://192.168.100.10:8080/start-plc
```

---

## Ignition 8.1.x (Dev Mode)

### Installation
```bash
# Download installer
wget https://files.inductiveautomation.com/release/ia-gateway/8.1.x/\
linux-x64/ignition-8.1.x-linux-x64-installer.run

chmod +x ignition-8.1.x-linux-x64-installer.run

# Install silently
sudo ./ignition-8.1.x-linux-x64-installer.run \
  --mode unattended \
  --prefix /usr/local/ignition

# Start service
sudo systemctl enable ignition
sudo systemctl start ignition

# Gateway: http://<ip>:8088
# Activate as: Trial → runs forever in dev mode (2 hours session, unlimited restarts)
```

### Modbus TCP Device Configuration (via REST API)
```bash
# Ignition has a REST API for config — use after gateway is running
# More commonly done via UI or scripted with selenium in Packer provisioner

# Gateway backup/restore (preferred for reproducibility)
# After configuring manually once, export project:
# Gateway → Config → Backup/Restore → Download Backup
# Store backup in repo: scada/ignition-project/gateway-backup.gwbk

# Restore backup in Ansible role:
# ansible.builtin.copy + command to call Ignition restore API
```

---

## GRFICSv2 Deployment

### What It Simulates
- Chemical plant: 3 reactors, pumps, heat exchangers, feed tanks
- Components: PLC simulator (Python/Modbus), HMI (ScadaBR), historian, engineering WS
- Attack surface: Modbus registers control reactor temperature, pressure, flow rate setpoints

```bash
# Clone
git clone https://github.com/mosse-security/grficsv2.git
cd grficsv2

# Deploy with Docker Compose (in a VM or LXC with Docker installed)
docker-compose up -d

# Verify containers
docker-compose ps
# Expected: plc, hmi, historian, engg-ws all running

# HMI web interface
http://192.168.100.20:8080  # ScadaBR HMI

# PLC Modbus endpoint
192.168.100.21:502  # Reactor PLC — use pymodbus to interact

# Critical registers (attack targets):
# HR0: Reactor temperature setpoint (safe range: 0–500)
# HR1: Reactor pressure setpoint (safe range: 0–100)
# HR2: Cooling flow rate (safe range: 20–100)
# Writing HR0 > 500 → overtemp condition → safety trip
```

---

## Historian Setup (InfluxDB 2.x)

```bash
# Install InfluxDB
wget https://dl.influxdata.com/influxdb/releases/influxdb2_2.x_amd64.deb
sudo dpkg -i influxdb2_2.x_amd64.deb
sudo systemctl enable influxdb && sudo systemctl start influxdb

# Initial setup (CLI)
influx setup \
  --username admin \
  --password 'LabHistorian2024!' \
  --org scada-lab \
  --bucket process-data \
  --retention 30d \
  --force

# Grafana for visualization
sudo apt install grafana
sudo systemctl enable grafana-server && sudo systemctl start grafana-server
# Grafana: http://<ip>:3000 — default admin/admin
# Add InfluxDB data source pointing to localhost:8086
```

---

## Scenario Attack Paths Reference

| Scenario | Entry Point | Protocol Used | Target Effect |
|---|---|---|---|
| scada_modbus_recon | Kali → vmbr3 direct | Modbus TCP FC01/FC03 | Enumerate coil/register map |
| scada_modbus_attack | Same | Modbus TCP FC05/FC06 | Disable pump (coil 0=False), set level=0 |
| ics_ot_pivot | Kali → IT WS → pfSense hole → OT | Modbus TCP | Manipulate reactor setpoints |
| grfics_process_attack | Kali → GRFICSv2 PLC | Modbus TCP | Write HR0 > 500 → overtemp trip |
