# Incident Report -- SCEN-003: APT Lateral Movement

**Student Name**: ___________________________
**Date**: ___________________________
**Lab Slot**: ___________________________

---

## 1. Executive Summary

*Provide a 3-5 sentence summary of the incident. Include: the initial access vector, the scope of compromise achieved, the number of systems affected, and the ultimate impact.*

___________________________________________________________________________

___________________________________________________________________________

___________________________________________________________________________

___________________________________________________________________________

___________________________________________________________________________

---

## 2. Incident Timeline

*Document every significant action with timestamps. Use your terminal history and notes.*

| Timestamp | Source Host | Target Host | Action | ATT&CK ID | Result |
|---|---|---|---|---|---|
| | | | | | |
| | | | | | |
| | | | | | |
| | | | | | |
| | | | | | |
| | | | | | |
| | | | | | |
| | | | | | |
| | | | | | |
| | | | | | |
| | | | | | |
| | | | | | |

---

## 3. Credential Chain

*Map the credential chain you discovered. For each credential, document how you obtained it and what access it provided.*

### 3.1 Credential Inventory

| # | Account | How Obtained | Password / Hash | Domain | Access Level |
|---|---|---|---|---|---|
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |
| 4 | | | | | |
| 5 | | | | | |

### 3.2 Credential Chain Diagram

*Draw the credential chain showing how each credential led to the next. Use arrows to show the progression.*

```
(starting credential)
    |
    | Method: _______________
    | Target: _______________
    v
(credential discovered)
    |
    | Method: _______________
    | Target: _______________
    v
(credential discovered)
    |
    | Method: _______________
    | Target: _______________
    v
(final access achieved)
```

---

## 4. Systems Compromised

*For each system you accessed, document the access level and method.*

### System 1: _______________

- **IP Address**: _______________
- **Hostname**: _______________
- **OS**: _______________
- **Access Method**: _______________
- **Credential Used**: _______________
- **Access Level**: _______________
- **Evidence** (whoami output, screenshot reference): _______________

### System 2: _______________

- **IP Address**: _______________
- **Hostname**: _______________
- **OS**: _______________
- **Access Method**: _______________
- **Credential Used**: _______________
- **Access Level**: _______________
- **Evidence**: _______________

### System 3: _______________

- **IP Address**: _______________
- **Hostname**: _______________
- **OS**: _______________
- **Access Method**: _______________
- **Credential Used**: _______________
- **Access Level**: _______________
- **Evidence**: _______________

---

## 5. MITRE ATT&CK Mapping

*Map each action to the corresponding ATT&CK technique. Include the tactic (why) and technique (how).*

| Tactic | Technique Name | Technique ID | How You Used It | Target System |
|---|---|---|---|---|
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |

---

## 6. Detection Opportunities

*For each phase of the attack, identify what a defender could have detected.*

### Phase 1: Initial Access

- **What would a defender see?**

  ___________________________________________________________________________

- **Relevant Event IDs / Data Sources**:

  ___________________________________________________________________________

- **Detection Rule Concept**:

  ___________________________________________________________________________

### Phase 2: Credential Dumping

- **What would a defender see?**

  ___________________________________________________________________________

- **Relevant Event IDs / Data Sources**:

  ___________________________________________________________________________

- **Detection Rule Concept**:

  ___________________________________________________________________________

### Phase 3: Lateral Movement

- **What would a defender see?**

  ___________________________________________________________________________

- **Relevant Event IDs / Data Sources**:

  ___________________________________________________________________________

- **Detection Rule Concept**:

  ___________________________________________________________________________

### Phase 4: Domain Compromise

- **What would a defender see?**

  ___________________________________________________________________________

- **Relevant Event IDs / Data Sources**:

  ___________________________________________________________________________

- **Detection Rule Concept**:

  ___________________________________________________________________________

---

## 7. Evidence Artifacts

*List all evidence collected during the engagement. Reference screenshots, terminal output files, and hash dumps.*

| # | Artifact Type | Description | Filename / Location |
|---|---|---|---|
| 1 | | | |
| 2 | | | |
| 3 | | | |
| 4 | | | |
| 5 | | | |
| 6 | | | |

---

## 8. Remediation Recommendations

*Based on your attack path, recommend specific defensive controls that would prevent or detect each phase. Be specific -- name the technology, configuration, or policy.*

### 8.1 Preventive Controls

| Priority | Recommendation | Prevents Which Phase | Implementation |
|---|---|---|---|
| Critical | | | |
| Critical | | | |
| High | | | |
| High | | | |
| Medium | | | |
| Medium | | | |

### 8.2 Detective Controls

| Priority | Recommendation | Detects Which Phase | Data Source Required |
|---|---|---|---|
| Critical | | | |
| High | | | |
| High | | | |
| Medium | | | |

### 8.3 If You Were the CISO

*In 3-5 sentences, what would you recommend as the top priority for this organization? Consider cost, operational impact, and risk reduction.*

___________________________________________________________________________

___________________________________________________________________________

___________________________________________________________________________

___________________________________________________________________________

___________________________________________________________________________

---

## 9. Lessons Learned

*Reflect on the exercise. What surprised you? What was harder or easier than expected? What would you do differently as an attacker? As a defender?*

### As the Attacker

___________________________________________________________________________

___________________________________________________________________________

___________________________________________________________________________

### As the Defender

___________________________________________________________________________

___________________________________________________________________________

___________________________________________________________________________

---

## Appendix A: Tool Output

*Paste relevant tool output here. Label each section clearly.*

### A.1 Credential Dump Output

```
(paste secretsdump/crackmapexec output here)
```

### A.2 Domain Enumeration Output

```
(paste domain enumeration output here)
```

### A.3 NTDS.dit Dump Output (if completed)

```
(paste secretsdump -just-dc output here)
```
