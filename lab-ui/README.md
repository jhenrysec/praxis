# Lab UI

Scenario deployment dashboard for the Vulnerability Lab.

**Built by**: FRONTEND_AGENT during `/phase 9`  
**Stack**: React 19 · Vite 6 · TypeScript · Tailwind CSS 4 · Zustand · TanStack Query

## Status

This directory is scaffolded. Run `/phase 9` in Claude Code to generate the full application.

## Development (after phase 9)

```bash
cd lab-ui
npm install
npm run dev       # dev server at http://localhost:5173
npm run build     # production build to dist/
npm run type-check # TypeScript validation
```

## What Gets Built

- **Scenario deployment dashboard** — browse, deploy, destroy scenarios
- **Live VM status panel** — real-time VM state from Proxmox API
- **Terminal output panel** — streams Terraform/Ansible output via xterm.js
- **Network topology diagram** — auto-generated SVG per scenario
- **Student access portal** — read-only scenario objectives and credentials

## Design System

Dark industrial theme — see `agents/FRONTEND_AGENT.md` for the full palette and typography spec.
