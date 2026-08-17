import { Injectable, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    userId: string,
    params?: { page?: number; limit?: number; status?: string },
  ) {
    const page = Number(params?.page) || 1;
    const limit = Number(params?.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (params?.status) where.status = params.status;

    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, status: { not: 'read' } },
    });
  }

  async markAsRead(id: string, userId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      throw new NotFoundException('Bildirim bulunamadı');
    }

    return this.prisma.notification.update({
      where: { id },
      data: { status: 'read', readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, status: { not: 'read' } },
      data: { status: 'read', readAt: new Date() },
    });
    return { message: 'Tüm bildirimler okundu olarak işaretlendi', count: result.count };
  }

  /**
   * Bugün doğum günü olan tedarikçi yetkililerini döndürür.
   * GET /notifications/birthdays-today — dashboard'da gösterilir.
   */
  async getBirthdaysToday(): Promise<Array<{
    contactId: string;
    fullName: string;
    vendorId: string;
    vendorName: string;
    birthDate: Date;
  }>> {
    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();

    // Raw query: ay ve gün eşleşmesi
    const results: any[] = await this.prisma.$queryRaw`
      SELECT
        vc.id AS "contactId",
        vc.full_name AS "fullName",
        v.id AS "vendorId",
        v.name AS "vendorName",
        vc.birth_date AS "birthDate"
      FROM vendor_contacts vc
      JOIN vendors v ON v.id = vc.vendor_id
      WHERE
        vc.birth_date IS NOT NULL
        AND EXTRACT(MONTH FROM vc.birth_date) = ${month}
        AND EXTRACT(DAY FROM vc.birth_date) = ${day}
        AND v.status = 'active'
      ORDER BY vc.full_name
    `;

    return results;
  }

  /**
   * Cron: Her gün 08:00'de doğum günü olan yetkililer için
   * tüm admin kullanıcılara bildirim oluşturur.
   */
  @Cron('0 8 * * *', { name: 'birthday-notifications', timeZone: 'Europe/Istanbul' })
  async sendBirthdayNotifications(): Promise<void> {
    const birthdays = await this.getBirthdaysToday();
    if (!birthdays.length) return;

    // Admin / manager kullanıcıları bul
    const admins = await this.prisma.user.findMany({
      where: {
        status: 'active',
        role: { code: { in: ['admin', 'manager', 'super_admin'] } },
      },
      select: { id: true },
    });

    if (!admins.length) return;

    const notifications = admins.flatMap((admin) =>
      birthdays.map((b) => ({
        userId: admin.id,
        type: 'birthday',
        title: 'Doğum Günü Hatırlatma',
        body: `Bugün ${b.fullName} (${b.vendorName}) doğum günü!`,
        channel: 'in_app',
        status: 'unread',
        relatedEntityType: 'vendor',
        relatedEntityId: b.vendorId,
      })),
    );

    await this.prisma.notification.createMany({ data: notifications, skipDuplicates: true });
  }
}
