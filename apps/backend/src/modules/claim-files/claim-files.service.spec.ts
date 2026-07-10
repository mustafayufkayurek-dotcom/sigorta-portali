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
      expect(result.meta.total).toBe(1);
    });

    it('customerId verilmediğinde tüm dosyalar için geniş sorgu yapar', async () => {
      await service.findAll({});

      const findManyCall = prisma.claimFile.findMany.mock.calls[0][0];
      expect(findManyCall.where.customerId).toBeUndefined();
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
});
