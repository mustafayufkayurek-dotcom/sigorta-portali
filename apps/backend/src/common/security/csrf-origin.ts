import type { Request, Response, NextFunction } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
/** Lokal panel: localhost ve 127.0.0.1 aynı giriş kapısıdır. */
const LOCAL_PANEL_ORIGINS = ['http://localhost:3001', 'http://127.0.0.1:3001'];

function withLocalhostTwin(origin: string): string[] {
  const normalized = origin.trim().replace(/\/$/, '');
  const twins = [normalized];
  try {
    const url = new URL(normalized);
    if (url.hostname === 'localhost') {
      url.hostname = '127.0.0.1';
      twins.push(url.origin);
    } else if (url.hostname === '127.0.0.1') {
      url.hostname = 'localhost';
      twins.push(url.origin);
    }
  } catch {
    /* ignore */
  }
  return twins;
}

export function parseAllowedOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const raw = [env.WEB_URL, env.CORS_ORIGIN]
    .filter(Boolean)
    .join(',');
  const listed = raw
    .split(',')
    .map((part) => part.trim().replace(/\/$/, ''))
    .filter(Boolean);
  const expanded = [...new Set(listed.flatMap(withLocalhostTwin))];
  if (expanded.length > 0) {
    if ((env.NODE_ENV || 'development') !== 'production') {
      return [...new Set([...expanded, ...LOCAL_PANEL_ORIGINS])];
    }
    return expanded;
  }
  if ((env.NODE_ENV || 'development') !== 'production') {
    return [...LOCAL_PANEL_ORIGINS];
  }
  return [];
}

export function isAllowedRequestOrigin(origin: string | undefined, allowed: string[]): boolean {
  if (!origin) return true;
  const normalized = origin.trim().replace(/\/$/, '');
  return allowed.includes(normalized);
}

/** Çerezli yazma isteklerinde yabancı siteden gelen Origin kesilir. Bearer/API Origin’siz kalabilir. */
export function csrfOriginGuard(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(String(req.method || '').toUpperCase())) {
    next();
    return;
  }
  const allowed = parseAllowedOrigins();
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
  if (isAllowedRequestOrigin(origin, allowed)) {
    next();
    return;
  }
  res.status(403).json({
    statusCode: 403,
    message: 'İstek reddedildi',
  });
}
