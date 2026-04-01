# Slides Content — ICS/OT Pivot: IT to OT Kill Chain

**Scenario**: SCEN-004
**Duration**: 5 hours
**Intended use**: Instructor presents during Briefing phase and references during Debrief. Individual slides can be shown before each phase as context.

---

## Slide: Title

**Visual**: Dark background with scenario title, ATT&CK Enterprise + ICS logos side by side.

```
SCEN-004: ICS/OT Pivot — IT to OT Kill Chain
Difficulty: Expert | Duration: 5 hours | VMs: 6 across 3 zones
ATT&CK Enterprise: T1021.002, T1003.001, T1558.003, T1021.004
ATT&CK ICS: T0846, T0842, T0855, T0836
```

**Talking points**:
- This is the capstone scenario — it chains everything from SCEN-001 through SCEN-003
- First time working across all three network zones simultaneously
- Mirrors the attack pattern used in every major ICS incident since 2015

**Transition**: "Let's start with why this matters."

---

## Slide: The IT/OT Convergence Threat Landscape

**Visual**: Timeline graphic showing major ICS attacks from 2010 to present.

```
2010  Stuxnet           Iran nuclear centrifuges (air-gapped, USB delivery)
2015  BlackEnergy       Ukrainian power grid (IT spearphish → OT pivot)
2016  CRASHOVERRIDE     Ukrainian power grid (automated ICS payload)
2017  TRITON/TRISIS     Saudi petrochemical (IT → OT → safety systems)
2021  Oldsmar           Florida water treatment (direct HMI access)
2021  Colonial Pipeline  US fuel pipeline (IT ransomware, OT shut down preemptively)
2023+ Volt Typhoon       US critical infrastructure (IT pre-positioning, OT capability assessed)
```

**Talking points**:
- The trend is clear: attackers are moving from IT-only attacks to IT→OT kill chains
- Before 2015, ICS attacks were rare and required nation-state resources (Stuxnet)
- Today, the tools and techniques for IT→OT pivoting are well-documented and accessible
- Volt Typhoon represents a shift: pre-positioning for future conflict, not immediate exploitation
- Colonial Pipeline shows that even an IT-only attack can shut down OT operations (fear-based OT shutdown)

**Transition**: "To understand why the pivot works, we need to understand how ICS networks are supposed to be structured."

---

## Slide: The Purdue Enterprise Reference Architecture

**Visual**: Layered diagram showing Purdue Model levels 0-5.

```
Level 5  ┌─────────────────────────┐  Enterprise Network
         │  Email, ERP, Internet   │  (Corporate IT)
         └────────────┬────────────┘
                      │
Level 4  ┌────────────┴────────────┐  Site Business Planning
         │  Domain Controller      │  Active Directory, DNS
         │  File Servers           │
         └────────────┬────────────┘
                      │
         ════════════════════════════  IT/OT BOUNDARY (DMZ)
                      │
Level 3  ┌────────────┴────────────┐  Site Operations
         │  Engineering            │  HMI, Historian,
         │  Workstation            │  Engineering Tools
         └────────────┬────────────┘
                      │
Level 2  ┌────────────┴────────────┐  Area Supervisory Control
         │  SCADA Server           │  Data Collection,
         │  Historian              │  Alarm Management
         └────────────┬────────────┘
                      │
Level 1  ┌────────────┴────────────┐  Basic Control
         │  PLC / RTU / DCS        │  Process Control
         └────────────┬────────────┘
                      │
Level 0  ┌────────────┴────────────┐  Physical Process
         │  Sensors, Actuators     │  Pumps, Valves, Motors
         │  Physical Equipment     │
         └─────────────────────────┘
```

**Talking points**:
- The Purdue Model is the reference architecture for ICS network segmentation (ISA-95/IEC 62264)
- Each level boundary should have access controls — firewalls, ACLs, data diodes
- Level 3 is the critical boundary: engineering workstations legitimately need access to both IT (Level 4) and OT (Level 2/1)
- Today's attack will violate every level boundary from 5 down to 0
- The IT/OT boundary (between Level 4 and Level 3) is where most organizations focus their security — but it is also where the most legitimate traffic crosses

**Transition**: "Now let's look at the specific lab environment you will be attacking."

---

## Slide: Lab Network Architecture

**Visual**: Three-zone network diagram matching NETWORK_MAP.md.

```
┌─────────────────────┐     ┌───────────────────────────────────┐
│  RED ZONE (vmbr1)   │     │  BLUE ZONE / IT (vmbr2)           │
│                     │     │  Domain: lab.local                │
│  kali-attacker      │─────│                                   │
│  .10                │     │  dc01          eng-ws              │
│  Attack platform    │     │  .20           .50                 │
│                     │     │  DC, DNS, KDC  Engineering WS      │
└─────────────────────┘     │               DUAL-HOMED ──────┐  │
                            └───────────────────────────────│──┘
                                                            │
                            ┌───────────────────────────────│──┐
                            │  OT ZONE (vmbr3)              │  │
                            │  *** NO DIRECT ROUTE ***      │  │
                            │                               │  │
                            │  openplc-01   historian   grfics │
                            │  .10          .20         .30    │
                            │  Modbus:502   Grafana     HMI    │
                            │  WebUI:8080   InfluxDB    :8080  │
                            └──────────────────────────────────┘
```

**Talking points**:
- Three zones, three bridges, six VMs
- kali-attacker is dual-homed: Red zone + Blue zone (simulating external access + phishing foothold)
- eng-ws is dual-homed: Blue zone + OT zone (the critical pivot point)
- OT zone has NO direct route from Red or Blue — the only path is through eng-ws
- openplc-01 runs Modbus TCP on port 502 — no authentication

**Transition**: "You have one credential: jsmith / Password123. Here is the kill chain you need to execute."

---

## Slide: The Kill Chain Overview

**Visual**: Horizontal arrow diagram showing four phases with technique IDs.

```
Phase 1                Phase 2                 Phase 3              Phase 4
IT FOOTHOLD            CREDENTIAL              OT ZONE              ICS
                       ESCALATION              PIVOT                EXPLOITATION

jsmith → dc01          Kerberoast              SSH to eng-ws        Modbus recon
AD enumeration         svc_scada               Discover OT NIC      Read registers
                       Crack hash              SSH tunnel            Write setpoints
                       Find eng_admin                                Disable pump

T1021.002              T1558.003               T1021.004            T0846
                       T1003.001                                    T0842
                                                                    T0855
                                                                    T0836
```

**Talking points**:
- Four phases, eight ATT&CK techniques (four Enterprise, four ICS)
- Each phase depends on the previous — you cannot skip ahead
- Phase 3 (the pivot) is the hardest and most time-consuming
- Phase 4 is straightforward IF you have a working tunnel — Modbus has no defenses once reachable
- The credential chain: jsmith → svc_scada (Kerberoast) → eng_admin (dump/enum) → eng-ws → OT

**Transition**: "Let's walk through Phase 1."

---

## Slide: Phase 1 — IT Foothold

**Visual**: Diagram showing kali → dc01 connection path with protocol labels.

```
kali-attacker ──── SMB/445 ────► dc01
                                 │
                                 ├── net user /domain
                                 ├── net group "Domain Admins" /domain
                                 └── net user svc_scada /domain
```

**Talking points**:
- Starting point: valid domain credentials from a simulated phishing campaign
- Goal: establish a session on dc01 and enumerate Active Directory
- Tools: impacket-psexec, evil-winrm, or crackmapexec for initial access
- Standard AD enumeration: users, groups, computers, service accounts
- Key discoveries: svc_scada (has SPN → Kerberoastable), eng_admin (engineering access)

**Key commands**:
```bash
crackmapexec smb <dc01_ip> -u jsmith -p 'Password123' -d lab.local
impacket-psexec lab.local/jsmith:'Password123'@<dc01_ip>
net user /domain
net user svc_scada /domain
```

**Transition**: "Once you know svc_scada has an SPN, it is time to Kerberoast."

---

## Slide: Phase 2 — Credential Escalation (Kerberoasting)

**Visual**: Kerberos ticket flow diagram.

```
           ┌────────┐
           │  KDC   │
           │ (dc01) │
           └───┬────┘
    TGS-REQ   │   TGS-REP
   (RC4 enc)  │  (encrypted with
               │   svc_scada's
               │   password hash)
           ┌───┴────┐
           │  kali  │──── hashcat ──── cracked password
           └────────┘
```

**Talking points**:
- Any domain user can request a TGS ticket for any SPN-registered account
- The TGS ticket is encrypted with the service account's NTLM hash
- If the password is weak, the hash can be cracked offline — no lockout, no detection (unless monitoring 4769 events)
- Hashcat mode 13100 for Kerberos 5 TGS-REP (RC4)
- Detection: Event ID 4769 with encryption type 0x17 (RC4-HMAC) — normal requests use AES (0x12)

**Key commands**:
```bash
impacket-GetUserSPNs lab.local/jsmith:'Password123' -dc-ip <dc01> -request
hashcat -m 13100 svc_scada.hash /usr/share/wordlists/rockyou.txt
```

**Transition**: "With svc_scada cracked, you need to find eng_admin's credentials."

---

## Slide: Phase 2 — Credential Escalation (Getting eng_admin)

**Visual**: Decision tree showing credential discovery paths.

```
svc_scada cracked
     │
     ├── Path A: WDigest dump
     │   impacket-secretsdump → eng_admin cleartext in LSASS
     │
     ├── Path B: Share enumeration
     │   crackmapexec --shares --spider-shares → credential files
     │
     └── Path C: Further enumeration
         svc_scada access → engineering shares → config files
```

**Talking points**:
- Multiple valid paths — real attacks use whatever works
- WDigest stores cleartext credentials in LSASS memory when enabled (disabled by default since 2012 R2, but often re-enabled by misconfig or attacker)
- Share enumeration can reveal scripts, configs, or batch files with hardcoded credentials
- Detection: LSASS access (Sysmon Event ID 10), share access patterns (Event ID 5145)

**Transition**: "Now for the hard part — pivoting into the OT zone."

---

## Slide: Phase 3 — The Pivot (SSH Tunneling)

**Visual**: Detailed tunnel diagram showing the SSH connection and forwarded traffic.

```
                        SSH TUNNEL
kali ─────────────────────────────────────── eng-ws
      Blue zone (vmbr2)     │                  │
                            │              eth0: Blue
                     SOCKS5 or             eth1: OT
                     local fwd                 │
                            │                  │
                            └──────────────────┼──► openplc-01:502
                                               ├──► historian:3000
                                               └──► grfics:8080
                                            OT zone (vmbr3)
```

**Talking points**:
- eng-ws is the only host with interfaces on both Blue and OT networks
- SSH dynamic port forwarding (`-D 1080`) creates a SOCKS5 proxy — any tool can route through it
- SSH local port forwarding (`-L 5502:target:502`) maps specific ports — simpler but less flexible
- The `-N` flag is critical — no remote command, just the tunnel
- proxychains routes tools through the SOCKS proxy transparently
- This is the step where most students get stuck — the concept of routing traffic through a tunnel is non-obvious

**Key commands**:
```bash
# SOCKS proxy approach
ssh -D 1080 -N eng_admin@<eng_ws_ip>
proxychains nmap -sT -p 502 192.168.x.10

# Local port forward approach
ssh -L 5502:192.168.x.10:502 -L 3000:192.168.x.20:3000 -N eng_admin@<eng_ws_ip>
python3 modbus_recon.py  # connects to 127.0.0.1:5502
```

**Transition**: "Once through the tunnel, Modbus has no defenses."

---

## Slide: Phase 4 — ICS Exploitation (Modbus TCP)

**Visual**: Modbus register map table and attack flow.

```
OpenPLC Register Map — tank_fill_control.st

Register        Address   Type   Default   Attack Impact
Pump Enable     Coil 0    R/W    ON        Disable → tank drains
Tank Level      IR 0      R      ~500      Read-only sensor
Pump Speed      HR 0      R/W    ~750      Overwritten by PLC logic
Setpoint        HR 1024   R/W    750       Change → over/underfill
Alarm High      HR 1025   R/W    900       Raise → suppress alarms
Alarm Low       HR 1026   R/W    200       Lower → suppress alarms

Attack sequence:
1. Read all registers → understand the process
2. Write HR 1024 = 200 → lower setpoint (drain attack)
3. Write Coil 0 = False → disable pump
4. Write HR 1025 = 9999, HR 1026 = 0 → suppress alarms
```

**Talking points**:
- Modbus TCP: no authentication, no encryption, no authorization
- Any host that reaches port 502 can read and write any register
- FC03 (Read Holding Register), FC04 (Read Input Register), FC01 (Read Coils) for recon
- FC06 (Write Single Register), FC05 (Write Single Coil) for manipulation
- The PLC will execute whatever values are in its registers — it does not know or care who wrote them
- Alarm suppression (modifying thresholds) is how sophisticated attackers hide their process manipulation

**Transition**: "Let's look at how this maps to real-world incidents."

---

## Slide: Real-World Incident Comparison

**Visual**: Four-column comparison table.

```
                TRITON          CRASHOVERRIDE    Volt Typhoon     Oldsmar
                (2017)          (2016)           (2023+)          (2021)

Target          Saudi petro-    Ukrainian        US critical      FL water
                chemical        power grid       infrastructure   treatment

IT Pivot        Yes (spear-     Yes (spear-      Yes (LOL         No (direct
                phish → IT      phish → IT       techniques,      TeamViewer
                → OT)           → OT)            VPN creds)       on HMI)

OT Protocol     TriStation      IEC 61850/104    Assessed but     HMI GUI
                (proprietary)   (grid control)   not confirmed    (manual)

Impact          Safety system   225K customers   Pre-positioning  NaOH 100→
                compromise      lost power       for future       11,100 ppm
                (no physical    for hours         conflict        (caught by
                harm — luck)                                      operator)

ATT&CK ICS     T0855, T0836    T0855, T0803     TBD              T0855
Techniques     T0881            T0831
```

**Talking points**:
- TRITON is the gold standard for IT→OT pivot: months of IT access → engineering workstation compromise → safety controller manipulation
- CRASHOVERRIDE automated the ICS attack — the malware included IEC 61850/104 protocol modules
- Volt Typhoon represents the new threat: pre-positioning in IT networks with assessed capability to pivot to OT, waiting for geopolitical trigger
- Oldsmar was not an IT→OT pivot — it was direct OT access via TeamViewer. But it demonstrated the consequence: chemical dosing changes can endanger public health
- Our scenario mirrors the TRITON pattern most closely: IT compromise → engineering workstation → PLC manipulation

**Transition**: "Now let's talk about detection."

---

## Slide: Detection Across IT and OT Boundaries

**Visual**: Three-column detection matrix aligned with network zones.

```
IT ZONE DETECTION                OT BOUNDARY              OT ZONE DETECTION
(Blue — AD Events)               DETECTION                (Modbus/Process)
                                 (eng-ws)

Event 4624: jsmith logon         SSH session from          Modbus FC05/FC06
Event 4769: TGS-REQ (RC4)       non-standard source       from unexpected IP
Event 4656: LSASS handle         New TCP connections        Process value
Event 4688: net.exe execution    to OT subnet              deviation in
Sysmon 1: process creation       Data volume anomaly        historian
Sysmon 10: LSASS access          Duration anomaly           Setpoint change
                                                            Alarm threshold
                                                            modification

    ▲                                ▲                         ▲
    │                                │                         │
    IT SOC                      BOUNDARY                    OT SOC
    (SIEM)                      MONITORING                  (ICS IDS)
                                (NetFlow/DPI)

    └──────── CORRELATION REQUIRED ─────── CORRELATION REQUIRED ┘
```

**Talking points**:
- Detection requires three separate data sources that are rarely correlated in practice
- IT SOC sees AD events but has no visibility into OT traffic
- OT monitoring (Dragos, Claroty, Nozomi) sees Modbus anomalies but does not know about the AD compromise that preceded them
- The boundary — eng-ws traffic to OT — is the critical link. SSH session monitoring and NetFlow at the IT/OT firewall connect the two halves
- Most organizations detect the IT phase (Kerberoasting) or the OT phase (unexpected Modbus writes), but fail to correlate them into a single incident timeline
- Building this cross-domain visibility is the single most important defensive improvement for ICS environments

**Transition**: "Let's look at what proper architecture looks like."

---

## Slide: Defensive Architecture — What Should Have Been

**Visual**: Improved Purdue Model with controls at each boundary.

```
Level 4/5  ┌─────────────────────┐
(IT)       │  dc01, workstations │
           └──────────┬──────────┘
                      │ FIREWALL + MFA
                      │ Session recording
           ┌──────────┴──────────┐
           │  JUMP SERVER (DMZ)  │  ← Not dual-homed eng-ws
           │  AppLocker enforced │
           │  Separate OT creds  │
           └──────────┬──────────┘
                      │ DATA DIODE (one-way OT→IT for historians)
                      │ Strict allowlist (only PLC programming ports)
Level 2/3  ┌──────────┴──────────┐
(OT)       │  eng-ws (OT-only)   │
           │  openplc, historian  │
           │  ICS-IDS monitoring  │
           └─────────────────────┘

Controls at each boundary:
1. MFA for all IT-to-DMZ access
2. Separate OT credentials (no AD password reuse)
3. Jump server with application whitelisting — no arbitrary tunneling
4. Data diode: historian data flows IT-ward, no IT traffic flows OT-ward
5. ICS-aware IDS: Modbus source IP allowlisting, function code monitoring
6. Process alarm integrity monitoring independent of SCADA system
```

**Talking points**:
- Replace dual-homed workstation with a jump server in a DMZ
- Separate credentials: IT AD credentials should not grant OT access
- Data diodes enforce one-way flow — historian data goes to IT for analytics, but no IT traffic reaches OT
- Application whitelisting prevents arbitrary tool execution on the jump server
- ICS-IDS monitors Modbus traffic for unauthorized source IPs and unusual function codes
- None of these controls are exotic — they are all documented in IEC 62443 and NIST SP 800-82

**Transition**: "Time to start the exercise. Your kali-attacker is waiting."

---

## Slide: Debrief — Attack Chain on the Purdue Model

**Visual**: Purdue Model with attack path drawn through all levels.

```
Level 5  Enterprise        ← jsmith phishing foothold
              │
Level 4  Site Business     ← AD enumeration, Kerberoasting, cred dump
              │
         ═══════════       ← IT/OT BOUNDARY VIOLATED
              │
Level 3  Site Operations   ← eng-ws SSH access, tunnel setup
              │
Level 2  Supervisory       ← Modbus recon through tunnel
              │
Level 1  Basic Control     ← FC06 write to PLC registers
              │
Level 0  Physical Process  ← Tank level changed, pump disabled
```

**Talking points**:
- Six boundary crossings, six opportunities for detection, six places a control could have stopped the attack
- Which crossing was easiest? (Level 1→0: Modbus has no auth)
- Which crossing was hardest? (Level 3→2: the tunnel setup)
- Which single control would have the highest impact? (Jump server architecture replacing dual-homed eng-ws)

---

## Slide: Key Takeaways

**Visual**: Numbered list with icons.

```
1. IT/OT convergence is not a theoretical risk — it is the
   primary attack pattern for ICS incidents since 2015

2. The engineering workstation is the most dangerous asset
   in any segmented ICS environment — it bridges the air gap
   by design

3. Modbus TCP has ZERO authentication — all security depends
   on network access control

4. Detection requires correlation across IT, boundary, and OT
   data sources — most organizations fail at this

5. The Purdue Model is not obsolete — it is the minimum
   architecture that must be implemented and monitored
```

**Talking points**:
- These five points are what students should remember six months from now
- The lab exercise makes these concrete — students experienced each point firsthand
- Further reading: NIST SP 800-82 Rev 3, IEC 62443, CISA ICS advisories

**Transition**: "Complete your incident report and submit. Include ATT&CK technique IDs for every phase."
