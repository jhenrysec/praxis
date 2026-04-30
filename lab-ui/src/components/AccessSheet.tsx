import { Copy, Check } from 'lucide-react';
import { useState, useCallback } from 'react';
import type { LabSlot } from '@/types';

interface AccessSheetProps {
  slot: LabSlot;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="rounded p-0.5 text-[#4b5563] hover:text-[#8b949e] transition-colors"
      aria-label={`Copy: ${text}`}
    >
      {copied ? <Check size={12} className="text-[#00e5a0]" /> : <Copy size={12} />}
    </button>
  );
}

export function AccessSheet({ slot }: AccessSheetProps) {
  const vms = slot.vms ?? [];
  if (slot.status !== 'running' || vms.length === 0) {
    return (
      <div className="rounded-lg border border-[#1e2228] bg-[#0d1017] p-6 text-center text-sm text-[#4b5563]">
        Deploy a scenario to generate the access sheet.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#1e2228] bg-[#0d1017] p-4">
      <h3 className="font-heading mb-3 text-sm font-semibold text-[#8b949e]">
        ACCESS SHEET — SLOT {String(slot.slot_number).padStart(2, '0')}
      </h3>
      <table className="w-full text-xs">
        <thead>
          <tr className="label-mono border-b border-[#1e2228] text-[#4b5563]">
            <th className="pb-2 text-left">HOST</th>
            <th className="pb-2 text-left">IP ADDRESS</th>
            <th className="pb-2 text-left">ZONE</th>
            <th className="pb-2 text-left">STATUS</th>
          </tr>
        </thead>
        <tbody>
          {vms.map((vm) => (
            <tr key={vm.vmid} className="border-b border-[#1e2228]/50">
              <td className="py-2 text-[#e6edf3]">{vm.name}</td>
              <td className="py-2">
                <span className="flex items-center gap-1.5">
                  <span className="text-[#00e5a0]">{vm.ip_address ?? '—'}</span>
                  {vm.ip_address && <CopyButton text={vm.ip_address} />}
                </span>
              </td>
              <td className="py-2 text-[#8b949e]">{vm.zone ?? '—'}</td>
              <td className="py-2">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{
                    backgroundColor: vm.status === 'running' ? '#00e5a0' : '#fb7185',
                  }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
