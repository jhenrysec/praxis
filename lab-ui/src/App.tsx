import {
  LayoutDashboard,
  Server,
  Shield,
  Terminal,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useTerminalStore } from '@/stores/terminalStore';
import { Dashboard } from '@/pages/Dashboard';
import { ScenarioDetail } from '@/pages/ScenarioDetail';
import { SlotsOverview } from '@/pages/SlotsOverview';
import { TerminalPanel } from '@/components/TerminalPanel';
import type { ViewMode } from '@/types';

interface NavItem {
  id: ViewMode;
  label: string;
  icon: typeof LayoutDashboard;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'scenario', label: 'Scenarios', icon: Shield },
  { id: 'slots', label: 'Lab Slots', icon: Server },
];

function PageContent() {
  const { view } = useUIStore();

  switch (view) {
    case 'scenario':
      return <ScenarioDetail />;
    case 'slots':
      return <SlotsOverview />;
    default:
      return <Dashboard />;
  }
}

export function App() {
  const { view, setView, sidebarOpen, toggleSidebar, terminalOpen, toggleTerminal } =
    useUIStore();
  const { isStreaming } = useTerminalStore();

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`flex flex-col border-r border-[#1e2228] bg-[#0d1017] transition-all ${
          sidebarOpen ? 'w-52' : 'w-14'
        }`}
      >
        {/* Logo area */}
        <div className="flex h-14 items-center justify-between border-b border-[#1e2228] px-3">
          {sidebarOpen && (
            <span className="font-heading text-sm font-bold tracking-wide text-[#00e5a0]">
              VULN LAB
            </span>
          )}
          <button
            onClick={toggleSidebar}
            className="rounded p-1 text-[#4b5563] hover:bg-[#131820] hover:text-[#8b949e] transition-colors"
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 p-2 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = view === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-all ${
                  isActive
                    ? 'bg-[#00e5a00d] text-[#00e5a0]'
                    : 'text-[#8b949e] hover:bg-[#131820] hover:text-[#e6edf3]'
                }`}
                aria-label={item.label}
              >
                <item.icon size={18} />
                {sidebarOpen && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Terminal toggle */}
        <div className="border-t border-[#1e2228] p-2">
          <button
            onClick={toggleTerminal}
            className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-all ${
              terminalOpen
                ? 'bg-[#00e5a00d] text-[#00e5a0]'
                : 'text-[#8b949e] hover:bg-[#131820] hover:text-[#e6edf3]'
            }`}
            aria-label="Toggle terminal"
          >
            <Terminal size={18} />
            {sidebarOpen && (
              <span className="flex items-center gap-2">
                Terminal
                {isStreaming && (
                  <span className="h-2 w-2 animate-pulse-green rounded-full bg-[#00e5a0]" />
                )}
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 items-center justify-between border-b border-[#1e2228] bg-[#0d1017] px-6">
          <h1 className="font-heading text-lg font-semibold text-[#e6edf3]">
            Vulnerability Lab Dashboard
          </h1>
          <div className="flex items-center gap-3 text-xs text-[#4b5563]">
            <span className="label-mono">PROXMOX VE 9.1</span>
            <span className="h-4 w-px bg-[#1e2228]" />
            <span className="label-mono">PVE01</span>
          </div>
        </header>

        {/* Content + optional terminal */}
        <div className="flex flex-1 overflow-hidden">
          {/* Page content */}
          <main className="flex-1 overflow-y-auto p-6">
            <PageContent />
          </main>

          {/* Terminal panel (right side) */}
          {terminalOpen && (
            <div className="w-[480px] border-l border-[#1e2228]">
              <TerminalPanel />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
