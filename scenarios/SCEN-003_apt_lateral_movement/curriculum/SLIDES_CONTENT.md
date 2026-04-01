# Slides Content -- SCEN-003: APT Lateral Movement

Slide-by-slide content for instructor presentation. Each slide includes visual description, talking points, and transition to the next slide.

---

## Slide 1: Title

**Visual**: Dark background with scenario title, MITRE ATT&CK shield logo, and the six technique IDs arranged in a horizontal chain.

**Content**:
```
SCEN-003: APT Lateral Movement
Advanced | 4 Hours | Red Team

ATT&CK Chain:
T1021.002 -> T1003.001 -> T1021.002 -> T1003.003

"Own one workstation, own the domain."
```

**Talking points**:
- This scenario follows the most common Active Directory compromise path in the wild
- Every major APT group and ransomware operator uses some variant of this chain
- By the end of today, you will have executed the full kill chain from a single compromised user to domain-wide compromise

**Transition**: "Before we start attacking, let's make sure we understand how Windows authentication actually works."

---

## Slide 2: Windows Authentication -- NTLM vs Kerberos

**Visual**: Two-column comparison diagram. Left column: NTLM challenge-response flow (client -> server -> DC). Right column: Kerberos ticket flow (client -> KDC -> TGT -> TGS -> service).

**Content**:
```
NTLM (Legacy)                         Kerberos (Default in AD)
-----------                            -----------
1. Client sends username               1. Client requests TGT from KDC
2. Server sends challenge              2. KDC issues TGT (encrypted with krbtgt)
3. Client sends hash(challenge)         3. Client requests TGS for service
4. Server validates via DC              4. KDC issues TGS (encrypted with service key)
                                        5. Client presents TGS to service

Attack surface:                        Attack surface:
- Pass-the-Hash (reuse hash)           - Kerberoasting (crack TGS offline)
- NTLM relay (forward auth)            - Pass-the-Ticket (reuse TGT/TGS)
                                        - Golden Ticket (forge TGT with krbtgt hash)
```

**Talking points**:
- NTLM: the password hash IS the credential -- if you have the hash, you can authenticate without knowing the password
- Kerberos: uses tickets, but those tickets are encrypted with keys derived from password hashes
- Both protocols are vulnerable when credential material is extracted from memory
- NTLM is still widely used for backward compatibility, SMB file shares, and network logons

**Transition**: "Both authentication protocols rely on secrets stored in a single process on every Windows machine -- LSASS."

---

## Slide 3: LSASS -- The Crown Jewels Process

**Visual**: Diagram of a Windows workstation with LSASS process highlighted. Arrows pointing into LSASS from: "Interactive logon (keyboard)", "Network logon (SMB/WinRM)", "Service logon", "Cached credentials". Arrows pointing out: "NTLM hashes", "Kerberos tickets", "WDigest cleartext (if enabled)", "SSP credentials".

**Content**:
```
lsass.exe -- Local Security Authority Subsystem Service

Stores (in memory):
  - NTLM password hashes for all logged-in users
  - Kerberos tickets (TGT, TGS)
  - WDigest cleartext passwords (if UseLogonCredential=1)
  - SSP/Credential Manager entries

Who gets cached:
  - Anyone who logs in interactively (console, RDP)
  - Anyone who logs in via network with admin shares
  - Service accounts running on the machine
  - Scheduled task accounts

Stays cached until:
  - Machine reboots
  - User logs off (sometimes -- depends on SSP)
  - Explicit LSASS flush (rare)
```

**Talking points**:
- LSASS is a single point of failure for credential security -- compromise LSASS, get every credential that has touched that machine
- WDigest was designed for HTTP Digest authentication. On older Windows versions (pre-8.1/2012 R2), it stored cleartext passwords by default
- Even with WDigest disabled, NTLM hashes are always present -- these can be used for pass-the-hash
- This is why Microsoft developed Credential Guard -- it isolates LSASS in a hardware-backed virtualization container

**Transition**: "So if an admin ever logs into a workstation, their credentials are sitting in memory. Let's talk about why that's a problem."

---

## Slide 4: The Lateral Movement Kill Chain

**Visual**: Horizontal flowchart with 4 boxes connected by arrows. Each box has an ATT&CK technique ID below it.

**Content**:
```
  [1. Foothold]          [2. Dump]            [3. Pivot]          [4. Compromise]
  +-----------+         +-----------+        +-----------+       +---------------+
  | Access    |  --->   | Extract   |  --->  | Use creds |  ---> | Access DC     |
  | ws01      |         | LSASS     |        | on ws02   |       | Extract       |
  | T1021.002 |         | T1003.001 |        | T1021.002 |       | NTDS.dit      |
  +-----------+         +-----------+        +-----------+       | T1003.003     |
                                                                  +---------------+
  jsmith                jsmith (known)       agarcia              agarcia
  Password123           svc_sql (new)        Welcome2024!         -> ALL hashes
                        agarcia (new)
```

**Talking points**:
- The attacker starts with one credential and ends with every credential in the domain
- Each phase enables the next -- the chain is only as strong as the weakest link
- A defender who breaks any single link stops the entire chain
- This is not a theoretical attack -- this is the most commonly observed AD compromise path

**Transition**: "Let's look at today's lab environment and your mission."

---

## Slide 5: Lab Network Topology

**Visual**: Network diagram matching NETWORK_MAP.md. Color-coded zones: Red (red border), Blue (blue border). VMs as labeled boxes with IP addresses.

**Content**:
```
  vmbr1 -- Red Zone
  +----------------------------+
  |  kali-attacker             |
  |  <red_prefix>.10           |
  |  Tools: Impacket, CME,     |
  |  pypykatz, evil-winrm      |------+
  +----------------------------+      |  (dual-homed)
                                       |
  vmbr2 -- Blue Zone (lab.local)      |
  +--------------------------------------------+
  |                                            |
  |  +----------+  +----------+  +----------+ |
  |  | dc01     |  | ws01     |  | ws02     | |
  |  | .20      |  | .30      |  | .40      | |
  |  | DC, DNS  |  | Foothold |  | Pivot    | |
  |  | KDC      |  | WDigest  |  | target   | |
  |  |          |  | jsmith   |  | agarcia  | |
  |  +----------+  +----------+  +----------+ |
  +--------------------------------------------+
```

**Talking points**:
- kali-attacker is dual-homed: red zone (attacker network) and blue zone (target AD network)
- dc01 is the domain controller for lab.local -- this is your ultimate target
- ws01 is your entry point -- jsmith has local admin here
- ws02 is the pivot -- you need to find credentials that get you there
- All Blue zone machines are domain-joined

**Transition**: "You have jsmith's credentials from a simulated phishing campaign. Your mission starts now."

---

## Slide 6: Your Mission

**Visual**: Mission briefing style -- dark background, monospaced font, classified-style header.

**Content**:
```
OPERATION: CREDENTIAL CASCADE
CLASSIFICATION: TRAINING EXERCISE

SITUATION:
  A phishing campaign targeting the target organization yielded
  valid domain credentials for user "jsmith" -- a standard
  domain user with local administrator rights on workstation ws01.

MISSION:
  Starting from kali-attacker, use the jsmith credentials to
  establish a foothold, harvest additional credentials, move
  laterally through the domain, and compromise the domain controller.

OBJECTIVE:
  Demonstrate complete domain compromise by extracting the NTDS.dit
  database from dc01.

RULES OF ENGAGEMENT:
  - Stay within the lab network
  - Document every step with timestamps
  - Map each action to a MITRE ATT&CK technique
  - Fill in the Incident Report Template as you go

INITIAL ACCESS:
  Username: jsmith
  Password: Password123
  Domain:   lab.local
  Target:   ws01 (<blue_prefix>.30)
```

**Talking points**:
- Distribute the Quick Reference card now
- Students should have the Incident Report Template open and fill it in as they work
- Remind students to document timestamps -- they will need them for the incident timeline
- Do not reveal the credential chain -- students must discover it through enumeration

**Transition**: "Open your terminals. Phase 1 begins now."

---

## Slide 7: Phase 1 -- Initial Foothold

**Visual**: Highlighted step 1 in the kill chain diagram. Terminal screenshot placeholder showing impacket-psexec connection.

**Content**:
```
Phase 1: Initial Foothold
ATT&CK: T1021.002 -- Remote Services: SMB/Windows Admin Shares

YOUR TASK:
  1. Establish a shell on ws01 using jsmith credentials
  2. Enumerate: domain users, groups, shares, local admins
  3. Identify Domain Admins members
  4. Map the network -- what other machines exist?

TOOLS:
  impacket-psexec    -- shell via SMB service creation
  impacket-smbexec   -- shell via SMB command execution
  impacket-wmiexec   -- shell via WMI
  evil-winrm         -- shell via WinRM (port 5985)
  crackmapexec       -- SMB enumeration and credential testing

TIME: 40 minutes
```

**Talking points**:
- Multiple tools can achieve the same goal -- let students choose their preferred method
- PsExec creates a Windows service (noisy), WMIExec uses WMI (quieter), WinRM uses HTTP (different port)
- The choice of tool matters for detection -- each leaves different forensic artifacts
- Key enumeration commands: `whoami /all`, `net user /domain`, `net group "Domain Admins" /domain`

**Transition**: "Once you have situational awareness, the next question is: what else is in memory on this machine?"

---

## Slide 8: Phase 2 -- Credential Dumping

**Visual**: Highlighted step 2 in the kill chain. Diagram of LSASS with arrows showing credential extraction.

**Content**:
```
Phase 2: Credential Dumping
ATT&CK: T1003.001 -- OS Credential Dumping: LSASS Memory

YOUR TASK:
  1. Dump credentials from ws01
  2. Identify ALL cached accounts
  3. Determine which accounts have access to other systems
  4. Test each credential against ws02 and dc01

METHODS:
  impacket-secretsdump  domain/user:pass@target    (remote, preferred)
  crackmapexec smb target -u user -p pass --lsa    (remote, LSA dump)
  pypykatz lsa minidump lsass.dmp                  (local, from memory dump)

WHY THIS WORKS:
  WDigest authentication is ENABLED on ws01.
  Registry: HKLM\...\WDigest\UseLogonCredential = 1
  Result: cleartext passwords stored in LSASS memory.

TIME: 50 minutes
```

**Talking points**:
- Remote credential dumping (secretsdump from Kali) is preferred because it avoids AV on the target
- WDigest cleartext storage was the default on Server 2008/2012 -- many organizations still have it enabled
- Even without WDigest, NTLM hashes are always available -- pass-the-hash still works
- Students must test every discovered credential against every target -- this is enumeration discipline

**Transition**: "You now have credentials that don't belong to jsmith. Time to see where they take you."

---

## Slide 9: Phase 3 -- Lateral Movement

**Visual**: Highlighted step 3 in the kill chain. Arrow from ws01 to ws02 with credential label.

**Content**:
```
Phase 3: Lateral Movement
ATT&CK: T1021.002 -- Remote Services: SMB/Windows Admin Shares

YOUR TASK:
  1. Use discovered credentials to access ws02
  2. Dump ws02 credentials
  3. Verify your new access level -- can you reach dc01?
  4. Document the credential chain

PASS-THE-HASH (if you only have the NTLM hash):
  impacket-psexec -hashes :<ntlm_hash> domain/user@target

CLEARTEXT (if WDigest gave you the password):
  impacket-psexec domain/user:'password'@target

CREDENTIAL TESTING:
  crackmapexec smb <target> -u <user> -p <pass> -d lab.local
  Look for: (Pwn3d!) = admin access

TIME: 45 minutes
```

**Talking points**:
- Pass-the-hash: the NTLM hash IS the credential for NTLM authentication -- no cracking needed
- This is the fundamental design weakness of NTLM -- the hash is equivalent to the password
- "Pwn3d!" in CrackMapExec means admin access (can write to C$) -- not just authentication
- The pivot from ws01 to ws02 is the moment where a single-machine compromise becomes a network-wide threat

**Transition**: "You're one hop from the domain controller. This is where it gets serious."

---

## Slide 10: Phase 4 -- Domain Compromise

**Visual**: Highlighted step 4 in the kill chain. dc01 highlighted in red. Crown icon on NTDS.dit.

**Content**:
```
Phase 4: Domain Compromise
ATT&CK: T1003.003 -- OS Credential Dumping: NTDS

YOUR TASK:
  1. Access dc01 using escalated credentials
  2. Verify your access level
  3. Extract NTDS.dit -- dump ALL domain password hashes
  4. Identify the krbtgt hash and explain its significance

THE COMMAND:
  impacket-secretsdump domain/user:pass@dc01 -just-dc

WHAT YOU GET:
  - Every domain user's NTLM hash
  - The krbtgt hash (Golden Ticket material)
  - Computer account hashes
  - Service account hashes

TIME: 40 minutes
```

**Talking points**:
- NTDS.dit is the Active Directory database -- it contains every credential in the domain
- secretsdump uses Volume Shadow Copy to read NTDS.dit without stopping the AD service
- The `-just-dc` flag tells secretsdump to only dump domain credentials (skip local SAM)
- This is game over -- there is no recovery without resetting every password in the domain

**Transition**: "You've just done what APT29 did to SolarWinds customers. Let's talk about how to stop it."

---

## Slide 11: The Complete Credential Chain

**Visual**: Vertical flow diagram showing the full chain with credential names at each link.

**Content**:
```
  Phishing campaign
       |
       v
  jsmith / Password123 (provided)
       |
       | impacket-psexec -> ws01 (T1021.002)
       v
  LSASS dump on ws01 (T1003.001)
       |
       +-- svc_sql / Summer2024! (dead end -- no admin)
       |
       +-- agarcia / Welcome2024! (IT admin)
            |
            | impacket-psexec -> ws02 (T1021.002)
            v
       ws02 compromised
            |
            | verified admin on dc01
            v
       dc01 compromised (T1021.002)
            |
            | secretsdump -just-dc (T1003.003)
            v
       ALL DOMAIN HASHES
       (including krbtgt -> Golden Ticket capability)
```

**Talking points**:
- One phishing email, four hops, total domain compromise
- svc_sql was a red herring -- it had no admin rights elsewhere
- The critical link was agarcia's cached credentials on ws01
- Ask students: "At which point would you have stopped the chain if you were a defender?"

**Transition**: "Let's talk about detection. What should a SOC analyst have seen?"

---

## Slide 12: Detection -- Windows Security Event IDs

**Visual**: Table of Event IDs with descriptions and detection value.

**Content**:
```
Event ID  | Source             | What It Tells You
----------|--------------------|-----------------------------------------
4624      | Security           | Successful logon (check Logon Type)
          |                    |   Type 3 = Network (SMB, WinRM)
          |                    |   Type 10 = RemoteInteractive (RDP)
4625      | Security           | Failed logon (credential testing)
4648      | Security           | Explicit credentials used (RunAs, PsExec)
4672      | Security           | Special privileges assigned to logon
          |                    |   (admin logon -- always fires for admins)
4768      | Security (DC)      | Kerberos TGT requested
4769      | Security (DC)      | Kerberos TGS requested
4776      | Security (DC)      | Credential validation (NTLM)
7045      | System             | Service installed (PsExec creates a service)
```

**Talking points**:
- Event ID 4624 Type 3 is the bread and butter of lateral movement detection
- Correlate source IP with expected behavior: "Does jsmith normally log in from the Kali IP?"
- Event 4672 fires every time an admin logs in -- if you see this from an unexpected user, investigate
- PsExec creates a service (Event 7045) named PSEXESVC by default -- trivially detectable
- On the DC, 4776 shows NTLM authentication -- in a Kerberos-default environment, NTLM from a domain user is suspicious

**Transition**: "Beyond event logs, what about endpoint detection?"

---

## Slide 13: Detection -- LSASS Access Monitoring

**Visual**: Sysmon Event ID 10 example log entry showing process access to lsass.exe.

**Content**:
```
Sysmon Event ID 10: Process Access

Source Process:  C:\Windows\Temp\secretsdump_service.exe
Target Process:  C:\Windows\System32\lsass.exe
GrantedAccess:   0x1FFFFF (PROCESS_ALL_ACCESS)
                 0x1010   (PROCESS_QUERY_LIMITED + PROCESS_VM_READ)

Detection Rule:
  IF TargetImage contains "lsass.exe"
  AND SourceImage NOT IN (known_legit_list)
  AND GrantedAccess IN (0x1010, 0x1FFFFF, 0x1F1FFF, 0x143A)
  THEN ALERT: potential credential dumping

Known legitimate LSASS accessors:
  - csrss.exe, services.exe, svchost.exe, winlogon.exe
  - Antivirus processes (vendor-specific)
  - Credential Guard (if configured)
```

**Talking points**:
- Sysmon must be installed and configured to log Event ID 10 -- it is not enabled by default
- The GrantedAccess mask tells you what the source process wanted to do with LSASS
- 0x1FFFFF (PROCESS_ALL_ACCESS) from an unknown binary is a critical alert
- Remote credential dumping (secretsdump from Kali) uploads a service binary that reads LSASS -- the service binary is the detection target
- CrackMapExec --lsa and secretsdump both create temporary service binaries

**Transition**: "Now that we know how to detect it, how do we prevent it entirely?"

---

## Slide 14: Detection -- Pass-the-Hash Indicators

**Visual**: Side-by-side comparison of normal Kerberos logon events vs. NTLM pass-the-hash logon events.

**Content**:
```
Normal Kerberos Logon:                  Pass-the-Hash (NTLM):
  Event 4624                              Event 4624
  Logon Type: 3                           Logon Type: 3
  Auth Package: Kerberos                  Auth Package: NTLM
  Source Network: 10.10.2.50              Source Network: 10.10.1.10
  (user's normal workstation)             (attacker IP -- unexpected)

Detection Pattern:
  1. NTLM authentication for a user who normally uses Kerberos
  2. Source IP does not match user's assigned workstation
  3. Rapid sequential Type 3 logons across multiple hosts
  4. 4672 (admin logon) immediately following 4624 from unexpected source
  5. 7045 (service installed) within seconds of 4624

Sigma Rule Concept:
  title: Potential Lateral Movement via PtH
  detection:
    selection:
      EventID: 4624
      LogonType: 3
      AuthenticationPackageName: NTLM
    filter:
      SourceNetworkAddress|cidr: '10.10.2.0/24'  # expected admin subnet
    condition: selection and not filter
```

**Talking points**:
- In a properly configured AD environment, Kerberos is the default -- NTLM from a domain user is already anomalous
- The source IP is the strongest indicator -- if a user is authenticating from an IP that is not their workstation, investigate
- Rapid sequential logons (same user on 3+ hosts in 5 minutes) is a high-confidence lateral movement indicator
- PsExec service creation (Event 7045) is trivially detectable -- but attackers can use WMI, WinRM, or DCOM to avoid it

**Transition**: "Detection is important, but prevention is better. Let's talk about the controls that would have stopped this attack."

---

## Slide 15: Defense -- Tiered Administration Model

**Visual**: Three-tier pyramid diagram. Tier 0 (Domain Controllers) at top, Tier 1 (Servers) in middle, Tier 2 (Workstations) at bottom. Arrows showing permitted and blocked credential flows.

**Content**:
```
Tier 0: Domain Controllers
  - Domain Admins, Enterprise Admins
  - Only accessible from Tier 0 PAWs
  - Credentials NEVER touch Tier 1 or Tier 2

Tier 1: Member Servers
  - Server Admins
  - Accessible from Tier 1 PAWs
  - Credentials NEVER touch Tier 2

Tier 2: Workstations
  - Helpdesk, workstation admins
  - Standard user workstations
  - Credentials stay at Tier 2

THE RULE: Credentials can only flow DOWN, never UP.
A Tier 0 account logged into a Tier 2 workstation
means Tier 0 credentials are now cached on Tier 2.
Game over.

IN THIS SCENARIO:
  agarcia (Tier 0 equivalent) logged into ws01 (Tier 2).
  This single violation enabled the entire attack chain.
```

**Talking points**:
- Tiered administration is the single most effective defense against lateral movement
- The attack in this scenario was possible because an admin with DC access logged into a workstation
- Microsoft's recommended model: separate accounts for each tier (jsmith-t2 for workstations, jsmith-t1 for servers, jsmith-t0 for DCs)
- This is operationally painful -- admins resist having 3+ accounts -- but it breaks the credential chain
- PAWs (Privileged Access Workstations) enforce this by restricting where admin credentials can be used

**Transition**: "Tiered administration handles the access problem. What about protecting the credentials themselves?"

---

## Slide 16: Defense -- Credential Protection Controls

**Visual**: Four defense mechanisms arranged as layers around a central LSASS icon.

**Content**:
```
1. CREDENTIAL GUARD (Windows 10/11 Enterprise)
   - Isolates LSASS in a hardware-backed VM
   - NTLM hashes and Kerberos tickets protected by hypervisor
   - Even local admin cannot read LSASS memory
   - Breaks: mimikatz, secretsdump, pypykatz

2. PROTECTED USERS SECURITY GROUP
   - Members cannot use NTLM (Kerberos only)
   - No credential caching on workstations
   - No delegation
   - TGT lifetime reduced to 4 hours
   - Breaks: pass-the-hash, credential caching

3. LAPS (Local Administrator Password Solution)
   - Unique, randomized local admin password per machine
   - Stored in AD, rotated automatically
   - Prevents reuse of local admin credentials across machines
   - Breaks: lateral movement via shared local admin passwords

4. DISABLE WDIGEST
   - Registry: UseLogonCredential = 0
   - Prevents cleartext password storage in LSASS
   - Default on Windows 8.1+ / Server 2012 R2+
   - Breaks: cleartext credential extraction (hashes still available)
```

**Talking points**:
- No single control is sufficient -- defense in depth means layering all four
- Credential Guard is the strongest technical control but requires Enterprise edition and compatible hardware
- Protected Users group is free but breaks some legacy applications that require NTLM
- LAPS is essential but only protects local admin accounts, not domain accounts
- Disabling WDigest removes cleartext passwords but NTLM hashes are still extractable

**Transition**: "Let's look at the real-world adversaries who use this exact technique chain."

---

## Slide 17: Real-World APT Context

**Visual**: Timeline showing major incidents that used the lateral movement kill chain.

**Content**:
```
APT29 (Cozy Bear) -- SolarWinds (2020)
  Trojanized update -> credential dumping -> lateral movement -> Golden Ticket
  Impact: 18,000+ organizations compromised

APT28 (Fancy Bear) -- DNC (2016)
  Phishing -> credential harvesting -> lateral movement -> email exfiltration
  Impact: US election interference

Conti Ransomware (2021-2022)
  Phishing/exploit -> Cobalt Strike -> credential dumping -> domain admin
  -> GPO-deployed ransomware to all workstations
  Impact: $180M+ in ransom payments

BlackCat/ALPHV (2023-2024)
  Initial access broker -> RDP -> LSASS dump -> lateral movement -> DC
  -> ransomware + data exfiltration (double extortion)
  Impact: MGM Resorts, Change Healthcare

COMMON PATTERN:
  Every one of these followed: foothold -> dump -> pivot -> DC -> objective
  The techniques are identical. Only the initial access and final objective differ.
```

**Talking points**:
- The attack chain you just executed is not academic -- it is the operational reality of enterprise compromise
- APT29 used Golden Tickets (forged from the krbtgt hash you extracted) to persist for months
- Ransomware operators use domain admin to push ransomware via Group Policy -- one compromised DC means every workstation encrypted
- The speed matters: Conti operators could go from initial access to domain admin in under 2 hours
- Your job as a defender is to break this chain faster than the attacker can execute it

**Transition**: "Let's debrief. Walk me through your attack chain."

---

## Slide 18: Debrief -- Attack Chain Review

**Visual**: Blank attack chain diagram (same layout as Slide 11) for students to fill in.

**Content**:
```
EXERCISE: Reconstruct your attack chain.

For each phase, state:
  1. What tool did you use?
  2. What credential did you use?
  3. What technique ID (ATT&CK)?
  4. What would a defender have seen?

  Phase 1: ____________ -> ws01 using ____________
  Phase 2: Dumped ____________ from ws01
  Phase 3: ____________ -> ws02 using ____________
  Phase 4: ____________ -> dc01 -> ____________

DISCUSSION:
  - Which phase was hardest? Why?
  - Where did you spend the most time?
  - What would you do differently next time?
  - At which point could a defender have stopped you?
```

**Talking points**:
- Have each student (or a few volunteers) walk through their chain
- Compare approaches: who used psexec vs. wmiexec vs. evil-winrm?
- Discuss the svc_sql red herring: who spent time on it? What did they learn?
- Key insight: the hardest part is not the technical execution -- it is the enumeration and credential testing

**Transition**: "Now flip your mindset. You're the defender. What would you have done?"

---

## Slide 19: Debrief -- Breaking the Chain

**Visual**: Same attack chain diagram with red X marks at each defensive breakpoint.

**Content**:
```
                    BREAK POINTS
                    ============

  Phishing -> jsmith creds
     [X] Security awareness training
     [X] MFA on email

  jsmith -> ws01
     [X] Remove unnecessary local admin rights
     [X] MFA on admin protocols (WinRM, SMB)

  LSASS dump on ws01
     [X] Credential Guard
     [X] Disable WDigest
     [X] EDR monitoring LSASS access

  agarcia creds discovered
     [X] Tiered administration (agarcia never logs into workstations)
     [X] Protected Users group (no caching)

  agarcia -> ws02 -> dc01
     [X] Network segmentation (workstations cannot reach DC)
     [X] PAW (DC admin only from hardened workstation)
     [X] Just-in-time access (admin rights expire)

  NTDS.dit extraction
     [X] DC firewall (only permit from PAW subnet)
     [X] Alert on VSS shadow copy creation on DCs
```

**Talking points**:
- Every link in the chain has at least two defensive controls
- The most impactful single control: tiered administration (prevents credential exposure across tiers)
- The most cost-effective quick win: disable WDigest + remove unnecessary local admin rights
- Defense in depth means the attacker must bypass ALL controls, not just one

**Transition**: "Final question before we wrap up."

---

## Slide 20: Debrief -- The krbtgt Question

**Visual**: Golden Ticket diagram showing krbtgt hash used to forge TGT for any user with any group membership.

**Content**:
```
THE KRBTGT HASH

You extracted it in Phase 4. Here is what it means:

  krbtgt is the service account that encrypts all Kerberos TGTs.

  With the krbtgt hash, an attacker can:
    - Forge a TGT for ANY user (including non-existent users)
    - Set ANY group membership (Domain Admins, Enterprise Admins)
    - Set ANY ticket lifetime (10 years if desired)
    - Authenticate to ANY service in the domain

  This is called a GOLDEN TICKET.

  Recovery requires:
    1. Reset krbtgt password TWICE (with 12+ hour gap)
    2. Reset EVERY user password in the domain
    3. Rebuild trust relationships
    4. Assume compromise until verified clean

  BOTTOM LINE:
    If the attacker gets NTDS.dit, the domain is gone.
    Rebuild, don't recover.
```

**Talking points**:
- Golden Tickets survive password resets of individual accounts because they use the krbtgt key
- The krbtgt password must be reset twice because AD keeps the current and previous key
- The 12+ hour gap between resets ensures Kerberos tickets issued with the old key expire
- This is the nuclear option for AD -- complete domain compromise with persistent access
- Prevention is the only viable strategy -- detection and response after NTDS.dit extraction is too late

**Transition**: "Submit your incident reports. Outstanding work today."

---

## Slide 21: Wrap-Up and Assignments

**Visual**: Checklist on dark background.

**Content**:
```
DELIVERABLES (due before next class):

  [ ] Completed Incident Report
      - Timeline with timestamps
      - Credential chain diagram
      - ATT&CK technique mapping
      - Detection opportunities identified
      - Remediation recommendations

  [ ] BONUS: Detection Engineering
      - Write one Sigma rule that detects any phase of this attack
      - Write one Windows Event Log query that identifies lateral movement
      - Explain what data sources are required

FURTHER READING:
  - MITRE ATT&CK: T1003.001, T1003.003, T1021.002
  - Microsoft: Securing Privileged Access
    https://learn.microsoft.com/en-us/security/privileged-access-workstations/overview
  - CISA: Detecting and Preventing Active Directory Compromises
  - Mandiant: APT29 SolarWinds Campaign Technical Analysis
```

**Talking points**:
- Incident report is graded per the rubric in the lesson plan
- Bonus detection engineering exercise is optional but strongly recommended for students pursuing blue team roles
- Next scenario builds on these skills -- understanding lateral movement is prerequisite

---

## Slide 22: ATT&CK Technique Summary

**Visual**: MITRE ATT&CK matrix with the six techniques from this scenario highlighted.

**Content**:
```
TECHNIQUES EXERCISED TODAY:

  Tactic               Technique                              ID
  ------------------   ------------------------------------   ----------
  Execution            Command and Scripting: PowerShell      T1059.001
  Credential Access    OS Credential Dumping: LSASS Memory    T1003.001
  Credential Access    OS Credential Dumping: NTDS            T1003.003
  Credential Access    Kerberoasting                          T1558.003
  Lateral Movement     Remote Services: SMB/Admin Shares      T1021.002
  Persistence          Hijack Execution Flow: DLL Hijack      T1574.001

  Primary chain: T1021.002 -> T1003.001 -> T1021.002 -> T1003.003
  Secondary:     T1059.001 (enumeration), T1558.003 (svc_sql), T1574.001 (ws02)
```

**Talking points**:
- Six techniques, three tactics -- this is a focused, realistic attack chain
- T1021.002 appears twice because lateral movement is iterative (ws01 -> ws02, ws02 -> dc01)
- T1558.003 (Kerberoasting) and T1574.001 (DLL Hijacking) are available but not required for the primary objective
- Students who found and exploited the bonus techniques demonstrated deeper enumeration skills
