import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { canOpenAcilFinanceAccess } from '@sigorta/shared';
import { OperationalAccessGrantsService } from '@/modules/operational-access-grants/operational-access-grants.service';

/** Adres yazılsa da Acil finans API’si ofis / sahaya açılmaz. */
@Injectable()
export class AcilFinanceAccessGuard implements CanActivate {
  constructor(private readonly operationalAccessGrants: OperationalAccessGrantsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request?.user;
    const roleCode = user?.roleCode ?? user?.role?.code;
    const userId = String(user?.id ?? user?.userId ?? '');
    const hasDelegation = userId
      ? await this.operationalAccessGrants.hasFunctionDelegation(userId, 'acil_yardim')
      : false;
    if (!canOpenAcilFinanceAccess(roleCode, hasDelegation)) {
      throw new NotFoundException();
    }
    return true;
  }
}
