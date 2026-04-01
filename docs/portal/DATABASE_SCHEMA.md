# Portal Database Schema Reference

**Database**: PostgreSQL 16
**Migration tool**: node-pg-migrate
**Connection**: `portal-backend/src/db/pool.ts` (pg Pool singleton)
**Last updated**: 2026-04-01

---

## Entity Relationship Diagram

```
                          +------------------+
                          |      users       |
                          +------------------+
                          | id (PK, UUID)    |
                          | email (UNIQUE)   |
                          | username (UNIQUE)|
                          | password_hash    |
                          | full_name        |
                          | student_id       |
                          | role             |
                          | status           |
                          | lab_slot (UNIQUE)|
                          | created_at       |
                          | last_login       |
                 +------->| approved_by (FK) |--+ (self-ref)
                 |        | approved_at      |  |
                 |        +--------+---------+  |
                 |                 |             |
                 +-----------------+-------------+
                          |
          +---------------+---------------+----------------+
          |               |               |                |
          v               v               v                v
 +----------------+ +-----------+ +----------------+ +-------------+
 | refresh_tokens | | audit_log | | objectives_    | |    hints     |
 +----------------+ +-----------+ |   progress     | +-------------+
 | id (PK)        | | id (PK)   | +----------------+ | id (PK)     |
 | user_id (FK)---+ | actor_id  | | id (PK)        | | from_user   |
 | token_hash     | |   (FK)----+ | user_id (FK)---+ |   (FK)------+
 | expires_at     | | action    | | slot_number    | | to_slot     |
 | created_at     | | target_   | |   (FK)---------+ |   (FK)------+
 | revoked_at     | |   type    | | scenario_id    | | message     |
 | ip_address     | | target_id | | objective_n    | | created_at  |
 | user_agent     | | details   | | completed      | | read_at     |
 +----------------+ |   (JSONB) | | completed_at   | +------+------+
                     | ip_address| | UNIQUE(user_id,|        |
                     | created_at| |  slot, scenario,|       |
                     +-----------+ |  objective_n)  |        |
                                   +-------+--------+        |
                                           |                 |
                                           v                 v
                                   +------------------+
                                   |    lab_slots     |
                                   +------------------+
                                   | slot_number (PK) |<-----+
                                   | user_id (FK)-----+      |
                                   | scenario_id      |      |
                                   | status           |      |
                                   | tf_workspace     |      |
                                   |   (UNIQUE)       |      |
                                   | deployed_at      |      |
                                   | last_reset       |      |
                                   | deploy_log       |      |
                                   +--------+---------+
                                            |
                                            v
                                   +--------------------+
                                   | scenario_assignments|
                                   +--------------------+
                                   | id (PK)            |
                                   | slot_number (FK)---+
                                   | scenario_id        |
                                   | assigned_by (FK)---+ (-> users)
                                   | assigned_at        |
                                   | completed          |
                                   | completed_at       |
                                   +--------------------+

FK Legend:
  ──> ON DELETE CASCADE    (refresh_tokens, objectives_progress)
  ──> ON DELETE SET NULL   (lab_slots.user_id)
  ──> NO ACTION (default)  (all others)
```

---

## Tables

### 1. `users`

Central identity table. Stores all portal accounts: admins, instructors, and students.

| Column | Type | Nullable | Default | Constraints | Purpose |
|--------|------|----------|---------|-------------|---------|
| `id` | `UUID` | NOT NULL | `gen_random_uuid()` | PRIMARY KEY | Unique user identifier |
| `email` | `VARCHAR(255)` | NOT NULL | -- | UNIQUE | Login credential, must be unique |
| `username` | `VARCHAR(50)` | NOT NULL | -- | UNIQUE | Display name, must be unique |
| `password_hash` | `VARCHAR(255)` | NOT NULL | -- | -- | bcrypt hash (cost factor 12) |
| `full_name` | `VARCHAR(255)` | NOT NULL | -- | -- | Real name for instructor reference |
| `student_id` | `VARCHAR(50)` | NULL | -- | -- | Optional institutional student ID |
| `role` | `VARCHAR(20)` | NOT NULL | `'student'` | CHECK (`admin`, `instructor`, `student`) | RBAC role assignment |
| `status` | `VARCHAR(20)` | NOT NULL | `'pending'` | CHECK (`pending`, `active`, `locked`, `deleted`) | Account lifecycle state |
| `lab_slot` | `SMALLINT` | NULL | -- | UNIQUE, CHECK (1-20) | Assigned lab slot; one user per slot |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | -- | Registration timestamp |
| `last_login` | `TIMESTAMPTZ` | NULL | -- | -- | Updated on each successful login |
| `approved_by` | `UUID` | NULL | -- | FK -> `users(id)` | Instructor/admin who approved registration |
| `approved_at` | `TIMESTAMPTZ` | NULL | -- | -- | Timestamp of approval |

**Indexes**:

| Index | Column(s) | Rationale |
|-------|-----------|-----------|
| `idx_users_email` | `email` | Login lookup by email |
| `idx_users_role` | `role` | Filter users by role (admin panel) |
| `idx_users_status` | `status` | Filter pending registrations, active users |
| `idx_users_lab_slot` | `lab_slot` | Slot ownership lookup |

**Notes**:
- `approved_by` is a self-referencing FK. An admin/instructor approves a student.
- `lab_slot` UNIQUE constraint guarantees one-user-per-slot at the database level.
- `password_hash` uses bcrypt with cost factor 12 minimum. Never store plaintext.
- Soft delete: setting `status = 'deleted'` rather than removing the row preserves audit trail integrity.

---

### 2. `refresh_tokens`

Stores hashed refresh tokens for JWT session management. Each row represents one issued refresh token.

| Column | Type | Nullable | Default | Constraints | Purpose |
|--------|------|----------|---------|-------------|---------|
| `id` | `UUID` | NOT NULL | `gen_random_uuid()` | PRIMARY KEY | Token record identifier |
| `user_id` | `UUID` | NOT NULL | -- | FK -> `users(id)` ON DELETE CASCADE | Token owner |
| `token_hash` | `VARCHAR(255)` | NOT NULL | -- | -- | SHA-256 hash of the refresh token |
| `expires_at` | `TIMESTAMPTZ` | NOT NULL | -- | -- | Token expiration (default: 7 days from issue) |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | -- | Issue timestamp |
| `revoked_at` | `TIMESTAMPTZ` | NULL | -- | -- | Set on logout or token rotation |
| `ip_address` | `INET` | NULL | -- | -- | Client IP at token issue |
| `user_agent` | `TEXT` | NULL | -- | -- | Browser/client identifier at issue |

**Indexes**:

| Index | Column(s) | Rationale |
|-------|-----------|-----------|
| `idx_refresh_tokens_user` | `user_id` | Find all tokens for a user (revocation, cleanup) |

**Notes**:
- `token_hash` stores a SHA-256 hash, not the raw token. The raw token is returned to the client once and never stored server-side.
- ON DELETE CASCADE: deleting a user automatically removes all their refresh tokens.
- Token rotation: on refresh, the old token is revoked (`revoked_at` set) and a new token is issued. This limits the window for stolen token reuse.
- A valid token must satisfy: `revoked_at IS NULL AND expires_at > NOW()`.

---

### 3. `lab_slots`

Fixed 20-row table representing the physical lab slot capacity. Pre-populated on database creation.

| Column | Type | Nullable | Default | Constraints | Purpose |
|--------|------|----------|---------|-------------|---------|
| `slot_number` | `SMALLINT` | NOT NULL | -- | PRIMARY KEY, CHECK (1-20) | Slot identifier (1 through 20) |
| `user_id` | `UUID` | NULL | -- | FK -> `users(id)` ON DELETE SET NULL | Currently assigned student |
| `scenario_id` | `VARCHAR(100)` | NULL | -- | -- | Currently deployed scenario name |
| `status` | `VARCHAR(30)` | NOT NULL | `'empty'` | CHECK (5 values, see state machine) | Deployment lifecycle state |
| `tf_workspace` | `VARCHAR(100)` | NULL | -- | UNIQUE | Terraform workspace name (`student-slot-01` through `student-slot-20`) |
| `deployed_at` | `TIMESTAMPTZ` | NULL | -- | -- | Last successful deployment timestamp |
| `last_reset` | `TIMESTAMPTZ` | NULL | -- | -- | Last snapshot rollback timestamp |
| `deploy_log` | `TEXT` | NULL | -- | -- | Terraform stdout from last deploy/destroy |

**Notes**:
- This table always has exactly 20 rows. Rows are never inserted or deleted after initial seed.
- ON DELETE SET NULL on `user_id`: if a user is deleted, the slot becomes unassigned but the deployed scenario remains intact.
- `tf_workspace` maps directly to a Terraform workspace name for isolation.
- `deploy_log` stores the full Terraform output for debugging failed deployments.

---

### 4. `scenario_assignments`

Historical record of which scenarios have been deployed to which slots. Unlike `lab_slots.scenario_id` (current state), this table tracks all past assignments.

| Column | Type | Nullable | Default | Constraints | Purpose |
|--------|------|----------|---------|-------------|---------|
| `id` | `UUID` | NOT NULL | `gen_random_uuid()` | PRIMARY KEY | Assignment record identifier |
| `slot_number` | `SMALLINT` | NOT NULL | -- | FK -> `lab_slots(slot_number)` | Target slot |
| `scenario_id` | `VARCHAR(100)` | NOT NULL | -- | -- | Scenario that was assigned |
| `assigned_by` | `UUID` | NOT NULL | -- | FK -> `users(id)` | Instructor who made the assignment |
| `assigned_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | -- | Assignment timestamp |
| `completed` | `BOOLEAN` | NULL | `FALSE` | -- | Whether the student completed all objectives |
| `completed_at` | `TIMESTAMPTZ` | NULL | -- | -- | Completion timestamp |

**Notes**:
- No CASCADE on `slot_number` FK because `lab_slots` rows are never deleted.
- `assigned_by` does not CASCADE. If the assigning instructor is deleted, the assignment record must remain for audit purposes. Deletion will fail if the instructor has assignment records -- handle in application layer by soft-deleting users instead.

---

### 5. `audit_log`

Append-only log of all administrative and security-relevant actions. Never updated or deleted.

| Column | Type | Nullable | Default | Constraints | Purpose |
|--------|------|----------|---------|-------------|---------|
| `id` | `UUID` | NOT NULL | `gen_random_uuid()` | PRIMARY KEY | Log entry identifier |
| `actor_id` | `UUID` | NULL | -- | FK -> `users(id)` | User who performed the action (NULL for system events) |
| `action` | `VARCHAR(100)` | NOT NULL | -- | -- | Action identifier (e.g., `user_approved`, `slot_deployed`, `logout`) |
| `target_type` | `VARCHAR(50)` | NULL | -- | -- | Entity type affected (`user`, `slot`, `scenario`) |
| `target_id` | `VARCHAR(255)` | NULL | -- | -- | ID of the affected entity |
| `details` | `JSONB` | NULL | -- | -- | Structured context (role changes, error messages, request params) |
| `ip_address` | `INET` | NULL | -- | -- | Client IP address |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | -- | Event timestamp |

**Indexes**:

| Index | Column(s) | Rationale |
|-------|-----------|-----------|
| `idx_audit_actor` | `actor_id` | Filter log by user |
| `idx_audit_created` | `created_at DESC` | Paginate in reverse chronological order |

**Notes**:
- This table is append-only. Application code must never issue UPDATE or DELETE against it.
- `actor_id` is nullable for system-generated events (e.g., scheduled cleanup, startup checks).
- `details` JSONB allows flexible structured data without schema changes. Common keys: `{ role, previous_status, new_status, error, slot_number }`.
- Logged actions include: `register`, `login`, `logout`, `user_approved`, `user_locked`, `user_unlocked`, `password_reset`, `slot_deployed`, `slot_destroyed`, `slot_reset`, `objective_completed`, `unauthorized_access`.

---

### 6. `objectives_progress`

Tracks per-student, per-scenario objective completion. Self-reported by students.

| Column | Type | Nullable | Default | Constraints | Purpose |
|--------|------|----------|---------|-------------|---------|
| `id` | `UUID` | NOT NULL | `gen_random_uuid()` | PRIMARY KEY | Progress record identifier |
| `user_id` | `UUID` | NOT NULL | -- | FK -> `users(id)` ON DELETE CASCADE | Student who completed the objective |
| `slot_number` | `SMALLINT` | NOT NULL | -- | FK -> `lab_slots(slot_number)` | Slot where the work was done |
| `scenario_id` | `VARCHAR(100)` | NOT NULL | -- | -- | Scenario the objective belongs to |
| `objective_n` | `SMALLINT` | NOT NULL | -- | -- | Objective number within the scenario (1-based) |
| `completed` | `BOOLEAN` | NULL | `FALSE` | -- | Completion flag |
| `completed_at` | `TIMESTAMPTZ` | NULL | -- | -- | When the student marked it complete |

**Constraints**:

| Constraint | Columns | Purpose |
|------------|---------|---------|
| UNIQUE | `(user_id, slot_number, scenario_id, objective_n)` | Prevents duplicate completion records for the same objective |

**Notes**:
- ON DELETE CASCADE on `user_id`: deleting a user removes their progress records.
- The composite UNIQUE constraint ensures a student cannot mark the same objective complete twice for the same slot/scenario combination.
- `objective_n` corresponds to the numbered objectives in `docs/scenarios/<name>/OBJECTIVES.md`.

---

### 7. `hints`

Instructor-to-student messaging. Instructors send hints to a slot; the student assigned to that slot reads them.

| Column | Type | Nullable | Default | Constraints | Purpose |
|--------|------|----------|---------|-------------|---------|
| `id` | `UUID` | NOT NULL | `gen_random_uuid()` | PRIMARY KEY | Hint identifier |
| `from_user` | `UUID` | NOT NULL | -- | FK -> `users(id)` | Instructor who sent the hint |
| `to_slot` | `SMALLINT` | NOT NULL | -- | FK -> `lab_slots(slot_number)` | Target slot (student reads hints for their assigned slot) |
| `message` | `TEXT` | NOT NULL | -- | -- | Hint content |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | -- | Send timestamp |
| `read_at` | `TIMESTAMPTZ` | NULL | -- | -- | Set when the student marks the hint as read |

**Notes**:
- Hints are addressed to a slot, not a user. If a different student is assigned to the slot later, they see the existing hints. This is intentional -- hints are tied to the lab environment, not the person.
- `from_user` does not CASCADE. If the sending instructor is deleted, the hint must remain readable.
- Unread count: `SELECT COUNT(*) FROM hints WHERE to_slot = $1 AND read_at IS NULL`.

---

## State Machines

### `users.status`

```
                     +─────────────+
   POST /register    |             |
   ─────────────────>|   pending   |
                     |             |
                     +──────┬──────+
                            |
              POST /:id/approve
                            |
                            v
                     +─────────────+
                     |             |<────────────────────+
                     |   active    |   POST /:id/unlock  |
                     |             |                     |
                     +──┬──────┬──+                     |
                        |      |                        |
          POST /:id/lock|      | DELETE /:id       +────┴──────+
                        |      |                   |           |
                        v      |                   |  locked   |
                 +──────────+  |                   |           |
                 |          |  |                   +───────────+
                 |  locked  |──+
                 |          |  |
                 +──────────+  |
                               v
                        +─────────────+
                        |             |
                        |   deleted   |  (terminal — soft delete)
                        |             |
                        +─────────────+
```

**Transitions**:

| From | To | Trigger | Who |
|------|----|---------|-----|
| (new) | `pending` | `POST /api/auth/register` | Public (self-registration) |
| `pending` | `active` | `POST /api/users/:id/approve` | Instructor, Admin |
| `active` | `locked` | `POST /api/users/:id/lock` | Instructor, Admin |
| `locked` | `active` | `POST /api/users/:id/unlock` | Instructor, Admin |
| `active` | `deleted` | `DELETE /api/users/:id` | Admin |
| `locked` | `deleted` | `DELETE /api/users/:id` | Admin |

**Rules**:
- Only `active` users can authenticate. Middleware rejects `pending`, `locked`, and `deleted` with 403.
- `deleted` is terminal. Rows are never physically removed -- the email/username UNIQUE constraints remain occupied.
- Direct `pending` -> `deleted` is allowed (reject a registration).

---

### `lab_slots.status`

```
                     +─────────────+
                     |             |
        +───────────>|    empty    |<──────────────+
        |            |             |               |
        |            +──────┬──────+               |
        |                   |                      |
        |     POST /:slot/deploy                   |
        |                   |                      |
        |                   v                      |
        |            +─────────────+               |
        |            |             |               |
        |            |  deploying  |───────+       |
        |            |             |       |       |
        |            +──────┬──────+       |       |
        |                   |              |       |
        |             (success)         (failure)  |
        |                   |              |       |
        |                   v              v       |
        |            +─────────────+ +──────────+  |
        |            |             | |          |  |
        |            |   running   | |  error   |  |
        |            |             | |          |  |
        |            +──┬───┬──────+ +──┬───────+  |
        |               |   |          |           |
        |  POST /:slot/ |   |  DELETE  |  (retry   |
        |  reset        |   |  /:slot/ |   or      |
        |  (returns to  |   |  destroy |  destroy) |
        |   running)    |   |          |           |
        |               |   v          v           |
        |               | +─────────────+          |
        |               | |             |          |
        |               | | destroying  |──────────+
        |               | |             |  (success -> empty)
        |               | +──────┬──────+
        |               |        |
        |               |     (failure)
        |               |        |
        |               |        v
        |               |  +──────────+
        |               +->|  error   |
        |                  +──────────+
        |                       |
        +───────────────────────+
              (destroy succeeds)
```

**Transitions**:

| From | To | Trigger | Notes |
|------|----|---------|-------|
| `empty` | `deploying` | `POST /api/slots/:slot/deploy` | Terraform apply starts |
| `deploying` | `running` | Terraform apply succeeds | `deployed_at` updated |
| `deploying` | `error` | Terraform apply fails | `deploy_log` captures stderr |
| `running` | `destroying` | `DELETE /api/slots/:slot/destroy` | Terraform destroy starts |
| `running` | `running` | `POST /api/slots/:slot/reset` | Snapshot rollback; `last_reset` updated |
| `destroying` | `empty` | Terraform destroy succeeds | `scenario_id`, `deployed_at` cleared |
| `destroying` | `error` | Terraform destroy fails | Manual intervention required |
| `error` | `deploying` | Retry deploy | Instructor retries |
| `error` | `destroying` | Force destroy | Cleanup attempt |
| `error` | `empty` | Destroy succeeds after error | Slot fully cleaned |

---

## Migration Files

All migrations are plain SQL files executed by node-pg-migrate in order.

| File | Table | Key Operations |
|------|-------|----------------|
| `001_create-users.sql` | `users` | Create table, pgcrypto extension, 4 indexes |
| `002_create-refresh-tokens.sql` | `refresh_tokens` | Create table, FK to users with CASCADE, 1 index |
| `003_create-lab-slots.sql` | `lab_slots` | Create table, pre-populate 20 rows via `generate_series(1,20)` |
| `004_create-scenario-assignments.sql` | `scenario_assignments` | Create table, FKs to lab_slots and users |
| `005_create-audit-log.sql` | `audit_log` | Create table, 2 indexes (actor, created_at DESC) |
| `006_create-objectives-progress.sql` | `objectives_progress` | Create table, composite UNIQUE constraint, FKs with CASCADE |
| `007_create-hints.sql` | `hints` | Create table, FKs to users and lab_slots |

**Run migrations**:
```bash
DATABASE_URL=postgresql://labportal:PASSWORD@localhost:5432/labportal npx node-pg-migrate up
```

**Rollback last migration**:
```bash
DATABASE_URL=postgresql://labportal:PASSWORD@localhost:5432/labportal npx node-pg-migrate down
```

---

## Data Integrity Rules

### CASCADE Deletes

| Parent | Child | Behavior | Rationale |
|--------|-------|----------|-----------|
| `users` | `refresh_tokens` | CASCADE | Tokens are useless without the user |
| `users` | `objectives_progress` | CASCADE | Progress records belong to the user |
| `users` | `lab_slots.user_id` | SET NULL | Preserve the running deployment; unassign the user |

### Non-Cascading FKs

| Parent | Child Column | Behavior | Rationale |
|--------|-------------|----------|-----------|
| `users` | `audit_log.actor_id` | NO ACTION | Audit records must never be destroyed |
| `users` | `scenario_assignments.assigned_by` | NO ACTION | Assignment history must persist |
| `users` | `hints.from_user` | NO ACTION | Hints remain readable after instructor deletion |
| `users` | `users.approved_by` | NO ACTION | Approval chain must persist |

This means a user with audit log entries, scenario assignments, or sent hints cannot be physically deleted. Use soft delete (`status = 'deleted'`) instead.

### UNIQUE Constraints

| Table | Column(s) | Effect |
|-------|-----------|--------|
| `users` | `email` | One account per email address |
| `users` | `username` | One account per username |
| `users` | `lab_slot` | One user per slot (nullable -- unassigned users have NULL) |
| `lab_slots` | `tf_workspace` | Prevents Terraform workspace collisions |
| `objectives_progress` | `(user_id, slot_number, scenario_id, objective_n)` | One completion record per objective per user per slot per scenario |

### CHECK Constraints

| Table | Column | Allowed Values |
|-------|--------|----------------|
| `users` | `role` | `admin`, `instructor`, `student` |
| `users` | `status` | `pending`, `active`, `locked`, `deleted` |
| `users` | `lab_slot` | `1` through `20` |
| `lab_slots` | `slot_number` | `1` through `20` |
| `lab_slots` | `status` | `empty`, `deploying`, `running`, `error`, `destroying` |

---

## Common Query Patterns

### Authentication

```sql
-- Login: find user by email
SELECT id, email, username, password_hash, role, status, lab_slot, full_name
FROM users WHERE email = $1;

-- Validate refresh token
SELECT rt.id, rt.user_id, rt.expires_at, u.status, u.role
FROM refresh_tokens rt
JOIN users u ON u.id = rt.user_id
WHERE rt.token_hash = $1
  AND rt.revoked_at IS NULL
  AND rt.expires_at > NOW();

-- Revoke refresh token (rotation)
UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1;

-- Update last login
UPDATE users SET last_login = NOW() WHERE id = $1;
```

### User Management

```sql
-- List users with pagination and filters
SELECT id, email, username, full_name, role, status, lab_slot, created_at
FROM users
WHERE ($1::varchar IS NULL OR role = $1)
  AND ($2::varchar IS NULL OR status = $2)
ORDER BY created_at DESC
LIMIT $3 OFFSET $4;

-- Pending registrations
SELECT id, email, username, full_name, student_id, created_at
FROM users WHERE status = 'pending'
ORDER BY created_at ASC;

-- Approve user
UPDATE users
SET status = 'active', approved_by = $2, approved_at = NOW()
WHERE id = $1 AND status = 'pending';
```

### Slot Operations

```sql
-- All slots with assigned user info
SELECT s.slot_number, s.scenario_id, s.status, s.deployed_at, s.last_reset,
       u.id AS user_id, u.username, u.full_name
FROM lab_slots s
LEFT JOIN users u ON u.id = s.user_id
ORDER BY s.slot_number;

-- Assign user to slot
UPDATE users SET lab_slot = $2 WHERE id = $1;
UPDATE lab_slots SET user_id = $1 WHERE slot_number = $2;

-- Update slot status on deploy
UPDATE lab_slots
SET status = 'deploying', scenario_id = $2, deployed_at = NOW()
WHERE slot_number = $1;

-- Mark deploy complete
UPDATE lab_slots SET status = 'running' WHERE slot_number = $1;

-- Mark deploy failed
UPDATE lab_slots SET status = 'error', deploy_log = $2 WHERE slot_number = $1;
```

### Student Progress

```sql
-- Get objectives for current user's slot
SELECT objective_n, completed, completed_at
FROM objectives_progress
WHERE user_id = $1 AND slot_number = $2 AND scenario_id = $3
ORDER BY objective_n;

-- Mark objective complete
INSERT INTO objectives_progress (user_id, slot_number, scenario_id, objective_n, completed, completed_at)
VALUES ($1, $2, $3, $4, TRUE, NOW())
ON CONFLICT (user_id, slot_number, scenario_id, objective_n)
DO UPDATE SET completed = TRUE, completed_at = NOW();

-- Instructor: view all students' progress for a slot
SELECT op.objective_n, op.completed, op.completed_at, u.username
FROM objectives_progress op
JOIN users u ON u.id = op.user_id
WHERE op.slot_number = $1
ORDER BY u.username, op.objective_n;
```

### Hints

```sql
-- Student: get hints for my slot
SELECT id, message, created_at, read_at
FROM hints WHERE to_slot = $1
ORDER BY created_at DESC;

-- Unread count
SELECT COUNT(*) AS unread FROM hints
WHERE to_slot = $1 AND read_at IS NULL;

-- Instructor: send hint
INSERT INTO hints (from_user, to_slot, message)
VALUES ($1, $2, $3);

-- Mark hint read
UPDATE hints SET read_at = NOW()
WHERE id = $1 AND read_at IS NULL;
```

### Audit Log

```sql
-- Paginated audit log with filters
SELECT al.id, al.action, al.target_type, al.target_id,
       al.details, al.ip_address, al.created_at,
       u.username AS actor_username
FROM audit_log al
LEFT JOIN users u ON u.id = al.actor_id
WHERE ($1::uuid IS NULL OR al.actor_id = $1)
  AND ($2::varchar IS NULL OR al.action = $2)
  AND ($3::timestamptz IS NULL OR al.created_at >= $3)
  AND ($4::timestamptz IS NULL OR al.created_at <= $4)
ORDER BY al.created_at DESC
LIMIT $5 OFFSET $6;

-- Write audit entry
INSERT INTO audit_log (actor_id, action, target_type, target_id, details, ip_address)
VALUES ($1, $2, $3, $4, $5, $6);
```

---

## Seed Data

The `seeds/seed.ts` script creates:

1. **Admin account**: `admin@lab.local` / username `admin` / bcrypt cost 12
   - Role: `admin`, Status: `active`
   - Password set via `ADMIN_PASSWORD` env var (default: `ChangeMe123!@#`)
2. **20 lab slots**: `slot_number` 1 through 20, all status `empty`, no assigned users

Run after migrations:
```bash
DATABASE_URL=postgresql://labportal:PASSWORD@localhost:5432/labportal npx tsx seeds/seed.ts
```

---

## Storage and Retention Notes

- **Refresh tokens**: expired and revoked tokens accumulate. Schedule periodic cleanup:
  ```sql
  DELETE FROM refresh_tokens
  WHERE revoked_at IS NOT NULL OR expires_at < NOW() - INTERVAL '30 days';
  ```
- **Audit log**: grows indefinitely by design. For long-running deployments, consider partitioning by `created_at` or archiving entries older than 1 year.
- **Deploy log**: `lab_slots.deploy_log` stores full Terraform output as TEXT. Large deployments may produce logs exceeding 100KB. No automatic truncation.
- **Pool configuration**: max 10 connections (configurable via `DATABASE_POOL_MAX`), 30s idle timeout, 5s connect timeout. Sufficient for 20 concurrent students plus instructor operations.
