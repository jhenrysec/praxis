# Objectives — SCEN-002: Credential Access — Kerberoasting

## Your Mission

You are a penetration tester who has obtained valid domain credentials for `jsmith` (a low-privilege user in the LAB.LOCAL domain) through a simulated social engineering campaign. Your objective is to escalate privileges by exploiting weakly configured service accounts using the Kerberoasting technique.

## Objectives

### Phase 1: Domain Enumeration
1. **Authenticate to the domain** — Verify the jsmith credentials work against the domain controller
2. **Enumerate domain users** — Identify all user accounts, focusing on service accounts
3. **Identify SPN accounts** — Find accounts with Service Principal Names registered

### Phase 2: Kerberoasting
4. **Request TGS tickets** — Use Impacket's GetUserSPNs.py to request Kerberos service tickets for all SPN accounts
5. **Extract ticket hashes** — Save the ticket hashes in a format suitable for offline cracking

### Phase 3: Offline Cracking
6. **Crack the hashes** — Use hashcat (mode 13100) or john with a wordlist to crack the TGS ticket hashes
7. **Validate access** — Use the cracked password to authenticate as the service account

### Phase 4: Advanced (Bonus)
8. **BloodHound mapping** — Run SharpHound/BloodHound to visualize the full AD attack path

## Tools Available
- `impacket-GetUserSPNs` — Kerberos SPN enumeration and TGS extraction
- `hashcat` — GPU-accelerated password cracking
- `john` — CPU password cracking
- `crackmapexec` — AD enumeration and lateral movement
- `ldapsearch` — LDAP enumeration

## Success Criteria
- Extracted TGS hashes saved to a file
- At least one service account password cracked
- Successful authentication using the cracked credentials
- Written explanation of the Kerberoasting attack flow and recommended defenses
