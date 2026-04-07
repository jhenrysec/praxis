import { useEffect, useRef, useCallback, useState } from 'react';
import type RFB from '@novnc/novnc/lib/rfb';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'disconnecting' | 'error';

interface VncViewerProps {
  wsUrl: string | null;
  onStateChange?: (state: ConnectionState) => void;
  viewOnly?: boolean;
  scaleViewport?: boolean;
  clipViewport?: boolean;
}

/**
 * Validates that a WebSocket URL points to the same origin, a relative path,
 * or the Proxmox host (whose VNC WebSocket URL is returned by the backend).
 */
function isAllowedWsUrl(url: string): boolean {
  // Relative paths (e.g. /novnc-proxy/...) are always safe
  if (url.startsWith('/')) return true;
  try {
    const parsed = new URL(url);
    // Same-origin is always allowed
    if (parsed.host === window.location.host) return true;
    // Allow the Proxmox host — the backend returns direct wss:// URLs to Proxmox
    // for VNC proxy. The port 8006 is the Proxmox API port.
    if (parsed.port === '8006' && parsed.pathname.includes('/api2/json/nodes/')) return true;
    return false;
  } catch {
    return false;
  }
}

export function VncViewer({ wsUrl, onStateChange, viewOnly = false, scaleViewport = true, clipViewport = false }: VncViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rfbRef = useRef<RFB | null>(null);
  const [state, setState] = useState<ConnectionState>('disconnected');

  const updateState = useCallback((newState: ConnectionState) => {
    setState(newState);
    onStateChange?.(newState);
  }, [onStateChange]);

  const disconnect = useCallback(() => {
    if (rfbRef.current) {
      try {
        rfbRef.current.disconnect();
      } catch {
        // ignore — may already be disconnected
      }
      rfbRef.current = null;
    }
    updateState('disconnected');
  }, [updateState]);

  useEffect(() => {
    if (!wsUrl || !containerRef.current) {
      disconnect();
      return;
    }

    // 🔒 SECURITY: reject WebSocket URLs pointing to foreign origins
    if (!isAllowedWsUrl(wsUrl)) {
      updateState('error');
      return;
    }

    // Dynamic import to avoid Rollup top-level await issue
    let cancelled = false;

    async function connect() {
      if (!containerRef.current || cancelled) return;

      updateState('connecting');

      try {
        const { default: RFBClass } = await import('@novnc/novnc/lib/rfb');

        if (cancelled || !containerRef.current) return;

        const rfb = new RFBClass(containerRef.current, wsUrl!, {
          wsProtocols: ['binary'],
        });

        rfb.viewOnly = viewOnly;
        rfb.scaleViewport = scaleViewport;
        rfb.clipViewport = clipViewport;
        rfb.resizeSession = false;
        rfb.background = '#0a0c0f';

        rfb.addEventListener('connect', () => {
          if (!cancelled) updateState('connected');
        });

        rfb.addEventListener('disconnect', (e: CustomEvent) => {
          if (!cancelled) {
            updateState(e.detail?.clean ? 'disconnected' : 'error');
          }
          rfbRef.current = null;
        });

        rfb.addEventListener('securityfailure', () => {
          if (!cancelled) updateState('error');
        });

        rfbRef.current = rfb;
      } catch {
        if (!cancelled) updateState('error');
      }
    }

    void connect();

    return () => {
      cancelled = true;
      disconnect();
    };
  }, [wsUrl, viewOnly, scaleViewport, clipViewport, disconnect, updateState]);

  // Update RFB settings when props change
  useEffect(() => {
    if (rfbRef.current) {
      rfbRef.current.viewOnly = viewOnly;
      rfbRef.current.scaleViewport = scaleViewport;
      rfbRef.current.clipViewport = clipViewport;
    }
  }, [viewOnly, scaleViewport, clipViewport]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-[#0a0c0f]"
      data-state={state}
    />
  );
}

// Send Ctrl+Alt+Del to the remote session
export function sendCtrlAltDel(rfb: RFB | null) {
  rfb?.sendCtrlAltDel();
}
