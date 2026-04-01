# Lab UI Guide

**Application**: lab-ui (Scenario Deployment Dashboard)
**Stack**: React 19 + Vite 6 + TypeScript + Tailwind CSS 4
**Access**: `http://192.168.1.50:3000` (management network)
**Last updated**: 2026-03-31

---

## Overview

The Lab UI is the instructor-facing dashboard for deploying, monitoring, and destroying
scenario labs. It communicates with the backend API at port 4000 to trigger Terraform
operations and query Proxmox VM status in real-time.

---

## Running the Dashboard

### Development mode

```bash
cd lab-ui
npm install
npm run dev
# Open http://localhost:3000
```

### Production build

```bash
cd lab-ui
npm run build
# Static files in lab-ui/dist/ — serve with nginx or similar
```

### Environment

The dashboard proxies `/api` requests to `http://localhost:4000` (backend API).
Configure the backend URL in `vite.config.ts` if your backend runs elsewhere.

---

## Pages

### Dashboard (Home)

The main view shows:

- **Stats row** — Scenario count, active slots, running VMs, errors
- **Slot grid** — All 20 lab slots as a visual grid, color-coded by status
- **Scenario catalog** — Cards for each available scenario with difficulty, VM count, ATT&CK techniques

Click a scenario card to navigate to its detail page.

### Scenario Detail

Shows full scenario information and deployment controls:

- **Scenario header** — Name, difficulty badge, description, resource requirements
- **ATT&CK techniques** — Clickable links to MITRE ATT&CK pages
- **Slot selector** — Pick which slot (1–20) to deploy into
- **Deploy controls** — DEPLOY / RESET / DESTROY buttons
- **Network topology** — Auto-generated SVG diagram showing VMs in their network zones
- **VM status list** — Per-VM rows with CPU/memory utilization, IP addresses, uptime
- **Access sheet** — IP addresses and credentials for the deployed lab (with copy buttons)

### Slots Overview

Grid view of all 20 slots with drill-down:

- Click any slot to see its current state
- Shows assigned scenario, user, deploy timestamp
- Lists VMs with real-time status when a slot is running

---

## Components

| Component | Purpose |
|---|---|
| `StatusBadge` | Color-coded status pill for slots (empty/deploying/running/error/destroying) and VMs (running/stopped/paused) |
| `DifficultyBadge` | Scenario difficulty with color coding (green=Beginner, blue=Intermediate, amber=Advanced, red=Expert) |
| `ScenarioCard` | Catalog card showing scenario metadata, focus areas, ATT&CK technique IDs |
| `VMStatusRow` | Single VM row with CPU/memory progress bars, zone badge, IP address, uptime |
| `SlotGrid` | 20-slot grid with selection state and scenario name preview |
| `NetworkTopology` | SVG diagram auto-generated from VM data — zones as dashed rects, VMs as labeled nodes |
| `DeployControls` | Deploy/Reset/Destroy buttons with confirmation dialogs, connects to WebSocket for streaming output |
| `TerminalPanel` | Right-side panel showing Terraform/Ansible output with color-coded stdout/stderr |
| `AccessSheet` | Table of VM IPs, zones, and status with copy-to-clipboard functionality |

---

## Design System

### Colors

| Token | Hex | Usage |
|---|---|---|
| Background base | `#0a0c0f` | Page background |
| Surface | `#0d1017` | Cards, panels |
| Hover | `#131820` | Interactive hover states |
| Border default | `#1e2228` | Card borders, dividers |
| Border active | `#2d3139` | Selected/active borders |
| Text primary | `#e6edf3` | Headings, primary content |
| Text secondary | `#8b949e` | Descriptions, labels |
| Text muted | `#4b5563` | Timestamps, meta info |
| Accent green | `#00e5a0` | Operational, running, success |
| Accent blue | `#6c8fff` | Informational, Blue zone |
| Accent amber | `#facc15` | Warning, OT zone, deploying |
| Accent red | `#fb7185` | Alert, Red zone, errors |
| Accent purple | `#a78bfa` | ATT&CK techniques, automation |

### Typography

| Element | Font | Size | Weight |
|---|---|---|---|
| Page headings | Rajdhani | 18–24px | 600–700 |
| Section headings | Rajdhani | 14–16px | 600 |
| Body text | JetBrains Mono | 12–13px | 400 |
| Labels/badges | JetBrains Mono | 10px, uppercase, tracking 1.5px | 500 |
| Code/IPs | JetBrains Mono | 12px | 400 |

---

## State Management

The UI uses Zustand for lightweight state:

| Store | Data |
|---|---|
| `scenarioStore` | Scenario list, selected scenario name |
| `slotStore` | 20 slots with status, selected slot number |
| `terminalStore` | Output lines, streaming state, active slot |
| `uiStore` | Current view, sidebar/terminal panel open state |

TanStack Query v5 handles all API data fetching with auto-refetch intervals:
- Scenarios: 15s
- Slots: 10s
- VM status: 5s

---

## API Endpoints (consumed by lab-ui)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/scenarios` | List all scenarios |
| GET | `/api/scenarios/:id` | Scenario details |
| GET | `/api/slots` | All 20 slots with status |
| GET | `/api/slots/:slot` | Single slot detail |
| GET | `/api/slots/:slot/vms` | VMs in a slot |
| POST | `/api/slots/:slot/deploy` | Deploy scenario to slot |
| DELETE | `/api/slots/:slot/destroy` | Destroy slot |
| POST | `/api/slots/:slot/reset` | Reset to baseline snapshot |
| WS | `/ws/deploy/:slot` | Stream Terraform output |

---

## Build Verification

```bash
cd lab-ui

# TypeScript type check
npx tsc --noEmit
# Expected: no output (zero errors)

# Production build
npm run build
# Expected: dist/ with index.html + JS/CSS bundles under 500KB
```
