import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { mergeAcilFileOwnerPermissions } from '@sigorta/shared';

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
    const rolePermissions = user?.role?.rolePermissions?.map((rp: { permission: { code: string } }) => rp.permission.code) || [];
    const now = new Date();
    const acilFunctionGrant = user?.id
      ? await this.prismaService.operationalAccessGrant.findFirst({
          where: {
            granteeUserId: user.id,
            grantType: 'function_delegation',
            isActive: true,
            validFrom: { lte: now },
            OR: [{ validTo: null }, { validTo: { gte: now } }],
            scopeType: { in: ['acil_yardim', 'both'] },
          },
          select: { id: true },
        })
      : null;
    return {
      id: user?.id ?? payload.sub,
      userId: payload.sub,
      email: payload.email,
      roleCode: user?.role?.code || null,
      permissions: mergeAcilFileOwnerPermissions(rolePermissions, Boolean(acilFunctionGrant)),
      insuranceCompanyScopes:
        user?.userInsuranceCompanyScopes?.map((s: { insuranceCompanyId: string }) => s.insuranceCompanyId) ?? [],
      assistantCustomerScopes:
        user?.userAssistantCustomerScopes?.map((s: { customerId: string }) => s.customerId) ?? [],
    };
  }
}
