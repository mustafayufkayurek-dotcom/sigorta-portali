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
    const token = this.extractTokenFromHeader(request);

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

      request.user = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roleCode: user.role.code,
        roleId: user.roleId,
        branchId: user.branchId,
        permissions: user.role.rolePermissions.map((rp) => rp.permission.code),
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

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
