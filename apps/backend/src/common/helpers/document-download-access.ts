import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  assertClaimFileAccess,
  isAssistanceCompanyUser,
  isInsuranceCompanyUser,
  normalizeRequestUser,
  type RequestUser,
} from './claim-file-scope.helper';
import { isFieldStaff } from './field-staff.helper';

export const DOCUMENT_DOWNLOAD_NOT_FOUND = 'Evrak bulunamadı';

type PrismaDownloadClient = {
  claimFile: {
    findUnique: (args: any) => Promise<any>;
    findFirst: (args: any) => Promise<any>;
  };
  emergencyCase: {
    findUnique: (args: any) => Promise<any>;
    findFirst: (args: any) => Promise<any>;
  };
};

export function silentDocumentDownloadDeny(): never {
  throw new NotFoundException(DOCUMENT_DOWNLOAD_NOT_FOUND);
}

export function rethrowDownloadAccess(error: unknown): never {
  if (error instanceof ForbiddenException) silentDocumentDownloadDeny();
  throw error;
}

export function normalizeDownloadEntityType(entityType: string): string {
  return String(entityType ?? '').trim().replace(/-/g, '_');
}

export function fieldStaffOwnsEmergencyCase(
  row: { assignedFieldUserId?: string | null; assignedUserId?: string | null },
  userId: string,
): boolean {
  return row.assignedFieldUserId === userId || row.assignedUserId === userId;
}

export function scopesFromUser(user: any): {
  insuranceCompanyIds: string[];
  assistantCustomerIds: string[];
} {
  const insuranceCompanyIds = Array.isArray(user?.insuranceCompanyScopes)
    ? user.insuranceCompanyScopes.map(String)
    : [];
  const assistantCustomerIds = Array.isArray(user?.assistantCustomerScopes)
    ? user.assistantCustomerScopes.map(String)
    : [];
  return { insuranceCompanyIds, assistantCustomerIds };
}

/**
 * Hasar / Acil / müşteri evrakı: saha yalnız atandığı dosyada;
 * sigorta oturumundaki şirket ile dosyanın sigorta şirketi eşleşir.
 */
export async function assertScopedFileEntityAccess(
  prisma: PrismaDownloadClient,
  entityType: string,
  entityId: string,
  user: any,
): Promise<void> {
  const requestingUser = normalizeRequestUser(user);
  if (!requestingUser) return;

  const type = normalizeDownloadEntityType(entityType);
  const { insuranceCompanyIds, assistantCustomerIds } = scopesFromUser(user);

  if (type === 'claim_file') {
    const claimFile = await prisma.claimFile.findUnique({
      where: { id: entityId },
      select: {
        insuranceCompanyId: true,
        assignedFieldUserId: true,
        closedAt: true,
        customerId: true,
      },
    });
    if (!claimFile) throw new NotFoundException('Hasar dosyası bulunamadı');
    assertClaimFileAccess(claimFile, requestingUser, insuranceCompanyIds, assistantCustomerIds);
    return;
  }

  if (type === 'emergency_case') {
    const emergencyCase = await prisma.emergencyCase.findUnique({
      where: { id: entityId },
      select: {
        assignedFieldUserId: true,
        assignedUserId: true,
        customerId: true,
      },
    });
    if (!emergencyCase) throw new NotFoundException('Dosya bulunamadı');
    await assertEmergencyRowAccess(
      prisma,
      emergencyCase,
      requestingUser,
      insuranceCompanyIds,
      assistantCustomerIds,
    );
    return;
  }

  if (type === 'customer') {
    await assertCustomerDocumentAccess(
      prisma,
      entityId,
      requestingUser,
      insuranceCompanyIds,
      assistantCustomerIds,
    );
  }
}

async function assertEmergencyRowAccess(
  prisma: PrismaDownloadClient,
  emergencyCase: {
    assignedFieldUserId?: string | null;
    assignedUserId?: string | null;
    customerId?: string | null;
  },
  requestingUser: RequestUser,
  insuranceCompanyIds: string[],
  assistantCustomerIds: string[],
): Promise<void> {
  if (isFieldStaff(requestingUser.roleCode)) {
    if (fieldStaffOwnsEmergencyCase(emergencyCase, requestingUser.id)) return;
    throw new ForbiddenException('Bu dosyaya erişim izniniz bulunmamaktadır');
  }

  if (isInsuranceCompanyUser(requestingUser.roleCode)) {
    if (!insuranceCompanyIds.length || !emergencyCase.customerId) {
      throw new ForbiddenException('Bu dosyaya erişim izniniz bulunmamaktadır');
    }
    const linked = await prisma.claimFile.findFirst({
      where: {
        customerId: emergencyCase.customerId,
        insuranceCompanyId: { in: insuranceCompanyIds },
      },
      select: { id: true },
    });
    if (!linked) {
      throw new ForbiddenException('Bu dosyaya erişim izniniz bulunmamaktadır');
    }
    return;
  }

  if (isAssistanceCompanyUser(requestingUser.roleCode)) {
    if (
      !assistantCustomerIds.length
      || !emergencyCase.customerId
      || !assistantCustomerIds.includes(emergencyCase.customerId)
    ) {
      throw new ForbiddenException('Bu dosyaya erişim izniniz bulunmamaktadır');
    }
  }
}

async function assertCustomerDocumentAccess(
  prisma: PrismaDownloadClient,
  customerId: string,
  requestingUser: RequestUser,
  insuranceCompanyIds: string[],
  assistantCustomerIds: string[],
): Promise<void> {
  if (isFieldStaff(requestingUser.roleCode)) {
    const assignedClaim = await prisma.claimFile.findFirst({
      where: { customerId, assignedFieldUserId: requestingUser.id },
      select: { id: true },
    });
    if (assignedClaim) return;
    const assignedEmergency = await prisma.emergencyCase.findFirst({
      where: {
        customerId,
        OR: [
          { assignedFieldUserId: requestingUser.id },
          { assignedUserId: requestingUser.id },
        ],
      },
      select: { id: true },
    });
    if (!assignedEmergency) {
      throw new ForbiddenException('Bu müşteriye erişim izniniz bulunmamaktadır');
    }
    return;
  }

  if (isInsuranceCompanyUser(requestingUser.roleCode)) {
    if (!insuranceCompanyIds.length) {
      throw new ForbiddenException('Bu müşteriye erişim izniniz bulunmamaktadır');
    }
    const linked = await prisma.claimFile.findFirst({
      where: {
        customerId,
        insuranceCompanyId: { in: insuranceCompanyIds },
      },
      select: { id: true },
    });
    if (!linked) {
      throw new ForbiddenException('Bu müşteriye erişim izniniz bulunmamaktadır');
    }
    return;
  }

  if (isAssistanceCompanyUser(requestingUser.roleCode)) {
    if (!assistantCustomerIds.includes(customerId)) {
      throw new ForbiddenException('Bu müşteriye erişim izniniz bulunmamaktadır');
    }
  }
}

export function fieldStaffMayDownloadEntityType(entityType: string): boolean {
  const type = normalizeDownloadEntityType(entityType);
  return type === 'claim_file' || type === 'emergency_case' || type === 'customer';
}
