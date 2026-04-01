# Incident Report — SCEN-002: Credential Access — Kerberoasting

**Student Name**: ___________________________
**Lab Slot**: ___________________________
**Date**: ___________________________

---

## 1. Executive Summary

*Provide a 3-5 sentence summary of the incident. What happened, what was compromised, and what is the impact? Write as if you are briefing a CISO who has 2 minutes to read this.*

___

___

___

___

___

---

## 2. Timeline of Events

*Document each action you took in chronological order. Include timestamps, commands run, and results observed.*

| Time | Action | Tool/Command Used | Result |
|---|---|---|---|
| | | | |
| | | | |
| | | | |
| | | | |
| | | | |
| | | | |
| | | | |
| | | | |

---

## 3. MITRE ATT&CK Technique Mapping

*For each technique used in this scenario, fill in the table. Describe what you did that corresponds to each technique.*

| ATT&CK ID | Technique Name | Tactic | Your Action | Evidence |
|---|---|---|---|---|
| | | | | |
| | | | | |
| | | | | |
| | | | | |

---

## 4. Enumeration Findings

### 4.1 Domain Users Discovered

*List all domain user accounts you identified during enumeration.*

| Username | Full Name | Description/Notes | Group Memberships |
|---|---|---|---|
| | | | |
| | | | |
| | | | |
| | | | |

### 4.2 Service Accounts with SPNs

*List all accounts with Service Principal Names registered.*

| Account Name | SPN | Service Type | Notes |
|---|---|---|---|
| | | | |
| | | | |

---

## 5. Evidence Collected

### 5.1 TGS Ticket Hashes

*Paste the first 80 characters of each extracted hash below (do not paste the full hash — just enough to demonstrate extraction).*

```
Hash 1: ___

Hash 2: ___
```

**Encryption type observed**: ___

**What does this encryption type tell you about the environment's Kerberos configuration?**

___

___

### 5.2 Cracking Results

| Account | Cracked (Yes/No) | Time to Crack | Wordlist Used | Tool Used |
|---|---|---|---|---|
| | | | | |
| | | | | |

**Why did one account crack and the other did not?**

___

___

### 5.3 Post-Cracking Validation

*What resources did the cracked service account have access to? Paste relevant command output.*

```


```

---

## 6. Attack Flow Diagram

*Draw or describe the complete attack chain from initial access to final objective. Show how each phase enabled the next.*

```


```

---

## 7. Detection Analysis

### 7.1 How would a defender detect this attack?

*For each phase of the attack, describe what a defender monitoring the environment would see.*

| Attack Phase | Detection Method | Specific Indicator | Detection Difficulty |
|---|---|---|---|
| Domain Enumeration | | | |
| TGS Ticket Request | | | |
| Offline Cracking | | | |
| Credential Use | | | |

### 7.2 Which phase offers the best detection opportunity and why?

___

___

___

### 7.3 What Windows Event ID is most relevant for detecting Kerberoasting?

**Event ID**: ___

**Key fields to examine**:

- ___
- ___
- ___

**What makes a TGS request suspicious vs. normal?**

___

___

---

## 8. Defense Recommendations

*You are advising this organization on how to prevent Kerberoasting. List at least 3 specific, actionable recommendations in priority order.*

| Priority | Recommendation | Implementation Effort | Effectiveness |
|---|---|---|---|
| 1 | | | |
| 2 | | | |
| 3 | | | |
| 4 | | | |
| 5 | | | |

---

## 9. Lessons Learned

**What was the most important thing you learned from this scenario?**

___

___

**What would you do differently if you encountered this attack in a production environment (as a defender)?**

___

___

**What surprised you about this attack technique?**

___

___

---

## 10. Bonus — BloodHound Analysis (Optional)

*If you completed the BloodHound bonus objective, describe the attack paths you discovered.*

**Shortest path from jsmith to Domain Admins**:

```


```

**Additional attack paths identified**:

___

___

---

*Submitted by*: ___________________________
*Reviewed by (instructor)*: ___________________________
*Grade*: ___ / 100
