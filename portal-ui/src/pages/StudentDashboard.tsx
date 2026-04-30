import { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useMySlot, useMySlotVMs, useMyObjectives, useMyHints, useCompleteObjective, useMarkHintRead, useScenarioDetail } from '../hooks/useStudent';
import { StatusBadge } from '../components/shared/StatusBadge';
import { PerVmControls } from '../components/shared/PerVmControls';
import {
  BookOpen, Target, Monitor, MessageSquare, CheckCircle2, Circle,
  Cpu, MemoryStick, Clock, AlertTriangle, Terminal, Settings2, ChevronRight,
} from 'lucide-react';
import type { VMInfo, ObjectiveProgress, Hint } from '../types';

export function StudentDashboard() {
  const { user } = useAuthStore();
  const slot = user?.lab_slot ?? null;

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-wide">
          Welcome, {user?.full_name}
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          {slot
            ? `Lab Slot #${slot}`
            : 'No lab slot assigned — contact your instructor'}
        </p>
      </div>

      {slot === null ? (
        <NoSlotAssigned />
      ) : (
        <SlotDashboard slotNumber={slot} />
      )}
    </div>
  );
}

function NoSlotAssigned() {
  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-12 text-center">
      <AlertTriangle className="w-12 h-12 text-[var(--accent-amber)] mx-auto mb-4" />
      <h2 className="text-lg font-bold mb-2">No Lab Slot Assigned</h2>
      <p className="text-[var(--text-muted)] text-sm max-w-md mx-auto">
        Your instructor needs to assign you a lab slot before you can access
        scenarios, VMs, and objectives. Please contact your instructor.
      </p>
    </div>
  );
}

function SlotDashboard({ slotNumber }: { slotNumber: number }) {
  const { data: slotData, isLoading: slotLoading } = useMySlot();
  const slotInfo = slotData?.slot;

  return (
    <div className="space-y-6">
      {/* Top row: Scenario + Status */}
      <ScenarioPanel
        scenarioId={slotInfo?.scenario_id ?? null}
        slotStatus={slotInfo?.status ?? 'empty'}
        isLoading={slotLoading}
      />

      {/* Two-column: Objectives + VMs */}
      <div className="grid grid-cols-2 gap-6">
        <ObjectivesPanel slotNumber={slotNumber} scenarioId={slotInfo?.scenario_id ?? null} />
        <VMsPanel slotNumber={slotNumber} />
      </div>

      {/* Hints */}
      <HintsPanel />
    </div>
  );
}

// ── Scenario Panel ────────────────────────────────────────────────────

function ScenarioPanel({ scenarioId, slotStatus, isLoading }: { scenarioId: string | null; slotStatus: string; isLoading: boolean }) {
  const { data: scenarioData } = useScenarioDetail(scenarioId);
  const scenario = scenarioData?.scenario;

  if (isLoading) {
    return (
      <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-6">
        <p className="text-[var(--text-muted)] text-sm">Loading slot info...</p>
      </div>
    );
  }

  if (!scenarioId || slotStatus === 'empty') {
    return (
      <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-6 flex items-center gap-4">
        <BookOpen className="w-10 h-10 text-[var(--text-muted)]" />
        <div>
          <h2 className="text-lg font-bold">No Active Scenario</h2>
          <p className="text-sm text-[var(--text-muted)]">
            Your instructor has not yet deployed a scenario to your slot.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <BookOpen className="w-10 h-10 text-[var(--accent-blue)] flex-shrink-0 mt-1" />
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-lg font-bold">{scenario?.display_name ?? scenarioId}</h2>
              <StatusBadge status={slotStatus} />
            </div>
            {scenario && (
              <>
                <p className="text-sm text-[var(--text-secondary)] mb-3">{scenario.description}</p>
                <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> {scenario.duration_hours}h estimated
                  </span>
                  <span className="flex items-center gap-1">
                    <Monitor className="w-3.5 h-3.5" /> {scenario.vm_count} VMs
                  </span>
                  <DifficultyLabel difficulty={scenario.difficulty} />
                </div>
                {scenario.focus_areas.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {scenario.focus_areas.map((area) => (
                      <span key={area} className="label-mono text-[var(--accent-blue)] bg-[#6c8fff0d] px-2 py-0.5 rounded">
                        {area}
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DifficultyLabel({ difficulty }: { difficulty: string }) {
  const colors: Record<string, string> = {
    Beginner: '#00e5a0',
    Intermediate: '#facc15',
    Advanced: '#fb7185',
    Expert: '#a78bfa',
  };
  const color = colors[difficulty] ?? '#6c8fff';
  return (
    <span className="label-mono" style={{ color }}>
      {difficulty}
    </span>
  );
}

// ── Objectives Panel ──────────────────────────────────────────────────

function ObjectivesPanel({ slotNumber, scenarioId }: { slotNumber: number; scenarioId: string | null }) {
  const { data, isLoading } = useMyObjectives();
  const completeMutation = useCompleteObjective();
  const objectives = data?.objectives ?? [];

  const handleComplete = (obj: ObjectiveProgress) => {
    if (obj.completed) return;
    completeMutation.mutate({
      objectiveN: obj.objective_n,
      slotNumber,
      scenarioId: scenarioId ?? undefined,
    });
  };

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--border-default)] flex items-center gap-2">
        <Target className="w-5 h-5 text-[var(--accent-green)]" />
        <h3 className="font-semibold">Objectives</h3>
        {objectives.length > 0 && (
          <span className="label-mono text-[var(--text-muted)] ml-auto">
            {objectives.filter((o) => o.completed).length}/{objectives.length}
          </span>
        )}
      </div>

      <div className="p-4">
        {isLoading ? (
          <p className="text-sm text-[var(--text-muted)]">Loading objectives...</p>
        ) : objectives.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">
            {scenarioId ? 'No objectives tracked yet. Complete objectives and mark them here.' : 'Deploy a scenario to see objectives.'}
          </p>
        ) : (
          <div className="space-y-2">
            {objectives.sort((a, b) => a.objective_n - b.objective_n).map((obj) => (
              <button
                key={obj.id}
                onClick={() => handleComplete(obj)}
                disabled={obj.completed || completeMutation.isPending}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                  obj.completed
                    ? 'bg-[#00e5a00d]'
                    : 'hover:bg-[var(--bg-hover)]'
                }`}
                aria-label={`Objective ${obj.objective_n}: ${obj.completed ? 'completed' : 'mark complete'}`}
              >
                {obj.completed ? (
                  <CheckCircle2 className="w-5 h-5 text-[var(--accent-green)] flex-shrink-0" />
                ) : (
                  <Circle className="w-5 h-5 text-[var(--text-muted)] flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <span className={`text-sm ${obj.completed ? 'text-[var(--accent-green)] line-through' : 'text-[var(--text-primary)]'}`}>
                    Objective {obj.objective_n}
                  </span>
                  {obj.completed_at && (
                    <span className="text-xs text-[var(--text-muted)] ml-2">
                      {new Date(obj.completed_at).toLocaleString()}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── VMs Panel ─────────────────────────────────────────────────────────

function VMsPanel({ slotNumber }: { slotNumber: number }) {
  const { data, isLoading } = useMySlotVMs();
  const vms = data?.vms ?? [];

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--border-default)] flex items-center gap-2">
        <Monitor className="w-5 h-5 text-[var(--accent-amber)]" />
        <h3 className="font-semibold">Virtual Machines</h3>
        <span className="label-mono text-[var(--text-muted)] ml-auto">SLOT #{slotNumber}</span>
      </div>

      <div className="p-4">
        {isLoading ? (
          <p className="text-sm text-[var(--text-muted)]">Loading VMs...</p>
        ) : vms.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No VMs in your slot.</p>
        ) : (
          <div className="space-y-2">
            {vms.map((vm) => (
              <StudentVMRow key={vm.vmid} vm={vm} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StudentVMRow({ vm }: { vm: VMInfo }) {
  const [expanded, setExpanded] = useState(false);
  const memPercent = vm.maxmem > 0 ? Math.round((vm.mem / vm.maxmem) * 100) : 0;
  const uptimeStr = formatUptime(vm.uptime);

  return (
    <div className="bg-[var(--bg-base)] rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex-1 flex items-center gap-3 min-w-0 text-left hover:bg-[var(--bg-hover)] -mx-1 px-1 py-1 rounded transition-colors"
          aria-label={expanded ? `Collapse ${vm.name} controls` : `Expand ${vm.name} controls`}
          aria-expanded={expanded}
        >
          <ChevronRight
            className={`w-4 h-4 text-[var(--text-muted)] flex-shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm text-[var(--text-primary)] font-medium truncate">{vm.name}</span>
              <StatusBadge status={vm.status} />
            </div>
            <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
              <span className="flex items-center gap-1">
                <Cpu className="w-3 h-3" /> {vm.cpu.toFixed(0)}%
              </span>
              <span className="flex items-center gap-1">
                <MemoryStick className="w-3 h-3" /> {memPercent}%
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" /> {uptimeStr}
              </span>
            </div>
          </div>
        </button>
        {vm.status === 'running' && (
          <a
            href="/console"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00e5a01a] text-[var(--accent-green)] text-xs font-medium hover:bg-[#00e5a02a] transition-colors flex-shrink-0"
            aria-label={`Open console for ${vm.name}`}
          >
            <Terminal className="w-3.5 h-3.5" /> Console
          </a>
        )}
      </div>
      {expanded && (
        <div className="px-3 pb-2.5 pt-0 border-t border-[var(--border-default)] bg-[var(--bg-surface)]">
          <div className="flex items-center gap-2 mt-2 mb-2">
            <Settings2 className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <span className="label-mono text-[var(--text-muted)] text-[10px]">VM controls</span>
          </div>
          <PerVmControls vm={vm} allowRollback={false} compact />
        </div>
      )}
    </div>
  );
}

// ── Hints Panel ───────────────────────────────────────────────────────

function HintsPanel() {
  const { data, isLoading } = useMyHints();
  const markRead = useMarkHintRead();
  const hints = data?.hints ?? [];
  const unreadCount = hints.filter((h) => !h.read_at).length;

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--border-default)] flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-[var(--accent-purple)]" />
        <h3 className="font-semibold">Instructor Hints</h3>
        {unreadCount > 0 && (
          <span className="bg-[var(--accent-purple)] text-[var(--bg-base)] text-xs font-bold px-2 py-0.5 rounded-full ml-auto">
            {unreadCount} new
          </span>
        )}
      </div>

      <div className="p-4">
        {isLoading ? (
          <p className="text-sm text-[var(--text-muted)]">Loading hints...</p>
        ) : hints.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">
            No hints yet. Your instructor may send hints during the scenario.
          </p>
        ) : (
          <div className="space-y-2">
            {hints.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((hint) => (
              <HintCard key={hint.id} hint={hint} onMarkRead={() => markRead.mutate(hint.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function HintCard({ hint, onMarkRead }: { hint: Hint; onMarkRead: () => void }) {
  const isUnread = !hint.read_at;

  return (
    <div
      className={`rounded-lg px-4 py-3 ${
        isUnread
          ? 'bg-[#a78bfa0d] border border-[#a78bfa33]'
          : 'bg-[var(--bg-base)]'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-[var(--text-muted)]">
          {new Date(hint.created_at).toLocaleString()}
        </span>
        {isUnread && (
          <button
            onClick={onMarkRead}
            className="text-xs text-[var(--accent-purple)] hover:underline"
            aria-label="Mark hint as read"
          >
            Mark read
          </button>
        )}
      </div>
      <p className={`text-sm ${isUnread ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
        {hint.message}
      </p>
    </div>
  );
}

// ── Utilities ─────────────────────────────────────────────────────────

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}
