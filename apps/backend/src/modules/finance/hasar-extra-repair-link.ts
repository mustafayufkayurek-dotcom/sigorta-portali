import { EXTRA_REPAIR_KIND } from '@sigorta/shared';
import { PrismaService } from '@/prisma/prisma.service';

export async function linkOpenExtraRepairToReport(
  prisma: PrismaService,
  claimFileId: string,
  reportId: string,
): Promise<void> {
  const open = await prisma.extraWorkItem.findFirst({
    where: {
      claimFileId,
      kind: EXTRA_REPAIR_KIND,
      status: { in: ['draft', 'approved'] },
      repairReportId: null,
    },
    select: { id: true },
  });
  if (!open) return;
  await prisma.extraWorkItem.update({
    where: { id: open.id },
    data: { repairReportId: reportId },
  });
}

export async function markExtraRepairApprovedForReport(
  prisma: PrismaService,
  reportId: string,
): Promise<void> {
  await prisma.extraWorkItem.updateMany({
    where: { repairReportId: reportId, kind: EXTRA_REPAIR_KIND, status: 'draft' },
    data: { status: 'approved', agreedAt: new Date() },
  });
}
