/**
 * WebSocket broadcast service — pushes slot/VM status updates
 * to all connected portal clients in real time.
 *
 * 🔒 SECURITY: Connections require a valid JWT passed as ?token= query param.
 * Students only receive status for their own slot; instructors/admins see all.
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';
import type { IncomingMessage } from 'node:http';
import jwt from 'jsonwebtoken';
import { query, queryOne } from '../db/pool.js';
import type { SlotRow, UserRow, JWTPayload } from '../types/index.js';

let wss: WebSocketServer | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;

const BROADCAST_INTERVAL_MS = 5_000;

/** Authenticated WebSocket with user metadata attached during handshake. */
interface AuthenticatedWebSocket extends WebSocket {
  userId: string;
  userRole: string;
  userLabSlot: number | null;
}

export function initStatusBroadcast(server: Server): void {
  wss = new WebSocketServer({ server, path: '/ws/status' });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    // 🔒 Verify JWT from query param before accepting connection
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(4401, 'Authentication required');
      return;
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      ws.close(4500, 'Server misconfigured');
      return;
    }

    let payload: JWTPayload;
    try {
      payload = jwt.verify(token, secret) as JWTPayload;
    } catch {
      ws.close(4401, 'Invalid or expired token');
      return;
    }

    // Look up user to get role and slot — async, so we handle inline
    queryOne<UserRow>('SELECT * FROM users WHERE id = $1', [payload.sub])
      .then((user) => {
        if (!user || user.status !== 'active') {
          ws.close(4403, 'User not found or inactive');
          return;
        }

        const authWs = ws as AuthenticatedWebSocket;
        authWs.userId = user.id;
        authWs.userRole = user.role;
        authWs.userLabSlot = user.lab_slot;

        // Send initial state scoped to this user
        sendScopedStatus(authWs).catch((err: unknown) => {
          console.error('[ws] initial broadcast failed:', err);
        });
      })
      .catch(() => {
        ws.close(4500, 'Auth lookup failed');
      });

    ws.on('error', (err) => {
      console.error('[ws] client error:', err.message);
    });
  });

  // Periodic broadcast
  intervalId = setInterval(() => {
    broadcastSlotStatus().catch((err: unknown) => {
      console.error('[ws] periodic broadcast failed:', err);
    });
  }, BROADCAST_INTERVAL_MS);
}

/** Send slot status scoped to a single client's permissions. */
async function sendScopedStatus(ws: AuthenticatedWebSocket): Promise<void> {
  if (ws.readyState !== WebSocket.OPEN) return;

  let slots: SlotRow[];
  if (ws.userRole === 'student') {
    if (!ws.userLabSlot) {
      slots = [];
    } else {
      slots = await query<SlotRow>(
        'SELECT * FROM lab_slots WHERE slot_number = $1',
        [ws.userLabSlot],
      );
    }
  } else {
    slots = await query<SlotRow>('SELECT * FROM lab_slots ORDER BY slot_number');
  }

  ws.send(JSON.stringify({ type: 'slot_status', data: slots }));
}

async function broadcastSlotStatus(): Promise<void> {
  if (!wss || wss.clients.size === 0) return;

  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      const authClient = client as AuthenticatedWebSocket;
      // Skip clients that haven't completed auth handshake yet
      if (!authClient.userId) continue;
      await sendScopedStatus(authClient);
    }
  }
}

/** Push an immediate update (e.g., after deploy/destroy). */
export function pushStatusUpdate(): void {
  broadcastSlotStatus().catch((err: unknown) => {
    console.error('[ws] push broadcast failed:', err);
  });
}

export function stopStatusBroadcast(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  if (wss) {
    wss.close();
    wss = null;
  }
}
