import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { useAuthStore } from '../stores/authStore';
import { VncViewer, type ConnectionState } from '../components/console/VncViewer';
import { StatusBadge } from '../components/shared/StatusBadge';
import {
  Monitor, Maximize2, Minimize2, Power, Eye, EyeOff,
  Keyboard, Wifi, WifiOff, AlertTriangle,
} from 'lucide-react';
import type { VMInfo } from '../types';

export function ConsolePage() {
  const { user } = useAuthStore();
  const [selectedVm, setSelectedVm] = useState<VMInfo | null>(null);
  const [wsUrl, setWsUrl] = useState<string | null>(null);
  const [connState, setConnState] = useState<ConnectionState>('disconnected');
  const [viewOnly, setViewOnly] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['consoleVMs'],
    queryFn: () => apiClient.getConsoleVMs(),
    refetchInterval: 15_000,
  });

  const ticketMutation = useMutation({
    mutationFn: (vmId: number) => apiClient.getConsoleTicket(vmId),
    onSuccess: (result) => {
      setWsUrl(result.wsUrl);
    },
  });

  const vms = data?.vms ?? [];

  const handleConnect = useCallback((vm: VMInfo) => {
    // Disconnect any existing session
    setWsUrl(null);
    setSelectedVm(vm);
    setConnState('connecting');
    ticketMutation.mutate(vm.vmid);
  }, [ticketMutation]);

  const handleDisconnect = useCallback(() => {
    setWsUrl(null);
    setConnState('disconnected');
  }, []);

  const handleStateChange = useCallback((state: ConnectionState) => {
    setConnState(state);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = document.getElementById('console-container');
    if (!el) return;
    if (!document.fullscreenElement) {
      void el.requestFullscreen();
      setIsFullscreen(true);
    } else {
      void document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  const isStudent = user?.role === 'student';

  return (
    <div className="h-full flex flex-col">
      {/* Header bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[var(--border-default)] bg-[var(--bg-surface)] flex-shrink-0">
        <div className="flex items-center gap-3">
          <Monitor className="w-5 h-5 text-[var(--accent-green)]" />
          <h1 className="text-lg font-bold tracking-wide">VM Console</h1>
          {selectedVm && (
            <span className="label-mono text-[var(--text-muted)]">
              {selectedVm.name} (VMID {selectedVm.vmid})
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ConnectionIndicator state={connState} />
          {connState === 'connected' && (
            <>
              <button
                onClick={() => setViewOnly((v) => !v)}
                className="p-2 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                title={viewOnly ? 'Enable input' : 'View only'}
                aria-label={viewOnly ? 'Enable input' : 'View only mode'}
              >
                {viewOnly ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              <button
                onClick={toggleFullscreen}
                className="p-2 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button
                onClick={handleDisconnect}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#fb71851a] text-[var(--accent-red)] text-sm hover:bg-[#fb71852a]"
                aria-label="Disconnect"
              >
                <Power className="w-3.5 h-3.5" /> Disconnect
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden">
        {/* VM sidebar */}
        <aside className="w-64 flex-shrink-0 border-r border-[var(--border-default)] bg-[var(--bg-surface)] overflow-y-auto">
          <div className="px-3 py-3">
            <h2 className="label-mono text-[var(--text-muted)] mb-2">
              {isStudent ? 'YOUR VMS' : 'LAB VMS'}
            </h2>
            {isLoading ? (
              <p className="text-sm text-[var(--text-muted)] px-2">Loading...</p>
            ) : vms.length === 0 ? (
              <div className="px-2">
                <p className="text-sm text-[var(--text-muted)]">No VMs available.</p>
                {isStudent && (
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    Your instructor needs to deploy a scenario first.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                {vms.map((vm) => (
                  <VMListItem
                    key={vm.vmid}
                    vm={vm}
                    isSelected={selectedVm?.vmid === vm.vmid}
                    isConnected={selectedVm?.vmid === vm.vmid && connState === 'connected'}
                    onConnect={handleConnect}
                  />
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Console area */}
        <div id="console-container" className="flex-1 flex items-center justify-center bg-[#0a0c0f] relative">
          {connState === 'disconnected' && !selectedVm && (
            <EmptyState />
          )}
          {connState === 'connecting' && (
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-[var(--accent-green)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-[var(--text-muted)]">Connecting to {selectedVm?.name}...</p>
            </div>
          )}
          {connState === 'error' && (
            <div className="text-center">
              <AlertTriangle className="w-10 h-10 text-[var(--accent-red)] mx-auto mb-3" />
              <p className="text-sm text-[var(--accent-red)] mb-2">Connection failed</p>
              <p className="text-xs text-[var(--text-muted)] mb-4 max-w-sm">
                The VM may not be running, or the VNC proxy is unavailable.
              </p>
              {selectedVm && (
                <button
                  onClick={() => handleConnect(selectedVm)}
                  className="px-4 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-default)] text-sm hover:bg-[var(--bg-hover)]"
                >
                  Retry
                </button>
              )}
            </div>
          )}
          {wsUrl && (connState === 'connecting' || connState === 'connected') && (
            <VncViewer
              wsUrl={wsUrl}
              onStateChange={handleStateChange}
              viewOnly={viewOnly}
              scaleViewport={true}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function VMListItem({ vm, isSelected, isConnected, onConnect }: {
  vm: VMInfo;
  isSelected: boolean;
  isConnected: boolean;
  onConnect: (vm: VMInfo) => void;
}) {
  const isRunning = vm.status === 'running';

  return (
    <button
      onClick={() => onConnect(vm)}
      disabled={!isRunning}
      className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
        isSelected
          ? 'bg-[#00e5a00d] border border-[var(--accent-green)]'
          : 'hover:bg-[var(--bg-hover)] border border-transparent'
      } ${!isRunning ? 'opacity-40 cursor-not-allowed' : ''}`}
      aria-label={`Connect to ${vm.name}`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-[var(--text-primary)] truncate font-medium">{vm.name}</span>
        {isConnected && <Wifi className="w-3.5 h-3.5 text-[var(--accent-green)] flex-shrink-0" />}
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge status={vm.status} />
        <span className="text-xs text-[var(--text-muted)]">ID {vm.vmid}</span>
      </div>
    </button>
  );
}

function ConnectionIndicator({ state }: { state: ConnectionState }) {
  const config: Record<ConnectionState, { color: string; label: string; icon: React.ReactNode }> = {
    disconnected: { color: '#4b5563', label: 'Disconnected', icon: <WifiOff className="w-3.5 h-3.5" /> },
    connecting:   { color: '#facc15', label: 'Connecting',   icon: <Wifi className="w-3.5 h-3.5 animate-pulse" /> },
    connected:    { color: '#00e5a0', label: 'Connected',    icon: <Wifi className="w-3.5 h-3.5" /> },
    disconnecting:{ color: '#facc15', label: 'Disconnecting',icon: <WifiOff className="w-3.5 h-3.5" /> },
    error:        { color: '#fb7185', label: 'Error',        icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  };
  const c = config[state];

  return (
    <span className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded" style={{ color: c.color }}>
      {c.icon}
      {c.label}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="text-center">
      <Monitor className="w-16 h-16 text-[var(--text-muted)] mx-auto mb-4 opacity-30" />
      <p className="text-[var(--text-secondary)] mb-1">Select a VM to connect</p>
      <p className="text-xs text-[var(--text-muted)]">
        Choose a running VM from the sidebar to open a console session.
      </p>
      <div className="flex items-center justify-center gap-4 mt-6 text-xs text-[var(--text-muted)]">
        <span className="flex items-center gap-1">
          <Keyboard className="w-3.5 h-3.5" /> Full keyboard input
        </span>
        <span className="flex items-center gap-1">
          <Maximize2 className="w-3.5 h-3.5" /> Fullscreen support
        </span>
        <span className="flex items-center gap-1">
          <Eye className="w-3.5 h-3.5" /> View-only mode
        </span>
      </div>
    </div>
  );
}
