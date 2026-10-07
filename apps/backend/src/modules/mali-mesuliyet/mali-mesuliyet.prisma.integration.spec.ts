import { PrismaClient } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { MaliMesuliyetService } from './mali-mesuliyet.service';
import {
  assertIsolatedTestDatabase,
  prismaIntegrationRequired,
  resolvePrismaTestDatabaseUrl,
} from '@/test/safe-test-database';
import {
  cleanupFinancePrismaFixture,
  seedFinancePrismaFixture,
  type FinancePrismaFixture,
} from '@/test/finance-prisma-fixture';

const url = resolvePrismaTestDatabaseUrl();
let skipReason = '';
if (!url) {
  skipReason = 'DATABASE_URL_TEST yok';
} else {
  try {
    assertIsolatedTestDatabase(url);
  } catch (err) {
    skipReason = err instanceof Error ? err.message : 'adres reddedildi';
  }
}

if (skipReason && prismaIntegrationRequired()) {
  throw new Error(`Prisma entegrasyon testi zorunlu: ${skipReason}`);
}

const describeIf = skipReason ? describe.skip : describe;

describeIf('Mali mesuliyet Prisma entegrasyon', () => {
  let prisma: PrismaClient;
  let service: MaliMesuliyetService;
  let fx: FinancePrismaFixture;

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: url! } } });
    await prisma.$connect();
    fx = await seedFinancePrismaFixture(prisma);
    service = new MaliMesuliyetService(prisma as unknown as PrismaService, {
      get: () => undefined,
    } as any);
  });

  afterAll(async () => {
    if (fx) await cleanupFinancePrismaFixture(prisma, fx);
    await prisma.$disconnect();
  });

  it('yan ve alt kat kalemleri kendi alanında toplanır, genel toplama eklenir', async () => {
    const yan = await service.createTespit(fx.claimFileId, {
      lokasyon: 'yan_daire',
      daireNo: '5',
    });
    const alt = await service.createTespit(fx.claimFileId, {
      lokasyon: 'alt_kat',
      daireNo: 12,
    });
    await service.addKalem(yan.id, {
      jobDescription: 'duvar işleri',
      quantity: 2,
      salesUnitPrice: 1000,
      supplierUnitPrice: 400,
    });
    await service.addKalem(alt.id, {
      jobDescription: 'sıva',
      quantity: 1,
      salesUnitPrice: 500,
      supplierUnitPrice: 200,
    });

    const listed = await service.listForClaim(fx.claimFileId);
    const yanRow = listed.tespipler.find((row) => row.lokasyon === 'yan_daire');
    const altRow = listed.tespipler.find((row) => row.lokasyon === 'alt_kat');
    expect(yanRow?.alanSatis).toBe(2000);
    expect(altRow?.alanSatis).toBe(500);
    expect(listed.genelToplam.neighborSales).toBe(2500);
    expect(listed.genelToplam.genelToplam).toBe(2500);
    expect(listed.genelToplam.genelMaliyet).toBe(1000);
  });

  it('onay kaydı muvafakat verildi yazar; ikinci erişim kapanır', async () => {
    const issued = await service.issuePublicLink(fx.claimFileId);
    expect(issued.publicToken).toBeTruthy();
    const saved = await service.approveByToken(issued.publicToken!, 'Ayşe Yılmaz');
    expect(saved.status).toBe('muvafakat_verildi');
    await expect(service.findByToken(issued.publicToken!)).rejects.toThrow(
      'Bu belge zaten işleme alınmıştır ve erişime kapatılmıştır',
    );
  });
});
