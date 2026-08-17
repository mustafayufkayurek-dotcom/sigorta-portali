import type { NextFunction, Request, Response } from 'express';
import { extractAccessToken } from '../auth/auth-cookies';
import { isSafeStorageKey } from '@/modules/storage/storage-path';

export function createUploadsAuthMiddleware(opts: {
  verify: (token: string) => Promise<unknown>;
  isBlacklisted: (token: string) => Promise<boolean>;
}) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (req.method === 'OPTIONS') {
      next();
      return;
    }

    const token = extractAccessToken(req);
    if (!token) {
      res.status(401).setHeader('Cache-Control', 'no-store').send('Unauthorized');
      return;
    }

    try {
      if (await opts.isBlacklisted(token)) {
        res.status(401).setHeader('Cache-Control', 'no-store').send('Unauthorized');
        return;
      }
      await opts.verify(token);
    } catch {
      res.status(401).setHeader('Cache-Control', 'no-store').send('Unauthorized');
      return;
    }

    const key = decodeURIComponent(String(req.path || '').replace(/^\/+/, ''));
    if (key && !isSafeStorageKey(key)) {
      res.status(400).setHeader('Cache-Control', 'no-store').send('Bad Request');
      return;
    }

    next();
  };
}
