# Objectives — SCEN-003: APT Lateral Movement

## Your Mission

You are a penetration tester simulating an APT intrusion. Through a phishing campaign, you obtained valid domain credentials for `jsmith` — a standard user with local admin rights on workstation ws01. Your objective is to move laterally through the AD environment and ultimately compromise the domain controller.

## Objectives

### Phase 1: Initial Foothold
1. **Access ws01** — Use jsmith credentials to establish a remote session on ws01 (WinRM, SMB, or PsExec)
2. **Situational awareness** — Enumerate the domain, local groups, network shares, and cached credentials

### Phase 2: Credential Dumping
3. **Dump LSASS** — Extract credential material from ws01's LSASS process (NTLM hashes, WDigest cleartext)
4. **Identify pivot accounts** — Determine which dumped credentials have access to other systems

### Phase 3: Lateral Movement
5. **Move to ws02** — Use dumped credentials (pass-the-hash or cleartext) to access ws02
6. **Dump additional credentials** — Extract credentials from ws02 that have elevated domain privileges

### Phase 4: Domain Compromise
7. **Compromise dc01** — Use the escalated credentials to access the domain controller
8. **Extract NTDS.dit** (Bonus) — Dump all domain password hashes using secretsdump

## Tools Available
- `impacket` suite (secretsdump, psexec, smbexec, wmiexec)
- `crackmapexec` — AD enumeration and credential validation
- `pypykatz` — Python Mimikatz for LSASS parsing
- `evil-winrm` — WinRM shell
- `hashcat` / `john` — Offline password cracking

## Success Criteria
- Documented credential chain: jsmith → [dumped creds] → [pivot creds] → Domain Admin
- Evidence of DC compromise (screenshot of whoami /all as Domain Admin, or NTDS.dit dump)
- Written attack timeline with MITRE ATT&CK technique IDs for each step
