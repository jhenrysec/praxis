# Portal System — Deployment and Operations Guide

Covers deploying `portal-backend` (Express 5 API) and `portal-ui` (React 19 SPA) on the Proxmox management host (172.16.0.10).

**Stack**: Node.js 22 LTS, Express 5, React 19 + Vite 6, PostgreSQL 16, PM2, nginx
**Ports**: nginx 3000 (public), backend 4000 (internal only)
**Last updated**: 2026-04-01

---

## Prerequisites

Install on the management host (172.16.0.10):

```bash
# Node.js 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# PostgreSQL 16
sudo apt install -y postgresql-16

# nginx
sudo apt install -y nginx

# PM2 (production process manager)
sudo npm install -g pm2@5
```

Verify versions:

```bash
node --version    # v22.x.x
psql --version    # psql (PostgreSQL) 16.x
nginx -v          # nginx/1.x.x
pm2 --version     # 5.x.x
```

Create the Proxmox API token if not already done:

```bash
pveum user add terraform@pve
pveum aclmod / -user terraform@pve -role PVEAdmin
pveum user token add terraform@pve terraform --privsep=0
# Save the token ID and secret — you need them for .env
```

---

## Database Setup

```bash
# Create database user and database
sudo -u postgres createuser labportal
sudo -u postgres createdb -O labportal labportal

# Set the database password
sudo -u postgres psql -c "ALTER USER labportal WITH PASSWORD 'CHANGE_THIS_PASSWORD';"
```

---

## Backend Deployment

### Configure Environment

```bash
cd /opt/vuln-lab/portal-backend
cp .env.example .env
```

Edit `.env` with production values:

```bash
NODE_ENV=production
PORT=4000

# Database
DATABASE_URL=postgresql://labportal:CHANGE_THIS_PASSWORD@localhost:5432/labportal
DATABASE_POOL_MAX=10
DATABASE_SSL=false
DATABASE_SSL_REJECT_UNAUTHORIZED=true

# JWT — generate a unique secret
JWT_SECRET=$(openssl rand -hex 64)
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_DAYS=7

# Proxmox — REQUIRED, no defaults
PROXMOX_URL=https://172.16.0.10:8006
PROXMOX_TOKEN_ID=terraform@pve!terraform
PROXMOX_TOKEN_SECRET=<uuid-from-token-creation>
PROXMOX_NODE=pve01

# Portal
PORTAL_ORIGIN=http://172.16.0.10:3000
AUTO_APPROVE_STUDENTS=false
MAX_STUDENT_SLOTS=20
REPO_ROOT=/opt/vuln-lab

# Email (console mode logs to stdout instead of sending)
EMAIL_MODE=console
```

### Install, Migrate, Seed, Build

```bash
cd /opt/vuln-lab/portal-backend
npm install
npm run migrate    # runs node-pg-migrate up — creates all tables
npm run seed       # creates admin@lab.local and 20 lab slots
npm run build      # tsc → dist/
```

Verify the build:

```bash
ls dist/index.js   # must exist
```

### Start with PM2

```bash
pm2 start dist/index.js --name portal-backend --env production
pm2 save
pm2 startup        # follow the printed command to enable boot persistence
```

Verify the backend is running:

```bash
curl -s http://127.0.0.1:4000/api/health | jq .
# Expected: { "status": "ok" }
```

---

## Frontend Deployment

### Build the SPA

```bash
cd /opt/vuln-lab/portal-ui
npm install
npm run build      # vite build → dist/
```

Verify the build:

```bash
ls dist/index.html   # must exist
```

### Deploy to nginx Web Root

```bash
sudo mkdir -p /var/www/portal
sudo cp -r dist/* /var/www/portal/
sudo chown -R www-data:www-data /var/www/portal
```

---

## nginx Configuration

Create `/etc/nginx/sites-available/portal`:

```nginx
server {
    listen 3000;
    server_name 172.16.0.10;

    root /var/www/portal;
    index index.html;

    # API proxy — all /api/* requests go to the backend
    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }

    # WebSocket proxy — slot status broadcast + VNC
    location /ws/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400s;
    }

    # SPA fallback — all other routes serve index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Static asset caching
    location ~* \.(js|css|png|jpg|ico|svg|woff2)$ {
        expires 7d;
        add_header Cache-Control "public, immutable";
    }
}
```

Enable and start:

```bash
sudo ln -sf /etc/nginx/sites-available/portal /etc/nginx/sites-enabled/portal
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t          # must report "syntax is ok"
sudo systemctl reload nginx
sudo systemctl enable nginx
```

Verify the portal is accessible:

```bash
curl -s -o /dev/null -w "%{http_code}" http://172.16.0.10:3000/
# Expected: 200
```

---

## Development Mode

For local development, run backend and frontend separately without PM2 or nginx.

```bash
# Terminal 1 — backend (auto-reloads on file changes)
cd /opt/vuln-lab/portal-backend
npm run dev    # tsx watch src/index.ts — listens on port 4000

# Terminal 2 — frontend (Vite dev server with HMR)
cd /opt/vuln-lab/portal-ui
npm run dev    # vite dev — listens on port 5173, proxies /api/* to 4000
```

Access the dev frontend at `http://172.16.0.10:5173`.

---

## Operations

### Restart Backend

```bash
pm2 restart portal-backend
```

### View Live Logs

```bash
pm2 logs portal-backend              # stream stdout + stderr
pm2 logs portal-backend --lines 50   # last 50 lines
```

### Check Process Status

```bash
pm2 status
```

### Redeploy Frontend After Changes

```bash
cd /opt/vuln-lab/portal-ui
npm run build
sudo cp -r dist/* /var/www/portal/
```

No nginx restart needed — static files are served directly.

### Redeploy Backend After Changes

```bash
cd /opt/vuln-lab/portal-backend
npm run build
pm2 restart portal-backend
```

### Run a New Migration

```bash
cd /opt/vuln-lab/portal-backend
npx node-pg-migrate create <migration_name>
# Edit the new file in migrations/
npm run migrate
pm2 restart portal-backend
```

### Reset Admin Password

```bash
cd /opt/vuln-lab/portal-backend
node -e "
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const pw = 'NewSecurePassword!';
bcrypt.hash(pw, 12).then(h =>
  pool.query('UPDATE users SET password_hash = \$1 WHERE email = \$2', [h, 'admin@lab.local'])
  .then(() => { console.log('Password reset to:', pw); pool.end(); })
);
"
```

### Database Backup

```bash
pg_dump -U labportal labportal > /opt/vuln-lab/backups/portal_$(date +%Y%m%d_%H%M%S).sql
```

### Database Restore

```bash
psql -U labportal labportal < /opt/vuln-lab/backups/portal_20260401_120000.sql
```

---

## Health Check

Backend health endpoint:

```bash
curl -s http://172.16.0.10:4000/api/health | jq .
# Expected: { "status": "ok" }
```

Full stack verification:

```bash
# Backend responds
curl -sf http://127.0.0.1:4000/api/health > /dev/null && echo "Backend: OK" || echo "Backend: FAIL"

# nginx serves frontend
curl -sf http://172.16.0.10:3000/ > /dev/null && echo "Frontend: OK" || echo "Frontend: FAIL"

# nginx proxies API
curl -sf http://172.16.0.10:3000/api/health > /dev/null && echo "API proxy: OK" || echo "API proxy: FAIL"

# Database accessible
sudo -u postgres psql -d labportal -c "SELECT COUNT(*) FROM users;" > /dev/null 2>&1 && echo "Database: OK" || echo "Database: FAIL"

# PM2 process running
pm2 pid portal-backend > /dev/null 2>&1 && echo "PM2: OK" || echo "PM2: FAIL"
```

---

## Security Notes

- **JWT_SECRET**: Must be at least 64 hex characters. Generate with `openssl rand -hex 64`. Rotate by updating `.env` and restarting the backend — all active sessions will be invalidated.
- **PROXMOX_TOKEN_ID and PROXMOX_TOKEN_SECRET**: Required. The backend refuses to start if either is missing. Never use default/fallback values.
- **DATABASE_SSL**: Defaults to `false` for local PostgreSQL connections over Unix socket or localhost. Set to `true` with a valid certificate for remote database connections.
- **Port 4000**: Never expose directly to the network. All external access goes through nginx on port 3000.
- **WebSocket authentication**: The `/ws/status` endpoint requires a JWT token as `?token=<jwt>` query parameter. Unauthenticated connections are rejected with close code 4401.
- **Password hashing**: All passwords use bcrypt with cost factor 12.
- **Refresh tokens**: Hashed with SHA-256 before database storage. Stored in sessionStorage (cleared on tab close). Rotated on every use (old token revoked, new token issued).
- **Rate limiting**: Auth endpoints (`/api/auth/login`, `/api/auth/register`, `/api/auth/refresh`) limited to 15 requests per 15 minutes. VNC ticket endpoint limited to 10 requests per minute.
- **Access tokens**: Held in memory only (never localStorage). 15-minute expiry with automatic refresh.

---

## Troubleshooting

### Backend won't start

```bash
pm2 logs portal-backend --lines 20
```

Common causes:
- Missing `PROXMOX_TOKEN_ID` or `PROXMOX_TOKEN_SECRET` in `.env`
- PostgreSQL not running: `sudo systemctl status postgresql`
- Wrong `DATABASE_URL`: test with `psql "postgresql://labportal:PASSWORD@localhost:5432/labportal"`
- Port 4000 already in use: `lsof -i :4000`

### Frontend shows blank page

- Check nginx error log: `sudo tail -20 /var/log/nginx/error.log`
- Verify files exist: `ls /var/www/portal/index.html`
- Check nginx config: `sudo nginx -t`

### API returns 502 Bad Gateway

- Backend is down: `pm2 status` — restart if stopped
- Port mismatch: verify `proxy_pass` in nginx matches backend `PORT` in `.env`

### WebSocket connection fails

- Verify nginx `Upgrade` and `Connection` headers in `/ws/` location block
- Check that the frontend sends a valid JWT as `?token=` query parameter
- Backend log will show `WebSocket auth failed` if token is invalid or expired

### Migrations fail

```bash
cd /opt/vuln-lab/portal-backend
DATABASE_URL="postgresql://labportal:PASSWORD@localhost:5432/labportal" npx node-pg-migrate up
```

Check for lock conflicts:

```sql
SELECT * FROM pgmigrations ORDER BY id DESC LIMIT 5;
```

### Default Credentials

| Account | Email | Default Password | Action |
|---------|-------|-----------------|--------|
| Admin | admin@lab.local | Set during seed (see `.env` `ADMIN_PASSWORD` or seed output) | Change immediately after first login |

---

## File Locations

| Component | Path |
|-----------|------|
| Backend source | `/opt/vuln-lab/portal-backend/` |
| Backend build output | `/opt/vuln-lab/portal-backend/dist/` |
| Backend environment | `/opt/vuln-lab/portal-backend/.env` |
| Frontend source | `/opt/vuln-lab/portal-ui/` |
| Frontend build output | `/opt/vuln-lab/portal-ui/dist/` |
| nginx static root | `/var/www/portal/` |
| nginx site config | `/etc/nginx/sites-available/portal` |
| PM2 logs | `~/.pm2/logs/portal-backend-*.log` |
| Database backups | `/opt/vuln-lab/backups/` |
| Migrations | `/opt/vuln-lab/portal-backend/migrations/` |
