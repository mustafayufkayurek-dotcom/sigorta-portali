import { BadRequestException } from '@nestjs/common';
import * as path from 'path';

const MAX_KEY_LENGTH = 512;

export function isSafeStorageKey(key: string): boolean {
  const trimmed = String(key ?? '').trim();
  if (!trimmed || trimmed.length > MAX_KEY_LENGTH) return false;
  if (trimmed.includes('\0')) return false;
  const normalized = trimmed.replace(/\\/g, '/');
  if (path.isAbsolute(normalized) || normalized.startsWith('/')) return false;
  if (normalized.split('/').some((seg) => seg === '..' || seg === '')) return false;
  return true;
}

export function resolveSafeLocalPath(rootDir: string, key: string): string {
  if (!isSafeStorageKey(key)) {
    throw new BadRequestException('Geçersiz dosya anahtarı');
  }
  const root = path.resolve(rootDir);
  const resolved = path.resolve(root, key);
  const rel = path.relative(root, resolved);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new BadRequestException('Geçersiz dosya anahtarı');
  }
  return resolved;
}
