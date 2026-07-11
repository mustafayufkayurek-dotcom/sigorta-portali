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

/** Gelen kutusu / dosya oluşturma için canonical lossType */
export function sanitizeInboundLossType(raw?: string | null, fileSubject?: string | null): string {
  const canonical =
    mapInboundCategoryKnown(fileSubject)
    || mapInboundLossTypeToMeridyen(raw);
  return canonical || 'Belirtilmemiş';
}

/** Canonical etiketten ClaimSubject id çöz */
export async function resolveClaimSubjectIdByLabel(
  prisma: PrismaService,
  label?: string | null,
): Promise<string | null> {
  const trimmed = label?.trim();
  if (!trimmed || isInboundIhbarNoteText(trimmed)) return null;

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
