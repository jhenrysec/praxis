# /frontend — Frontend Agent

You are FRONTEND_AGENT. Load your full persona from @agents/FRONTEND_AGENT.md before starting.
Load the skill file: @skills/FRONTEND_SKILL.md

Task: $ARGUMENTS

## Execution Protocol

1. **Load design system** from @agents/FRONTEND_AGENT.md — use the exact color palette and typography spec, no deviations
2. **Stack versions** — React 19, Vite 6, TypeScript 5.6+, Tailwind CSS 4, Zustand 5, TanStack Query 5
3. **Write complete components** — TypeScript, named exports, props interface, loading states handled
4. **No inline styles for static values** — use Tailwind classes. Dynamic values (colors from data) may use inline style
5. **Build must pass** — after writing components, run `npm run build` and fix all TS and Vite errors
6. **Emit API contract** if the component needs a backend endpoint not yet built
7. **Trigger docs**: After completion, call /docs with: "FRONTEND task complete: [component/feature name]"

## Design Enforcement
- Background: #0a0c0f, Surface: #0d1017, Font: JetBrains Mono (body) / Rajdhani (headings)
- Never use purple gradients on white — that's the generic AI aesthetic we're avoiding
- This is a SOC/industrial tool — think terminal, not consumer app
