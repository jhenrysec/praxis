# Slide Deck Content — SCADA Modbus Recon & Manipulation

> Instructor slide-ready content for SCEN-001. Each section is one slide.
> Build your deck from these notes or present directly from this document.

---

## Slide: Title

**Visual**: Dark background, scenario title, MITRE ATT&CK ICS logo, lab topology preview

**Talking points**:
- SCEN-001: SCADA Modbus Recon & Manipulation
- Difficulty: Beginner | Duration: 2 hours
- Focus: ICS/OT — Modbus TCP protocol exploitation
- 5 ATT&CK for ICS techniques covered

**Transition**: "Let's start with some context on why this matters."

---

## Slide: Why Target ICS?

**Visual**: Timeline of major ICS incidents (Stuxnet 2010, Ukraine 2015, TRITON 2017, Oldsmar 2021)

**Talking points**:
- ICS controls physical processes — water treatment, power generation, manufacturing
- Compromise means physical impact: safety risk, environmental damage, service disruption
- Nation-state pre-positioning in ICS networks is an active, documented threat
- Ransomware groups increasingly target OT for maximum leverage

**Transition**: "The protocol we're attacking today was designed in 1979."

---

## Slide: Modbus Protocol — History

**Visual**: Diagram showing RS-485 serial bus (1979) → Modbus TCP wrapper (1999)

**Talking points**:
- Created by Modicon in 1979 for serial communication between PLCs
- Simple request/response: master asks, slave answers
- Modbus TCP (1999): same protocol wrapped in TCP/IP on port 502
- No authentication, no encryption — by design, not by misconfiguration
- Still the most widely deployed ICS protocol globally

**Transition**: "Let's look at how Modbus actually works."

---

## Slide: Modbus Data Model

**Visual**: Table showing the four Modbus object types

| Object Type | Access | Size | Function Codes | Example Use |
|---|---|---|---|---|
| Coils | Read/Write | 1 bit | FC01 (read) / FC05 (write) | Pump on/off, valve open/close |
| Discrete Inputs | Read Only | 1 bit | FC02 | Sensor switches, limit switches |
| Input Registers | Read Only | 16 bit | FC04 | Analog sensor readings |
| Holding Registers | Read/Write | 16 bit | FC03 (read) / FC06 (write) | Setpoints, alarm thresholds |

**Talking points**:
- Four data types, each with specific function codes
- Key distinction: coils/holding registers are writable, inputs are read-only
- Holding registers are the primary attack surface — setpoints and thresholds
- No access control on any of these — any TCP client can read or write

**Transition**: "Here's the environment you'll be attacking today."

---

## Slide: Lab Topology

**Visual**: Network diagram from NETWORK_MAP.md

```
┌─────────────────────────────────────────────────┐
│              OT Network (vmbr3)                 │
│            192.168.101.0/24                     │
│                                                 │
│  ┌──────────────┐  ┌──────────────┐            │
│  │ kali-attacker│  │  openplc-01  │            │
│  │ 192.168.101.10│  │ 192.168.101.20│           │
│  │              │  │  Port 502    │            │
│  │              │  │  Port 8080   │            │
│  └──────────────┘  └──────────────┘            │
│                                                 │
│                    ┌──────────────┐             │
│                    │  historian   │             │
│                    │ 192.168.101.30│            │
│                    │  Port 8086   │             │
│                    │  Port 3000   │             │
│                    └──────────────┘             │
└─────────────────────────────────────────────────┘
```

**Talking points**:
- Flat OT network — all three VMs on the same subnet (this is realistic for many small utilities)
- Kali attacker has already gained network access to the OT segment
- OpenPLC at .20: Modbus TCP (502) + Web UI (8080)
- Historian at .30: InfluxDB (8086) + Grafana dashboard (3000)
- No firewall between attacker and PLC — network segmentation is the missing control

**Transition**: "Your mission: discover, enumerate, and manipulate this process."

---

## Slide: Your Mission

**Visual**: Scenario brief text, role assignment

**Talking points**:
- You are a red team operator who has gained access to an OT network segment
- A water tank fill process is running on an OpenPLC controller
- Your objectives:
  1. Discover ICS devices on the OT subnet
  2. Enumerate Modbus registers to understand the process
  3. Map the register table to control logic
  4. Manipulate process parameters via Modbus writes
  5. Explain the defensive gap

**Transition**: "Phase 1 — let's find what's on this network."

---

## Slide: Phase 1 — Reconnaissance

**Visual**: Terminal screenshot of nmap output, ATT&CK technique card for T0846

**Talking points**:
- ATT&CK ICS T0846: Remote System Discovery
- Start with network scanning to find live hosts and open ports
- Key ports: 502 (Modbus TCP), 8080 (OpenPLC Web UI), 8086 (InfluxDB), 3000 (Grafana)
- In real ICS: active scanning can crash legacy PLCs — passive recon preferred
- We use active scanning here because OpenPLC handles it safely

**Command reference**:
```bash
nmap -sT -p 502,8080,8086,3000 192.168.101.0/24
```

**Transition**: "Now that we've found the PLC, let's read its registers."

---

## Slide: Phase 2 — Modbus Enumeration

**Visual**: pymodbus code snippet, register map table, ATT&CK T0842 card

**Talking points**:
- ATT&CK ICS T0842: Network Sniffing / Protocol Analysis
- Use pymodbus to connect and read all register types
- Function codes: FC01 (read coils), FC03 (read holding registers), FC04 (read input registers)
- OpenPLC maps %MW variables to holding registers starting at address 1024
- This is pure reconnaissance — no changes made yet

**Code reference**:
```python
from pymodbus.client import ModbusTcpClient
c = ModbusTcpClient('192.168.101.20', port=502)
c.connect()

# Read coils (digital outputs)
coils = c.read_coils(0, 8, slave=1)
print(f"Coil 0 (pump): {coils.bits[0]}")

# Read holding registers (setpoints)
hr = c.read_holding_registers(1024, 3, slave=1)
print(f"HR 1024 (setpoint): {hr.registers[0]}")
print(f"HR 1025 (alarm high): {hr.registers[1]}")
print(f"HR 1026 (alarm low): {hr.registers[2]}")

# Read input registers (sensor values)
ir = c.read_input_registers(0, 4, slave=1)
print(f"IR 0 (tank level): {ir.registers[0]}")
```

**Transition**: "We now have a complete map. Time to attack."

---

## Slide: Register Map — What We Found

**Visual**: Complete register table

| Address | Type | Name | Value | Description |
|---|---|---|---|---|
| Coil 0 | Coil (FC01/FC05) | pump_enable | True | Pump on/off control |
| IR 0 | Input Register (FC04) | tank_level | ~500 | Current tank level (0-1000) |
| HR 0 | Holding Register (FC03/FC06) | pump_speed | 100 | Pump speed percentage |
| HR 1024 | Holding Register | setpoint | 750 | Target tank level |
| HR 1025 | Holding Register | alarm_high | 900 | High level alarm threshold |
| HR 1026 | Holding Register | alarm_low | 100 | Low level alarm threshold |

**Talking points**:
- Coil 0 controls the pump — write False to disable it
- HR 1024 is the setpoint — the PLC fills to this level
- HR 1025 is the alarm threshold — if tank exceeds this, alarm fires
- All of these are writable with no authentication

**Transition**: "Watch what happens when we write to these registers."

---

## Slide: Phase 3 — Process Manipulation

**Visual**: Split screen — pymodbus write commands on left, Grafana dashboard showing impact on right

**Talking points**:
- ATT&CK ICS T0836: Modify Parameter + T0855: Unauthorized Command Message
- FC06 writes to holding registers, FC05 writes to coils
- Write 999 to HR 1024 → setpoint exceeds safe range → tank overfills
- Write False to Coil 0 → pump disabled → process stops
- No challenge, no confirmation, no audit log on the PLC
- This is the protocol working as designed

**Code reference**:
```python
# Set unsafe setpoint
c.write_register(1024, 999, slave=1)

# Disable pump
c.write_coil(0, False, slave=1)
```

**Transition**: "But what about the alarms?"

---

## Slide: Advanced — Alarm Suppression

**Visual**: Before/after Grafana showing alarm threshold manipulation

**Talking points**:
- Smart attacker modifies alarm thresholds BEFORE changing setpoints
- Write 1000 to HR 1025 → raise alarm threshold above sensor range
- Then write 999 to HR 1024 → overfill without triggering alarm
- This is why monitoring threshold changes is as important as monitoring process values
- Stealthy attack: modify the guards before breaking the rules

**Code reference**:
```python
# Suppress alarms first
c.write_register(1025, 1000, slave=1)  # alarm high → above range

# Now attack without alarms
c.write_register(1024, 999, slave=1)   # unsafe setpoint
```

**Transition**: "Let's discuss how to defend against this."

---

## Slide: Detection Opportunities

**Visual**: Table mapping attack phases to detection methods

| Phase | What to Monitor | Detection Method |
|---|---|---|
| Recon (nmap) | SYN scans to port 502 | Network IDS, firewall logs |
| Enumeration (FC01/03/04) | Modbus reads from unknown IP | Modbus-aware IDS (Suricata ET ICS rules) |
| Write (FC05/FC06) | Modbus writes from unknown IP | HIGH severity IDS alert + historian anomaly |
| Alarm suppression | Setpoint/threshold changes | Historian trend analysis, change detection |

**Talking points**:
- Every phase generates detectable network traffic
- Modbus-aware IDS distinguishes reads (suspicious) from writes (critical)
- Historian data reveals sudden setpoint jumps — baseline comparison
- Defense-in-depth: network segmentation + IDS + historian monitoring + change management

**Transition**: "Let's look at real-world parallels."

---

## Slide: Real-World Parallel — Oldsmar, FL (2021)

**Visual**: News headline, simplified attack diagram

**Talking points**:
- Attacker accessed water treatment HMI via TeamViewer
- Changed NaOH (lye) dosing from 100ppm to 11,100ppm — 111x increase
- Operator noticed cursor moving on HMI, reverted the change manually
- Same fundamental issue: no authentication on process control commands
- Oldsmar used a different protocol (SCADA HMI, not raw Modbus) but the principle is identical
- Detection was human observation, not automated monitoring

**Transition**: "And the most sophisticated ICS attack ever seen."

---

## Slide: Real-World Parallel — TRITON/TRISIS (2017)

**Visual**: TRITON attack chain diagram (IT → OT → SIS)

**Talking points**:
- Attackers (XENOTIME / TEMP.Veles) targeted Schneider Triconex safety controllers
- Safety Instrumented Systems are the last line of defense against catastrophic failure
- Attackers reprogrammed the SIS to allow unsafe conditions
- Attack was discovered only because a bug in their code tripped a safety shutdown
- If successful: could have caused physical destruction or loss of life
- This is why ICS security is a safety issue, not just a cybersecurity issue

**Transition**: "So why can't we just fix the protocol?"

---

## Slide: Why Not Just Add Authentication?

**Visual**: Comparison table: IT systems vs. ICS constraints

| Factor | IT Systems | ICS/OT Systems |
|---|---|---|
| Lifecycle | 3-5 years | 15-30 years |
| Patching | Monthly | Annual or never |
| CPU power | Modern x86/ARM | 8/16-bit microcontrollers |
| Downtime tolerance | Hours | Minutes (or zero) |
| Protocol migration | Months | Decades |

**Talking points**:
- Many PLCs lack CPU power for TLS/crypto
- Protocol migration is multi-decade in ICS — can't just swap Modbus for something secure
- Downtime for upgrades may not be acceptable (24/7 operations)
- Defense must assume the protocol is insecure and protect at the network level
- Defense-in-depth: segmentation, monitoring, access control at the network boundary

**Transition**: "Let's map what we did to the ATT&CK framework."

---

## Slide: ATT&CK for ICS Mapping

**Visual**: ATT&CK ICS matrix with highlighted techniques

| Tactic | Technique | ID | What We Did |
|---|---|---|---|
| Discovery | Remote System Discovery | T0846 | nmap scan of OT subnet |
| Discovery | Network Sniffing | T0842 | pymodbus register enumeration |
| Impair Process Control | Modify Parameter | T0836 | Changed setpoint via FC06 |
| Impair Process Control | Unauthorized Command Message | T0855 | Wrote to coils via FC05 |
| Inhibit Response Function | Manipulate I/O Image | T0812 | Alarm threshold suppression |

**Talking points**:
- 5 techniques across 3 tactics
- Full attack chain: discover → enumerate → modify → suppress defenses
- Each technique maps to a specific Modbus function code
- Students should be able to identify these techniques from network captures

**Transition**: "Complete your ATT&CK mapping exercise and incident report."

---

## Slide: Assessment

**Visual**: Rubric summary table

| Criterion | Points |
|---|---|
| Identified PLC and historian via nmap | 10 |
| Produced complete register map | 20 |
| Modified setpoint via FC06 | 20 |
| Disabled pump via FC05 | 15 |
| Documented Grafana impact | 10 |
| ATT&CK technique mapping | 10 |
| Written impact explanation | 15 |
| **Bonus**: Alarm suppression | +10 |
| **Total** | **100 (+10)** |

**Talking points**:
- Complete the assessment checklist before leaving
- Submit: nmap output, register map, pymodbus commands, Grafana screenshots, ATT&CK table, impact statement
- Bonus: demonstrate alarm suppression before setpoint manipulation

**Transition**: "Questions? Let's debrief."

---

## Slide: Further Reading

**Visual**: Resource list with links

**Resources**:
- MITRE ATT&CK for ICS: https://attack.mitre.org/matrices/ics/
- CISA ICS-CERT Advisories: https://www.cisa.gov/topics/industrial-control-systems
- Dragos ICS/OT Cybersecurity Year in Review (annual)
- NIST SP 800-82 Rev 3: Guide to OT Security
- pymodbus documentation: https://pymodbus.readthedocs.io/

**Talking points**:
- ATT&CK for ICS is the framework — learn it
- CISA advisories are real-world vulnerability reports for ICS products
- SP 800-82 is the foundational guide for OT security architecture
