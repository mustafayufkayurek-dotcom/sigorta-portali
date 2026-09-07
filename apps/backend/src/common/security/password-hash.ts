import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

/** bcrypt üst sınırı; daha uzun girdi kesilmez, reddedilir. */
export const PASSWORD_MAX_LENGTH = 72;
export const NEW_PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_BCRYPT_ROUNDS = 12;

export function assertNewPassword(password: string): string {
  const value = String(password ?? '');
  if (value.length < NEW_PASSWORD_MIN_LENGTH) {
    throw new BadRequestException('Şifre en az 8 karakter olmalıdır');
  }
  if (value.length > PASSWORD_MAX_LENGTH) {
    throw new BadRequestException('Şifre en fazla 72 karakter olabilir');
  }
  return value;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, PASSWORD_BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, passwordHash: string): Promise<boolean> {
  if (!plain || !passwordHash) return false;
  if (plain.length > PASSWORD_MAX_LENGTH) return false;
  return bcrypt.compare(plain, passwordHash);
}
