import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  HttpException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PrismaService } from '@/prisma/prisma.service';
import { TokenBlacklistService } from '@/modules/auth/token-blacklist.service';
import { extractAccessToken } from '@/common/auth/auth-cookies';
import { mergeAcilFileOwnerPermissions } from '@sigorta/shared';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private jwtService: JwtService,
    private prisma: PrismaService,
    private tokenBlacklistService: TokenBlacklistService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const token = extractAccessToken(request);

    if (!token) {
      throw new UnauthorizedException('Token bulunamadı');
    }

    try {
      if (await this.tokenBlacklistService.isBlacklisted(token)) {
        throw new UnauthorizedException('Token geçersiz');
      }

      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
      });

      // Load user with permissions
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: {
          role: {
            include: {
              rolePermissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
          userInsuranceCompanyScopes: true,
          userAssistantCustomerScopes: true,
        },
      });

      if (!user || user.status !== 'active') {
        throw new UnauthorizedException('Kullanıcı bulunamadı veya aktif değil');
      }

      const rolePermissions = user.role.rolePermissions.map((rp) => rp.permission.code);
      const acilFunctionGrant = await this.prisma.operationalAccessGrant.findFirst({
        where: {
          granteeUserId: user.id,
          grantType: 'function_delegation',
          isActive: true,
          validFrom: { lte: new Date() },
          OR: [{ validTo: null }, { validTo: { gte: new Date() } }],
          scopeType: { in: ['acil_yardim', 'both'] },
        },
        select: { id: true },
      });

      request.user = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roleCode: user.role.code,
        roleId: user.roleId,
        branchId: user.branchId,
        permissions: mergeAcilFileOwnerPermissions(rolePermissions, Boolean(acilFunctionGrant)),
        insuranceCompanyScopes: user.userInsuranceCompanyScopes.map(
          (s) => s.insuranceCompanyId,
        ),
        assistantCustomerScopes: user.userAssistantCustomerScopes.map(
          (s) => s.customerId,
        ),
      };

      return true;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new UnauthorizedException('Geçersiz veya süresi dolmuş token');
    }
  }
}
