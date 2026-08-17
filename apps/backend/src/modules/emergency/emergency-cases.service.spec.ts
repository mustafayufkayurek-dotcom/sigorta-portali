import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EmergencyCasesService } from './emergency-cases.service';

describe('EmergencyCasesService', () => {
  let service: EmergencyCasesService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      customer: { findUnique: jest.fn() },
      emergencyCase: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
      },
      claimFile: { findFirst: jest.fn() },
      inboundMessage: { findMany: jest.fn().mockResolvedValue([]) },
      fileDocument: { findMany: jest.fn().mockResolvedValue([]) },
      invoiceRequest: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const operationalAccessGrants = {
      isDelegationScopedRole: jest.fn().mockReturnValue(false),
      buildEmergencyDelegationScope: jest.fn().mockResolvedValue({}),
      canAccessAssignedUserViaDelegation: jest.fn().mockResolvedValue(false),
      resolveDelegationBanner: jest.fn().mockResolvedValue(null),
    };
    const fileDocumentsService = {
      checkEmergencyCaseClosureConditions: jest.fn().mockResolvedValue({
        canCreateInvoiceRequest: false,
      }),
    };
    const invoiceRequestsService = {
      create: jest.fn(),
    };
    const vendorProfile = {
      onFileCompleted: jest.fn().mockResolvedValue(undefined),
    };
    const emailService = {
      sendEmail: jest.fn().mockResolvedValue({ sent: true }),
    };
    const storage = {
      download: jest.fn().mockResolvedValue(Buffer.from('x')),
    };
    service = new EmergencyCasesService(
      prisma,
      operationalAccessGrants as any,
      fileDocumentsService as any,
      invoiceRequestsService as any,
      vendorProfile as any,
      emailService as any,
      storage as any,
    );
  });

  describe('findAllForCustomer', () => {
    it('müşteri yoksa NotFoundException fırlatır', async () => {
      prisma.customer.findUnique.mockResolvedValue(null);
      await expect(service.findAllForCustomer('missing', {})).rejects.toThrow(
        new NotFoundException('Müşteri bulunamadı'),
      );
    });

    it('customerId filtresini zorunlu uygular', async () => {
      prisma.customer.findUnique.mockResolvedValue({ id: 'cust-a' });
      await service.findAllForCustomer('cust-a', {});
      expect(prisma.emergencyCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ customerId: 'cust-a' }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('saha personeli yetkisiz dosyada ForbiddenException fırlatır', async () => {
      prisma.emergencyCase.findUnique.mockResolvedValue({
        id: 'case-1',
        assignedUserId: 'other-user',
        customerId: 'cust-a',
        assignedVendor: null,
        assignedUser: null,
        customer: null,
        costEntries: [],
        invoiceItems: [],
        resolvedAt: null,
        invoicedAt: null,
        status: 'GELEN',
      });
      prisma.claimFile.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne('case-1', { id: 'field-user', roleCode: 'field_staff' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
