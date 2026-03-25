# Skill: Lab Portal — Authentication, RBAC, and Console Viewing

**Applies to**: PORTAL_AGENT · BACKEND_AGENT  
**Stack**: Express 5 + TypeScript + PostgreSQL + JWT + noVNC  
**Last reviewed**: 2025-06

---

## JWT Authentication Pattern

### Token Strategy
- **Access token**: 15-minute expiry, signed with HS256, payload: `{ sub: userId, role, slot }`
- **Refresh token**: 7-day expiry, stored as httpOnly cookie, hashed in DB
- **Rotation**: each refresh issues a new refresh token, old one revoked (prevents replay)

### Login Flow
```typescript
// POST /api/auth/login
async function login(email: string, password: string, ip: string) {
  const user = await db.query(
    'SELECT * FROM users WHERE email = $1 AND status = $2',
    [email.toLowerCase(), 'active']
  );
  if (!user || !await bcrypt.compare(password, user.password_hash)) {
    // Always same error — don't leak whether email exists
    throw new UnauthorizedError('Invalid credentials');
  }

  const accessToken = jwt.sign(
    { sub: user.id, role: user.role, slot: user.lab_slot },
    process.env.JWT_SECRET!,
    { expiresIn: '15m' }
  );

  const refreshToken = crypto.randomBytes(64).toString('hex');
  const refreshHash = await bcrypt.hash(refreshToken, 10);

  await db.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, ip_address)
     VALUES ($1, $2, NOW() + INTERVAL '7 days', $3)`,
    [user.id, refreshHash, ip]
  );

  await db.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

  return { accessToken, refreshToken };  // refreshToken goes in httpOnly cookie
}
```

### Rate Limiting
```typescript
import rateLimit from 'express-rate-limit';

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts — try again in 15 minutes' },
  keyGenerator: (req) => req.ip + ':' + (req.body?.email || ''),
});
```

---

## RBAC Implementation

### Role Hierarchy
```
admin > instructor > student
```

### Route Guard Pattern
```typescript
// Protect all /api/users/* — instructor+
router.use('/api/users', authenticate, requireRole('instructor', 'admin'));

// Protect slot mutations — instructor+
router.post('/api/slots/:slot/deploy', authenticate, requireRole('instructor', 'admin'), deployHandler);

// Student can only read their own slot
router.get('/api/slots/:slot', authenticate, requireSlotOwner, slotGetHandler);

// Admin only
router.get('/api/audit', authenticate, requireRole('admin'), auditHandler);
```

### Frontend Route Guards
```tsx
// src/components/shared/ProtectedRoute.tsx
interface ProtectedRouteProps {
  roles: Role[];
  children: ReactNode;
}

export function ProtectedRoute({ roles, children }: ProtectedRouteProps) {
  const { user } = useAuthStore();

  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}

// Usage in router:
<Route path="/admin" element={
  <ProtectedRoute roles={['instructor', 'admin']}>
    <AdminPage />
  </ProtectedRoute>
} />
```

---

## noVNC Console Integration

### Architecture
```
Browser (noVNC) ──WebSocket──▶ portal-backend :4000/novnc-proxy/:ticket
                                       │
                                       ▼
                              Proxmox VNC WebSocket
                              172.16.0.10:{port}
```

### Backend: VNC Ticket + WebSocket Proxy
```typescript
// src/services/console.ts

import { createProxyMiddleware } from 'http-proxy-middleware';
import { WebSocketServer } from 'ws';

// Step 1: Issue proxied VNC ticket
app.post('/api/consoles/ticket', authenticate, async (req, res) => {
  const { vmId } = req.body;

  // Verify ownership
  const vm = await proxmox.getVMStatus('pve01', vmId);
  const slot = extractSlotFromTag(vm.tags);

  if (req.user.role === 'student' && req.user.lab_slot !== slot) {
    return res.status(403).json({ error: 'Not your VM' });
  }

  // Get VNC ticket from Proxmox
  const { ticket, port, cert } = await proxmox.getVNCTicket('pve01', vmId);

  // Create a short-lived proxy ticket (5 minute TTL)
  const proxyTicket = crypto.randomBytes(16).toString('hex');
  await cache.set(`vnc:${proxyTicket}`, { port, ticket, vmId }, 300);

  await auditLog(req.user.id, 'console_access', 'vm', String(vmId));

  res.json({ proxyTicket, wsUrl: `/novnc-proxy/${proxyTicket}` });
});

// Step 2: WebSocket proxy
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', async (req, socket, head) => {
  const match = req.url?.match(/^\/novnc-proxy\/([a-f0-9]{32})$/);
  if (!match) { socket.destroy(); return; }

  const proxyTicket = match[1];
  const vnc = await cache.get(`vnc:${proxyTicket}`);
  if (!vnc) { socket.destroy(); return; }

  // Proxy to Proxmox VNC websocket
  wss.handleUpgrade(req, socket, head, (ws) => {
    const upstream = new WebSocket(
      `wss://172.16.0.10:${vnc.port}`,
      { headers: { Cookie: `PVEAuthCookie=${vnc.ticket}` }, rejectUnauthorized: false }
    );
    // Bidirectional pipe
    ws.on('message', (d) => upstream.send(d));
    upstream.on('message', (d) => ws.send(d));
    ws.on('close', () => upstream.close());
    upstream.on('close', () => ws.close());
  });
});
```

### Frontend: noVNC Component
```tsx
// src/components/console/NoVNCViewer.tsx
import { useEffect, useRef, useState } from 'react';
import RFB from '@novnc/novnc/core/rfb';

interface NoVNCViewerProps {
  vmId: number;
  readOnly?: boolean;
}

export function NoVNCViewer({ vmId, readOnly = false }: NoVNCViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rfbRef = useRef<RFB | null>(null);
  const [status, setStatus] = useState<'connecting'|'connected'|'disconnected'|'error'>('connecting');

  useEffect(() => {
    async function connect() {
      try {
        const res = await fetch('/api/consoles/ticket', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json',
                     'Authorization': `Bearer ${getAccessToken()}` },
          body: JSON.stringify({ vmId }),
        });
        const { wsUrl } = await res.json();
        const wsFullUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}${wsUrl}`;

        if (!containerRef.current) return;
        const rfb = new RFB(containerRef.current, wsFullUrl);
        rfb.viewOnly = readOnly;
        rfb.scaleViewport = true;
        rfb.addEventListener('connect', () => setStatus('connected'));
        rfb.addEventListener('disconnect', () => setStatus('disconnected'));
        rfbRef.current = rfb;
      } catch {
        setStatus('error');
      }
    }
    connect();
    return () => { rfbRef.current?.disconnect(); };
  }, [vmId, readOnly]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {status !== 'connected' && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: '#0d1017', color: '#8b949e', fontFamily: 'JetBrains Mono',
          fontSize: 13,
        }}>
          {status === 'connecting' && '⬤ Connecting to console...'}
          {status === 'disconnected' && '⬤ Disconnected'}
          {status === 'error' && '⬤ Connection failed'}
        </div>
      )}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
```

---

## 20-Slot Deployment Pattern

### Slot-Aware Terraform Variables
```hcl
# terraform/modules/vm_clone/variables.tf — additions for multi-slot
variable "slot_number" {
  type        = number
  description = "Student slot number 1-20"
  validation {
    condition     = var.slot_number >= 1 && var.slot_number <= 20
    error_message = "Slot must be 1-20"
  }
}

# VM ID formula: base + (slot-1)*10 + vm_index
variable "vm_id_base" {
  type        = number
  description = "200 + (slot_number - 1) * 10"
}
```

### IP Addressing Per Slot
```
Slot 01: red=10.10.1.x  blue=10.10.2.x  ot=192.168.101.x
Slot 02: red=10.10.3.x  blue=10.10.4.x  ot=192.168.102.x
...
Slot 20: red=10.10.39.x blue=10.10.40.x ot=192.168.120.x
```

### VLAN-per-Slot Network Isolation
Each slot gets its own VLAN tags (101–120) to prevent cross-student traffic.
Configure via Proxmox SDN zones or VLAN-aware bridges.

---

## Zod Validation Schemas

```typescript
// src/api/schemas/auth.ts
import { z } from 'zod';

export const RegisterSchema = z.object({
  email:      z.string().email().toLowerCase().max(255),
  username:   z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/),
  full_name:  z.string().min(2).max(255),
  password:   z.string()
                .min(12, 'Password must be at least 12 characters')
                .regex(/[A-Z]/, 'Must contain uppercase')
                .regex(/[a-z]/, 'Must contain lowercase')
                .regex(/[0-9]/, 'Must contain number')
                .regex(/[^A-Za-z0-9]/, 'Must contain special character'),
  student_id: z.string().max(50).optional(),
});

export const LoginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

export const DeploySchema = z.object({
  scenario_id: z.string().min(1).max(100).regex(/^[a-z0-9_-]+$/),
});

export const HintSchema = z.object({
  slot:    z.number().int().min(1).max(20),
  message: z.string().min(1).max(1000),
});
```

---

## WebSocket Status Feed

```typescript
// Real-time lab status pushed to instructor dashboard
// src/services/statusBroadcast.ts

const clients = new Set<WebSocket>();

export function broadcastSlotUpdate(slot: number, status: SlotStatus) {
  const msg = JSON.stringify({ type: 'slot_update', slot, status, ts: Date.now() });
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  }
}

// Frontend: useLabStatus hook
export function useLabStatus() {
  const { setSlotStatus } = useLabStore();

  useEffect(() => {
    const ws = new WebSocket(`ws://${location.host}/api/status/ws`);
    ws.onmessage = (e) => {
      const { type, slot, status } = JSON.parse(e.data);
      if (type === 'slot_update') setSlotStatus(slot, status);
    };
    ws.onclose = () => setTimeout(() => {/* reconnect */}, 3000);
    return () => ws.close();
  }, []);
}
```

---

## Common Pitfalls

| Issue | Cause | Fix |
|---|---|---|
| noVNC blank screen | VNC ticket expired before connect | Reduce latency between ticket issue and WS connect |
| CORS on WebSocket | WS upgrade not getting CORS headers | Set `origin` option in `ws.Server` |
| JWT in localStorage | XSS vulnerability | Always use httpOnly cookie for refresh, memory for access |
| Proxmox VNC cert error | Self-signed cert on VNC WS | Set `rejectUnauthorized: false` in upstream WS connection |
| Slot IP collision | Two students same VLAN | Enforce VLAN-per-slot in SDN config |
