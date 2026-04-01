import type { Request } from 'express';

/** Extract a single IP string from req.ip (Express 5 may return string | string[]). */
export function getIp(req: Request): string | null {
  const ip = req.ip;
  if (typeof ip === 'string') return ip;
  if (Array.isArray(ip)) return ip[0] ?? null;
  return req.socket.remoteAddress ?? null;
}

/** Extract a single string param value (Express 5 params may be string | string[]). */
export function param(req: Request, name: string): string {
  const val = req.params[name];
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) return val[0] ?? '';
  return '';
}
