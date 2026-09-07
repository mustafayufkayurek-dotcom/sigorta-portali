import type { Request, Response, NextFunction } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function parseAllowedOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const raw = [env.WEB_URL, env.CORS_ORIGIN]
    .filter(Boolean)
    .join(',');
  const listed = raw
    .split(',')
    .map((part) => part.trim().replace(/\/$/, ''))
    .filter(Boolean);
  if (listed.length > 0) return listed;
  if ((env.NODE_ENV || 'development') !== 'production') {
    return ['http://localhost:3001', 'http://127.0.0.1:3001'];
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
