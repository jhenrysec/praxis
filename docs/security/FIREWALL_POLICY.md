# Firewall Policy

**Maintained by**: SECURITY_AGENT  
**Framework**: Proxmox VE datacenter + node firewall + pfSense VM  
**Default stance**: Deny all, permit by exception

---

## Zone Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  MANAGEMENT (vmbr0)  172.16.0.0/24                              │
│  Proxmox UI :8006 · SSH :22 · Terraform · Ansible               │
│  ⛔ NEVER reachable from vmbr1, vmbr2, vmbr3                    │
└─────────────────────────────────────────────────────────────────┘
         │ permits: TCP/8006, TCP/22 from mgmt subnet only

┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  RED (vmbr1)     │  │  BLUE (vmbr2)    │  │  OT (vmbr3)      │
│  10.10.1.0/24    │  │  10.10.2.0/24    │  │  192.168.100.0   │
│  Attacker VMs    │  │  IT victim VMs   │  │  ICS/SCADA VMs   │
└──────────────────┘  └──────────────────┘  └──────────────────┘
        │                      │                      │
        └──── DEFAULT: BLOCKED ┘        ┌─────────────┘
                                        │
                               ┌────────┴────────┐
                               │  pfSense VM      │
                               │  WAN: vmbr2      │
                               │  LAN: vmbr3      │
                               │  Default: BLOCK  │
                               └──────────────────┘
```

---

## Default Firewall Rules (Persistent — Applied at Phase 3)

### Proxmox Datacenter Firewall

| Direction | Protocol | Source | Destination | Port | Action | Purpose |
|---|---|---|---|---|---|---|
| IN | TCP | 172.16.0.0/24 | Proxmox host | 8006 | ACCEPT | Web UI |
| IN | TCP | 172.16.0.0/24 | Proxmox host | 22 | ACCEPT | SSH |
| IN | ICMP | 172.16.0.0/24 | Proxmox host | — | ACCEPT | Ping |
| IN | * | * | Proxmox host | * | DROP | Default deny |
| FWD | * | vmbr1/2/3 | 172.16.0.0/24 | * | DROP | Protect mgmt net |

### Inter-Zone (Default)

| From | To | Action | Notes |
|---|---|---|---|
| vmbr1 (red) | vmbr0 (mgmt) | BLOCK | Management isolation |
| vmbr1 (red) | vmbr2 (blue) | BLOCK | No direct red→blue by default |
| vmbr1 (red) | vmbr3 (OT) | BLOCK | No direct red→OT |
| vmbr2 (blue) | vmbr0 (mgmt) | BLOCK | Management isolation |
| vmbr2 (blue) | vmbr3 (OT) | BLOCK | pfSense controls this boundary |
| vmbr3 (OT) | vmbr0 (mgmt) | BLOCK | Management isolation |
| vmbr3 (OT) | vmbr1 (red) | BLOCK | No OT→attacker |
| vmbr3 (OT) | vmbr2 (blue) | BLOCK | pfSense controls this boundary |

---

## Scenario-Scoped Rules (Deployed with Terraform, Destroyed with `terraform destroy`)

These rules are only active when the corresponding scenario workspace is deployed.

### SCEN-001: scada_modbus_recon

| Rule | Source | Destination | Port | Notes |
|---|---|---|---|---|
| PERMIT | 10.10.1.10 (Kali) | 192.168.100.10 (OpenPLC) | TCP/502 | Direct red→OT Modbus for this scenario |

### SCEN-004: ics_ot_pivot

| Rule | Source | Destination | Port | Notes |
|---|---|---|---|---|
| PERMIT | 10.10.2.30 (Eng WS) | 192.168.100.10 (OpenPLC) | TCP/502 | EWS→PLC pivot path (students must find this) |
| PERMIT | 10.10.2.30 (Eng WS) | 192.168.100.10 (OpenPLC) | TCP/4840 | OPC-UA |

*Additional scenario rules added here as scenarios are built.*

---

## pfSense Configuration

### Default Policy
- WAN (vmbr2) → LAN (vmbr3): **Block all**
- LAN (vmbr3) → WAN (vmbr2): **Block all**
- Scenario rules loaded via Ansible pfSense API tasks

### Management Access
pfSense web UI: accessible only from management workstation via static route.
pfSense admin credentials: stored in Ansible Vault, never in plain text.

---

## Change Log

| Date | Change | Agent | Scenario |
|---|---|---|---|
| — | Initial policy defined | SECURITY_AGENT | Persistent |

*Updated automatically by SECURITY_AGENT when `/security` tasks modify firewall rules.*
