import { BadRequestException } from '@nestjs/common';

export function resolveUserId(user: { id?: string; userId?: string; sub?: string } | null | undefined): string {
  const id = user?.id ?? user?.userId ?? user?.sub;
  if (!id) {
    throw new BadRequestException('Kullanıcı kimliği bulunamadı');
  }
  return id;
}
