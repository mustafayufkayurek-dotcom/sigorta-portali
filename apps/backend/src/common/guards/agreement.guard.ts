import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AgreementsService } from '../../modules/agreements/agreements.service';
import { resolveUserId } from '../utils/resolve-user-id';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

export const SKIP_AGREEMENT_GUARD_KEY = 'skipAgreementGuard';

// Endpoint'e @SkipAgreementGuard() eklenince bu guard atlanır
import { SetMetadata } from '@nestjs/common';
export const SkipAgreementGuard = () => SetMetadata(SKIP_AGREEMENT_GUARD_KEY, true);

@Injectable()
export class AgreementGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly agreementsService: AgreementsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Public endpoint'leri atla
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // Guard'ın skip edildiği endpoint'leri atla
    const skipGuard = this.reflector.getAllAndOverride<boolean>(SKIP_AGREEMENT_GUARD_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skipGuard) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Kullanıcı yoksa (JwtAuthGuard zaten yakalar) geçirir
    if (!user) return true;

    // Agreements endpoint'lerine erişim her zaman serbest
    const path: string = request.path ?? '';
    if (path.includes('/agreements')) return true;
    if (path.includes('/auth/')) return true;

    try {
      const userId = resolveUserId(user);
      const hasAccepted = await this.agreementsService.hasUserAcceptedAll(userId);
      if (!hasAccepted) {
        const pending = await this.agreementsService.getPendingForUser(userId);
        throw new ForbiddenException({
          code: 'AGREEMENTS_PENDING',
          message: 'Önce aktif sözleşmeleri onaylamanız gerekiyor.',
          pendingAgreements: pending.map((a: { id: string; title: string; type: string; version: string }) => ({
            id: a.id,
            title: a.title,
            type: a.type,
            version: a.version,
          })),
        });
      }
    } catch (err: any) {
      // Agreements tablosu henüz migrate edilmediyse veya DB hatası varsa guard'ı geç
      if (err instanceof ForbiddenException) throw err;
    }

    return true;
  }
}
