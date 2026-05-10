import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '@/prisma/prisma.service';
import { LogAccessDto } from './dto/log-access.dto';

const ANOMALY_THRESHOLD = 50;
const ANOMALY_WINDOW_HOURS = 1;

@Injectable()
export class CustomerAccessLogService {
  constructor(
    @InjectQueue('customer-access') private accessQueue: Queue,
    private prisma: PrismaService,
  ) {}

  /**
   * Async (non-blocking): BullMQ kuyruğuna log job'ı ekler
   */
  logAsync(dto: LogAccessDto): void {
    this.accessQueue.add('log-access', dto).catch(() => {
      // Kuyruk hatası loglama'yı engellemez
    });
  }

  async findAll(filters?: {
    userId?: string;
    customerId?: string;
    accessType?: string;
    isAnomaly?: boolean;
    fromDate?: string;
    toDate?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Number(filters?.page) || 1;
    const limit = Number(filters?.limit) || 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (filters?.userId) where.userId = filters.userId;
    if (filters?.customerId) where.customerId = filters.customerId;
    if (filters?.accessType) where.accessType = filters.accessType;
    if (filters?.isAnomaly !== undefined) where.isAnomaly = filters.isAnomaly;
    if (filters?.fromDate || filters?.toDate) {
      where.createdAt = {
        ...(filters.fromDate ? { gte: new Date(filters.fromDate) } : {}),
        ...(filters.toDate ? { lte: new Date(filters.toDate) } : {}),
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.customerAccessLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, roleId: true } },
          customer: { select: { id: true, fullName: true, companyName: true, phone: true } },
          claimFile: { select: { id: true, fileNo: true } },
        },
      }),
      this.prisma.customerAccessLog.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getStats() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [todayTotal, todayAnomalies, weekTotal, weekAnomalies] = await Promise.all([
      this.prisma.customerAccessLog.count({ where: { createdAt: { gte: todayStart } } }),
      this.prisma.customerAccessLog.count({ where: { createdAt: { gte: todayStart }, isAnomaly: true } }),
      this.prisma.customerAccessLog.count({ where: { createdAt: { gte: weekStart } } }),
      this.prisma.customerAccessLog.count({ where: { createdAt: { gte: weekStart }, isAnomaly: true } }),
    ]);

    return { todayTotal, todayAnomalies, weekTotal, weekAnomalies };
  }

  /**
   * 24 saatte >20 farklı müşteri erişimi varsa anomali kaydeder ve yöneticiye bildirim atar
   */
  async detectAndAlertAnomaly(
    logId: string,
    userId: string,
  ): Promise<void> {
    const since = new Date(Date.now() - ANOMALY_WINDOW_HOURS * 60 * 60 * 1000);

    const distinctCustomers = await this.prisma.customerAccessLog.findMany({
      where: { userId, createdAt: { gte: since } },
      distinct: ['customerId'],
      select: { customerId: true },
    });

    if (distinctCustomers.length > ANOMALY_THRESHOLD) {
      // Log'u anomali olarak işaretle
      await this.prisma.customerAccessLog.update({
        where: { id: logId },
        data: { isAnomaly: true },
      });

      // Yöneticilere bildirim gönder
      const admins = await this.prisma.user.findMany({
        where: { role: { code: 'admin' }, status: 'active' },
        select: { id: true },
      });

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true },
      });

      const userName = user ? `${user.firstName} ${user.lastName}` : userId;

      if (admins.length > 0) {
        await this.prisma.notification.createMany({
          data: admins.map((admin) => ({
            userId: admin.id,
            type: 'security_anomaly',
            title: 'Anormal Müşteri Erişimi Tespit Edildi',
            body: `${userName} kullanıcısı son ${ANOMALY_WINDOW_HOURS} saatte ${distinctCustomers.length} farklı müşteri bilgisine erişti (eşik: ${ANOMALY_THRESHOLD}).`,
            channel: 'in_app',
            status: 'pending',
            relatedEntityType: 'user',
            relatedEntityId: userId,
          })),
        });
      }
    }
  }
}
