import { useEffect, useRef, useState, useCallback } from 'react';
import { apiClient } from '../api/client';
import { Shield, Maximize2, Minimize2, RefreshCw, AlertTriangle, ExternalLink } from 'lucide-react';

type GrantState = 'idle' | 'granting' | 'ready' | 'error';

const DASHBOARD_PATH = '/api/soc/';

export function BlueTeamSoc() {
  const [state, setState] = useState<GrantState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [iframeKey, setIframeKey] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const grant = useCallback(async () => {
    setState('granting');
    setError(null);
    try {
      const result = await apiClient.grantSocAccess();
      setExpiresAt(Date.now() + result.expires_in_seconds * 1000);
      setState('ready');
      setIframeKey((k) => k + 1);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      setState('error');
    }
  }, []);

  useEffect(() => {
    void grant();
    return () => {
      void apiClient.revokeSocAccess().catch(() => {
        // best effort — cookie also expires on its own
      });
    };
  }, [grant]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      void el.requestFullscreen();
    } else {
      void document.exitFullscreen();
    }
  }, []);

  const minutesLeft = expiresAt ? Math.max(0, Math.floor((expiresAt - Date.now()) / 60000)) : null;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-default)] bg-[var(--bg-surface)]">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-[var(--accent-blue)]" />
          <div>
            <h1 className="text-lg font-bold tracking-wide">Blue Team SOC</h1>
            <p className="label-mono text-[var(--text-muted)] mt-0.5">
              Wazuh SIEM · proxied via portal-backend
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {state === 'ready' && minutesLeft !== null && (
            <span className="label-mono text-[var(--text-muted)]">
              session expires in {minutesLeft}m
            </span>
          )}
          <button
            onClick={() => void grant()}
            disabled={state === 'granting'}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-50"
            aria-label="Refresh session"
          >
            <RefreshCw className={`w-4 h-4 ${state === 'granting' ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <a
            href={DASHBOARD_PATH}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
            aria-label="Open dashboard in new tab"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Open in tab</span>
          </a>
        </div>
      </div>

      {/* Dashboard container */}
      <div ref={containerRef} className="flex-1 relative bg-black">
        {state === 'granting' && (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-base)] bg-opacity-80 z-10">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 text-[var(--accent-blue)] animate-spin mx-auto mb-3" />
              <p className="text-sm text-[var(--text-secondary)]">Granting SOC session...</p>
            </div>
          </div>
        )}

        {state === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-base)] z-10">
            <div className="max-w-md text-center">
              <AlertTriangle className="w-10 h-10 text-[var(--accent-red)] mx-auto mb-3" />
              <h2 className="text-lg font-semibold mb-2">Could not open SOC session</h2>
              <p className="text-sm text-[var(--text-muted)] mb-4">{error}</p>
              <button
                onClick={() => void grant()}
                className="px-4 py-2 rounded-lg bg-[var(--accent-blue)] bg-opacity-10 text-[var(--accent-blue)] border border-[var(--accent-blue)] border-opacity-30 hover:bg-opacity-20 text-sm"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {state === 'ready' && (
          <iframe
            key={iframeKey}
            src={DASHBOARD_PATH}
            title="Wazuh SOC Dashboard"
            className="w-full h-full border-0"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-downloads"
          />
        )}
      </div>
    </div>
  );
}
