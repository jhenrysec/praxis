# Portal Backend API Reference

**Base URL**: `http://<management-host>:4000`
**Version**: 0.1.0
**Last updated**: 2026-04-01

All request and response bodies are JSON (`Content-Type: application/json`).

---

## Table of Contents

- [Authentication](#authentication)
- [Rate Limits](#rate-limits)
- [Error Responses](#error-responses)
- [Auth Routes](#auth-routes)
- [Users Routes](#users-routes)
- [Slots Routes](#slots-routes)
- [Consoles Routes](#consoles-routes)
- [Scenarios Routes](#scenarios-routes)
- [Objectives Routes](#objectives-routes)
- [Hints Routes](#hints-routes)
- [Audit Routes](#audit-routes)
- [WebSocket](#websocket)

---

## Authentication

Access tokens are JWTs passed in the `Authorization` header:

```
Authorization: Bearer <access_token>
```

| Token Type | Storage | Expiry | Notes |
|---|---|---|---|
| Access token | Memory only (never localStorage) | 15 minutes | JWT, verified on every authenticated request |
| Refresh token | sessionStorage (cleared on tab close) | 7 days | Opaque random string, hashed with SHA-256 before DB storage, rotated on each use (old revoked, new issued) |

The portal-ui client intercepts 401 responses, refreshes the access token automatically, and retries the original request once. Requests to `/auth/` paths are excluded from retry to prevent infinite loops.

---

## Rate Limits

| Scope | Limit | Window |
|---|---|---|
| Global (all routes) | 200 requests | 1 minute |
| Auth (`/login`, `/register`, `/refresh`) | 15 requests | 15 minutes |
| Console ticket (`/consoles/ticket`) | 10 requests | 1 minute |

Rate-limited responses return `429 Too Many Requests`.

---

## Error Responses

All errors return a JSON body:

```json
{
  "error": "Human-readable error message",
  "details": [
    { "path": "email", "message": "Invalid email format" }
  ]
}
```

The `details` array is present only on 400 validation errors (Zod). No stack traces are exposed.

| Status | Meaning |
|---|---|
| 400 | Validation error or bad request |
| 401 | Missing or invalid/expired token |
| 403 | Insufficient permissions or inactive account |
| 404 | Resource not found |
| 409 | Conflict (duplicate email/username, slot already taken) |
| 429 | Rate limited |
| 500 | Internal server error |

---

## Auth Routes

Base path: `/api/auth`

### POST /api/auth/register

Create a new student account. Public endpoint. Rate limited: 15/15min.

**Request body**:

| Field | Type | Required | Description |
|---|---|---|---|
| `email` | string | yes | Unique email address |
| `username` | string | yes | Unique username (max 50 chars) |
| `password` | string | yes | Account password |
| `full_name` | string | yes | Display name |
| `student_id` | string | no | Optional student ID |

**Response** `201 Created`:

```json
{
  "user": {
    "id": "uuid",
    "email": "student@example.com",
    "username": "jdoe",
    "full_name": "Jane Doe",
    "role": "student",
    "status": "pending"
  },
  "message": "Registration successful. Awaiting instructor approval."
}
```

```bash
curl -X POST http://172.16.0.10:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "student@lab.local",
    "username": "jdoe",
    "password": "SecurePass123!",
    "full_name": "Jane Doe",
    "student_id": "STU-042"
  }'
```

---

### POST /api/auth/login

Authenticate and receive tokens. Public endpoint. Rate limited: 15/15min.

**Request body**:

| Field | Type | Required | Description |
|---|---|---|---|
| `email` | string | yes | Account email |
| `password` | string | yes | Account password |

**Response** `200 OK`:

```json
{
  "access_token": "eyJhbGciOi...",
  "refresh_token": "a1b2c3d4e5...",
  "user": {
    "id": "uuid",
    "email": "student@lab.local",
    "username": "jdoe",
    "full_name": "Jane Doe",
    "role": "student",
    "status": "active",
    "lab_slot": 3
  }
}
```

```bash
curl -X POST http://172.16.0.10:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@lab.local",
    "password": "ChangeMe123!@#"
  }'
```

---

### POST /api/auth/logout

Revoke a refresh token. Public endpoint.

**Request body**:

| Field | Type | Required | Description |
|---|---|---|---|
| `refresh_token` | string | yes | Token to revoke |

**Response** `200 OK`:

```json
{
  "message": "Logged out successfully"
}
```

```bash
curl -X POST http://172.16.0.10:4000/api/auth/logout \
  -H "Content-Type: application/json" \
  -d '{ "refresh_token": "a1b2c3d4e5..." }'
```

---

### POST /api/auth/refresh

Exchange a refresh token for a new access/refresh token pair. Public endpoint. Rate limited: 15/15min.

The old refresh token is revoked and a new one is issued (token rotation).

**Request body**:

| Field | Type | Required | Description |
|---|---|---|---|
| `refresh_token` | string | yes | Current valid refresh token |

**Response** `200 OK`:

```json
{
  "access_token": "eyJhbGciOi...",
  "refresh_token": "f6g7h8i9j0..."
}
```

```bash
curl -X POST http://172.16.0.10:4000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{ "refresh_token": "a1b2c3d4e5..." }'
```

---

### GET /api/auth/me

Return the authenticated user's profile.

**Auth**: Bearer token required.

**Response** `200 OK`:

```json
{
  "user": {
    "id": "uuid",
    "email": "admin@lab.local",
    "username": "admin",
    "full_name": "Lab Administrator",
    "role": "admin",
    "status": "active",
    "lab_slot": null,
    "student_id": null,
    "created_at": "2026-03-31T00:00:00.000Z",
    "last_login": "2026-04-01T12:00:00.000Z"
  }
}
```

```bash
curl http://172.16.0.10:4000/api/auth/me \
  -H "Authorization: Bearer eyJhbGciOi..."
```

---

## Users Routes

Base path: `/api/users`

**Auth**: Bearer token required. All routes require `instructor` or `admin` role.

### GET /api/users

List all users with optional filters and pagination.

**Query parameters**:

| Param | Type | Default | Description |
|---|---|---|---|
| `role` | string | — | Filter by role: `admin`, `instructor`, `student` |
| `status` | string | — | Filter by status: `pending`, `active`, `locked`, `deleted` |
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Results per page |

**Response** `200 OK`:

```json
{
  "users": [
    {
      "id": "uuid",
      "email": "student@lab.local",
      "username": "jdoe",
      "full_name": "Jane Doe",
      "role": "student",
      "status": "active",
      "lab_slot": 3,
      "student_id": "STU-042",
      "created_at": "2026-03-31T00:00:00.000Z",
      "last_login": "2026-04-01T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3
  }
}
```

```bash
curl "http://172.16.0.10:4000/api/users?role=student&status=active&page=1&limit=10" \
  -H "Authorization: Bearer eyJhbGciOi..."
```

---

### GET /api/users/pending

List all users with `pending` status (shortcut for registration approvals).

**Response** `200 OK`:

```json
{
  "users": [
    {
      "id": "uuid",
      "email": "new-student@lab.local",
      "username": "newstudent",
      "full_name": "New Student",
      "role": "student",
      "status": "pending",
      "created_at": "2026-04-01T08:00:00.000Z"
    }
  ]
}
```

---

### POST /api/users

Create a user directly (instructor creates student accounts). Only admins can set `role: "instructor"`.

**Request body**:

| Field | Type | Required | Description |
|---|---|---|---|
| `email` | string | yes | Unique email |
| `username` | string | yes | Unique username |
| `password` | string | yes | Initial password |
| `full_name` | string | yes | Display name |
| `student_id` | string | no | Student ID |
| `role` | string | no | `student` (default), `instructor` (admin only) |

**Response** `201 Created`:

```json
{
  "user": {
    "id": "uuid",
    "email": "student2@lab.local",
    "username": "student2",
    "full_name": "Student Two",
    "role": "student",
    "status": "active"
  }
}
```

```bash
curl -X POST http://172.16.0.10:4000/api/users \
  -H "Authorization: Bearer eyJhbGciOi..." \
  -H "Content-Type: application/json" \
  -d '{
    "email": "student2@lab.local",
    "username": "student2",
    "password": "TempPass456!",
    "full_name": "Student Two"
  }'
```

---

### GET /api/users/:id

Retrieve a single user by UUID.

**Response** `200 OK`:

```json
{
  "user": {
    "id": "uuid",
    "email": "student@lab.local",
    "username": "jdoe",
    "full_name": "Jane Doe",
    "role": "student",
    "status": "active",
    "lab_slot": 3,
    "student_id": "STU-042",
    "created_at": "2026-03-31T00:00:00.000Z",
    "last_login": "2026-04-01T10:00:00.000Z"
  }
}
```

---

### PATCH /api/users/:id

Update user fields. Only admins can set `role: "admin"`.

**Request body** (all fields optional):

| Field | Type | Description |
|---|---|---|
| `role` | string | `student`, `instructor`, `admin` (admin only for admin grant) |
| `status` | string | `pending`, `active`, `locked`, `deleted` |
| `lab_slot` | number | 1-20, assigns user to a lab slot |
| `full_name` | string | Updated display name |
| `student_id` | string | Updated student ID |

**Response** `200 OK`:

```json
{
  "user": { "...updated user object..." }
}
```

```bash
curl -X PATCH http://172.16.0.10:4000/api/users/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer eyJhbGciOi..." \
  -H "Content-Type: application/json" \
  -d '{ "lab_slot": 5, "status": "active" }'
```

---

### DELETE /api/users/:id

Soft-delete a user (sets `status: "deleted"`). Does not remove the database row.

**Response** `200 OK`:

```json
{
  "message": "User deleted"
}
```

---

### POST /api/users/:id/approve

Transition a user from `pending` to `active` status.

**Response** `200 OK`:

```json
{
  "user": { "...user with status: active, approved_by, approved_at..." }
}
```

```bash
curl -X POST http://172.16.0.10:4000/api/users/550e8400-e29b-41d4-a716-446655440000/approve \
  -H "Authorization: Bearer eyJhbGciOi..."
```

---

### POST /api/users/:id/lock

Lock a user account. Revokes all active refresh tokens.

**Response** `200 OK`:

```json
{
  "message": "User locked"
}
```

---

### POST /api/users/:id/unlock

Unlock a previously locked user account.

**Response** `200 OK`:

```json
{
  "message": "User unlocked"
}
```

---

### POST /api/users/:id/reset-password

Generate a temporary password for the user. Revokes all active refresh tokens.

**Response** `200 OK`:

```json
{
  "message": "Password reset",
  "temporary_password": "xK9#mP2qL7"
}
```

```bash
curl -X POST http://172.16.0.10:4000/api/users/550e8400-e29b-41d4-a716-446655440000/reset-password \
  -H "Authorization: Bearer eyJhbGciOi..."
```

---

## Slots Routes

Base path: `/api/slots`

**Auth**: Bearer token required. Read access varies by role. All mutations require `instructor` or `admin` role.

### GET /api/slots

List lab slots. Students see only their assigned slot. Instructors and admins see all 20.

**Response** `200 OK`:

```json
{
  "slots": [
    {
      "slot_number": 1,
      "user_id": "uuid",
      "scenario_id": "scada_modbus_recon",
      "status": "running",
      "tf_workspace": "student-slot-01",
      "deployed_at": "2026-04-01T09:00:00.000Z",
      "last_reset": null
    }
  ]
}
```

```bash
curl http://172.16.0.10:4000/api/slots \
  -H "Authorization: Bearer eyJhbGciOi..."
```

---

### POST /api/slots/deploy-all

Deploy the same scenario to all active (user-assigned) slots. Instructor or admin only.

**Request body**:

| Field | Type | Required | Description |
|---|---|---|---|
| `scenario_id` | string | yes | Scenario to deploy across all active slots |

**Response** `202 Accepted`:

```json
{
  "message": "Deploying to all active slots",
  "slots": [1, 3, 5, 7, 12]
}
```

```bash
curl -X POST http://172.16.0.10:4000/api/slots/deploy-all \
  -H "Authorization: Bearer eyJhbGciOi..." \
  -H "Content-Type: application/json" \
  -d '{ "scenario_id": "scada_modbus_recon" }'
```

---

### GET /api/slots/:slot

Get details for a single slot. Students can access only their own assigned slot. Instructors and admins can access any slot.

**URL parameters**:

| Param | Type | Description |
|---|---|---|
| `slot` | number | Slot number (1-20) |

**Response** `200 OK`:

```json
{
  "slot": {
    "slot_number": 3,
    "user_id": "uuid",
    "scenario_id": "cred_access_kerberoasting",
    "status": "running",
    "tf_workspace": "student-slot-03",
    "deployed_at": "2026-04-01T09:15:00.000Z",
    "last_reset": null,
    "deploy_log": "..."
  }
}
```

---

### POST /api/slots/:slot/deploy

Deploy a scenario to a specific slot. Instructor or admin only. Triggers `terraform apply` in the background.

**Request body**:

| Field | Type | Required | Description |
|---|---|---|---|
| `scenario_id` | string | yes | Scenario to deploy |

**Response** `202 Accepted`:

```json
{
  "message": "Deploying scada_modbus_recon to slot 3"
}
```

```bash
curl -X POST http://172.16.0.10:4000/api/slots/3/deploy \
  -H "Authorization: Bearer eyJhbGciOi..." \
  -H "Content-Type: application/json" \
  -d '{ "scenario_id": "scada_modbus_recon" }'
```

---

### DELETE /api/slots/:slot/destroy

Destroy the lab environment in a slot. Instructor or admin only. Triggers `terraform destroy` in the background.

**Response** `202 Accepted`:

```json
{
  "message": "Destroying slot 3"
}
```

```bash
curl -X DELETE http://172.16.0.10:4000/api/slots/3/destroy \
  -H "Authorization: Bearer eyJhbGciOi..."
```

---

### POST /api/slots/:slot/reset

Roll the slot back to its baseline snapshot.

**Response** `200 OK`:

```json
{
  "message": "Slot 3 reset to baseline"
}
```

---

### GET /api/slots/:slot/vms

List VMs in a slot with live Proxmox status. Students can access only their own slot.

**Response** `200 OK`:

```json
{
  "vms": [
    {
      "vmid": 220,
      "name": "kali-attacker",
      "status": "running",
      "cpu": 0.12,
      "mem": 2147483648,
      "maxmem": 4294967296,
      "uptime": 3600,
      "tags": "scada-modbus-recon;red;lab"
    }
  ]
}
```

```bash
curl http://172.16.0.10:4000/api/slots/3/vms \
  -H "Authorization: Bearer eyJhbGciOi..."
```

---

## Consoles Routes

Base path: `/api/consoles`

**Auth**: Bearer token required. Students can access only VMs in their assigned slot.

### GET /api/consoles/vms

List VMs accessible to the current user. Students see VMs in their own slot. Instructors and admins see all lab-tagged VMs.

**Response** `200 OK`:

```json
{
  "vms": [
    {
      "vmid": 220,
      "name": "kali-attacker",
      "status": "running",
      "node": "pve01",
      "tags": "scada-modbus-recon;red;lab"
    }
  ]
}
```

---

### POST /api/consoles/ticket

Request a VNC ticket for a specific VM. Rate limited: 10/min. Students are validated against slot ownership before a ticket is issued.

**Request body**:

| Field | Type | Required | Description |
|---|---|---|---|
| `vmId` | number | yes | Proxmox VM ID |

**Response** `200 OK`:

```json
{
  "ticket": "PVEVNC:12345678::...",
  "wsUrl": "wss://172.16.0.10:8006/api2/json/nodes/pve01/qemu/220/vncwebsocket?port=5900&vncticket=...",
  "port": 5900
}
```

```bash
curl -X POST http://172.16.0.10:4000/api/consoles/ticket \
  -H "Authorization: Bearer eyJhbGciOi..." \
  -H "Content-Type: application/json" \
  -d '{ "vmId": 220 }'
```

---

## Scenarios Routes

Base path: `/api/scenarios`

**Auth**: Bearer token required. All authenticated users can browse scenarios.

### GET /api/scenarios

List all available scenarios (parsed from `scenario.yaml` files on disk).

**Response** `200 OK`:

```json
{
  "scenarios": [
    {
      "id": "scada_modbus_recon",
      "name": "SCADA Modbus Recon & Manipulation",
      "difficulty": "Beginner",
      "duration": "2h",
      "vm_count": 3,
      "focus_areas": ["ICS/OT", "Modbus TCP"],
      "techniques": ["T0846", "T0842", "T0836", "T0855", "T0812"]
    }
  ]
}
```

```bash
curl http://172.16.0.10:4000/api/scenarios \
  -H "Authorization: Bearer eyJhbGciOi..."
```

---

### GET /api/scenarios/:id

Get full details for a single scenario.

**Response** `200 OK`:

```json
{
  "scenario": {
    "id": "scada_modbus_recon",
    "name": "SCADA Modbus Recon & Manipulation",
    "difficulty": "Beginner",
    "duration": "2h",
    "description": "...",
    "vm_count": 3,
    "focus_areas": ["ICS/OT", "Modbus TCP"],
    "techniques": ["T0846", "T0842", "T0836", "T0855", "T0812"],
    "objectives": [
      "Enumerate Modbus registers on the target PLC",
      "Read process values from holding registers",
      "Write to a coil to manipulate the physical process"
    ],
    "vms": [
      { "name": "kali-attacker", "role": "attacker", "zone": "red" },
      { "name": "openplc-01", "role": "plc", "zone": "ot" },
      { "name": "historian", "role": "historian", "zone": "ot" }
    ]
  }
}
```

---

## Objectives Routes

Base path: `/api/objectives`

**Auth**: Bearer token required.

### GET /api/objectives

Get the current user's objective progress across all scenarios.

**Response** `200 OK`:

```json
{
  "objectives": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "slot_number": 3,
      "scenario_id": "scada_modbus_recon",
      "objective_n": 1,
      "completed": true,
      "completed_at": "2026-04-01T10:30:00.000Z"
    },
    {
      "id": "uuid",
      "user_id": "uuid",
      "slot_number": 3,
      "scenario_id": "scada_modbus_recon",
      "objective_n": 2,
      "completed": false,
      "completed_at": null
    }
  ]
}
```

---

### POST /api/objectives/:objectiveN/complete

Mark an objective as complete (self-reported by student).

**URL parameters**:

| Param | Type | Description |
|---|---|---|
| `objectiveN` | number | Objective number to mark complete |

**Request body** (optional for students with a slot assignment):

| Field | Type | Required | Description |
|---|---|---|---|
| `slot_number` | number | no | Auto-inferred from student's assigned slot |
| `scenario_id` | string | no | Auto-inferred from slot's active scenario |

**Response** `200 OK`:

```json
{
  "objective": {
    "id": "uuid",
    "user_id": "uuid",
    "slot_number": 3,
    "scenario_id": "scada_modbus_recon",
    "objective_n": 2,
    "completed": true,
    "completed_at": "2026-04-01T11:00:00.000Z"
  }
}
```

```bash
curl -X POST http://172.16.0.10:4000/api/objectives/2/complete \
  -H "Authorization: Bearer eyJhbGciOi..."
```

---

### GET /api/objectives/slot/:slot

View a student's objective progress in a specific slot. Instructor or admin only.

**Response** `200 OK`:

```json
{
  "objectives": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "slot_number": 3,
      "scenario_id": "scada_modbus_recon",
      "objective_n": 1,
      "completed": true,
      "completed_at": "2026-04-01T10:30:00.000Z"
    }
  ]
}
```

```bash
curl http://172.16.0.10:4000/api/objectives/slot/3 \
  -H "Authorization: Bearer eyJhbGciOi..."
```

---

## Hints Routes

Base path: `/api/hints`

**Auth**: Bearer token required.

### GET /api/hints

Students receive hints for their own slot. Instructors can filter by slot.

**Query parameters** (instructor only):

| Param | Type | Description |
|---|---|---|
| `slot` | number | Filter hints by slot number |

**Response** `200 OK`:

```json
{
  "hints": [
    {
      "id": "uuid",
      "from_user": "uuid",
      "to_slot": 3,
      "message": "Look at the network traffic on port 502.",
      "created_at": "2026-04-01T10:15:00.000Z",
      "read_at": null
    }
  ]
}
```

```bash
curl http://172.16.0.10:4000/api/hints \
  -H "Authorization: Bearer eyJhbGciOi..."
```

---

### POST /api/hints

Send a hint to a student's slot. Instructor or admin only.

**Request body**:

| Field | Type | Required | Description |
|---|---|---|---|
| `slot` | number | yes | Target slot number (1-20) |
| `message` | string | yes | Hint text |

**Response** `201 Created`:

```json
{
  "hint": {
    "id": "uuid",
    "from_user": "uuid",
    "to_slot": 3,
    "message": "Try using pymodbus to read holding registers starting at address 0.",
    "created_at": "2026-04-01T10:45:00.000Z",
    "read_at": null
  }
}
```

```bash
curl -X POST http://172.16.0.10:4000/api/hints \
  -H "Authorization: Bearer eyJhbGciOi..." \
  -H "Content-Type: application/json" \
  -d '{ "slot": 3, "message": "Try using pymodbus to read holding registers starting at address 0." }'
```

---

### PATCH /api/hints/:id/read

Mark a hint as read.

**Response** `200 OK`:

```json
{
  "hint": {
    "id": "uuid",
    "from_user": "uuid",
    "to_slot": 3,
    "message": "Look at the network traffic on port 502.",
    "created_at": "2026-04-01T10:15:00.000Z",
    "read_at": "2026-04-01T10:20:00.000Z"
  }
}
```

---

## Audit Routes

Base path: `/api/audit`

**Auth**: Bearer token required. Admin role required.

### GET /api/audit

Paginated audit log with optional filters.

**Query parameters**:

| Param | Type | Default | Description |
|---|---|---|---|
| `actor_id` | string (UUID) | — | Filter by acting user |
| `action` | string | — | Filter by action type (e.g., `login`, `deploy`, `approve_user`) |
| `from_date` | string (ISO 8601) | — | Start of date range |
| `to_date` | string (ISO 8601) | — | End of date range |
| `page` | number | 1 | Page number |
| `limit` | number | 50 | Results per page |

**Response** `200 OK`:

```json
{
  "entries": [
    {
      "id": "uuid",
      "actor_id": "uuid",
      "action": "deploy",
      "target_type": "slot",
      "target_id": "3",
      "details": {
        "scenario_id": "scada_modbus_recon"
      },
      "ip_address": "192.168.1.100",
      "created_at": "2026-04-01T09:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 237,
    "pages": 5
  }
}
```

```bash
curl "http://172.16.0.10:4000/api/audit?action=deploy&from_date=2026-04-01&page=1&limit=20" \
  -H "Authorization: Bearer eyJhbGciOi..."
```

---

## WebSocket

### WS /ws/status

Real-time slot status feed. Pushes updates every 5 seconds.

**Connection**: Requires JWT as query parameter:

```
ws://172.16.0.10:4000/ws/status?token=eyJhbGciOi...
```

Unauthenticated connections are rejected with WebSocket close code `4401`.

**Scope**:
- Students receive status updates for their own slot only.
- Instructors and admins receive status updates for all 20 slots.

**Message format** (server to client):

```json
{
  "type": "slot_status",
  "data": [
    {
      "slot_number": 3,
      "status": "running",
      "scenario_id": "scada_modbus_recon",
      "deployed_at": "2026-04-01T09:00:00.000Z"
    }
  ]
}
```

**Example connection** (JavaScript):

```javascript
const ws = new WebSocket(`ws://172.16.0.10:4000/ws/status?token=${accessToken}`);

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.type === 'slot_status') {
    updateSlotDisplay(message.data);
  }
};

ws.onclose = (event) => {
  if (event.code === 4401) {
    console.error('WebSocket auth failed — refresh token and reconnect');
  }
};
```

---

## Permission Matrix

| Route | Public | Student | Instructor | Admin |
|---|---|---|---|---|
| POST /auth/register | X | | | |
| POST /auth/login | X | | | |
| POST /auth/logout | X | | | |
| POST /auth/refresh | X | | | |
| GET /auth/me | | X | X | X |
| GET /users | | | X | X |
| POST /users | | | X | X |
| PATCH /users/:id | | | X | X |
| DELETE /users/:id | | | X | X |
| POST /users/:id/approve | | | X | X |
| GET /slots | | own slot | all | all |
| POST /slots/:slot/deploy | | | X | X |
| DELETE /slots/:slot/destroy | | | X | X |
| GET /slots/:slot/vms | | own slot | all | all |
| GET /consoles/vms | | own slot | all | all |
| POST /consoles/ticket | | own VMs | all VMs | all VMs |
| GET /scenarios | | X | X | X |
| GET /objectives | | X | X | X |
| POST /objectives/:n/complete | | X | | |
| GET /objectives/slot/:slot | | | X | X |
| POST /hints | | | X | X |
| GET /hints | | own slot | all | all |
| GET /audit | | | | X |
| WS /ws/status | | own slot | all | all |
