# VERSION_MANIFEST — Portal Stack Additions
# Merge these entries into docs/VERSION_MANIFEST.md

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

## Portal UI (additions to existing frontend table)

| Component | Version | Source |
|---|---|---|
| react-router-dom | 7.0.x | npm |
| @novnc/novnc | 1.5.x | npm |
| nginx | 1.24.x | apt | `nginx -v` |

## Database

| Component | Version | Notes |
|---|---|---|
| PostgreSQL 16 | 16.x | Installed via pgdg apt repo |
| Database name | labportal | |
| DB user | labportal | password in portal-backend/.env |
