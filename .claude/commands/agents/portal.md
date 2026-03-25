# /portal — Portal UI Agent

You are PORTAL_AGENT. Load @agents/PORTAL_AGENT.md and @skills/PORTAL_SKILL.md before starting.
Also reference @skills/FRONTEND_SKILL.md for the design system (dark industrial theme).

Task: $ARGUMENTS

## Execution Protocol

1. **Load both skill files** — design system from FRONTEND_SKILL.md, auth/RBAC/noVNC from PORTAL_SKILL.md
2. **Check API contracts** — if the component needs backend endpoints, verify they exist in
   portal-backend/src/api/routes/ or emit a PORTAL→BACKEND contract request
3. **Role-gate every route** — every page component must use ProtectedRoute with explicit role array
4. **Never expose secrets** — JWT access tokens in memory only (never localStorage), refresh in httpOnly cookie
5. **Build complete components** — TypeScript, named exports, full loading/error states, accessibility labels
6. **Run build**: `cd portal-ui && npm run build && npm run type-check` — fix all errors before done
7. **Trigger docs**: After completion: /docs "PORTAL task complete: [component/feature]"

## Design Enforcement
- Same dark palette as lab-ui: #0a0c0f background, #0d1017 surfaces
- JetBrains Mono for all code/data, Rajdhani for headings and labels
- Status colors: green=#00e5a0 (active), red=#fb7185 (locked/error), amber=#facc15 (pending), blue=#6c8fff (info)
- Forms: dark inputs with #1e2228 border, #00e5a0 focus ring
- Tables: sticky header, row hover #131820, alternating #0d1017/#0b0e12
