# Detection Exercise — SCEN-002: Kerberoasting Detection and Defense

**Focus**: Blue team detection of Kerberoasting activity using Windows event logs, network analysis, and proactive defense techniques.

This exercise can be run as a standalone blue team module or as a follow-up to the red team Kerberoasting lab.

---

## Prerequisites

- Access to dc01 (Domain Controller) via RDP or WinRM
- Familiarity with Windows Event Viewer and PowerShell
- Basic understanding of Kerberos authentication (covered in the briefing slides)

---

## Part 1: Understanding Event ID 4769

Windows Security Event ID 4769 is logged every time the KDC issues a Kerberos Service Ticket (TGS). This is the primary detection artifact for Kerberoasting.

### 1.1 Examine a Normal Event ID 4769

RDP to dc01 or use PowerShell remoting. Open Event Viewer or run:

```powershell
Get-WinEvent -FilterHashtable @{
    LogName = 'Security'
    Id = 4769
} -MaxEvents 10 | Format-List TimeCreated, Message
```

A normal Event ID 4769 entry contains these fields:

| Field | Description | Normal Value |
|---|---|---|
| Account Name | User who requested the ticket | Machine account or service account |
| Service Name | SPN that was requested | The target service |
| Client Address | IP of the requesting machine | Known server IP |
| Ticket Encryption Type | Encryption algorithm | 0x12 (AES-256) |
| Ticket Options | Kerberos flags | 0x40810000 |

### 1.2 Identify Key Fields

For each Event ID 4769 entry, extract and document:

```powershell
Get-WinEvent -FilterHashtable @{
    LogName = 'Security'
    Id = 4769
} -MaxEvents 50 | ForEach-Object {
    $xml = [xml]$_.ToXml()
    $data = $xml.Event.EventData.Data
    [PSCustomObject]@{
        Time           = $_.TimeCreated
        AccountName    = ($data | Where-Object Name -eq 'TargetUserName').'#text'
        ServiceName    = ($data | Where-Object Name -eq 'ServiceName').'#text'
        ClientAddress  = ($data | Where-Object Name -eq 'IpAddress').'#text'
        EncryptionType = ($data | Where-Object Name -eq 'TicketEncryptionType').'#text'
        Status         = ($data | Where-Object Name -eq 'Status').'#text'
    }
} | Format-Table -AutoSize
```

**Questions to answer**:
1. What is the most common encryption type in normal operations?
2. Which accounts are requesting TGS tickets under normal conditions?
3. What source IPs are generating TGS requests?

---

## Part 2: Detecting Kerberoasting in Event Logs

After the red team phase of the lab (or after the instructor triggers a simulated Kerberoasting attack), examine the event logs for indicators.

### 2.1 Hunt for RC4 TGS Requests

Kerberoasting tools default to requesting RC4 (etype 23 / 0x17) encrypted tickets because they are fastest to crack. This is the strongest single indicator.

```powershell
# Find all TGS requests with RC4 encryption (0x17 = decimal 23)
Get-WinEvent -FilterHashtable @{
    LogName = 'Security'
    Id = 4769
} | Where-Object {
    $xml = [xml]$_.ToXml()
    $encType = ($xml.Event.EventData.Data | Where-Object Name -eq 'TicketEncryptionType').'#text'
    $encType -eq '0x17'
} | ForEach-Object {
    $xml = [xml]$_.ToXml()
    $data = $xml.Event.EventData.Data
    [PSCustomObject]@{
        Time           = $_.TimeCreated
        AccountName    = ($data | Where-Object Name -eq 'TargetUserName').'#text'
        ServiceName    = ($data | Where-Object Name -eq 'ServiceName').'#text'
        ClientAddress  = ($data | Where-Object Name -eq 'IpAddress').'#text'
        EncryptionType = ($data | Where-Object Name -eq 'TicketEncryptionType').'#text'
    }
} | Format-Table -AutoSize
```

**What to look for**:
- Encryption Type `0x17` (RC4) instead of `0x12` (AES-256) — modern domains should use AES
- Multiple RC4 TGS requests in a short time window (seconds apart) — normal service ticket requests are spaced out over hours
- Requests originating from an unusual IP (not the server that normally uses that service)
- Requests from a user account (jsmith) rather than a machine account

### 2.2 Identify Bulk TGS Requests

Kerberoasting tools request tickets for all SPNs at once. Normal service operations request one ticket at a time, spread across normal business operations.

```powershell
# Group TGS requests by source IP and time window (5-minute buckets)
Get-WinEvent -FilterHashtable @{
    LogName = 'Security'
    Id = 4769
} | ForEach-Object {
    $xml = [xml]$_.ToXml()
    $data = $xml.Event.EventData.Data
    [PSCustomObject]@{
        TimeBucket     = $_.TimeCreated.ToString("yyyy-MM-dd HH:mm")
        ClientAddress  = ($data | Where-Object Name -eq 'IpAddress').'#text'
        ServiceName    = ($data | Where-Object Name -eq 'ServiceName').'#text'
        EncryptionType = ($data | Where-Object Name -eq 'TicketEncryptionType').'#text'
    }
} | Group-Object TimeBucket, ClientAddress | Where-Object { $_.Count -gt 3 } |
    Select-Object Count, Name | Format-Table -AutoSize
```

**Threshold guidance**: More than 3 TGS requests from the same source IP within 5 minutes targeting different SPNs is suspicious. Adjust based on your environment's baseline.

### 2.3 Correlate with Logon Events

Cross-reference the Kerberoasting source with Event ID 4624 (logon) to identify which account initiated the attack.

```powershell
# Find logon events from the suspected attacker IP
$attackerIP = "<kali_ip>"  # Replace with the IP you identified

Get-WinEvent -FilterHashtable @{
    LogName = 'Security'
    Id = 4624
} | Where-Object {
    $xml = [xml]$_.ToXml()
    $ip = ($xml.Event.EventData.Data | Where-Object Name -eq 'IpAddress').'#text'
    $ip -eq $attackerIP
} | ForEach-Object {
    $xml = [xml]$_.ToXml()
    $data = $xml.Event.EventData.Data
    [PSCustomObject]@{
        Time        = $_.TimeCreated
        Account     = ($data | Where-Object Name -eq 'TargetUserName').'#text'
        LogonType   = ($data | Where-Object Name -eq 'LogonType').'#text'
        SourceIP    = ($data | Where-Object Name -eq 'IpAddress').'#text'
    }
} | Format-Table -AutoSize
```

**Document**: Which account logged in from the attacker IP? Was it jsmith? This links the enumeration activity to a specific compromised account.

---

## Part 3: Writing Detection Rules

### 3.1 Sigma Rule

Write a Sigma detection rule for Kerberoasting. Sigma is a vendor-neutral detection format that can be converted to Splunk SPL, Elastic KQL, Microsoft Sentinel, and others.

```yaml
title: Kerberoasting — RC4 TGS Ticket Request from Non-Server Source
id: <generate-uuid>
status: experimental
description: >
    Detects Kerberos Service Ticket (TGS) requests using RC4 encryption
    (etype 23) originating from workstation or unknown IPs. Kerberoasting
    tools request RC4 tickets because they are fastest to crack offline.
references:
    - https://attack.mitre.org/techniques/T1558/003/
    - https://adsecurity.org/?p=2293
author: <your-name>
date: <today>
tags:
    - attack.credential_access
    - attack.t1558.003
logsource:
    product: windows
    service: security
detection:
    selection:
        EventID: 4769
        TicketEncryptionType: '0x17'
        Status: '0x0'
    filter_machine_accounts:
        ServiceName|endswith: '$'
    filter_known_servers:
        IpAddress:
            - '<sql_server_ip>'
            - '<exchange_server_ip>'
            # Add all IPs of servers that legitimately request
            # TGS tickets for their own SPNs
    condition: selection and not filter_machine_accounts and not filter_known_servers
falsepositives:
    - Legacy applications that require RC4 Kerberos encryption
    - Misconfigured service accounts
level: high
```

**Student task**: Complete the Sigma rule above by filling in the filter_known_servers section with the legitimate server IPs from your environment. Consider what false positives might occur and how to tune them.

### 3.2 Splunk SPL Query (if Splunk is available)

```spl
index=wineventlog EventCode=4769 TicketEncryptionType=0x17 Status=0x0
| where NOT match(ServiceName, "\$$")
| where NOT cidrmatch("10.10.0.0/16", ClientAddress)
| stats count by TargetUserName, ServiceName, ClientAddress, _time
| where count > 2
| sort - _time
```

### 3.3 PowerShell Scheduled Detection Script

For environments without a SIEM, a scheduled PowerShell task can provide basic detection:

```powershell
# kerberoast_detect.ps1 — Run as scheduled task every 5 minutes
# Alerts on RC4 TGS requests from non-whitelisted sources

$whitelistedIPs = @(
    # Add IPs of servers that legitimately request TGS tickets
    # "<sql_server_ip>",
    # "<exchange_server_ip>"
)

$suspiciousEvents = Get-WinEvent -FilterHashtable @{
    LogName   = 'Security'
    Id        = 4769
    StartTime = (Get-Date).AddMinutes(-5)
} -ErrorAction SilentlyContinue | Where-Object {
    $xml = [xml]$_.ToXml()
    $data = $xml.Event.EventData.Data
    $encType = ($data | Where-Object Name -eq 'TicketEncryptionType').'#text'
    $clientIP = ($data | Where-Object Name -eq 'IpAddress').'#text'
    $svcName = ($data | Where-Object Name -eq 'ServiceName').'#text'

    $encType -eq '0x17' -and
    $clientIP -notin $whitelistedIPs -and
    $svcName -notmatch '\$$'
}

if ($suspiciousEvents.Count -gt 0) {
    $alertBody = "ALERT: Potential Kerberoasting detected`n"
    $alertBody += "Events: $($suspiciousEvents.Count)`n"
    $alertBody += "Time: $(Get-Date)`n`n"

    foreach ($evt in $suspiciousEvents) {
        $xml = [xml]$evt.ToXml()
        $data = $xml.Event.EventData.Data
        $alertBody += "  Service: $(($data | Where-Object Name -eq 'ServiceName').'#text')`n"
        $alertBody += "  Source:  $(($data | Where-Object Name -eq 'IpAddress').'#text')`n"
        $alertBody += "  Time:    $($evt.TimeCreated)`n`n"
    }

    # Write alert to a local log file
    $alertBody | Out-File -Append "C:\SecurityAlerts\kerberoast_alerts.log"

    # Write to Windows Application event log
    Write-EventLog -LogName Application -Source "KerberoastDetect" `
        -EventId 9001 -EntryType Warning -Message $alertBody
}
```

**Student task**: Review this script and answer:
1. Why does the script filter out service names ending in `$`?
2. What is the purpose of the whitelisted IPs?
3. What would you add to reduce false positives?
4. How would you extend this to send an email or Slack alert?

---

## Part 4: Proactive Defense — Honeypot SPNs

A honeypot SPN is a fake service account with an SPN registered in Active Directory. No legitimate service uses it. Any TGS request for this SPN is guaranteed to be malicious — providing zero-false-positive detection.

### 4.1 Honeypot SPN Design Principles

1. **The account must look real** — name it something an attacker would target (e.g., `svc_sharepoint`, `svc_citrix`, `svc_sccm`)
2. **The SPN must look legitimate** — use a realistic SPN format (e.g., `HTTP/sharepoint.lab.local`)
3. **The password must be strong** — 30+ characters. The goal is detection, not compromise.
4. **The account must have no real permissions** — it should not be a member of any privileged groups
5. **Alerting must be immediate** — any Event ID 4769 for this SPN triggers an alert

### 4.2 Creating a Honeypot SPN (Conceptual)

```powershell
# Create the honeypot service account
New-ADUser -Name "svc_sharepoint" `
    -SamAccountName "svc_sharepoint" `
    -UserPrincipalName "svc_sharepoint@lab.local" `
    -Description "SharePoint Application Pool Service Account" `
    -AccountPassword (ConvertTo-SecureString "X#9kL2$mP7@wR4vN8!qJ5yT0bF3hG6c" -AsPlainText -Force) `
    -Enabled $true `
    -PasswordNeverExpires $true `
    -CannotChangePassword $true

# Register a realistic SPN
Set-ADUser -Identity "svc_sharepoint" `
    -ServicePrincipalNames @{Add="HTTP/sharepoint.lab.local"}

# Verify the SPN is visible
Get-ADUser -Identity "svc_sharepoint" -Properties ServicePrincipalName |
    Select-Object Name, ServicePrincipalName
```

### 4.3 Honeypot Detection Rule

```powershell
# Monitor for any TGS request targeting the honeypot SPN
$honeypotSPNs = @("svc_sharepoint")

Get-WinEvent -FilterHashtable @{
    LogName = 'Security'
    Id = 4769
} | Where-Object {
    $xml = [xml]$_.ToXml()
    $svcName = ($xml.Event.EventData.Data | Where-Object Name -eq 'ServiceName').'#text'
    $svcName -in $honeypotSPNs
} | ForEach-Object {
    $xml = [xml]$_.ToXml()
    $data = $xml.Event.EventData.Data

    # HIGH CONFIDENCE ALERT — any request for this SPN is malicious
    Write-Warning "HONEYPOT TRIGGERED: Kerberoasting detected!"
    Write-Warning "  Source IP: $(($data | Where-Object Name -eq 'IpAddress').'#text')"
    Write-Warning "  Account:  $(($data | Where-Object Name -eq 'TargetUserName').'#text')"
    Write-Warning "  Time:     $($_.TimeCreated)"
}
```

### 4.4 Discussion Questions

1. **Why is a honeypot SPN more reliable than generic Event ID 4769 monitoring?**
   - Expected answer: Zero false positives. No legitimate service ever requests a TGS for this SPN. Any request is definitively malicious. Generic 4769 monitoring requires baselining and tuning to avoid false positives from legitimate service ticket requests.

2. **How many honeypot SPNs should you deploy?**
   - Expected answer: At least 2-3, with names that match services attackers commonly target (SQL, SharePoint, Exchange, SCCM, Citrix). If the attacker requests tickets for ALL SPNs (which most tools do by default), a single honeypot is sufficient. Multiple honeypots guard against targeted attackers who selectively request tickets.

3. **What happens if the attacker checks whether the service is actually running before requesting a ticket?**
   - Expected answer: Sophisticated attackers may verify that the SPN resolves to an active service before requesting tickets. Countermeasure: create a DNS A record pointing to a real IP, or even run a dummy listener on the expected port. Most Kerberoasting tools do not perform this check.

4. **Could an attacker detect that an SPN is a honeypot?**
   - Expected answer: Potentially, by checking if the account has recent logon activity (honeypots typically have no last logon), or by verifying the service is actually running. Good honeypot hygiene includes simulating occasional logon activity and maintaining realistic account attributes.

---

## Part 5: Detection Exercise Deliverables

Submit the following to your instructor:

1. **Event Log Analysis Report**
   - Number of Event ID 4769 entries with RC4 encryption
   - Source IPs that generated suspicious TGS requests
   - Accounts targeted by the Kerberoasting attempt
   - Timeline: when did the attack occur (from the logs)?

2. **Detection Rule**
   - A completed Sigma rule, Splunk query, or PowerShell script that would detect the Kerberoasting activity you observed
   - Document any tuning decisions (why you whitelisted certain IPs, what thresholds you chose)

3. **Honeypot SPN Proposal**
   - Propose 3 honeypot SPN accounts for this environment
   - For each: account name, SPN value, description field, and alerting method
   - Explain why you chose those service names

4. **Detection Gap Analysis**
   - Which phases of the Kerberoasting attack are detectable? Which are not?
   - What additional logging or tooling would you recommend to improve detection coverage?

---

## Encryption Type Reference

| Hex Value | Decimal | Algorithm | Cracking Difficulty |
|---|---|---|---|
| 0x17 | 23 | RC4-HMAC | Easy — fastest to crack |
| 0x11 | 17 | AES128-CTS-HMAC-SHA1 | Moderate |
| 0x12 | 18 | AES256-CTS-HMAC-SHA1 | Hard — slowest to crack |

Modern domains should default to AES-256 (0x12). RC4 (0x17) TGS requests from user accounts are a strong Kerberoasting indicator.

---

## Further Reading

- MITRE ATT&CK T1558.003: https://attack.mitre.org/techniques/T1558/003/
- Microsoft: Monitoring AD for Signs of Compromise: https://learn.microsoft.com/en-us/windows-server/identity/ad-ds/plan/security-best-practices/monitoring-active-directory-for-signs-of-compromise
- Sean Metcalf — Detecting Kerberoasting: https://adsecurity.org/?p=3458
- Trimarc — Detecting Kerberoasting Activity: https://www.trimarcsecurity.com/post/trimarcresearch-detecting-kerberoasting-activity
