# Detection Exercise — SCADA Modbus Recon & Manipulation

> Blue team track for SCEN-001. After completing the red team objectives, switch to the defender
> perspective and work through these detection challenges.

---

## Exercise Overview

You have just executed a full Modbus attack chain against a water tank fill process. Now,
assume the role of a defender. Using the tools available on the historian VM, detect and
document the attack you just performed. The goal: build detection capabilities that would
catch this attack in a real ICS environment.

**Time estimate**: 30 minutes (can be run as extension activity or standalone blue team exercise)

---

## Exercise 1: Network Traffic Analysis

### Task
Capture Modbus traffic from your Kali attacker and identify the difference between
read operations (reconnaissance) and write operations (manipulation).

### Steps

1. Start a packet capture on the Kali attacker:
   ```bash
   sudo tshark -i eth0 -f "tcp port 502" -w /tmp/modbus_attack.pcap
   ```

2. Run your Modbus enumeration and write commands again while the capture is running.

3. Stop the capture and analyze:
   ```bash
   # Show all Modbus function codes
   tshark -r /tmp/modbus_attack.pcap -Y "modbus" -T fields \
     -e frame.time -e ip.src -e ip.dst -e modbus.func_code

   # Filter for writes only (FC05 and FC06)
   tshark -r /tmp/modbus_attack.pcap -Y "modbus.func_code == 5 || modbus.func_code == 6"

   # Filter for reads only (FC01, FC03, FC04)
   tshark -r /tmp/modbus_attack.pcap -Y "modbus.func_code == 1 || modbus.func_code == 3 || modbus.func_code == 4"
   ```

### Questions

1. How many read requests vs. write requests did your attack generate?
2. What is the source IP for all Modbus requests? Is this IP expected on the OT network?
3. If you were writing a firewall rule, what single rule would block this entire attack?

---

## Exercise 2: Suricata IDS Rules

### Task
Write Suricata rules that would detect Modbus reconnaissance and manipulation from
unauthorized sources.

### Background

Suricata's ET ICS ruleset includes Modbus detection, but you'll write custom rules
to understand the logic. Modbus TCP has a 7-byte MBAP header before the PDU:

```
[Transaction ID: 2 bytes][Protocol ID: 2 bytes (0x0000)]
[Length: 2 bytes][Unit ID: 1 byte][Function Code: 1 byte]...
```

The function code is at byte offset 7 from the start of the TCP payload.

### Rules to Write

**Rule 1**: Alert on any Modbus read coils (FC01) from a non-PLC source:
```
alert tcp !$OT_PLCS any -> $OT_PLCS 502 (
  msg:"SCADA Modbus Read Coils from unauthorized source";
  flow:to_server,established;
  content:"|00 00|"; offset:2; depth:2;
  byte_test:1,=,1,7;
  classtype:protocol-command-decode;
  sid:1000001; rev:1;
)
```

**Rule 2**: Alert on any Modbus write single coil (FC05) — HIGH priority:
```
alert tcp any any -> $OT_PLCS 502 (
  msg:"SCADA Modbus Write Single Coil - MANIPULATION ATTEMPT";
  flow:to_server,established;
  content:"|00 00|"; offset:2; depth:2;
  byte_test:1,=,5,7;
  classtype:protocol-command-decode;
  priority:1;
  sid:1000002; rev:1;
)
```

**Rule 3**: Write your own rule to detect FC06 (Write Single Register):
```
(write your rule here — model it on Rule 2, change the function code byte)
```

### Questions

1. Why should Modbus write alerts (FC05/FC06) be higher priority than read alerts (FC01/FC03)?
2. What is the limitation of source-IP-based detection? (Hint: what if the attacker compromises a legitimate engineering workstation?)
3. How would you handle false positives from legitimate SCADA master stations that also issue FC06 writes?

---

## Exercise 3: Historian Anomaly Detection

### Task
Use InfluxDB and Grafana on the historian VM to detect the setpoint changes you made
during the attack.

### Steps

1. Open Grafana at `http://192.168.101.30:3000` (admin / LabGrafana2024!)

2. Open the **SCADA Process Monitor** dashboard and look at the time range covering your attack.

3. Identify the anomalies:
   - Sudden setpoint change (HR 1024 jump)
   - Tank level deviation from normal range
   - Alarm threshold change (if you did the bonus)

4. Write an InfluxDB Flux query to detect setpoint changes greater than 10% in a 1-minute window:
   ```flux
   from(bucket: "process-data")
     |> range(start: -1h)
     |> filter(fn: (r) => r._measurement == "modbus_registers")
     |> filter(fn: (r) => r._field == "setpoint")
     |> difference()
     |> filter(fn: (r) => r._value > 75 or r._value < -75)
   ```

5. Write a Flux query to detect when the alarm threshold (HR 1025) changes at all:
   ```flux
   from(bucket: "process-data")
     |> range(start: -1h)
     |> filter(fn: (r) => r._measurement == "modbus_registers")
     |> filter(fn: (r) => r._field == "alarm_high")
     |> difference()
     |> filter(fn: (r) => r._value != 0)
   ```

### Questions

1. What is the time delay between the attacker's Modbus write and the historian recording the change?
2. Could an attacker modify the historian data to cover their tracks? What access would they need?
3. Why is monitoring threshold changes (HR 1025) as important as monitoring process values (HR 1024)?

---

## Exercise 4: Defense Architecture Design

### Task
Design a defense-in-depth architecture for this OT network. Produce a written proposal
covering network, host, and monitoring controls.

### Requirements

Your proposal should address:

**Network Controls**:
- Where would you place a firewall or data diode?
- What Modbus-specific rules would you configure?
- How would you segment the engineering workstation from the PLC?
- Draw a revised network diagram with your proposed controls.

**Host Controls**:
- What hardening would you apply to the OpenPLC controller?
- Can you restrict which IP addresses are allowed to send Modbus writes?
- What logging would you enable on the historian?

**Monitoring Controls**:
- What Suricata rules from Exercise 2 would you deploy?
- What Grafana alerts would you configure based on Exercise 3?
- How would you detect a compromised engineering workstation issuing legitimate-looking writes?

**Process Controls**:
- What change management process would you implement for setpoint changes?
- How would you verify that alarm thresholds haven't been tampered with?
- What manual verification procedures would operators follow?

### Deliverable

Write a 1-page defense proposal covering the four categories above. Reference specific
technologies, IP addresses, and Modbus function codes from this lab.

---

## Assessment Criteria (Detection Track)

| Exercise | Points | Verification |
|---|---|---|
| PCAP capture with read/write analysis | 10 | tshark output showing FC differentiation |
| Suricata rule for FC06 detection | 10 | Valid Suricata rule syntax |
| Suricata rule questions answered | 5 | Demonstrates understanding of IDS limitations |
| InfluxDB setpoint change query | 10 | Working Flux query with results |
| InfluxDB threshold change query | 10 | Working Flux query with results |
| Historian questions answered | 5 | Demonstrates understanding of historian role |
| Defense architecture proposal | 10 | Covers all 4 categories with specific controls |
| **Total** | **60** | |

> This detection track can be combined with the red team assessment (100 pts) for a
> comprehensive 160-point lab grade.
