import {
  isInboundIhbarNoteText,
  mapInboundCategoryKnown,
  mapInboundLossTypeToMeridyen,
} from '@sigorta/shared';
import type { PrismaService } from '@/prisma/prisma.service';

/** Ayarlar → Dosya Konuları kaydıyla eşleşen kanonik konu */
export async function resolveDepartmentFileSubjectByLabel(
  prisma: PrismaService,
  label?: string | null,
  departmentId?: string | null,
): Promise<{ id: string; name: string } | null> {
  const trimmed = label?.trim();
  if (!trimmed || isInboundIhbarNoteText(trimmed)) return null;

  const canonical =
    mapInboundLossTypeToMeridyen(trimmed)
    ?? mapInboundCategoryKnown(trimmed)
    ?? trimmed;

  const norm = (s: string) => s.trim().toLocaleLowerCase('tr-TR');
  const keys = new Set([norm(trimmed), norm(canonical)]);

  const subjects = await prisma.departmentFileSubject.findMany({
    where: {
      status: 'active',
      ...(departmentId ? { departmentId } : {}),
      department: { status: 'active' },
    },
    select: { id: true, name: true, code: true },
  });

  const match = subjects.find(
    (s) => keys.has(norm(s.name)) || keys.has(norm(s.code)),
  );
  return match ? { id: match.id, name: match.name } : null;
}
