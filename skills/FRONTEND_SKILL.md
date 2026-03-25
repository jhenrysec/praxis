# Skill: Lab UI Frontend Development

**Applies to**: FRONTEND_AGENT  
**Stack**: React 19, Vite 6, Tailwind CSS 4, Zustand 5, TanStack Query 5  
**Design system**: Industrial/SOC dark theme — see FRONTEND_AGENT.md for palette  
**Last reviewed**: 2025-06

---

## Project Bootstrap

```bash
# Initialize project
npm create vite@latest lab-ui -- --template react-ts
cd lab-ui

# Install dependencies
npm install @tanstack/react-query@5 zustand@5 lucide-react
npm install xterm @xterm/addon-fit @xterm/addon-web-links
npm install recharts

# Dev dependencies
npm install -D tailwindcss@4 @tailwindcss/vite autoprefixer
npm install -D @types/node vitest @testing-library/react

# Google Fonts (JetBrains Mono + Rajdhani)
# Add to index.html <head>:
# <link rel="preconnect" href="https://fonts.googleapis.com">
# <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;700&family=Rajdhani:wght@500;600;700&display=swap" rel="stylesheet">
```

---

## tailwind.config.ts

```typescript
import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
        display: ["Rajdhani", "sans-serif"],
      },
      colors: {
        // Lab design system — extend Tailwind, don't replace
        lab: {
          bg:       "#0a0c0f",
          surface:  "#0d1017",
          hover:    "#131820",
          border:   "#1e2228",
          "border-active": "#2d3139",
          muted:    "#4b5563",
          secondary:"#8b949e",
          primary:  "#e6edf3",
          green:    "#00e5a0",
          blue:     "#6c8fff",
          amber:    "#facc15",
          red:      "#fb7185",
          purple:   "#a78bfa",
        },
      },
    },
  },
} satisfies Config;
```

---

## Global CSS (src/index.css)

```css
@import "tailwindcss";

:root {
  color-scheme: dark;
}

body {
  background-color: #0a0c0f;
  color: #e6edf3;
  font-family: "JetBrains Mono", monospace;
}

/* Scrollbar */
::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-track { background: #0a0c0f; }
::-webkit-scrollbar-thumb { background: #2d3139; border-radius: 2px; }
::-webkit-scrollbar-thumb:hover { background: #4b5563; }

/* Focus ring */
*:focus-visible {
  outline: 1px solid #6c8fff;
  outline-offset: 2px;
  border-radius: 2px;
}
```

---

## Component Patterns

### StatusBadge Component
```tsx
// src/components/StatusBadge.tsx
type Status = "running" | "stopped" | "deploying" | "template" | "error";

interface StatusBadgeProps {
  status: Status;
  label?: string;
}

const STATUS_CONFIG: Record<Status, { color: string; bg: string; border: string; label: string }> = {
  running:   { color: "#00e5a0", bg: "#00e5a01a", border: "#00e5a033", label: "RUNNING" },
  stopped:   { color: "#fb7185", bg: "#fb71851a", border: "#fb718533", label: "STOPPED" },
  deploying: { color: "#facc15", bg: "#facc151a", border: "#facc1533", label: "DEPLOYING" },
  template:  { color: "#6c8fff", bg: "#6c8fff1a", border: "#6c8fff33", label: "TEMPLATE" },
  error:     { color: "#fb7185", bg: "#fb71851a", border: "#fb718533", label: "ERROR" },
};

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      style={{
        color: cfg.color,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
      }}
      className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-medium tracking-widest uppercase"
    >
      {label ?? cfg.label}
    </span>
  );
}
```

### Terminal Output Panel (xterm.js)
```tsx
// src/components/Terminal.tsx
import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

interface TerminalProps {
  output: string[];
  onClear?: () => void;
}

export function Terminal({ output }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new XTerm({
      theme: {
        background: "#0d1017",
        foreground: "#c9d1d9",
        cursor: "#00e5a0",
        green: "#00e5a0",
        cyan: "#6c8fff",
        yellow: "#facc15",
        red: "#fb7185",
      },
      fontFamily: "JetBrains Mono, monospace",
      fontSize: 12,
      cursorBlink: true,
      scrollback: 5000,
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    fit.fit();

    termRef.current = term;
    fitRef.current = fit;

    const ro = new ResizeObserver(() => fit.fit());
    ro.observe(containerRef.current);

    return () => { ro.disconnect(); term.dispose(); };
  }, []);

  useEffect(() => {
    const term = termRef.current;
    if (!term || output.length === 0) return;
    const latest = output[output.length - 1];
    term.write(latest + "\r\n");
    term.scrollToBottom();
  }, [output]);

  return (
    <div
      ref={containerRef}
      className="w-full rounded border border-lab-border"
      style={{ height: "300px", background: "#0d1017", padding: "8px" }}
    />
  );
}
```

### Scenario Card
```tsx
// src/components/ScenarioCard.tsx
import { Play, Trash2, Network } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import type { Scenario } from "../types";

interface ScenarioCardProps {
  scenario: Scenario;
  onDeploy: (id: string) => void;
  onDestroy: (id: string) => void;
}

export function ScenarioCard({ scenario, onDeploy, onDestroy }: ScenarioCardProps) {
  const isActive = scenario.status === "running" || scenario.status === "deploying";

  return (
    <div className="rounded border border-lab-border bg-lab-surface p-4 hover:border-lab-border-active transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-[10px] font-mono tracking-widest text-lab-muted uppercase mb-1">
            {scenario.id}
          </p>
          <h3 className="font-display font-semibold text-base text-lab-primary tracking-wide">
            {scenario.name}
          </h3>
        </div>
        <StatusBadge status={scenario.status} />
      </div>

      <p className="text-xs text-lab-secondary mb-3 leading-relaxed">
        {scenario.description}
      </p>

      <div className="flex gap-2 text-[10px] text-lab-muted mb-4">
        <span className="px-2 py-0.5 rounded bg-lab-hover border border-lab-border">
          {scenario.difficulty}
        </span>
        <span className="px-2 py-0.5 rounded bg-lab-hover border border-lab-border">
          {scenario.duration}
        </span>
        <span className="px-2 py-0.5 rounded bg-lab-hover border border-lab-border">
          {scenario.vmCount} VMs
        </span>
      </div>

      <div className="flex gap-2">
        {!isActive ? (
          <button
            onClick={() => onDeploy(scenario.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono
                       bg-lab-green text-lab-bg hover:opacity-90 transition-opacity"
            aria-label={`Deploy ${scenario.name}`}
          >
            <Play size={12} /> Deploy
          </button>
        ) : (
          <button
            onClick={() => onDestroy(scenario.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono
                       bg-lab-red/20 text-lab-red border border-lab-red/30 hover:bg-lab-red/30 transition-colors"
            aria-label={`Destroy ${scenario.name}`}
          >
            <Trash2 size={12} /> Destroy
          </button>
        )}
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono
                     border border-lab-border text-lab-secondary hover:text-lab-primary hover:border-lab-border-active transition-colors"
          aria-label="View network topology"
        >
          <Network size={12} /> Topology
        </button>
      </div>
    </div>
  );
}
```

---

## Zustand Store Pattern

```typescript
// src/stores/labStore.ts
import { create } from "zustand";
import type { Scenario, VM } from "../types";

interface LabState {
  scenarios: Scenario[];
  activeVMs: VM[];
  deploymentLog: string[];
  selectedScenario: string | null;

  setScenarios: (scenarios: Scenario[]) => void;
  setActiveVMs: (vms: VM[]) => void;
  appendLog: (line: string) => void;
  clearLog: () => void;
  selectScenario: (id: string | null) => void;
}

export const useLabStore = create<LabState>((set) => ({
  scenarios: [],
  activeVMs: [],
  deploymentLog: [],
  selectedScenario: null,

  setScenarios: (scenarios) => set({ scenarios }),
  setActiveVMs: (vms) => set({ vms }),
  appendLog: (line) =>
    set((state) => ({ deploymentLog: [...state.deploymentLog, line] })),
  clearLog: () => set({ deploymentLog: [] }),
  selectScenario: (id) => set({ selectedScenario: id }),
}));
```

---

## API Client Pattern

```typescript
// src/api/labApi.ts
const BASE = import.meta.env.VITE_API_BASE_URL ?? "http://172.16.0.10:3001";

export async function getScenarios(): Promise<Scenario[]> {
  const res = await fetch(`${BASE}/api/scenarios`);
  if (!res.ok) throw new Error(`Failed to fetch scenarios: ${res.statusText}`);
  return res.json();
}

export function streamDeploy(
  scenarioId: string,
  onLine: (line: string) => void,
  onDone: () => void
): () => void {
  const controller = new AbortController();

  fetch(`${BASE}/api/deploy/${scenarioId}`, {
    method: "POST",
    signal: controller.signal,
  }).then(async (res) => {
    if (!res.body) return;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) { onDone(); break; }
      onLine(decoder.decode(value));
    }
  });

  return () => controller.abort();
}
```
