/**
 * Demo Veri Seti — Production'da gerçekçi test verileri oluşturur
 * Kullanım: npx tsx prisma/seed-demo.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🎭 Demo veri seti yükleniyor...');

  // Admin kullanıcıyı al
  const admin = await prisma.user.findFirst({ where: { email: 'admin@meridyenassistance.com' } });
  if (!admin) { console.error('Admin kullanıcı bulunamadı!'); return; }

  // Aktif statüler
  const statuses = await prisma.claimStatus.findMany();
  const openStatus = statuses.find(s => s.code === 'dosya_acildi' || s.code === 'OPENED') ?? statuses[0];
  const inspectionStatus = statuses.find(s => s.code === 'ekspertiz' || s.code === 'INSPECTION') ?? statuses[1];
  const repairStatus = statuses.find(s => s.code === 'onarim' || s.code === 'REPAIR') ?? statuses[2];

  if (!openStatus) {
    console.error('Statü bulunamadı! Önce ana seed çalıştırın.');
    return;
  }

  // Sigorta şirketleri
  const companies = await prisma.insuranceCompany.findMany({ take: 5 });
  if (companies.length === 0) {
    console.error('Sigorta şirketi bulunamadı!');
    return;
  }

  // Branşlar
  const branches = await prisma.branch.findMany({ take: 3 });

  // Demo müşteriler
  const customers = [
    { firstName: 'Ayşe', lastName: 'Yılmaz', phone: '05321234567', email: 'ayse.yilmaz@example.com', city: 'İstanbul', district: 'Kadıköy' },
    { firstName: 'Mehmet', lastName: 'Demir', phone: '05339876543', email: 'mehmet.demir@example.com', city: 'Ankara', district: 'Çankaya' },
    { firstName: 'Fatma', lastName: 'Kaya', phone: '05421112233', email: 'fatma.kaya@example.com', city: 'İzmir', district: 'Konak' },
    { firstName: 'Ali', lastName: 'Çelik', phone: '05553334455', email: 'ali.celik@example.com', city: 'İstanbul', district: 'Beşiktaş' },
    { firstName: 'Zeynep', lastName: 'Arslan', phone: '05447778899', email: 'zeynep.arslan@example.com', city: 'Bursa', district: 'Osmangazi' },
  ];

  const createdCustomers = [];
  for (const c of customers) {
    const existing = await prisma.customer.findFirst({ where: { phone: c.phone } });
    if (existing) { createdCustomers.push(existing); continue; }
    const created = await prisma.customer.create({ data: { ...c, type: 'bireysel' } });
    createdCustomers.push(created);
    console.log(`  ✅ Müşteri: ${c.firstName} ${c.lastName}`);
  }

  // Demo hasar dosyaları
  const claimFiles = [
    { fileNo: 'HD-2026-001', description: 'Su Hasarı — Banyo Tesisat Patlaması', statusId: openStatus?.id, customerId: createdCustomers[0]?.id, companyId: companies[0]?.id, branchId: branches[0]?.id },
    { fileNo: 'HD-2026-002', description: 'Yangın Hasarı — Elektrik Kontağı', statusId: inspectionStatus?.id ?? openStatus?.id, customerId: createdCustomers[1]?.id, companyId: companies[1]?.id, branchId: branches[0]?.id },
    { fileNo: 'HD-2026-003', description: 'Fırtına Hasarı — Çatı Akması', statusId: repairStatus?.id ?? openStatus?.id, customerId: createdCustomers[2]?.id, companyId: companies[2]?.id ?? companies[0]?.id, branchId: branches[1]?.id ?? branches[0]?.id },
    { fileNo: 'HD-2026-004', description: 'Hırsızlık — Kapı Kilit Sistemi', statusId: openStatus?.id, customerId: createdCustomers[3]?.id, companyId: companies[0]?.id, branchId: branches[0]?.id },
    { fileNo: 'HD-2026-005', description: 'Deprem Hasarı — Duvar Çatlakları', statusId: inspectionStatus?.id ?? openStatus?.id, customerId: createdCustomers[4]?.id, companyId: companies[3]?.id ?? companies[0]?.id, branchId: branches[2]?.id ?? branches[0]?.id },
  ];

  for (const cf of claimFiles) {
    if (!cf.customerId || !cf.statusId || !cf.companyId || !cf.branchId) continue;
    const existing = await prisma.claimFile.findFirst({ where: { fileNo: cf.fileNo } });
    if (existing) { console.log(`  ⏭ Dosya mevcut: ${cf.fileNo}`); continue; }
    await prisma.claimFile.create({
      data: {
        fileNo: cf.fileNo,
        currentStatusId: cf.statusId,
        customerId: cf.customerId,
        insuranceCompanyId: cf.companyId,
        assignedBranchId: cf.branchId,
        currentResponsibleUserId: admin.id,
        policyNo: `POL-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        claimNo: `CLM-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 100)}`,
        productBranch: 'konut',
        incidentDate: new Date(Date.now() - Math.floor(Math.random() * 30) * 86400000),
        notificationDate: new Date(Date.now() - Math.floor(Math.random() * 25) * 86400000),
      },
    });
    console.log(`  ✅ Dosya: ${cf.fileNo} — ${cf.description}`);
  }

  console.log('\n🎉 Demo veri seti yüklendi!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
