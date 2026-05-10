import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { sanitizeAuditValue } from './audit-log.sanitizer';
import { Prisma } from '@prisma/client';

type LogParams = {
  entityType: string;
  entityId: string;
  action: string;
  oldValue?: unknown;
  newValue?: unknown;
  userId: string;
  userEmail?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);

  constructor(private readonly prisma: PrismaService) {}

  log(params: LogParams): void {
    const payload: Prisma.AuditLogUncheckedCreateInput = {
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      oldValue: params.oldValue === undefined ? undefined : (sanitizeAuditValue(params.oldValue) as Prisma.InputJsonValue),
      newValue: params.newValue === undefined ? undefined : (sanitizeAuditValue(params.newValue) as Prisma.InputJsonValue),
      userId: params.userId,
      userEmail: params.userEmail ?? null,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
    };

    void this.prisma.auditLog
      .create({
        data: payload,
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Audit log yazilamadi: ${message}`);
      });
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    entityType?: string;
    userId?: string;
    from?: string;
    to?: string;
  }) {
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.entityType) where.entityType = params.entityType;
    if (params.userId) where.userId = params.userId;
    if (params.from || params.to) {
      where.createdAt = {
        ...(params.from ? { gte: new Date(params.from) } : {}),
        ...(params.to ? { lte: new Date(params.to) } : {}),
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }
}