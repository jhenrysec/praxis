import { Monitor, Cpu, MemoryStick } from 'lucide-react';
import type { VMStatus } from '@/types';
import { StatusBadge } from './StatusBadge';

interface VMStatusRowProps {
  vm: VMStatus;
}

function formatUptime(seconds: number): string {
  if (seconds === 0) return '--';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatMemory(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

export function VMStatusRow({ vm }: VMStatusRowProps) {
  const cpuPercent = Math.round(vm.cpu * 100);
  const memPercent = vm.maxmem > 0 ? Math.round((vm.mem / vm.maxmem) * 100) : 0;

  const zoneColor = vm.zone === 'red' ? '#fb7185'
    : vm.zone === 'ot' ? '#facc15'
    : vm.zone === 'blue' ? '#6c8fff'
    : '#4b5563';

  return (
    <div className="flex items-center gap-4 rounded border border-[#1e2228] bg-[#0d1017] px-4 py-3 hover:border-[#2d3139] transition-colors">
      {/* VM icon + name */}
      <div className="flex items-center gap-3 min-w-[200px]">
        <Monitor size={16} style={{ color: zoneColor }} />
        <div>
          <div className="text-sm font-medium text-[#e6edf3]">{vm.name}</div>
          {vm.ip_address && (
            <div className="text-[10px] text-[#4b5563] font-mono">{vm.ip_address}</div>
          )}
        </div>
      </div>

      {/* Status */}
      <div className="min-w-[100px]">
        <StatusBadge status={vm.status} variant="vm" />
      </div>

      {/* Zone badge */}
      {vm.zone && (
        <span
          className="label-mono rounded px-1.5 py-0.5 min-w-[50px] text-center"
          style={{
            backgroundColor: `${zoneColor}1a`,
            color: zoneColor,
            border: `1px solid ${zoneColor}33`,
          }}
        >
          {vm.zone}
        </span>
      )}

      {/* CPU */}
      <div className="flex items-center gap-1.5 min-w-[80px] text-xs text-[#8b949e]">
        <Cpu size={12} />
        <div className="flex-1">
          <div className="h-1.5 w-full rounded-full bg-[#1e2228]">
            <div
              className="h-1.5 rounded-full transition-all"
              style={{
                width: `${cpuPercent}%`,
                backgroundColor: cpuPercent > 80 ? '#fb7185' : '#00e5a0',
              }}
            />
          </div>
        </div>
        <span className="w-8 text-right">{cpuPercent}%</span>
      </div>

      {/* Memory */}
      <div className="flex items-center gap-1.5 min-w-[120px] text-xs text-[#8b949e]">
        <MemoryStick size={12} />
        <div className="flex-1">
          <div className="h-1.5 w-full rounded-full bg-[#1e2228]">
            <div
              className="h-1.5 rounded-full transition-all"
              style={{
                width: `${memPercent}%`,
                backgroundColor: memPercent > 80 ? '#fb7185' : '#6c8fff',
              }}
            />
          </div>
        </div>
        <span className="w-16 text-right">{formatMemory(vm.mem)}</span>
      </div>

      {/* Uptime */}
      <div className="text-xs text-[#4b5563] min-w-[60px] text-right">
        {formatUptime(vm.uptime)}
      </div>
    </div>
  );
}
