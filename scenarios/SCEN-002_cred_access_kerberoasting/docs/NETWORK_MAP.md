# Network Map — SCEN-002: Kerberoasting

```
┌─────────────────────────────────────────────────────────────────┐
│                    Proxmox VE Host (pve01)                      │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  vmbr1 — Red Zone (10.10.<2N-1>.0/24)                  │    │
│  │                                                         │    │
│  │   ┌──────────────────────┐                              │    │
│  │   │  kali-attacker       │                              │    │
│  │   │  .10                 │                              │    │
│  │   │  Kali 2024.4         │──── dual-homed ───┐          │    │
│  │   │  impacket, hashcat,  │                   │          │    │
│  │   │  crackmapexec        │                   │          │    │
│  │   └──────────────────────┘                   │          │    │
│  └─────────────────────────────────────────────│──────────┘    │
│                                                 │               │
│  ┌─────────────────────────────────────────────│──────────┐    │
│  │  vmbr2 — Blue Zone (10.10.<2N>.0/24)        │          │    │
│  │  Domain: lab.local                           │          │    │
│  │                                              │          │    │
│  │   ┌──────────────────────┐    ┌─────────────▼────────┐ │    │
│  │   │  dc01                │    │  ws01                 │ │    │
│  │   │  .20                 │    │  .30                  │ │    │
│  │   │  Win Server 2022     │    │  Win Server 2022      │ │    │
│  │   │  Domain Controller   │    │  Domain Member        │ │    │
│  │   │                      │    │                       │ │    │
│  │   │  AD DS, DNS, DHCP    │    │  Cached logons: 10    │ │    │
│  │   │  Kerberos KDC        │    │                       │ │    │
│  │   │                      │    │                       │ │    │
│  │   │  SPN accounts:       │    │                       │ │    │
│  │   │   svc_sql (WEAK)     │    │                       │ │    │
│  │   │   svc_backup         │    │                       │ │    │
│  │   └──────────────────────┘    └───────────────────────┘ │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

## IP Addressing (Slot N)

| VM | Bridge | IP | Ports |
|---|---|---|---|
| kali-attacker | vmbr1 + vmbr2 | 10.10.(2N-1).10 | — |
| dc01 | vmbr2 | 10.10.(2N).20 | 88 (Kerberos), 389 (LDAP), 445 (SMB) |
| ws01 | vmbr2 | 10.10.(2N).30 | 445 (SMB), 3389 (RDP) |

## Attack Path

```
kali (jsmith creds)
  │
  ├── 1. crackmapexec → verify domain creds
  ├── 2. GetUserSPNs.py → enumerate SPNs
  ├── 3. GetUserSPNs.py -request → extract TGS tickets
  ├── 4. hashcat -m 13100 → crack ticket hashes (offline)
  └── 5. psexec/smbexec → authenticate as svc_sql
```
