import { useEffect, useRef } from 'react';
import { Terminal as TerminalIcon, X, Trash2 } from 'lucide-react';
import { useTerminalStore } from '@/stores/terminalStore';

export function TerminalPanel() {
  const { lines, isStreaming, activeSlot, clear } = useTerminalStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines.length]);

  const lineColor = (type: 'stdout' | 'stderr' | 'system') => {
    switch (type) {
      case 'stderr': return '#fb7185';
      case 'system': return '#6c8fff';
      default: return '#e6edf3';
    }
  };

  return (
    <div className="flex h-full flex-col rounded-lg border border-[#1e2228] bg-[#0a0c0f]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#1e2228] px-4 py-2">
        <div className="flex items-center gap-2">
          <TerminalIcon size={14} className="text-[#00e5a0]" />
          <span className="label-mono text-[#8b949e]">
            TERMINAL OUTPUT
            {activeSlot !== null && ` — SLOT ${String(activeSlot).padStart(2, '0')}`}
          </span>
          {isStreaming && (
            <span className="label-mono animate-pulse-green text-[#00e5a0]">LIVE</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={clear}
            className="rounded p-1 text-[#4b5563] hover:bg-[#131820] hover:text-[#8b949e] transition-colors"
            aria-label="Clear terminal"
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={() => useTerminalStore.getState().setStreaming(false)}
            className="rounded p-1 text-[#4b5563] hover:bg-[#131820] hover:text-[#8b949e] transition-colors"
            aria-label="Close terminal"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Output */}
      <div className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-5">
        {lines.length === 0 ? (
          <div className="text-[#4b5563]">Waiting for output...</div>
        ) : (
          lines.map((line, i) => (
            <div key={i} className="whitespace-pre-wrap" style={{ color: lineColor(line.type) }}>
              {line.type === 'system' && (
                <span className="mr-2 text-[#6c8fff]">[system]</span>
              )}
              {line.text}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
