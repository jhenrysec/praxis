import type { VMStatus } from '@/types';

interface NetworkTopologyProps {
  vms: VMStatus[];
  scenarioName?: string;
}

interface ZoneLayout {
  label: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function NetworkTopology({ vms, scenarioName }: NetworkTopologyProps) {
  const redVMs = vms.filter((vm) => vm.zone === 'red');
  const blueVMs = vms.filter((vm) => vm.zone === 'blue');
  const otVMs = vms.filter((vm) => vm.zone === 'ot');

  const hasOT = otVMs.length > 0;
  const svgHeight = hasOT ? 420 : 280;

  const zones: ZoneLayout[] = [
    { label: 'RED ZONE — vmbr1', color: '#fb7185', x: 20, y: 20, width: 760, height: 90 },
    { label: 'BLUE ZONE — vmbr2', color: '#6c8fff', x: 20, y: 130, width: 760, height: 90 },
  ];

  if (hasOT) {
    zones.push({
      label: 'OT ZONE — vmbr3', color: '#facc15', x: 20, y: 240, width: 760, height: 90,
    });
  }

  const vmNode = (
    vm: VMStatus,
    cx: number,
    cy: number,
    zoneColor: string,
  ) => {
    const isRunning = vm.status === 'running';
    return (
      <g key={vm.vmid}>
        {/* Node box */}
        <rect
          x={cx - 55}
          y={cy - 22}
          width={110}
          height={44}
          rx={4}
          fill="#0d1017"
          stroke={isRunning ? zoneColor : '#2d3139'}
          strokeWidth={isRunning ? 1.5 : 1}
          opacity={isRunning ? 1 : 0.5}
        />
        {/* Name */}
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          fill={isRunning ? '#e6edf3' : '#4b5563'}
          fontSize={11}
          fontFamily="JetBrains Mono"
          fontWeight={500}
        >
          {vm.name.replace(/-s\d+$/, '')}
        </text>
        {/* IP */}
        <text
          x={cx}
          y={cy + 12}
          textAnchor="middle"
          fill={isRunning ? zoneColor : '#4b5563'}
          fontSize={9}
          fontFamily="JetBrains Mono"
        >
          {vm.ip_address ?? '—'}
        </text>
      </g>
    );
  };

  const distributeVMs = (vmList: VMStatus[], zone: ZoneLayout, color: string) => {
    const count = vmList.length;
    if (count === 0) return null;
    const spacing = zone.width / (count + 1);
    return vmList.map((vm, i) =>
      vmNode(vm, zone.x + spacing * (i + 1), zone.y + zone.height / 2, color),
    );
  };

  // Find dual-homed VMs for connection lines
  const dualHomed = vms.filter((vm) =>
    vm.tags.includes('dual-homed') || vm.tags.includes('pivot'),
  );

  return (
    <div className="rounded-lg border border-[#1e2228] bg-[#0a0c0f] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-heading text-sm font-semibold text-[#8b949e]">
          NETWORK TOPOLOGY
        </h3>
        {scenarioName && (
          <span className="label-mono text-[#4b5563]">{scenarioName}</span>
        )}
      </div>

      <svg
        viewBox={`0 0 800 ${svgHeight}`}
        className="w-full"
        aria-label="Network topology diagram"
      >
        {/* Zone backgrounds */}
        {zones.map((zone) => (
          <g key={zone.label}>
            <rect
              x={zone.x}
              y={zone.y}
              width={zone.width}
              height={zone.height}
              rx={8}
              fill="none"
              stroke={zone.color}
              strokeWidth={1}
              strokeDasharray="4 4"
              opacity={0.3}
            />
            <text
              x={zone.x + 12}
              y={zone.y + 16}
              fill={zone.color}
              fontSize={10}
              fontFamily="JetBrains Mono"
              fontWeight={600}
              letterSpacing={1.5}
              opacity={0.6}
            >
              {zone.label}
            </text>
          </g>
        ))}

        {/* Connection lines for dual-homed VMs */}
        {dualHomed.map((vm) => {
          const blueZone = zones[1];
          const targetZone = zones[2]; // OT zone if exists
          if (!blueZone || !targetZone) return null;
          const blueIdx = blueVMs.findIndex((v) => v.vmid === vm.vmid);
          if (blueIdx === -1) return null;
          const blueSpacing = blueZone.width / (blueVMs.length + 1);
          const cx = blueZone.x + blueSpacing * (blueIdx + 1);
          return (
            <line
              key={`pivot-${vm.vmid}`}
              x1={cx}
              y1={blueZone.y + blueZone.height}
              x2={cx}
              y2={targetZone.y}
              stroke="#facc15"
              strokeWidth={2}
              className="animate-attack-path"
              opacity={0.6}
            />
          );
        })}

        {/* VM nodes */}
        {distributeVMs(redVMs, zones[0]!, '#fb7185')}
        {distributeVMs(blueVMs, zones[1]!, '#6c8fff')}
        {zones[2] && distributeVMs(otVMs, zones[2], '#facc15')}

        {/* Legend */}
        <g transform={`translate(20, ${svgHeight - 30})`}>
          {[
            { color: '#00e5a0', label: 'Running' },
            { color: '#4b5563', label: 'Stopped' },
            { color: '#facc15', label: 'Pivot path' },
          ].map((item, i) => (
            <g key={item.label} transform={`translate(${i * 120}, 0)`}>
              <rect x={0} y={0} width={10} height={10} rx={2} fill={item.color} opacity={0.8} />
              <text x={16} y={9} fill="#8b949e" fontSize={10} fontFamily="JetBrains Mono">
                {item.label}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
