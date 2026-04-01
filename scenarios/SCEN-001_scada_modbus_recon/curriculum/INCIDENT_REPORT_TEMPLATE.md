# Incident Report — SCADA Modbus Recon & Manipulation

> Complete this report as you work through the scenario. Submit to your instructor at the end of the lab.

---

## Report Header

| Field | Your Entry |
|---|---|
| Student Name | |
| Date | |
| Scenario ID | SCEN-001 |
| Lab Slot | |
| Time Started | |
| Time Completed | |

---

## Section 1: Reconnaissance Findings

### 1.1 Network Discovery

Paste your nmap scan results below:

```
(paste nmap output here)
```

List all hosts discovered and their open ports:

| IP Address | Open Ports | Suspected Role |
|---|---|---|
| | | |
| | | |
| | | |

### 1.2 What ATT&CK technique does this reconnaissance map to?

- Technique ID:
- Technique Name:
- Tactic:

### 1.3 Detection Question

If you were a network defender monitoring this OT segment, what indicators would alert you to this scanning activity?

> (your answer)

---

## Section 2: Modbus Enumeration

### 2.1 Register Map

Document every register you discovered. Fill in values you read:

| Address | Type | Function Code Used | Value Read | Suspected Purpose |
|---|---|---|---|---|
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |

### 2.2 pymodbus Commands Used

Paste the Python commands you used to enumerate registers:

```python
(paste your pymodbus read commands here)
```

### 2.3 What ATT&CK technique does register enumeration map to?

- Technique ID:
- Technique Name:
- Tactic:

### 2.4 Process Understanding

Based on your register map, describe in your own words what this PLC is controlling:

> (your answer — what physical process? what does each register represent?)

---

## Section 3: Process Manipulation

### 3.1 Setpoint Modification

What register did you write to, and what value did you set?

- Register address:
- Original value:
- Value you wrote:
- Modbus function code used:

Paste the pymodbus write command:

```python
(paste command here)
```

### 3.2 Coil Manipulation

What coil did you write to, and what was the effect?

- Coil address:
- Original state:
- Value you wrote:
- Observed effect:

Paste the pymodbus write command:

```python
(paste command here)
```

### 3.3 Grafana Observation

Describe what you observed on the Grafana dashboard after your writes:

> (describe the change in tank level, pump status, alarm state)

### 3.4 What ATT&CK techniques do these writes map to?

- Technique 1 ID:
- Technique 1 Name:
- Technique 2 ID:
- Technique 2 Name:
- Tactic:

---

## Section 4: Bonus — Alarm Suppression (Optional)

### 4.1 Alarm Threshold Manipulation

If you attempted alarm suppression, describe your approach:

- Which register holds the alarm threshold?
- What value did you change it to?
- Did the alarm fire after you modified the setpoint? Why or why not?

```python
(paste alarm suppression commands here)
```

### 4.2 Why is alarm suppression more dangerous than direct manipulation?

> (your answer)

---

## Section 5: ATT&CK Mapping Summary

Complete this table mapping your activities to ATT&CK for ICS:

| Your Activity | Tactic | Technique Name | Technique ID |
|---|---|---|---|
| Network scanning | | | |
| Register reads | | | |
| Setpoint write | | | |
| Coil write | | | |
| Alarm suppression | | | |

---

## Section 6: Real-World Impact Analysis

### 6.1 Impact Statement

In 2-3 sentences, describe what this attack would do to a real water treatment facility:

> (your answer)

### 6.2 Defense Recommendations

List at least 3 defensive controls that would mitigate this attack:

1.
2.
3.

### 6.3 Protocol Limitations

Why can't we simply add TLS and authentication to Modbus TCP? What constraints exist in real ICS environments?

> (your answer)

---

## Instructor Grading (do not fill in)

| Criterion | Points Possible | Points Earned | Notes |
|---|---|---|---|
| Host discovery (nmap output) | 10 | | |
| Complete register map | 20 | | |
| Setpoint modification (FC06) | 20 | | |
| Pump disable (FC05) | 15 | | |
| Grafana impact documented | 10 | | |
| ATT&CK mapping accuracy | 10 | | |
| Real-world impact explanation | 15 | | |
| Bonus: alarm suppression | +10 | | |
| **Total** | **100 (+10)** | | |
