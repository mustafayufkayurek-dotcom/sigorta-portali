import {
  isInboundIhbarNoteText,
  mapInboundCategoryKnown,
  mapInboundLossTypeToMeridyen,
} from '@sigorta/shared';
import type { PrismaService } from '@/prisma/prisma.service';

/** Canonical ihbar konusu etiketi — serbest metin notları hariç */
export function resolveCanonicalIhbarLabel(input: {
  lossType?: string | null;
  fileSubject?: string | null;
  claimSubjectName?: string | null;
  departmentFileSubjectName?: string | null;
}): string | undefined {
  const subjectName = input.claimSubjectName?.trim() || input.departmentFileSubjectName?.trim();
  if (subjectName && !isInboundIhbarNoteText(subjectName)) {
    return subjectName;
  }

  const fromCategory = mapInboundCategoryKnown(input.fileSubject);
  if (fromCategory) return fromCategory;

  const fromLoss = mapInboundLossTypeToMeridyen(input.lossType);
  if (fromLoss) return fromLoss;

  return undefined;
}

/** Gelen kutusu / dosya oluşturma için canonical lossType — hasar şekli öncelikli */
export function sanitizeInboundLossType(raw?: string | null, fileSubject?: string | null): string {
  // Önce serbest hasar şekli (Cam Kırığı → Cam Kırılması); kategori ikinci sırada
  const fromLoss = mapInboundLossTypeToMeridyen(raw);
  if (fromLoss) return fromLoss;
  const fromSubject = mapInboundCategoryKnown(fileSubject) || mapInboundLossTypeToMeridyen(fileSubject);
  if (fromSubject) return fromSubject;
  const fromRawCategory = mapInboundCategoryKnown(raw);
  return fromRawCategory || 'Belirtilmemiş';
}

/** Ayarlar listesinden seçilen konu durur. Uzun ihbar notu konu olmaz. */
export function preserveChosenFileSubject(raw: string, sanitized: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return sanitized || 'Belirtilmemiş';
  if (/^belirtilmemi[sş]$/i.test(trimmed)) return 'Belirtilmemiş';
  if (/^gelen kutusu ihbar/i.test(trimmed) || trimmed.length > 48) {
    return sanitized && sanitized !== 'Belirtilmemiş' ? sanitized : 'Belirtilmemiş';
  }
  if (sanitized && sanitized !== 'Belirtilmemiş') return sanitized;
  return trimmed;
}

/** Mail ve kartta Dosya Konusu: Ayarlar konusu, sonra eski konu, sonra yazılan konu. */
export function claimFileSubjectName(claim: {
  departmentFileSubject?: { name?: string | null } | null;
  claimSubject?: { name?: string | null } | null;
  lossType?: string | null;
}): string | null {
  const candidates = [claim.departmentFileSubject?.name, claim.claimSubject?.name, claim.lossType];
  for (const raw of candidates) {
    const name = String(raw ?? '').trim();
    if (name && !/^belirtilmemi[sş]$/i.test(name)) return name;
  }
  return null;
}

/** Canonical etiketten ClaimSubject id çöz */
export async function resolveClaimSubjectIdByLabel(
  prisma: PrismaService,
  label?: string | null,
): Promise<string | null> {
  const trimmed = label?.trim();
  if (!trimmed || trimmed.length > 80 || /^gelen kutusu ihbar/i.test(trimmed)) return null;

  const exact = await prisma.claimSubject.findFirst({
    where: { name: { equals: trimmed, mode: 'insensitive' }, isActive: true },
    select: { id: true },
  });
  if (exact) return exact.id;

  const normalized = trimmed.toLocaleLowerCase('tr-TR');
  const all = await prisma.claimSubject.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });
  const match = all.find(
    (s) => s.name.toLocaleLowerCase('tr-TR') === normalized,
  );
  return match?.id ?? null;
}
