# Incident Report — SCEN-004: ICS/OT Pivot

**Student Name**: ___________________________
**Date**: ___________________________
**Lab Slot**: ___________________________

---

## 1. Executive Summary

*Provide a 3-5 sentence summary of the full attack chain. Describe the initial access vector, the credential escalation path, the OT pivot method, and the final impact on the industrial process. Write as if briefing a CISO who needs to understand the incident in 30 seconds.*

> [Your summary here]

---

## 2. Attack Timeline

*Document each step chronologically. Include the time (relative to start), the action taken, the tool used, the result, and the ATT&CK technique ID.*

| Time | Action | Tool | Result | ATT&CK ID |
|---|---|---|---|---|
| T+00:00 | | | | |
| T+__:__ | | | | |
| T+__:__ | | | | |
| T+__:__ | | | | |
| T+__:__ | | | | |
| T+__:__ | | | | |
| T+__:__ | | | | |
| T+__:__ | | | | |
| T+__:__ | | | | |
| T+__:__ | | | | |

*Add rows as needed.*

---

## 3. Credential Chain

*Document every credential obtained during the engagement, how it was obtained, and what access it granted.*

| Account | How Obtained | Method/Tool | Access Granted |
|---|---|---|---|
| jsmith | Provided (simulated phishing) | N/A | |
| | | | |
| | | | |
| | | | |

---

## 4. Network Pivot Path

*Draw or describe the complete network path from initial access to OT zone exploitation. Include IP addresses, ports, and protocols at each hop.*

```
Source                  Protocol/Port           Destination
──────                  ─────────────           ───────────
kali (__________)  ──►  _____________  ──►  ________________

________________   ──►  _____________  ──►  ________________

________________   ──►  _____________  ──►  ________________

________________   ──►  _____________  ──►  ________________
```

*Describe the SSH tunneling method used (dynamic port forward, local port forward, or other):*

> [Your description here]

---

## 5. Network Zones Traversed

*For each zone, document what hosts were accessed and what activities were performed.*

### Red Zone (vmbr1)

| Host | IP | Activities |
|---|---|---|
| | | |

### Blue Zone / IT (vmbr2)

| Host | IP | Activities |
|---|---|---|
| | | |
| | | |

### OT Zone (vmbr3)

| Host | IP | Activities |
|---|---|---|
| | | |
| | | |
| | | |

---

## 6. ICS Process Impact Assessment

*Document the industrial process state before and after your manipulation.*

### Before Attack (Baseline Readings)

| Register | Address | Value | Description |
|---|---|---|---|
| Pump Enable | Coil 0 | | |
| Tank Level | IR 0 | | |
| Pump Speed | HR 0 | | |
| Setpoint | HR 1024 | | |
| Alarm High | HR 1025 | | |
| Alarm Low | HR 1026 | | |

### After Attack

| Register | Address | Original Value | Modified Value | Attack Type |
|---|---|---|---|---|
| | | | | |
| | | | | |
| | | | | |
| | | | | |

### Physical Process Impact

*Describe the observable impact on the physical process (tank level behavior, pump status, alarm state):*

> [Your description here]

*If you accessed Grafana, describe the process deviation visible in the dashboard:*

> [Your description here]

---

## 7. MITRE ATT&CK Mapping

*Complete both the Enterprise and ICS technique tables. List every technique you used during the engagement.*

### Enterprise ATT&CK Techniques

| Tactic | Technique ID | Technique Name | Phase Used | Evidence |
|---|---|---|---|---|
| Initial Access | | | | |
| Lateral Movement | | | | |
| Credential Access | | | | |
| Credential Access | | | | |
| Lateral Movement | | | | |
| Discovery | | | | |

### ICS ATT&CK Techniques

| Tactic | Technique ID | Technique Name | Phase Used | Evidence |
|---|---|---|---|---|
| Discovery | | | | |
| Collection | | | | |
| Impair Process Control | | | | |
| Impair Process Control | | | | |

---

## 8. Purdue Model Violation Analysis

*Map each phase of your attack to the Purdue Model level boundaries crossed.*

| Attack Phase | From Level | To Level | Boundary Crossed | Control That Would Have Stopped It |
|---|---|---|---|---|
| IT Foothold | | | | |
| Credential Escalation | | | | |
| OT Zone Pivot | | | | |
| ICS Exploitation | | | | |

*Which boundary crossing was the easiest for the attacker? Why?*

> [Your answer here]

*Which boundary crossing was the hardest for the attacker? Why?*

> [Your answer here]

---

## 9. Detection Opportunities

*For each phase, identify what a defender would see if proper monitoring was in place.*

### Phase 1: IT Foothold

| Data Source | Detection Indicator | Severity |
|---|---|---|
| | | |
| | | |

### Phase 2: Credential Escalation

| Data Source | Detection Indicator | Severity |
|---|---|---|
| | | |
| | | |

### Phase 3: OT Zone Pivot

| Data Source | Detection Indicator | Severity |
|---|---|---|
| | | |
| | | |

### Phase 4: ICS Exploitation

| Data Source | Detection Indicator | Severity |
|---|---|---|
| | | |
| | | |

*Which phase had the strongest detection opportunities? Which had the weakest?*

> [Your answer here]

---

## 10. Recommendations

*Based on your attack path, provide specific, actionable security recommendations organized by priority.*

### Critical (Would have prevented the attack)

1. > [Recommendation]
2. > [Recommendation]
3. > [Recommendation]

### High (Would have detected the attack earlier)

1. > [Recommendation]
2. > [Recommendation]

### Medium (Would reduce future attack surface)

1. > [Recommendation]
2. > [Recommendation]

---

## 11. Real-World Comparison

*Compare this attack chain to one real-world ICS incident (TRITON, CRASHOVERRIDE, Volt Typhoon, or Oldsmar). Identify similarities and differences in the attack path, tools, and objectives.*

**Selected Incident**: ___________________________

**Similarities**:
> [Your analysis here]

**Differences**:
> [Your analysis here]

**Key Lesson**:
> [Your analysis here]

---

## 12. Evidence Appendix

*Attach or paste screenshots and command output for each phase below.*

### Phase 1 Evidence

```
[Paste command output or describe screenshot]
```

### Phase 2 Evidence

```
[Paste command output or describe screenshot]
```

### Phase 3 Evidence

```
[Paste command output or describe screenshot]
```

### Phase 4 Evidence

```
[Paste command output or describe screenshot]
```
