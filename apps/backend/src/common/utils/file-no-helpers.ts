import { Prisma } from '@prisma/client';
import { compactFileNo } from '@sigorta/shared';
import { PrismaService } from '@/prisma/prisma.service';

const CLAIM_COMPACT_SQL = Prisma.sql`
  UPPER(REGEXP_REPLACE(COALESCE(file_no, ''), '[[:space:]]+', '', 'g'))
`;

const EMERGENCY_FILE_COMPACT_SQL = Prisma.sql`
  UPPER(REGEXP_REPLACE(COALESCE(file_no, ''), '[[:space:]]+', '', 'g'))
`;

const EMERGENCY_CASE_COMPACT_SQL = Prisma.sql`
  UPPER(REGEXP_REPLACE(COALESCE(case_no, ''), '[[:space:]]+', '', 'g'))
`;

export async function findClaimFileIdByCompactFileNo(
  prisma: PrismaService,
  fileNo: string,
  excludeId?: string,
): Promise<string | null> {
  const compact = compactFileNo(fileNo);
  if (!compact) return null;

  const excludeClause = excludeId
    ? Prisma.sql`AND id <> ${excludeId}::uuid`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM claim_files
    WHERE ${CLAIM_COMPACT_SQL} = ${compact}
    ${excludeClause}
    LIMIT 1
  `;
  return rows[0]?.id ?? null;
}

export async function findEmergencyCaseIdByCompactFileNo(
  prisma: PrismaService,
  fileNo: string,
  excludeId?: string,
): Promise<string | null> {
  const compact = compactFileNo(fileNo);
  if (!compact) return null;

  const excludeClause = excludeId
    ? Prisma.sql`AND id <> ${excludeId}::uuid`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM emergency_cases
    WHERE ${EMERGENCY_FILE_COMPACT_SQL} = ${compact}
       OR ${EMERGENCY_CASE_COMPACT_SQL} = ${compact}
    ${excludeClause}
    LIMIT 1
  `;
  return rows[0]?.id ?? null;
}
