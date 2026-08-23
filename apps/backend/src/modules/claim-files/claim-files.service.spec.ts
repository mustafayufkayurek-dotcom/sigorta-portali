import { NotFoundException } from '@nestjs/common';
import { ClaimFilesService } from './claim-files.service';

describe('ClaimFilesService', () => {
  let service: ClaimFilesService;
  let prisma: any;
  let cache: any;

  beforeEach(() => {
    prisma = {
      customer: {
        findUnique: jest.fn(),
      },
      claimFile: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      repairReport: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      payment: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      fileActivityLog: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      note: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      reportApprovalHistory: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    cache = {
      invalidatePattern: jest.fn().mockResolvedValue(undefined),
    };

    service = new ClaimFilesService(prisma, cache, { log: jest.fn() } as any);
  });

  describe('findAll', () => {
    it('customerId verildiğinde yalnızca o müşterinin dosyalarını sorgular', async () => {
      prisma.claimFile.findMany.mockResolvedValue([
        { id: 'file-a', customerId: 'cust-a' },
      ]);
      prisma.claimFile.count.mockResolvedValue(1);

      const result = await service.findAll({ customerId: 'cust-a' });

      expect(prisma.claimFile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ customerId: 'cust-a' }),
        }),
      );
      expect(prisma.claimFile.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ customerId: 'cust-a' }),
        }),
      );
      expect(result.data).toHaveLength(1);
      expect(result.data[0].vendorPaid).toBeNull();
      expect(result.meta.total).toBe(1);
    });

    it('customerId verilmediğinde tüm dosyalar için geniş sorgu yapar', async () => {
      await service.findAll({});

      const findManyCall = prisma.claimFile.findMany.mock.calls[0][0];
      expect(findManyCall.where.customerId).toBeUndefined();
    });

    it('liste select tedarikçi alanlarını içerir (Atanmadı regresyon kilidi)', async () => {
      await service.findAll({});
      const findManyCall = prisma.claimFile.findMany.mock.calls[0][0];
      expect(findManyCall.select.assignedSupplier).toBeDefined();
      expect(findManyCall.select.supplierAssignments).toBeDefined();
    });
  });

  describe('findAllForCustomer', () => {
    it('müşteri yoksa NotFoundException fırlatır', async () => {
      prisma.customer.findUnique.mockResolvedValue(null);

      await expect(service.findAllForCustomer('missing-customer')).rejects.toThrow(
        new NotFoundException('Müşteri bulunamadı'),
      );
      expect(prisma.claimFile.findMany).not.toHaveBeenCalled();
    });

    it('path customerId filtresini zorunlu uygular', async () => {
      prisma.customer.findUnique.mockResolvedValue({ id: 'cust-a' });
      prisma.claimFile.findMany.mockResolvedValue([
        { id: 'file-a', customerId: 'cust-a' },
      ]);
      prisma.claimFile.count.mockResolvedValue(1);

      await service.findAllForCustomer('cust-a', { page: 1, limit: 50 });

      expect(prisma.claimFile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ customerId: 'cust-a' }),
        }),
      );
    });

    it('query içinde farklı customerId geçilse bile path param geçerli olur', async () => {
      prisma.customer.findUnique.mockResolvedValue({ id: 'cust-a' });

      await service.findAllForCustomer('cust-a');

      expect(prisma.claimFile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ customerId: 'cust-a' }),
        }),
      );
    });
  });

  describe('findAll field staff scope', () => {
    it('saha personeli için assignedFieldUserId filtresi uygular', async () => {
      await service.findAll({}, { id: 'field-1', roleCode: 'field_staff' });

      expect(prisma.claimFile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            assignedFieldUserId: 'field-1',
            OR: [{ closedAt: null }, { closedAt: { gt: expect.any(Date) } }],
          }),
        }),
      );
    });

    it('statusCode=open kapalı olmayan tüm durumları getirir (tek duruma daralmaz)', async () => {
      await service.findAll(
        { statusCode: 'open' },
        { id: 'field-1', roleCode: 'field_staff' },
      );

      expect(prisma.claimFile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({
                currentStatus: { isClosedState: false },
              }),
            ]),
          }),
        }),
      );
    });

    it('office_staff için assignedOfficeUserId vekalet kapsamı uygular', async () => {
      const operationalAccessGrants = {
        isDelegationScopedRole: (roleCode: string) => roleCode === 'office_staff',
        buildClaimFileDelegationScope: jest.fn().mockResolvedValue({
          OR: [
            { assignedOfficeUserId: { in: ['office-1'] } },
            {
              assignedOfficeUserId: null,
              statusHistory: {
                some: {
                  changedByUserId: 'office-1',
                  note: 'Dosya oluşturuldu',
                },
              },
            },
          ],
        }),
      };
      service = new ClaimFilesService(
        prisma,
        cache,
        { log: jest.fn() } as any,
        undefined,
        undefined,
        undefined,
        undefined,
        operationalAccessGrants as any,
      );

      await service.findAll({}, { id: 'office-1', roleCode: 'office_staff' });

      expect(operationalAccessGrants.buildClaimFileDelegationScope).toHaveBeenCalledWith('office-1', 'office_staff');
      expect(prisma.claimFile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { assignedOfficeUserId: { in: ['office-1'] } },
            ]),
          }),
        }),
      );
    });
  });

  describe('assignSupplier (çoklu)', () => {
    const actor = { id: 'user-1', role: { code: 'office_staff' } };

    beforeEach(() => {
      prisma.claimFile.findUnique = jest.fn();
      prisma.claimFile.update = jest.fn().mockResolvedValue({});
      prisma.vendor = { findMany: jest.fn() };
      prisma.claimFileSupplier = {
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
      };
      prisma.claimStatus = { findUnique: jest.fn().mockResolvedValue(null), findFirst: jest.fn().mockResolvedValue(null) };
      prisma.claimStatusHistory = { create: jest.fn() };
      prisma.fileActivityLog = { create: jest.fn().mockResolvedValue({}) };
      prisma.note = { create: jest.fn() };
      service = new ClaimFilesService(prisma, cache, { log: jest.fn() } as any);
      (service as any).applyWorkflowStatus = jest.fn().mockResolvedValue(undefined);
      (service as any).logActivity = jest.fn().mockResolvedValue(undefined);
    });

    it('boş liste ile BadRequest fırlatır', async () => {
      await expect(service.assignSupplier('file-1', [], actor)).rejects.toThrow('En az bir tedarikçi seçiniz');
    });

    it('iki tedarikçiyi createMany ile ekler ve birincil alanı senkronlar', async () => {
      prisma.claimFile.findUnique
        .mockResolvedValueOnce({
          id: 'file-1',
          fileNo: 'F-1',
          insuredName: 'Test',
          lossType: null,
          assignedSupplier: null,
          propertyAddress: null,
          claimSubject: null,
          supplierAssignments: [],
        })
        .mockResolvedValueOnce({
          id: 'file-1',
          assignedSupplierId: 'v1',
          assignedSupplier: { id: 'v1', name: 'Mobilyacı A' },
          supplierAssignments: [
            { vendor: { id: 'v1', name: 'Mobilyacı A' } },
            { vendor: { id: 'v2', name: 'Boyacı B' } },
          ],
          currentStatus: null,
          propertyAddress: null,
        });
      prisma.vendor.findMany.mockResolvedValue([
        { id: 'v1', name: 'Mobilyacı A', phone: null, authorizedPhone: null, status: 'active' },
        { id: 'v2', name: 'Boyacı B', phone: null, authorizedPhone: null, status: 'active' },
      ]);
      prisma.claimFileSupplier.findFirst.mockResolvedValue({
        vendorId: 'v1',
        assignedAt: new Date('2026-07-13'),
      });

      const result = await service.assignSupplier('file-1', ['v1', 'v2'], actor, 'teklif');

      expect(prisma.claimFileSupplier.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ claimFileId: 'file-1', vendorId: 'v1' }),
            expect.objectContaining({ claimFileId: 'file-1', vendorId: 'v2' }),
          ]),
        }),
      );
      expect(prisma.claimFile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'file-1' },
          data: expect.objectContaining({ assignedSupplierId: 'v1' }),
        }),
      );
      expect(result.assignedSuppliers).toHaveLength(2);
      expect(result.newlyAssignedCount).toBe(2);
    });

    it('zaten atanmış tedarikçiyi tekrar eklemez', async () => {
      prisma.claimFile.findUnique
        .mockResolvedValueOnce({
          id: 'file-1',
          fileNo: 'F-1',
          insuredName: 'Test',
          lossType: null,
          assignedSupplier: { id: 'v1', name: 'Mobilyacı A' },
          propertyAddress: null,
          claimSubject: null,
          supplierAssignments: [{ vendorId: 'v1', sortOrder: 0 }],
        })
        .mockResolvedValueOnce({
          id: 'file-1',
          assignedSupplier: { id: 'v1', name: 'Mobilyacı A' },
          supplierAssignments: [{ vendor: { id: 'v1', name: 'Mobilyacı A' } }],
          currentStatus: null,
          propertyAddress: null,
        });
      prisma.vendor.findMany.mockResolvedValue([
        { id: 'v1', name: 'Mobilyacı A', phone: null, authorizedPhone: null, status: 'active' },
      ]);

      const result = await service.assignSupplier('file-1', ['v1'], actor);

      expect(prisma.claimFileSupplier.createMany).not.toHaveBeenCalled();
      expect(result.newlyAssignedCount).toBe(0);
    });

    it('zaten atanmış tedarikçide görev tanımını günceller', async () => {
      prisma.claimFile.findUnique
        .mockResolvedValueOnce({
          id: 'file-1',
          fileNo: 'F-1',
          insuredName: 'Test',
          lossType: null,
          assignedSupplier: { id: 'v1', name: 'Mobilyacı A' },
          propertyAddress: null,
          claimSubject: null,
          supplierAssignments: [{ vendorId: 'v1', sortOrder: 0 }],
        })
        .mockResolvedValueOnce({
          id: 'file-1',
          assignedSupplier: { id: 'v1', name: 'Mobilyacı A' },
          supplierAssignments: [{ vendor: { id: 'v1', name: 'Mobilyacı A' } }],
          currentStatus: null,
          propertyAddress: null,
        });
      prisma.vendor.findMany.mockResolvedValue([
        { id: 'v1', name: 'Mobilyacı A', phone: null, authorizedPhone: null, status: 'active' },
      ]);

      await service.assignSupplier('file-1', ['v1'], actor, undefined, {
        v1: 'Mutfak dolabı tamiri',
      });

      expect(prisma.claimFileSupplier.createMany).not.toHaveBeenCalled();
      expect(prisma.claimFileSupplier.updateMany).toHaveBeenCalledWith({
        where: { claimFileId: 'file-1', vendorId: 'v1' },
        data: { note: 'Mutfak dolabı tamiri' },
      });
    });
  });
});
