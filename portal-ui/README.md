# portal-ui

React 19 + TypeScript web interface for the Lab Portal. Provides login/registration,
instructor admin dashboard, student lab dashboard, and noVNC-based VM console access.

## Stack

| Component | Version |
|---|---|
| React | 19 |
| Vite | 6 |
| TypeScript | 5.6+ |
| Tailwind CSS | 4 |
| State | Zustand 5 |
| Data Fetching | TanStack Query 5 |
| Console | noVNC 1.5 (RFB) |
| Icons | Lucide React |

## Quick Start

```bash
# Install dependencies
npm install

# Start dev server (port 5173, proxies /api to backend at :4000)
npm run dev

# Production build
npm run build   # outputs to dist/
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | TypeScript check + Vite production build |
| `npm run preview` | Preview production build locally |
| `npm run type-check` | TypeScript type checking only |
| `npm run lint` | ESLint check |

## Project Structure

```
src/
├── main.tsx              — React entry (QueryClient + Router)
├── App.tsx               — Route definitions + role guards
├── api/
│   └── client.ts         — Typed HTTP client with 401 auto-refresh
├── stores/
│   └── authStore.ts      — Zustand auth state (tokens, user, session)
├── hooks/
│   ├── useAdmin.ts       — TanStack Query hooks for admin operations
│   └── useStudent.ts     — TanStack Query hooks for student operations
├── pages/
│   ├── AuthPage.tsx      — Login/register toggle
│   ├── AdminDashboard.tsx
│   ├── UserManagement.tsx
│   ├── SlotManagement.tsx
│   ├── ScenarioBrowser.tsx
│   ├── AuditLog.tsx
│   ├── StudentDashboard.tsx
│   └── ConsolePage.tsx   — noVNC VM console viewer
├── components/
│   ├── auth/             — LoginForm, RegisterForm, ProtectedRoute
│   ├── console/          — VncViewer (noVNC RFB wrapper)
│   └── shared/           — AppLayout, StatusBadge
└── types/
    ├── index.ts          — App type definitions
    └── novnc.d.ts        — noVNC TypeScript declarations
```

## Pages by Role

| Page | Route | Roles |
|---|---|---|
| Login/Register | `/auth` | Public |
| Student Dashboard | `/dashboard` | student |
| Admin Dashboard | `/admin` | instructor, admin |
| User Management | `/admin/users` | instructor, admin |
| Lab Slots | `/admin/slots` | instructor, admin |
| Scenarios | `/admin/scenarios` | All authenticated |
| Audit Log | `/admin/audit` | admin |
| VM Console | `/console` | All authenticated |

## Design System

Dark SOC-style theme:
- Background: `#0a0c0f` / Surface: `#0d1017`
- Green (operational): `#00e5a0`
- Blue (info): `#6c8fff`
- Amber (warning): `#facc15`
- Red (alert): `#fb7185`
- Typography: JetBrains Mono (code/labels), Rajdhani (headings)

## Security

- Access tokens stored in memory only (never localStorage)
- Refresh tokens in sessionStorage (cleared on tab close)
- Automatic 401 retry with token refresh (single attempt, deduplicated)
- WebSocket URL validation prevents connecting to non-same-origin endpoints
- Role-based route guards with server-side enforcement
- Auto-refresh timer fires every 12 minutes (for 15-minute token lifetime)

## Build Output

```
dist/index.html           ~1 KB
dist/assets/index.css     ~18 KB
dist/assets/index.js      ~268 KB (app code)
dist/assets/vendor.js     ~48 KB (React + router)
dist/assets/rfb.js        ~69 KB (noVNC)
dist/assets/query.js      ~36 KB (TanStack Query)
```
