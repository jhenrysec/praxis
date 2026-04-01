import { Clock, Cpu, HardDrive, Server } from 'lucide-react';
import type { Scenario } from '@/types';
import { DifficultyBadge } from './DifficultyBadge';

interface ScenarioCardProps {
  scenario: Scenario;
  onSelect: (name: string) => void;
}

export function ScenarioCard({ scenario, onSelect }: ScenarioCardProps) {
  return (
    <button
      onClick={() => onSelect(scenario.name)}
      className="group w-full rounded-lg border border-[#1e2228] bg-[#0d1017] p-5 text-left transition-all hover:border-[#2d3139] hover:bg-[#131820]"
      aria-label={`Select scenario: ${scenario.display_name}`}
    >
      {/* Header */}
      <div className="mb-3 flex items-start justify-between">
        <h3 className="font-heading text-lg font-semibold text-[#e6edf3] group-hover:text-[#00e5a0] transition-colors">
          {scenario.display_name}
        </h3>
        <DifficultyBadge difficulty={scenario.difficulty} />
      </div>

      {/* Description */}
      <p className="mb-4 line-clamp-2 text-xs text-[#8b949e]">
        {scenario.description}
      </p>

      {/* Focus areas */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {scenario.focus_areas.map((area) => (
          <span
            key={area}
            className="label-mono rounded bg-[#6c8fff1a] px-1.5 py-0.5 text-[#6c8fff]"
          >
            {area.replace(/_/g, ' ')}
          </span>
        ))}
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 text-[10px] text-[#4b5563]">
        <span className="flex items-center gap-1">
          <Clock size={12} />
          {scenario.estimated_hours}h
        </span>
        <span className="flex items-center gap-1">
          <Server size={12} />
          {scenario.vm_count} VMs
        </span>
        <span className="flex items-center gap-1">
          <Cpu size={12} />
          {scenario.total_cpu} cores
        </span>
        <span className="flex items-center gap-1">
          <HardDrive size={12} />
          {Math.round(scenario.total_memory_mb / 1024)} GB
        </span>
      </div>

      {/* ATT&CK techniques */}
      <div className="mt-3 flex flex-wrap gap-1">
        {scenario.mitre_techniques.map((tech) => (
          <span
            key={tech}
            className="rounded bg-[#a78bfa1a] px-1.5 py-0.5 text-[10px] font-medium text-[#a78bfa]"
          >
            {tech}
          </span>
        ))}
      </div>
    </button>
  );
}
