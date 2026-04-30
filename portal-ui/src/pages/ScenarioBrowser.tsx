import { Link } from 'react-router-dom';
import { useScenarios } from '../hooks/useAdmin';
import { useAuthStore } from '../stores/authStore';
import { Clock, Monitor, Target, Shield } from 'lucide-react';
import type { Scenario } from '../types';

const DIFFICULTY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Beginner:     { bg: '#00e5a01a', text: '#00e5a0', border: '#00e5a033' },
  Intermediate: { bg: '#facc151a', text: '#facc15', border: '#facc1533' },
  Advanced:     { bg: '#fb71851a', text: '#fb7185', border: '#fb718533' },
  Expert:       { bg: '#a78bfa1a', text: '#a78bfa', border: '#a78bfa33' },
};

export function ScenarioBrowser() {
  const { data, isLoading } = useScenarios();
  const scenarios = data?.scenarios ?? [];

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-wide">Scenarios</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          {scenarios.length} scenario{scenarios.length !== 1 ? 's' : ''} available
        </p>
      </div>

      {isLoading ? (
        <div className="text-[var(--text-muted)] text-sm">Loading scenarios...</div>
      ) : scenarios.length === 0 ? (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-12 text-center text-[var(--text-muted)]">
          No scenarios found. Build scenarios in Phase 8.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {scenarios.map((s) => (
            <ScenarioCard key={s.id} scenario={s} />
          ))}
        </div>
      )}
    </div>
  );
}

function ScenarioCard({ scenario }: { scenario: Scenario }) {
  const diffColor = DIFFICULTY_COLORS[scenario.difficulty] ?? { bg: '#00e5a01a', text: '#00e5a0', border: '#00e5a033' };
  const role = useAuthStore((s) => s.user?.role);
  const canDeploy = role === 'admin' || role === 'instructor';

  const cardClasses = canDeploy
    ? 'block bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-5 hover:border-[var(--border-active)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]'
    : 'block bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-5';

  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    canDeploy ? (
      <Link to={`/admin/slots?scenario=${encodeURIComponent(scenario.id)}`} className={cardClasses}>
        {children}
      </Link>
    ) : (
      <div className={cardClasses}>{children}</div>
    );

  return (
    <Wrapper>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-[var(--text-primary)] truncate">{scenario.display_name}</h3>
          <span className="label-mono text-[var(--text-muted)]">{scenario.id}</span>
        </div>
        <span
          className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium border ml-3 flex-shrink-0"
          style={{ backgroundColor: diffColor.bg, color: diffColor.text, borderColor: diffColor.border }}
        >
          {scenario.difficulty}
        </span>
      </div>

      {/* Description */}
      <p className="text-sm text-[var(--text-secondary)] mb-4 line-clamp-2">{scenario.description}</p>

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs text-[var(--text-muted)] mb-4">
        <span className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" /> {scenario.duration_hours}h
        </span>
        <span className="flex items-center gap-1">
          <Monitor className="w-3.5 h-3.5" /> {scenario.vm_count} VMs
        </span>
      </div>

      {/* Focus areas */}
      {scenario.focus_areas.length > 0 && (
        <div className="flex items-center gap-1.5 mb-3">
          <Target className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0" />
          <div className="flex flex-wrap gap-1">
            {scenario.focus_areas.map((area) => (
              <span
                key={area}
                className="label-mono text-[var(--accent-blue)] bg-[#6c8fff0d] px-2 py-0.5 rounded"
              >
                {area}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ATT&CK techniques */}
      {scenario.mitre_techniques.length > 0 && (
        <div className="flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0" />
          <div className="flex flex-wrap gap-1">
            {scenario.mitre_techniques.slice(0, 6).map((tech) => (
              <span
                key={tech}
                className="label-mono text-[var(--accent-purple)] bg-[#a78bfa0d] px-2 py-0.5 rounded"
              >
                {tech}
              </span>
            ))}
            {scenario.mitre_techniques.length > 6 && (
              <span className="label-mono text-[var(--text-muted)] px-1">
                +{scenario.mitre_techniques.length - 6}
              </span>
            )}
          </div>
        </div>
      )}
    </Wrapper>
  );
}
