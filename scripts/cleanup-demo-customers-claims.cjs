#!/usr/bin/env node
/**
 * Tek seferlik: demo müşteri + test hasar dosyası temizliği.
 * Kullanım (container içinde):
 *   node cleanup-demo-customers-claims.mjs --dry-run
 *   node cleanup-demo-customers-claims.mjs --execute
 *
 * Beyaz liste dışı hiçbir kayıt silinmez.
 */
const { PrismaClient } = require('@prisma/client');

const DEMO_CUSTOMER_EMAILS = new Set([
  'sevgi.turan@example.com',
  'orhan.kilic@example.com',
  'gizem.arslan@example.com',
  'mustafa.erdem@example.com',
  'elif.cetin@example.com',
  'ayse.yilmaz@example.com',
  'mehmet.demir@example.com',
  'fatma.kaya@example.com',
  'ali.celik@example.com',
  'zeynep.arslan@example.com',
]);

const DEMO_INSURANCE_CODES = [
  'ALLIANZ_DEMO',
  'ANADOLU_SIGORTA_DEMO',
  'AKSIGORTA_DEMO',
];

const execute = process.argv.includes('--execute');
const dryRun = !execute;

const prisma = new PrismaClient();

function isDemoFileNo(fileNo) {
  if (!fileNo) return false;
  return /^(PLT-2026-|HD-2026-)/i.test(fileNo);
}

function isDemoLocalEmail(email) {
  if (!email) return false;
  const e = email.trim().toLowerCase();
  if (DEMO_CUSTOMER_EMAILS.has(e)) return true;
  return e.endsWith('@demo.local');
}

async function main() {
  console.log(dryRun ? '=== DRY-RUN (silme yok) ===' : '=== EXECUTE (kalıcı silme) ===');

  const demoCompanies = await prisma.insuranceCompany.findMany({
    where: { code: { in: DEMO_INSURANCE_CODES } },
    select: { id: true, code: true, name: true },
  });
  const demoCompanyIds = demoCompanies.map((c) => c.id);
  console.log(
    'Demo sigorta şirketleri (silinmez, yalnız dosya filtresi):',
    demoCompanies.map((c) => c.code).join(', ') || '(yok)',
  );

  const claimsByCompany =
    demoCompanyIds.length === 0
      ? []
      : await prisma.claimFile.findMany({
          where: { insuranceCompanyId: { in: demoCompanyIds } },
          select: {
            id: true,
            fileNo: true,
            customerId: true,
            insuranceCompany: { select: { code: true } },
          },
        });

  const claimsByFileNo = await prisma.claimFile.findMany({
    where: {
      OR: [{ fileNo: { startsWith: 'PLT-2026-' } }, { fileNo: { startsWith: 'HD-2026-' } }],
    },
    select: {
      id: true,
      fileNo: true,
      customerId: true,
      insuranceCompany: { select: { code: true } },
    },
  });

  const demoReportClaims = await prisma.repairReport.findMany({
    where: { reportNo: { startsWith: 'DEMO-RR-' } },
    select: { claimFileId: true, reportNo: true },
  });
  const demoInvoiceClaims = await prisma.invoice.findMany({
    where: {
      OR: [{ invoiceNo: { startsWith: 'DEMO-FTR-' } }, { notes: 'Lokal demo fatura' }],
    },
    select: { claimFileId: true, invoiceNo: true },
  });

  const claimIdSet = new Map();
  for (const c of [...claimsByCompany, ...claimsByFileNo]) {
    claimIdSet.set(c.id, {
      id: c.id,
      fileNo: c.fileNo,
      customerId: c.customerId,
      companyCode: c.insuranceCompany?.code ?? null,
      reason: isDemoFileNo(c.fileNo)
        ? 'fileNo'
        : `company:${c.insuranceCompany?.code ?? '?'}`,
    });
  }
  for (const r of demoReportClaims) {
    if (!r.claimFileId) continue;
    if (!claimIdSet.has(r.claimFileId)) {
      const cf = await prisma.claimFile.findUnique({
        where: { id: r.claimFileId },
        select: {
          id: true,
          fileNo: true,
          customerId: true,
          insuranceCompany: { select: { code: true } },
        },
      });
      if (cf) {
        claimIdSet.set(cf.id, {
          id: cf.id,
          fileNo: cf.fileNo,
          customerId: cf.customerId,
          companyCode: cf.insuranceCompany?.code ?? null,
          reason: `report:${r.reportNo}`,
        });
      }
    }
  }
  for (const inv of demoInvoiceClaims) {
    if (!inv.claimFileId) continue;
    if (!claimIdSet.has(inv.claimFileId)) {
      const cf = await prisma.claimFile.findUnique({
        where: { id: inv.claimFileId },
        select: {
          id: true,
          fileNo: true,
          customerId: true,
          insuranceCompany: { select: { code: true } },
        },
      });
      if (cf) {
        claimIdSet.set(cf.id, {
          id: cf.id,
          fileNo: cf.fileNo,
          customerId: cf.customerId,
          companyCode: cf.insuranceCompany?.code ?? null,
          reason: `invoice:${inv.invoiceNo}`,
        });
      }
    }
  }

  const claimsToDelete = [...claimIdSet.values()];
  console.log(`\nSilinecek hasar dosyası adayı: ${claimsToDelete.length}`);
  for (const c of claimsToDelete) {
    console.log(`  - ${c.fileNo} | ${c.companyCode ?? '-'} | ${c.reason}`);
  }

  const demoCustomers = await prisma.customer.findMany({
    where: {
      OR: [
        { email: { in: [...DEMO_CUSTOMER_EMAILS] } },
        { email: { endsWith: '@demo.local' } },
      ],
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      firstName: true,
      lastName: true,
      updatedByUserId: true,
      claimFiles: { select: { id: true, fileNo: true } },
    },
  });

  const demoClaimIds = new Set(claimsToDelete.map((c) => c.id));
  const customersToDelete = [];
  const customersSkipped = [];

  for (const cust of demoCustomers) {
    const email = (cust.email ?? '').toLowerCase();
    if (!isDemoLocalEmail(email)) {
      customersSkipped.push({ ...cust, skip: 'email-not-whitelist' });
      continue;
    }
    if (cust.updatedByUserId) {
      customersSkipped.push({ ...cust, skip: 'updatedByUserId-set' });
      continue;
    }
    const nonDemoClaims = cust.claimFiles.filter((cf) => !demoClaimIds.has(cf.id));
    if (nonDemoClaims.length > 0) {
      customersSkipped.push({
        ...cust,
        skip: `has-non-demo-claims:${nonDemoClaims.map((c) => c.fileNo).join(',')}`,
      });
      continue;
    }
    customersToDelete.push(cust);
  }

  console.log(`\nSilinecek müşteri adayı: ${customersToDelete.length}`);
  for (const c of customersToDelete) {
    console.log(
      `  - ${c.email} | ${c.fullName || `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim()} | claims=${c.claimFiles.length}`,
    );
  }
  if (customersSkipped.length) {
    console.log(`\nAtlanan müşteri (koruma): ${customersSkipped.length}`);
    for (const c of customersSkipped) {
      console.log(`  - ${c.email} | skip=${c.skip}`);
    }
  }

  if (dryRun) {
    console.log('\nDRY-RUN bitti. Silmek için --execute kullanın.');
    return;
  }

  // Önce dosyalar — ilişkili kayıtlar ClaimFile Cascade ile düşer; rapor/onay ayrıca temizlenir
  let deletedClaims = 0;
  for (const claim of claimsToDelete) {
    await prisma.$transaction(async (tx) => {
      const reports = await tx.repairReport.findMany({
        where: { claimFileId: claim.id },
        select: { id: true },
      });
      const reportIds = reports.map((r) => r.id);
      if (reportIds.length) {
        await tx.externalApproval.deleteMany({ where: { reportId: { in: reportIds } } });
        await tx.repairReportItem.deleteMany({ where: { reportId: { in: reportIds } } });
        await tx.repairReport.deleteMany({ where: { id: { in: reportIds } } });
      }
      await tx.invoice.deleteMany({ where: { claimFileId: claim.id } });
      await tx.claimFile.delete({ where: { id: claim.id } });
    });
    deletedClaims += 1;
    console.log(`Silindi dosya: ${claim.fileNo}`);
  }

  let deletedCustomers = 0;
  for (const cust of customersToDelete) {
    // Yeniden doğrula: non-demo claim kalmasın
    const leftover = await prisma.claimFile.count({
      where: { customerId: cust.id },
    });
    if (leftover > 0) {
      console.log(`Atlandı müşteri (hâlâ dosya var): ${cust.email}`);
      continue;
    }
    await prisma.customer.delete({ where: { id: cust.id } });
    deletedCustomers += 1;
    console.log(`Silindi müşteri: ${cust.email}`);
  }

  console.log(`\nTamam: ${deletedClaims} dosya, ${deletedCustomers} müşteri silindi.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
