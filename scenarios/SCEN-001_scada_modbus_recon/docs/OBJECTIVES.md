# Objectives — SCEN-001: SCADA Modbus Recon & Manipulation

## Your Mission

You have gained network access to an industrial control system managing a water tank fill process. Your objective is to enumerate the SCADA environment, understand the control logic, and demonstrate the impact of unauthorized Modbus register manipulation.

## Objectives

### Phase 1: Reconnaissance
1. **Identify the PLC** — Use nmap to discover hosts on the OT network and identify the OpenPLC controller
2. **Enumerate Modbus registers** — Use pymodbus to read all coils (FC01), input registers (FC04), and holding registers (FC03)
3. **Map the register table** — Document which registers control which process variables

### Phase 2: Process Manipulation
4. **Modify the setpoint** — Write an unsafe value (>900) to the tank level setpoint register
5. **Disable the pump** — Write FALSE to the pump enable coil to stop the fill process
6. **Observe impact** — Watch the Grafana dashboard to see how your changes affect the physical process

### Phase 3: Advanced (Bonus)
7. **Suppress alarms** — Modify the high-level alarm threshold to prevent alarm activation during an overfill attack

## Tools Available
- `pymodbus` — Python Modbus TCP client (pre-installed)
- `nmap` — Network scanner
- `Wireshark` — Protocol analyzer
- `modpoll` — Command-line Modbus tool

## Success Criteria
- Documented register map matching the PLC program
- Screenshot or log showing successful setpoint modification
- Screenshot or log showing pump disable via coil write
- Brief written explanation of real-world impact
