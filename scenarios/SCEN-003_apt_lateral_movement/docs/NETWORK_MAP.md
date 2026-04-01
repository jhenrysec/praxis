# Network Map — SCEN-003: APT Lateral Movement

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Proxmox VE Host (pve01)                        │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────┐      │
│  │  vmbr1 — Red Zone (10.10.<2N-1>.0/24)                    │      │
│  │                                                           │      │
│  │   ┌──────────────────────┐                                │      │
│  │   │  kali-attacker       │                                │      │
│  │   │  .10                 │──── dual-homed ──────┐         │      │
│  │   │  Impacket, CME,      │                      │         │      │
│  │   │  pypykatz, hashcat   │                      │         │      │
│  │   └──────────────────────┘                      │         │      │
│  └─────────────────────────────────────────────────│─────────┘      │
│                                                     │                │
│  ┌─────────────────────────────────────────────────│─────────┐      │
│  │  vmbr2 — Blue Zone (10.10.<2N>.0/24)            │         │      │
│  │  Domain: lab.local                               │         │      │
│  │                                                  │         │      │
│  │   ┌──────────────┐  ┌──────────────┐  ┌─────────▼──────┐ │      │
│  │   │  dc01         │  │  ws01         │  │  ws02          │ │      │
│  │   │  .20          │  │  .30          │  │  .40           │ │      │
│  │   │  DC, DNS      │  │  Foothold     │  │  Pivot target  │ │      │
│  │   │  Kerberos KDC │  │  WDigest ON   │  │  agarcia admin │ │      │
│  │   │               │  │  jsmith admin │  │                │ │      │
│  │   └───────▲───────┘  └───────────────┘  └────────────────┘ │      │
│  │           │                                                 │      │
│  │           └── agarcia has local admin on dc01 ──────────────┘      │
│  └───────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

## IP Addressing (Slot N)

| VM | Bridge | IP | Key Ports |
|---|---|---|---|
| kali-attacker | vmbr1 + vmbr2 | 10.10.(2N-1).10 | — |
| dc01 | vmbr2 | 10.10.(2N).20 | 88, 389, 445, 636 |
| ws01 | vmbr2 | 10.10.(2N).30 | 445, 5985 |
| ws02 | vmbr2 | 10.10.(2N).40 | 445, 5985 |

## Attack Path

```
1. kali → psexec/winrm → ws01 (jsmith creds)           [T1021.002]
2. ws01 → LSASS dump → extract agarcia hash/cleartext   [T1003.001]
3. kali → psexec (agarcia) → ws02                       [T1021.002]
4. ws02 → secretsdump → confirm agarcia admin on dc01   [T1003.001]
5. kali → psexec (agarcia) → dc01                       [T1021.002]
6. dc01 → secretsdump -just-dc → NTDS.dit dump          [T1003.003]
```
