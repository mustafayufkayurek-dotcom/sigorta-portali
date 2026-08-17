import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CustomerAccessLogService } from '@/modules/customer-access-log/customer-access-log.service';
import { isFieldStaff } from '../helpers/field-staff.helper';

const ACCESS_EXPIRY_HOURS = 48;

@Injectable()
export class CustomerAccessGuard implements CanActivate {
  constructor(
    private prisma: PrismaService,
    private accessLogService: CustomerAccessLogService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Kullanıcı bilgisi bulunamadı');
    }

    // Saha personeli değilse tam erişim
    if (!isFieldStaff(user.roleCode)) {
      return true;
    }

    const customerId: string | undefined = request.params?.id ?? request.params?.customerId;
    const claimFileId: string | undefined = request.params?.claimFileId ?? request.params?.fileId;

    // customerId üzerinden kontrol
    if (customerId) {
      await this.checkCustomerAccess(user.id, customerId, request);
    } else if (claimFileId) {
      await this.checkClaimFileAccess(user.id, claimFileId, request);
    }

    return true;
  }

  private async checkCustomerAccess(
    userId: string,
    customerId: string,
    request: any,
  ): Promise<void> {
    // Bu müşteriye ait, kullanıcının atandığı aktif bir ClaimFile var mı?
    const assignedFile = await this.prisma.claimFile.findFirst({
      where: {
        customerId,
        assignedFieldUserId: userId,
      },
      include: {
        tasks: {
          where: { assignedUserId: userId },
          orderBy: { completedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!assignedFile) {
      throw new ForbiddenException(
        'Bu müşteriye erişim izniniz bulunmamaktadır',
      );
    }

    // Erişim süresi kontrolü
    this.checkAccessExpiry(assignedFile);

    // Erişim logu
    this.accessLogService.logAsync({
      userId,
      customerId,
      claimFileId: assignedFile.id,
      accessType: 'view',
      ipAddress: request.ip,
      userAgent: request.headers?.['user-agent'],
    });
  }

  private async checkClaimFileAccess(
    userId: string,
    claimFileId: string,
    request: any,
  ): Promise<void> {
    const claimFile = await this.prisma.claimFile.findFirst({
      where: {
        id: claimFileId,
        assignedFieldUserId: userId,
      },
      include: {
        tasks: {
          where: { assignedUserId: userId },
          orderBy: { completedAt: 'desc' },
          take: 1,
        },
        customer: { select: { id: true } },
      },
    });

    if (!claimFile) {
      throw new ForbiddenException(
        'Bu dosyaya erişim izniniz bulunmamaktadır',
      );
    }

    // Erişim süresi kontrolü
    this.checkAccessExpiry(claimFile);

    if (claimFile.customer?.id) {
      this.accessLogService.logAsync({
        userId,
        customerId: claimFile.customer.id,
        claimFileId,
        accessType: 'view',
        ipAddress: request.ip,
        userAgent: request.headers?.['user-agent'],
      });
    }
  }

  private checkAccessExpiry(claimFile: {
    closedAt: Date | null;
    tasks: Array<{ completedAt: Date | null }>;
  }): void {
    const now = new Date();
    const expiryMs = ACCESS_EXPIRY_HOURS * 60 * 60 * 1000;

    // ClaimFile kapanma kontrolü
    if (claimFile.closedAt) {
      const expiry = new Date(claimFile.closedAt.getTime() + expiryMs);
      if (now > expiry) {
        throw new ForbiddenException('Bu dosya için erişim süreniz dolmuştur');
      }
    }

    // Görev tamamlanma kontrolü (en son tamamlanan görev)
    const latestTask = claimFile.tasks[0];
    if (latestTask?.completedAt) {
      const expiry = new Date(latestTask.completedAt.getTime() + expiryMs);
      if (now > expiry) {
        throw new ForbiddenException('Bu dosya için erişim süreniz dolmuştur');
      }
    }
  }
}
