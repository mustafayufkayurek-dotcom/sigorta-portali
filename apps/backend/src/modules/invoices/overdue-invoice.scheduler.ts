import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class OverdueInvoiceScheduler {
  private readonly logger = new Logger(OverdueInvoiceScheduler.name);

  constructor(private prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async checkOverdueInvoices() {
    this.logger.log('Vadesi geçmiş faturalar kontrol ediliyor...');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overdueInvoices = await this.prisma.invoice.findMany({
      where: {
        dueDate: { lt: today },
        status: { notIn: ['paid', 'cancelled'] },
      },
      include: {
        claimFile: {
          select: {
            id: true,
            fileNo: true,
            assignedOfficeUserId: true,
          },
        },
        emergencyCase: {
          select: {
            id: true,
            fileNo: true,
            caseNo: true,
            assignedUserId: true,
          },
        },
        createdBy: {
          select: { id: true },
        },
      },
    });

    this.logger.log(`${overdueInvoices.length} vadesi geçmiş fatura bulundu`);

    for (const invoice of overdueInvoices) {
      const daysOverdue = Math.floor(
        (today.getTime() - new Date(invoice.dueDate!).getTime()) / (1000 * 60 * 60 * 24),
      );

      // Only notify at specific milestones to avoid spam
      if (![3, 7, 15, 30].includes(daysOverdue)) continue;

      let severity = 'info';
      if (daysOverdue >= 30) severity = 'critical';
      else if (daysOverdue >= 15) severity = 'high';
      else if (daysOverdue >= 7) severity = 'warning';

      const fileNo =
        invoice.claimFile?.fileNo
        ?? invoice.emergencyCase?.fileNo
        ?? invoice.emergencyCase?.caseNo
        ?? '—';
      const targetUserId =
        invoice.claimFile?.assignedOfficeUserId
        ?? invoice.emergencyCase?.assignedUserId
        ?? invoice.createdBy.id;

      if (!targetUserId) continue;

      // Check if notification already sent today for this invoice+days
      const existingNotification = await this.prisma.notification.findFirst({
        where: {
          userId: targetUserId,
          type: 'invoice_overdue',
          relatedEntityId: invoice.id,
          createdAt: { gte: today },
        },
      });

      if (existingNotification) continue;

      await this.prisma.notification.create({
        data: {
          userId: targetUserId,
          type: 'invoice_overdue',
          title: `Vadesi Geçmiş Fatura — ${daysOverdue} Gün (${severity})`,
          body: `${invoice.invoiceNo} numaralı fatura ${daysOverdue} gün gecikmiş. Dosya: ${fileNo}`,
          channel: 'in_app',
          relatedEntityType: 'invoice',
          relatedEntityId: invoice.id,
          status: 'pending',
        },
      });
    }

    this.logger.log('Vadesi geçmiş fatura kontrol tamamlandı');
  }
}
