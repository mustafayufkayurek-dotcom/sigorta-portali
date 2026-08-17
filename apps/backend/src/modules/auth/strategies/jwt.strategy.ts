import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prismaService: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    const user = await this.prismaService.user.findUnique({
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
        userInsuranceCompanyScopes: {
          select: { insuranceCompanyId: true },
        },
        userAssistantCustomerScopes: {
          select: { customerId: true },
        },
      },
    });
    return {
      id: user?.id ?? payload.sub,
      userId: payload.sub,
      email: payload.email,
      roleCode: user?.role?.code || null,
      permissions: user?.role?.rolePermissions?.map((rp) => rp.permission.code) || [],
      insuranceCompanyScopes:
        user?.userInsuranceCompanyScopes?.map((s) => s.insuranceCompanyId) ?? [],
      assistantCustomerScopes:
        user?.userAssistantCustomerScopes?.map((s) => s.customerId) ?? [],
    };
  }
}
