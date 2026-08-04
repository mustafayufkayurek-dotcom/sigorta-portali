import { ForbiddenException } from '@nestjs/common';
import { isFieldStaff } from './field-staff.helper';

export const CLAIM_FILE_ACCESS_EXPIRY_HOURS = 48;

export type RequestUser = { id: string; roleCode: string; permissions?: string[] };

export function normalizeRequestUser(user: any): RequestUser | undefined {
  if (!user) return undefined;
  const id = user.id ?? user.userId;
  const roleCode = user.roleCode ?? user.role?.code;
  if (!id || !roleCode) return undefined;
  const permissions = Array.isArray(user.permissions) ? user.permissions.map(String) : undefined;
  return { id: String(id), roleCode: String(roleCode), permissions };
}

export function isInsuranceCompanyUser(roleCode: string | undefined | null): boolean {
  return roleCode === 'insurance_company_user';
}

export function isAssistanceCompanyUser(roleCode: string | undefined | null): boolean {
  return roleCode === 'assistance_company_user';
}

export function mergeWhereAnd(...clauses: Array<Record<string, unknown>>): Record<string, unknown> {
  const nonEmpty = clauses.filter((c) => Object.keys(c).length > 0);
  if (nonEmpty.length === 0) return {};
  if (nonEmpty.length === 1) return nonEmpty[0];
  return { AND: nonEmpty };
}

/**
 * Hasar dosyası listesi için rol bazlı scope filtresi (findAll).
 */
export function applyClaimFileListScope(
  baseWhere: Record<string, unknown>,
  user?: RequestUser,
  insuranceCompanyIds?: string[],
  assistantCustomerIds?: string[],
  expertOfficeCustomerIds?: string[],
): Record<string, unknown> {
  const scopes: Array<Record<string, unknown>> = [];
  if (Object.keys(baseWhere).length > 0) scopes.push({ ...baseWhere });

  if (insuranceCompanyIds?.length) {
    scopes.push({ insuranceCompanyId: { in: insuranceCompanyIds } });
  }

  if (assistantCustomerIds?.length) {
    scopes.push({ customerId: { in: assistantCustomerIds } });
  }

  if (user && isFieldStaff(user.roleCode)) {
    const expiryThreshold = new Date(
      Date.now() - CLAIM_FILE_ACCESS_EXPIRY_HOURS * 60 * 60 * 1000,
    );
    scopes.push({
      assignedFieldUserId: user.id,
      OR: [{ closedAt: null }, { closedAt: { gt: expiryThreshold } }],
    });
  }

  if (user?.roleCode === 'expert') {
    const expertOr: Array<Record<string, unknown>> = [
      { assignedAdjusterId: user.id },
      {
        sourceChannel: 'expert_portal',
        repairReports: { some: { createdByUserId: user.id } },
      },
    ];
    // Gelen kutudan açılan hasar: customerId = ekspertiz firması; eksper kullanıcı firmasına yansır
    if (expertOfficeCustomerIds?.length) {
      expertOr.push({ customerId: { in: expertOfficeCustomerIds } });
    }
    scopes.push({ OR: expertOr });
  }

  return mergeWhereAnd(...scopes);
}

type ClaimFileAccessRow = {
  assignedFieldUserId?: string | null;
  closedAt?: Date | null;
  insuranceCompanyId?: string | null;
  customerId?: string | null;
  assignedAdjusterId?: string | null;
  sourceChannel?: string | null;
};

/**
 * Tekil hasar dosyası erişim denetimi (findOne).
 */
export function assertClaimFileAccess(
  claimFile: ClaimFileAccessRow,
  user?: RequestUser,
  insuranceCompanyIds?: string[],
  assistantCustomerIds?: string[],
  _expertOfficeCustomerIds?: string[],
): void {
  if (!user) return;

  if (isInsuranceCompanyUser(user.roleCode)) {
    if (!insuranceCompanyIds?.length || !insuranceCompanyIds.includes(claimFile.insuranceCompanyId ?? '')) {
      throw new ForbiddenException('Bu dosyaya erişim izniniz bulunmamaktadır');
    }
  }

  if (isAssistanceCompanyUser(user.roleCode)) {
    if (!assistantCustomerIds?.length || !assistantCustomerIds.includes(claimFile.customerId ?? '')) {
      throw new ForbiddenException('Bu dosyaya erişim izniniz bulunmamaktadır');
    }
  }

  // expert erişimi: liste filtresi + findOne özel dalı (ofis / atama / kendi raporu)

  if (isFieldStaff(user.roleCode)) {
    if (claimFile.assignedFieldUserId !== user.id) {
      throw new ForbiddenException('Bu dosyaya erişim izniniz bulunmamaktadır');
    }
    if (claimFile.closedAt) {
      const expiryMs = CLAIM_FILE_ACCESS_EXPIRY_HOURS * 60 * 60 * 1000;
      const expiry = new Date(claimFile.closedAt.getTime() + expiryMs);
      if (new Date() > expiry) {
        throw new ForbiddenException('Bu dosya için erişim süreniz dolmuştur');
      }
    }
  }
}

/**
 * Payment / expense gibi claimFile ilişkili kayıtlar için scope.
 */
export function buildClaimFileRelationScope(
  user?: RequestUser,
  insuranceCompanyIds?: string[],
  assistantCustomerIds?: string[],
  expertOfficeCustomerIds?: string[],
): Record<string, unknown> | undefined {
  const scoped = applyClaimFileListScope(
    {},
    user,
    insuranceCompanyIds,
    assistantCustomerIds,
    expertOfficeCustomerIds,
  );
  if (Object.keys(scoped).length === 0) return undefined;
  return { claimFile: scoped };
}
