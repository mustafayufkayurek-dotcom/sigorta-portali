import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@/prisma/prisma.service';

const ACCESS_EXPIRY_HOURS = 48;

@Injectable()
export class AccessExpiryScheduler {
  private readonly logger = new Logger(AccessExpiryScheduler.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Her gün 03:00'te kapanmış dosyalar veya tamamlanmış görevler için
   * erişim süresi dolan durumları kontrol eder ve yöneticilere bildirim gönderir.
   */
  @Cron('0 3 * * *')
  async handleExpiredAccessCheck(): Promise<void> {
    this.logger.log('Erişim süresi kontrolü başlatıldı...');
    const expiryThreshold = new Date(Date.now() - ACCESS_EXPIRY_HOURS * 60 * 60 * 1000);

    try {
      // Süresi dolmuş dosyalara son 24 saatte erişim deneyen kullanıcıları bul
      const expiredFileAccesses = await this.prisma.customerAccessLog.findMany({
        where: {
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          claimFile: {
            closedAt: { lt: expiryThreshold },
          },
        },
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
          claimFile: { select: { id: true, fileNo: true, closedAt: true } },
        },
        distinct: ['userId', 'claimFileId'],
      });

      if (expiredFileAccesses.length > 0) {
        this.logger.warn(
          `${expiredFileAccesses.length} adet süresi dolmuş dosya erişimi tespit edildi`,
        );

        // Admin'lere toplu bildirim
        const admins = await this.prisma.user.findMany({
          where: { role: { code: 'admin' }, status: 'active' },
          select: { id: true },
        });

        if (admins.length > 0) {
          const uniqueUsers = new Set(expiredFileAccesses.map((a) => a.userId));
          await this.prisma.notification.createMany({
            data: admins.map((admin) => ({
              userId: admin.id,
              type: 'access_expiry_warning',
              title: 'Süresi Dolmuş Dosya Erişimi',
              body: `${uniqueUsers.size} kullanıcı süresi dolmuş ${expiredFileAccesses.length} dosyaya erişim denemesi gerçekleştirdi.`,
              channel: 'in_app',
              status: 'pending',
              relatedEntityType: 'security',
              relatedEntityId: null,
            })),
          });
        }
      }

      this.logger.log('Erişim süresi kontrolü tamamlandı');
    } catch (error) {
      this.logger.error('Erişim süresi kontrolü sırasında hata:', error);
    }
  }
}
