# Version Manifest

**Last updated**: (update on each change)  
**Maintained by**: INFRA_AGENT + DOCS_AGENT

---

## Packer VM Templates

| VM ID | Template Name | Base OS | Purpose | Packer File |
|---|---|---|---|---|
| 101 | tpl-kali-2024 | Kali 2024.4 | Attacker platform | `packer/templates/kali-2024.pkr.hcl` |
| 102 | tpl-ubuntu-2404 | Ubuntu 24.04.2 LTS | General purpose server | `packer/templates/ubuntu-2404.pkr.hcl` |
| 103 | tpl-debian-12 | Debian 12.9 | Lightweight server | `packer/templates/debian-12.pkr.hcl` |
| 110 | tpl-win2022 | Windows Server 2022 Eval | AD / workstation base | `packer/templates/windows-server-2022.pkr.hcl` |
| 150 | tpl-openplc | Debian 12.9 + OpenPLC v3 | ICS/SCADA PLC simulator | `packer/templates/openplc.pkr.hcl` |
| 151 | tpl-ignition-dev | Debian 12.9 + Ignition 8.1.44 | HMI / historian | `packer/templates/ignition-dev.pkr.hcl` |

---

## Hypervisor & Host

| Component | Version | Source | Notes |
|---|---|---|---|
| Proxmox VE | 9.1.x | proxmox.com/downloads | Verify: `pveversion` |
| Debian base | 13 (Trixie) | Included in Proxmox ISO | |
| ZFS | 2.3.x | Included in Proxmox | Verify: `zfs version` |

---

## Infrastructure as Code

| Tool | Version | Install source | Pin command |
|---|---|---|---|
| Terraform | 1.14.x | releases.hashicorp.com | `terraform version` |
| bpg/proxmox provider | 0.99.x | registry.terraform.io | Lock: `.terraform.lock.hcl` |
| Packer | 1.15.x | releases.hashicorp.com | `packer version` |
| Packer proxmox plugin | 1.1.x | registry.packer.io | Lock: `.packer_cache` |
| Ansible Core | 2.20.x | pip install | `ansible --version` |
| ansible.windows | 2.4.x | ansible-galaxy | `ansible-galaxy collection list` |
| microsoft.ad | 1.7.x | ansible-galaxy | `ansible-galaxy collection list` |
| pywinrm | 0.4.x | pip | `pip show pywinrm` |

---

## SCADA/ICS

| Component | Version | Source | Ansible Role |
|---|---|---|---|
| OpenPLC Runtime | v3 (latest) | github.com/thiagoralves/OpenPLC_v3 | `openplc-configure` |
| Ignition Gateway | 8.1.44 | inductiveautomation.com | `ignition-configure` |
| GRFICSv2 | latest (Docker) | github.com/Fortiphyd/GRFICSv2 | `grficsv2-deploy` |
| InfluxDB | 2.7.10 | influxdata.com | `influxdb-setup` |
| Grafana | 11.3.1 | grafana.com | `grafana-scada` |
| Modbus Historian Bridge | 1.0 (custom) | `ansible/roles/modbus-historian-bridge/files/` | `modbus-historian-bridge` |
| pymodbus | 3.7.x | pip | — |
| influxdb-client (Python) | 1.40.x | pip | — |
| opcua (Python) | 0.98.x | pip | — |
| open62541 (OPC-UA) | 1.3.x | github.com/open62541/open62541 | — |

---

## Frontend / Lab UI

| Package | Version | Pin |
|---|---|---|
| Node.js | 22.x LTS | nodejs.org |
| React | 19.x | npm |
| Vite | 6.x | npm |
| TypeScript | 5.6.x | npm |
| Tailwind CSS | 4.x | npm |
| Zustand | 5.x | npm |
| TanStack Query | 5.x | npm |
| xterm.js | 5.x | npm |
| Recharts | 2.x | npm |
| Lucide React | latest | npm |

---

## Portal Backend

| Component | Version | Source | Verify |
|---|---|---|---|
| Node.js | 22.x LTS | nodejs.org | `node --version` |
| Express | 5.0.x | npm | `npm list express` |
| PostgreSQL | 16.x | postgresql.org | `psql --version` |
| node-pg-migrate | 7.7.x | npm | `npm list node-pg-migrate` |
| jsonwebtoken | 9.0.x | npm | `npm list jsonwebtoken` |
| bcrypt | 5.1.x | npm | `npm list bcrypt` |
| zod | 3.23.x | npm | `npm list zod` |
| helmet | 8.0.x | npm | `npm list helmet` |
| express-rate-limit | 7.4.x | npm | `npm list express-rate-limit` |
| ws (WebSocket) | 8.18.x | npm | `npm list ws` |
| http-proxy-middleware | 3.0.x | npm | `npm list http-proxy-middleware` |
| PM2 | 5.x | npm global | `pm2 --version` |

---

## Portal UI

| Component | Version | Source |
|---|---|---|
| react-router-dom | 7.0.x | npm |
| @novnc/novnc | 1.5.x | npm |
| nginx | 1.24.x | apt | `nginx -v` |

---

## Database

| Component | Version | Notes |
|---|---|---|
| PostgreSQL 16 | 16.x | Installed via pgdg apt repo |
| Database name | labportal | |
| DB user | labportal | password in portal-backend/.env |
