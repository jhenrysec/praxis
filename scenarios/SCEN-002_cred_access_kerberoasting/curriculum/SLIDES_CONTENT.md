# Slides Content — SCEN-002: Credential Access — Kerberoasting

**INSTRUCTOR ONLY — Slide-ready content for classroom presentation**

Use this content to build your own slide deck or present directly from notes.
Each slide block contains: title, visual description, talking points, and transition.

---

## Slide 1: Title

**Visual**: Dark background. Scenario title centered. MITRE ATT&CK logo in corner.

```
CREDENTIAL ACCESS: KERBEROASTING
SCEN-002 | Intermediate | 3 Hours

Techniques: T1087.002 · T1069.002 · T1558.003 · T1110.002
```

**Talking points**:
- Today we are attacking Active Directory using nothing more than a low-privilege domain account
- No exploits. No vulnerabilities in the traditional sense. We are abusing how Kerberos works by design.
- By the end of this lab, you will have escalated from a helpdesk-level account to a service account with elevated access — using only legitimate Kerberos requests and offline cracking

**Transition**: "Before we attack Kerberos, we need to understand how it works."

---

## Slide 2: Kerberos Authentication — The Big Picture

**Visual**: Flow diagram showing the three parties (Client, KDC/DC, Service) and the two exchanges (AS exchange, TGS exchange).

```
                    ┌──────────────┐
                    │     KDC      │
                    │  (Domain     │
                    │  Controller) │
                    └──┬───────┬───┘
           AS-REQ/     │       │     TGS-REQ/
           AS-REP      │       │     TGS-REP
                    ┌──┴──┐ ┌──┴──┐
                    │     │ │     │
                 ┌──┴──┐  │  ┌──┴──────┐
                 │Client│  │  │ Service │
                 │(User)│──┘  │ (SQL,   │
                 └──────┘     │  IIS)   │
                    AP-REQ/   └─────────┘
                    AP-REP
```

**Talking points**:
- Kerberos uses tickets instead of sending passwords over the network — this is fundamentally more secure than NTLM
- Step 1: Client proves identity to KDC, receives a Ticket Granting Ticket (TGT) — this is your "passport"
- Step 2: Client presents TGT to KDC and asks for a Ticket Granting Service ticket (TGS) for a specific service
- Step 3: Client presents TGS to the service to authenticate
- The critical detail: the TGS ticket is encrypted with the service account's long-term key (derived from its password hash)

**Transition**: "That last point — the TGS ticket being encrypted with the service account's password — is where the attack lives."

---

## Slide 3: What Is a Service Principal Name (SPN)?

**Visual**: Table showing example SPNs and what they map to.

```
SPN Format: <service_class>/<host>:<port>

Examples:
  MSSQLSvc/sqlserver01.corp.local:1433  →  svc_sql account
  HTTP/webserver.corp.local             →  svc_iis account
  exchangeMDB/mail01.corp.local         →  svc_exchange account
  WBEM/mgmt01.corp.local                →  svc_backup account
```

**Talking points**:
- An SPN is a unique identifier for a service instance — it tells Kerberos which account's key to use when encrypting the TGS ticket
- SPNs are registered in Active Directory on the service account object
- Any authenticated domain user can query AD for all SPNs — this is by design, not a misconfiguration
- The SPN itself is not the vulnerability. The vulnerability is what happens next — when we request a TGS ticket and take it offline

**Transition**: "So any domain user can find SPNs. Any domain user can request TGS tickets. Let's see what an attacker does with that."

---

## Slide 4: The Kerberoasting Attack Flow

**Visual**: Four-step attack chain diagram with color coding (green = legitimate, red = malicious).

```
[1] AUTHENTICATE              [2] ENUMERATE SPNs
    Any domain creds               LDAP query to AD
    (even low-privilege)           (normal operation)
    ────────────────►              ────────────────►
    ✅ Legitimate                  ✅ Legitimate

[3] REQUEST TGS TICKETS       [4] CRACK OFFLINE
    KDC issues tickets             hashcat -m 13100
    encrypted with svc              on attacker's machine
    account password hash          ─────────────────►
    ────────────────►              🔴 Malicious (but invisible)
    ✅ Legitimate (by design)
```

**Talking points**:
- Steps 1 through 3 are completely legitimate Kerberos operations — no exploit, no vulnerability
- The DC has no way to distinguish a Kerberoasting request from a normal service ticket request
- Step 4 happens entirely on the attacker's machine — zero network traffic, zero failed logins, zero account lockouts
- The defender's detection window is narrow: the TGS request in step 3 is the only observable event
- If the service account password is weak, the attacker wins. If it is strong, the hash is useless.

**Transition**: "Let's look at this in the real world before we do it ourselves."

---

## Slide 5: Real-World Kerberoasting

**Visual**: Timeline or bullet list of notable incidents.

**Talking points**:
- Kerberoasting was first publicly described by Tim Medin at DerbyCon 2014 — it has been a known technique for over a decade
- Used by APT29 (Cozy Bear / Russia SVR) in the SolarWinds campaign — after initial access, they Kerberoasted service accounts to move laterally
- FIN6 (financially motivated) uses Kerberoasting as a standard part of their AD compromise playbook
- Wizard Spider (Ryuk/Conti ransomware operators) Kerberoast service accounts as part of their pre-encryption domain takeover
- MITRE ATT&CK lists Kerberoasting (T1558.003) with procedure examples from 20+ threat groups
- This is not a theoretical attack — it is used in the majority of enterprise AD compromises

**Transition**: "Now let's do it. Here is your lab environment."

---

## Slide 6: Lab Environment

**Visual**: Network diagram matching the scenario's NETWORK_MAP.md.

```
┌─────────────────────────────────────────────┐
│           Red Zone (vmbr1)                  │
│                                             │
│   ┌────────────────────┐                    │
│   │  kali-attacker     │                    │
│   │  Your machine      │─── dual-homed ──┐  │
│   │  impacket, hashcat │                 │  │
│   └────────────────────┘                 │  │
└──────────────────────────────────────────│──┘
                                           │
┌──────────────────────────────────────────│──┐
│           Blue Zone (vmbr2)              │  │
│           Domain: lab.local              │  │
│                                          │  │
│   ┌────────────────────┐   ┌─────────────▼┐ │
│   │  dc01              │   │  ws01        │ │
│   │  Domain Controller │   │  Workstation │ │
│   │  Kerberos KDC      │   │              │ │
│   │                    │   │              │ │
│   │  SPNs:             │   │              │ │
│   │   svc_sql          │   │              │ │
│   │   svc_backup       │   │              │ │
│   └────────────────────┘   └──────────────┘ │
└─────────────────────────────────────────────┘
```

**Talking points**:
- You start on kali-attacker with the jsmith domain credentials (low-privilege user)
- dc01 is the domain controller running Kerberos, LDAP, DNS, and SMB
- ws01 is a domain-joined workstation — you may interact with it later
- Your initial credentials: `jsmith` / `Password123` — a regular domain user with no admin privileges
- Your goal: find service accounts, steal their ticket hashes, crack them, and use the cracked passwords

**Transition**: "Open your terminals. Phase 1: Domain Enumeration."

---

## Slide 7: Phase 1 — Domain Enumeration

**Visual**: Terminal screenshot showing crackmapexec and GetUserSPNs output.

```
PHASE 1: DOMAIN ENUMERATION
ATT&CK: T1087.002 — Account Discovery: Domain Account
         T1069.002 — Permission Groups Discovery: Domain Groups

Your task:
  1. Verify jsmith credentials work
  2. Enumerate all domain users
  3. Find accounts with SPNs

Tools: crackmapexec, ldapsearch, impacket-GetUserSPNs
Time: 35 minutes
```

**Talking points**:
- First step in any AD attack: verify your credentials work and enumerate the environment
- You are looking for service accounts — accounts with SPNs registered
- Multiple tools can do this: crackmapexec --users, ldapsearch, GetUserSPNs.py
- Start with credential verification, then enumerate

**Transition**: Transition to lab work. Circulate and assist.

---

## Slide 8: Phase 2 — Kerberoasting

**Visual**: Terminal screenshot showing GetUserSPNs.py -request output with hash format highlighted.

```
PHASE 2: KERBEROASTING
ATT&CK: T1558.003 — Steal or Forge Kerberos Tickets: Kerberoasting

Your task:
  1. Request TGS tickets for all SPN accounts
  2. Save hashes to a file
  3. Examine the hash format

Key flag: -request
Hash format: $krb5tgs$23$*<account>$<domain>$...
The "23" = RC4 encryption (etype 23)

Time: 30 minutes
```

**Talking points**:
- GetUserSPNs.py with -request does both enumeration and ticket extraction in one command
- The output format starts with `$krb5tgs$23$` — this tells hashcat/john which algorithm to use
- etype 23 = RC4-HMAC — the weakest Kerberos encryption, most common default
- The DC issues these tickets without checking if you actually need the service — this is by-design behavior

**Transition**: "You now have encrypted blobs. Time to crack them."

---

## Slide 9: Phase 3 — Offline Cracking

**Visual**: Terminal showing hashcat command and cracked output.

```
PHASE 3: OFFLINE PASSWORD CRACKING
ATT&CK: T1110.002 — Brute Force: Password Cracking

Your task:
  1. Crack the TGS hashes with hashcat or john
  2. Use rockyou.txt wordlist
  3. Validate cracked credentials

hashcat -m 13100 kerberoast_hashes.txt /usr/share/wordlists/rockyou.txt
         ▲
         │
    Mode 13100 = Kerberos 5 TGS-REP (RC4)

Time: 35 minutes
```

**Talking points**:
- Mode 13100 is the hashcat mode for Kerberos 5 TGS-REP etype 23 (RC4)
- rockyou.txt contains ~14 million real passwords from a 2009 data breach
- One of the two service accounts has a weak password that will crack. The other has a strong password that will not.
- After cracking, validate the password works by authenticating as the service account
- This entire phase is invisible to the defender — zero network traffic

**Transition**: "Once you have cracked credentials, validate them and document everything."

---

## Slide 10: Detection — What Defenders See

**Visual**: Windows Event Viewer screenshot showing Event ID 4769.

```
DETECTION: WINDOWS EVENT ID 4769
Kerberos Service Ticket Operations

Key fields to analyze:
  Account Name:           jsmith         ← who requested the ticket
  Service Name:           svc_sql        ← which SPN
  Ticket Encryption Type: 0x17           ← RC4 (suspicious!)
  Client Address:         10.10.x.10     ← attacker IP
  Ticket Options:         0x40810000

Normal pattern: TGS requests come FROM the server running the service
Attack pattern: TGS requests come FROM a user workstation or unknown IP
```

**Talking points**:
- Event ID 4769 logs every TGS ticket request on the domain controller
- The key indicator is Ticket Encryption Type 0x17 (RC4) — modern environments should use AES
- Source IP is critical — if svc_sql's TGS is normally requested by the SQL server, a request from a Kali box is anomalous
- Bulk TGS requests in a short window (requesting tickets for many SPNs at once) is another strong indicator
- This is the only detection window — once the attacker has the hash, the cracking phase is invisible

**Transition**: "So how do we defend against this?"

---

## Slide 11: Defense — Mitigating Kerberoasting

**Visual**: Defense stack listed in priority order with effectiveness rating.

```
DEFENSE STACK (priority order):

1. Group Managed Service Accounts (gMSA)    ███████████ MOST EFFECTIVE
   - 120-char random password, auto-rotates every 30 days
   - Cannot be Kerberoasted (password too complex to crack)

2. Strong Service Account Passwords          ████████░░
   - 25+ characters, not in any wordlist
   - Applies when gMSA is not possible (legacy apps)

3. AES Encryption Enforcement                ██████░░░░
   - Slower to crack than RC4, but not immune
   - Configure: msDS-SupportedEncryptionTypes attribute

4. Detection — Event ID 4769 Monitoring      █████░░░░░
   - Alert on RC4 TGS requests from unusual sources
   - High signal-to-noise if baselined correctly

5. Honeypot SPNs                             ████████░░
   - Fake service accounts that trigger alerts on any TGS request
   - Zero false positives — any request is guaranteed malicious
```

**Talking points**:
- gMSA is the definitive fix — if you can use it, Kerberoasting is eliminated for that account
- Many organizations cannot use gMSA for legacy applications — in that case, password strength is the last line of defense
- AES enforcement makes cracking harder but does not eliminate it — treat it as defense in depth, not a solution
- Event ID 4769 monitoring is reactive, not preventive — but it is essential for catching attacks in progress
- Honeypot SPNs are underused and highly effective — zero false positive alerting

**Transition**: "Let's bring it all together."

---

## Slide 12: The Full Kill Chain

**Visual**: Complete attack chain with detection opportunities marked at each phase.

```
ATTACK CHAIN — KERBEROASTING

┌─────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  INITIAL     │    │  DOMAIN      │    │ KERBEROAST   │    │  OFFLINE     │
│  ACCESS      │───►│  ENUMERATION │───►│ TGS REQUEST  │───►│  CRACKING    │
│              │    │              │    │              │    │              │
│  jsmith creds│    │  T1087.002   │    │  T1558.003   │    │  T1110.002   │
│  (phishing)  │    │  T1069.002   │    │              │    │              │
└─────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
                          │                   │                    │
                    ┌─────▼─────┐       ┌─────▼─────┐       ┌─────▼─────┐
                    │ Detect:   │       │ Detect:   │       │ Detect:   │
                    │ LDAP query│       │ Event ID  │       │ INVISIBLE │
                    │ volume    │       │ 4769 (RC4)│       │ to target │
                    │ LOW signal│       │ HIGH signal│       │           │
                    └───────────┘       └───────────┘       └───────────┘
```

**Talking points**:
- The entire attack uses legitimate protocols and legitimate Kerberos behavior
- Detection opportunity is strongest at the TGS request phase (Event ID 4769)
- Once the attacker has the hash, the game is over for that account
- Defense in depth: gMSA eliminates the risk, strong passwords mitigate it, detection catches it, honeypots trap it

**Transition**: "Time for debrief. Let's discuss what you found."

---

## Slide 13: Debrief Discussion

**Visual**: Discussion questions on screen.

```
DEBRIEF

1. Why does Kerberoasting work?
   (It's not a bug — it's by design)

2. Why did svc_sql crack but svc_backup didn't?
   (Password strength is the last line of defense)

3. At which phase did the defender have the best
   detection opportunity?
   (Phase 2 — TGS request — Event ID 4769)

4. What would you recommend to this organization?
   (gMSA, password policy, monitoring, honeypots)

5. How would you detect this attack in your own
   environment?
   (Write the detection rule)
```

**Talking points**:
- Walk through each question with the class
- Compare student approaches — who used which tools, who found things faster
- Emphasize that password strength is the determining factor — svc_backup survived because its password was not in rockyou.txt
- Challenge students to articulate the defense recommendations in their own words

**Transition**: "Submit your incident reports. Great work today."

---

## Slide 14: Further Reading

**Visual**: Resource list.

```
FURTHER READING

MITRE ATT&CK:
  T1558.003 — Steal or Forge Kerberos Tickets: Kerberoasting
  https://attack.mitre.org/techniques/T1558/003/

Tim Medin — "Attacking Kerberos: Kicking the Guard Dog
of Hades" (DerbyCon 2014)
  https://www.youtube.com/watch?v=PUyhlN-E5MU

Sean Metcalf — "Cracking Kerberos TGS Tickets Using
Kerberoast" (ADSecurity.org)
  https://adsecurity.org/?p=2293

Microsoft — "Group Managed Service Accounts Overview"
  https://learn.microsoft.com/en-us/windows-server/security/
  group-managed-service-accounts/group-managed-service-accounts-overview
```

**Talking points**:
- Tim Medin's DerbyCon talk is the original public disclosure — worth watching for historical context
- Sean Metcalf's adsecurity.org is the authoritative reference for AD attack and defense techniques
- Microsoft's gMSA documentation is essential reading for any AD administrator
