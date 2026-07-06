import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { KVKK_DEFAULT_CONTENT, GIZLILIK_DEFAULT_CONTENT } from '@sigorta/shared';
import { PROVINCES } from './data/turkey-locations';
import { seedPilotOperationData } from './seed-pilot-operation-data';

// Production ortamında seed çalışmasını engelle (--force flag ile override edilebilir)
if (process.env.NODE_ENV === 'production' && !process.argv.includes('--force')) {
  console.error('⛔ Seed production ortamında çalıştırılamaz. Override için: npx tsx prisma/seed.ts --force');
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // NOTE: deleteMany() calls removed to prevent data loss on re-seed.
  // All inserts below use upsert() so this script is safe to run multiple times.

  // Create permissions (upsert by code)
  const permissions = [
    // User management
    { code: 'user.view', name: 'Kullanıcıları Görüntüle', module: 'user', action: 'view' },
    { code: 'user.create', name: 'Kullanıcı Oluştur', module: 'user', action: 'create' },
    { code: 'user.update', name: 'Kullanıcı Güncelle', module: 'user', action: 'update' },
    { code: 'user.delete', name: 'Kullanıcı Sil', module: 'user', action: 'delete' },

    // Role management
    { code: 'role.view', name: 'Rolleri Görüntüle', module: 'role', action: 'view' },
    { code: 'role.create', name: 'Rol Oluştur', module: 'role', action: 'create' },
    { code: 'role.update', name: 'Rol Güncelle', module: 'role', action: 'update' },
    { code: 'role.delete', name: 'Rol Sil', module: 'role', action: 'delete' },

    // Insurance company
    { code: 'insurance_company.view', name: 'Sigorta Şirketlerini Görüntüle', module: 'insurance_company', action: 'view' },
    { code: 'insurance_company.create', name: 'Sigorta Şirketi Oluştur', module: 'insurance_company', action: 'create' },
    { code: 'insurance_company.update', name: 'Sigorta Şirketi Güncelle', module: 'insurance_company', action: 'update' },
    { code: 'insurance_company.delete', name: 'Sigorta Şirketi Sil', module: 'insurance_company', action: 'delete' },

    // Claim file
    { code: 'claim_file.view', name: 'Hasar Dosyalarını Görüntüle', module: 'claim_file', action: 'view' },
    { code: 'claim_file.create', name: 'Hasar Dosyası Oluştur', module: 'claim_file', action: 'create' },
    { code: 'claim_file.update', name: 'Hasar Dosyası Güncelle', module: 'claim_file', action: 'update' },
    { code: 'claim_file.delete', name: 'Hasar Dosyası Sil', module: 'claim_file', action: 'delete' },
    { code: 'claim_file.assign', name: 'Hasar Dosyası Ata', module: 'claim_file', action: 'assign' },
    { code: 'claim_file.status_change', name: 'Hasar Durumu Değiştir', module: 'claim_file', action: 'status_change' },

    // Customer
    { code: 'customer.view', name: 'Müşterileri Görüntüle', module: 'customer', action: 'view' },
    { code: 'customer.create', name: 'Müşteri Oluştur', module: 'customer', action: 'create' },
    { code: 'customer.update', name: 'Müşteri Güncelle', module: 'customer', action: 'update' },
    { code: 'customer.delete', name: 'Müşteri Sil', module: 'customer', action: 'delete' },

    // Task
    { code: 'task.view', name: 'Görevleri Görüntüle', module: 'task', action: 'view' },
    { code: 'task.create', name: 'Görev Oluştur', module: 'task', action: 'create' },
    { code: 'task.update', name: 'Görev Güncelle', module: 'task', action: 'update' },
    { code: 'task.delete', name: 'Görev Sil', module: 'task', action: 'delete' },
    { code: 'task.complete', name: 'Görevi Tamamla', module: 'task', action: 'complete' },

    // Document
    { code: 'document.view', name: 'Dokümanları Görüntüle', module: 'document', action: 'view' },
    { code: 'document.upload', name: 'Doküman Yükle', module: 'document', action: 'upload' },
    { code: 'document.delete', name: 'Doküman Sil', module: 'document', action: 'delete' },

    // Note
    { code: 'note.view', name: 'Notları Görüntüle', module: 'note', action: 'view' },
    { code: 'note.create', name: 'Not Oluştur', module: 'note', action: 'create' },
    { code: 'note.update', name: 'Not Güncelle', module: 'note', action: 'update' },
    { code: 'note.delete', name: 'Not Sil', module: 'note', action: 'delete' },

    // Dashboard
    { code: 'dashboard.view', name: 'Dashboard Görüntüle', module: 'dashboard', action: 'view' },

    // Invoice
    { code: 'invoice.view', name: 'Faturaları Görüntüle', module: 'invoice', action: 'view' },
    { code: 'invoice.create', name: 'Fatura Oluştur', module: 'invoice', action: 'create' },
    { code: 'invoice.update', name: 'Fatura Güncelle', module: 'invoice', action: 'update' },
    { code: 'invoice.delete', name: 'Fatura Sil', module: 'invoice', action: 'delete' },

    // Payment
    { code: 'payment.view', name: 'Ödemeleri Görüntüle', module: 'payment', action: 'view' },
    { code: 'payment.create', name: 'Ödeme Kaydet', module: 'payment', action: 'create' },
    { code: 'payment.update', name: 'Ödeme Güncelle', module: 'payment', action: 'update' },

    // Bank Account
    { code: 'bank_account.view', name: 'Banka Hesaplarını Görüntüle', module: 'bank_account', action: 'view' },
    { code: 'bank_account.create', name: 'Banka Hesabı Oluştur', module: 'bank_account', action: 'create' },
    { code: 'bank_account.update', name: 'Banka Hesabı Güncelle', module: 'bank_account', action: 'update' },
    { code: 'bank_account.delete', name: 'Banka Hesabı Sil', module: 'bank_account', action: 'delete' },

    // Report
    { code: 'report.view', name: 'Raporları Görüntüle', module: 'report', action: 'view' },

    // Location tracking
    { code: 'location.view', name: 'Konum Takibini Görüntüle', module: 'location', action: 'view' },

    // Operasyon Gelen Kutusu (Microsoft 365)
    { code: 'operation_inbox.view', name: 'Gelen Kutusunu Görüntüle', module: 'operation_inbox', action: 'view' },
    { code: 'operation_inbox.manage', name: 'Gelen Kutusunu Yönet', module: 'operation_inbox', action: 'manage' },
    { code: 'operation_inbox.settings', name: 'Gelen Kutusu Ayarları', module: 'operation_inbox', action: 'settings' },

    // Personel Özlük (HR)
    { code: 'hr.view', name: 'Personel Özlük Görüntüle', module: 'hr', action: 'view' },
    { code: 'hr.leave.request', name: 'İzin Talebi Oluştur', module: 'hr', action: 'leave_request' },
    { code: 'hr.leave.approve', name: 'İzin Onayla', module: 'hr', action: 'leave_approve' },
    { code: 'hr.attendance.manage', name: 'Puantaj Düzenle', module: 'hr', action: 'attendance_manage' },
  ];

  const createdPermissions = await Promise.all(
    permissions.map((p) =>
      prisma.permission.upsert({
        where: { code: p.code },
        update: { name: p.name, module: p.module, action: p.action },
        create: p,
      })
    )
  );
  console.log(`✅ Created/updated ${createdPermissions.length} permissions`);

  // Create roles (upsert by code)
  const adminRole = await prisma.role.upsert({
    where: { code: 'admin' },
    update: { name: 'Yönetici', description: 'Tam yetkili sistem yöneticisi' },
    create: { code: 'admin', name: 'Yönetici', description: 'Tam yetkili sistem yöneticisi' },
  });

  const managerRole = await prisma.role.upsert({
    where: { code: 'manager' },
    update: { name: 'Müdür', description: 'Şube müdürü' },
    create: { code: 'manager', name: 'Müdür', description: 'Şube müdürü' },
  });

  const officeStaffRole = await prisma.role.upsert({
    where: { code: 'office_staff' },
    update: { name: 'Ofis Personeli', description: 'Ofis operasyon personeli' },
    create: { code: 'office_staff', name: 'Ofis Personeli', description: 'Ofis operasyon personeli' },
  });

  const fieldStaffRole = await prisma.role.upsert({
    where: { code: 'field_staff' },
    update: { name: 'Saha Personeli', description: 'Saha operasyon personeli' },
    create: { code: 'field_staff', name: 'Saha Personeli', description: 'Saha operasyon personeli' },
  });

  const adjusterRole = await prisma.role.upsert({
    where: { code: 'adjuster' },
    update: { name: 'Eksper (İç)', description: 'Bağımsız eksper (iç kullanım)' },
    create: { code: 'adjuster', name: 'Eksper (İç)', description: 'Bağımsız eksper (iç kullanım)' },
  });

  const financeRole = await prisma.role.upsert({
    where: { code: 'finance' },
    update: { name: 'Finans', description: 'Finans personeli' },
    create: { code: 'finance', name: 'Finans', description: 'Finans personeli' },
  });

  const expertRole = await prisma.role.upsert({
    where: { code: 'expert' },
    update: { name: 'Eksper Portalı', description: 'Harici eksper portal kullanıcısı' },
    create: { code: 'expert', name: 'Eksper Portalı', description: 'Harici eksper portal kullanıcısı' },
  });

  const insuranceCompanyUserRole = await prisma.role.upsert({
    where: { code: 'insurance_company_user' },
    update: { name: 'Sigorta Şirketi', description: 'Sigorta şirketi portal kullanıcısı' },
    create: { code: 'insurance_company_user', name: 'Sigorta Şirketi', description: 'Sigorta şirketi portal kullanıcısı' },
  });

  const brokerUserRole = await prisma.role.upsert({
    where: { code: 'broker_user' },
    update: { name: 'Broker', description: 'Broker portal kullanıcısı' },
    create: { code: 'broker_user', name: 'Broker', description: 'Broker portal kullanıcısı' },
  });

  console.log('✅ Created 9 roles');

  // Assign all permissions to admin
  await Promise.all(
    createdPermissions.map((p) =>
      prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: adminRole.id, permissionId: p.id } },
        update: {},
        create: { roleId: adminRole.id, permissionId: p.id },
      })
    )
  );

  // Manager permissions
  const managerPermCodes = [
    'user.view', 'user.create', 'user.update',
    'insurance_company.view',
    'claim_file.view', 'claim_file.create', 'claim_file.update', 'claim_file.assign', 'claim_file.status_change',
    'customer.view', 'customer.create', 'customer.update',
    'task.view', 'task.create', 'task.update', 'task.complete',
    'document.view', 'document.upload',
    'note.view', 'note.create', 'note.update',
    'dashboard.view',
    'invoice.view', 'invoice.create', 'invoice.update', 'invoice.delete',
    'payment.view', 'payment.create', 'payment.update',
    'bank_account.view', 'bank_account.create', 'bank_account.update', 'bank_account.delete',
    'report.view',
    'location.view',
    'hr.view', 'hr.leave.approve', 'hr.attendance.manage',
    'operation_inbox.view', 'operation_inbox.manage',
  ];
  await assignPermissions(managerRole.id, managerPermCodes, createdPermissions);

  // Office staff permissions
  const officePermCodes = [
    'claim_file.view', 'claim_file.create', 'claim_file.update', 'claim_file.assign', 'claim_file.status_change',
    'customer.view', 'customer.create', 'customer.update',
    'vendor.view', 'vendor.create', 'vendor.update',
    'task.view', 'task.create', 'task.update', 'task.complete',
    'document.view', 'document.upload',
    'note.view', 'note.create', 'note.update',
    'invoice.view', 'invoice.create',
    'payment.view', 'payment.create',
    'bank_account.view',
    'dashboard.view',
    'location.view',
    'hr.view', 'hr.leave.request',
    'report.view', 'report.create',
    'operation_inbox.view', 'operation_inbox.manage',
  ];
  await assignPermissions(officeStaffRole.id, officePermCodes, createdPermissions);

  // Field staff permissions
  const fieldPermCodes = [
    'claim_file.view', 'claim_file.update',
    'task.view', 'task.update', 'task.complete',
    'document.view', 'document.upload',
    'note.view', 'note.create',
  ];
  await assignPermissions(fieldStaffRole.id, fieldPermCodes, createdPermissions);

  // Adjuster permissions
  const adjusterPermCodes = [
    'claim_file.view', 'claim_file.update', 'claim_file.status_change',
    'task.view', 'task.complete',
    'document.view', 'document.upload',
    'note.view', 'note.create',
  ];
  await assignPermissions(adjusterRole.id, adjusterPermCodes, createdPermissions);

  // Finance permissions
  const financePermCodes = [
    'claim_file.view', 'claim_file.update',
    'document.view', 'document.upload',
    'note.view', 'note.create', 'note.update',
    'dashboard.view',
    'invoice.view', 'invoice.create', 'invoice.update', 'invoice.delete',
    'payment.view', 'payment.create', 'payment.update',
    'bank_account.view', 'bank_account.create', 'bank_account.update', 'bank_account.delete',
    'report.view',
  ];
  await assignPermissions(financeRole.id, financePermCodes, createdPermissions);

  // Expert permissions (harici eksper portal)
  const expertPermCodes = [
    'claim_file.view', 'claim_file.create', 'claim_file.update',
    'document.view', 'document.upload',
    'note.view', 'note.create',
    'report.view',
  ];
  await assignPermissions(expertRole.id, expertPermCodes, createdPermissions);

  // Insurance company user permissions
  const insuranceCompanyUserPermCodes = [
    'claim_file.view', 'claim_file.create', 'claim_file.update',
    'document.view', 'document.upload',
    'invoice.view',
    'report.view',
  ];
  await assignPermissions(insuranceCompanyUserRole.id, insuranceCompanyUserPermCodes, createdPermissions);

  console.log('✅ Assigned role permissions');

  // Create claim statuses
  const statuses = [
    { code: 'new', name: 'Yeni', sequenceNo: 1, color: '#3B82F6', isClosedState: false },
    { code: 'pre_review', name: 'Ön İnceleme', sequenceNo: 2, color: '#8B5CF6', isClosedState: false },
    { code: 'adjuster_assigned', name: 'Eksper Atandı', sequenceNo: 3, color: '#EC4899', isClosedState: false },
    { code: 'site_visit_planned', name: 'Saha Ziyareti Planlandı', sequenceNo: 4, color: '#F59E0B', isClosedState: false },
    { code: 'site_visit_done', name: 'Saha Ziyareti Tamamlandı', sequenceNo: 5, color: '#10B981', isClosedState: false },
    { code: 'budget_preparing', name: 'Bütçe Hazırlanıyor', sequenceNo: 6, color: '#6366F1', isClosedState: false },
    { code: 'budget_submitted', name: 'Bütçe Sunuldu', sequenceNo: 7, color: '#8B5CF6', isClosedState: false },
    { code: 'budget_revision_requested', name: 'Bütçe Revize Talep Edildi', sequenceNo: 8, color: '#EF4444', isClosedState: false },
    { code: 'budget_approved', name: 'Bütçe Onaylandı', sequenceNo: 9, color: '#10B981', isClosedState: false },
    { code: 'repair_planning', name: 'Onarım Planlanıyor', sequenceNo: 10, color: '#F59E0B', isClosedState: false },
    { code: 'repair_in_progress', name: 'Onarım Devam Ediyor', sequenceNo: 11, color: '#3B82F6', isClosedState: false },
    { code: 'repair_completed', name: 'Onarım Tamamlandı', sequenceNo: 12, color: '#10B981', isClosedState: false },
    { code: 'invoice_pending', name: 'Fatura Bekleniyor', sequenceNo: 13, color: '#F59E0B', isClosedState: false },
    { code: 'invoice_submitted', name: 'Fatura Sunuldu', sequenceNo: 14, color: '#8B5CF6', isClosedState: false },
    { code: 'payment_pending', name: 'Ödeme Bekleniyor', sequenceNo: 15, color: '#F59E0B', isClosedState: false },
    { code: 'partially_collected', name: 'Kısmi Tahsilat', sequenceNo: 16, color: '#FBBF24', isClosedState: false },
    { code: 'closed', name: 'Kapatıldı', sequenceNo: 17, color: '#059669', isClosedState: true },
    { code: 'cancelled', name: 'İptal Edildi', sequenceNo: 18, color: '#6B7280', isClosedState: true },
  ];

  await Promise.all(
    statuses.map((s) =>
      prisma.claimStatus.upsert({
        where: { code: s.code },
        update: { name: s.name, sequenceNo: s.sequenceNo, color: s.color, isClosedState: s.isClosedState },
        create: s,
      })
    )
  );
  console.log('✅ Created/updated 18 claim statuses');

  await Promise.all(
    [
      { code: 'new', maxDurationHours: 24 },
      { code: 'pre_review', maxDurationHours: 24 },
      { code: 'adjuster_assigned', maxDurationHours: 18 },
      { code: 'site_visit_planned', maxDurationHours: 48 },
      { code: 'site_visit_done', maxDurationHours: 24 },
      { code: 'budget_preparing', maxDurationHours: 36 },
      { code: 'budget_submitted', maxDurationHours: 24 },
      { code: 'budget_revision_requested', maxDurationHours: 24 },
      { code: 'budget_approved', maxDurationHours: 24 },
      { code: 'repair_planning', maxDurationHours: 48 },
      { code: 'repair_in_progress', maxDurationHours: 120 },
      { code: 'repair_completed', maxDurationHours: 24 },
      { code: 'invoice_pending', maxDurationHours: 36 },
      { code: 'invoice_submitted', maxDurationHours: 36 },
      { code: 'payment_pending', maxDurationHours: 72 },
      { code: 'partially_collected', maxDurationHours: 72 },
    ].map((status) =>
      prisma.claimStatus.update({
        where: { code: status.code },
        data: { maxDurationHours: status.maxDurationHours },
      }),
    ),
  );
  console.log('✅ Updated claim status SLA durations');

  // Create admin user (upsert by email)
  const hashedPassword = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@meridyenassistance.com' },
    update: { roleId: adminRole.id, status: 'active' },
    create: {
      firstName: 'Sistem',
      lastName: 'Yöneticisi',
      email: 'admin@meridyenassistance.com',
      passwordHash: hashedPassword,
      roleId: adminRole.id,
      employeeCode: 'MRD001',
      status: 'active',
      isWebUser: true,
      isMobileUser: false,
    },
  });
  console.log('✅ Created/updated admin user (admin@meridyenassistance.com / admin123)');

  // Demo: Expert portal kullanıcısı
  const expertUser = await prisma.user.upsert({
    where: { email: 'eksper@example.com' },
    update: { roleId: expertRole.id, status: 'active' },
    create: {
      firstName: 'Ahmet',
      lastName: 'Eksper',
      email: 'eksper@example.com',
      passwordHash: hashedPassword,
      roleId: expertRole.id,
      employeeCode: 'EXP001',
      status: 'active',
      isWebUser: true,
      isMobileUser: false,
    },
  });
  console.log('✅ Created/updated expert user (eksper@example.com / admin123)');

  // Demo: Sigorta şirketi portal kullanıcısı
  await prisma.user.upsert({
    where: { email: 'sigorta@example.com' },
    update: { roleId: insuranceCompanyUserRole.id, status: 'active' },
    create: {
      firstName: 'Mehmet',
      lastName: 'Sigorta',
      email: 'sigorta@example.com',
      passwordHash: hashedPassword,
      roleId: insuranceCompanyUserRole.id,
      employeeCode: 'INS001',
      status: 'active',
      isWebUser: true,
      isMobileUser: false,
    },
  });
  console.log('✅ Created/updated insurance company user (sigorta@example.com / admin123)');

  await seedPilotOperationData(prisma);

  // Demo sigorta portal kullanıcısına pilot şirket kapsamı (ALLIANZ_DEMO dosyaları)
  const sigortaPortalUser = await prisma.user.findUnique({ where: { email: 'sigorta@example.com' } });
  const demoInsuranceCompany = await prisma.insuranceCompany.findFirst({ where: { code: 'ALLIANZ_DEMO' } });
  if (sigortaPortalUser && demoInsuranceCompany) {
    await prisma.userInsuranceCompanyScope.upsert({
      where: {
        userId_insuranceCompanyId: {
          userId: sigortaPortalUser.id,
          insuranceCompanyId: demoInsuranceCompany.id,
        },
      },
      update: {},
      create: {
        userId: sigortaPortalUser.id,
        insuranceCompanyId: demoInsuranceCompany.id,
      },
    });
    console.log('✅ Sigorta portal demo kullanıcısına ALLIANZ_DEMO kapsamı atandı');
  }

  // Demo: Adjuster kaydı oluştur ve expert kullanıcıya bağla
  const demoAdjuster = await prisma.adjuster.upsert({
    where: { licenseNo: 'DEMO-EXPERT-001' },
    update: { name: 'Ahmet Eksper', phone: '5551234567', city: 'İstanbul', status: 'active' },
    create: {
      name: 'Ahmet Eksper',
      email: 'eksper@example.com',
      licenseNo: 'DEMO-EXPERT-001',
      phone: '5551234567',
      city: 'İstanbul',
      status: 'active',
    },
  });
  await prisma.user.update({
    where: { id: expertUser.id },
    data: { adjusterId: demoAdjuster.id },
  });
  console.log('✅ Linked expert user to adjuster record');

  // ── Work Groups (İş Grupları) ──────────────────────────────────────────────
  const workGroups = [
    { code: 'duvar_isleri', name: 'Duvar İşleri', sortOrder: 1 },
    { code: 'izolasyon_yalitim', name: 'İzolasyon-Yalıtım', sortOrder: 2 },
    { code: 'siva_isleri', name: 'Sıva İşleri', sortOrder: 3 },
    { code: 'kartonpiyer', name: 'Kartonpiyer', sortOrder: 4 },
    { code: 'alcipan', name: 'Alçıpan', sortOrder: 5 },
    { code: 'asma_tavan', name: 'Asma Tavan', sortOrder: 6 },
    { code: 'pvc_dograma', name: 'PVC Doğrama', sortOrder: 7 },
    { code: 'demir_dograma', name: 'Demir Doğrama', sortOrder: 8 },
    { code: 'aluminyum_dograma', name: 'Alüminyum Doğrama', sortOrder: 9 },
    { code: 'dis_cephe_kaplama', name: 'Dış Cephe Kaplama', sortOrder: 10 },
    { code: 'cam_isleri', name: 'Cam İşleri', sortOrder: 11 },
    { code: 'boya_isleri', name: 'Boya İşleri', sortOrder: 12 },
    { code: 'duvar_kagidi', name: 'Duvar Kağıdı', sortOrder: 13 },
    { code: 'mobilya', name: 'Mobilya', sortOrder: 14 },
    { code: 'dogal_tas', name: 'Doğaltaş', sortOrder: 15 },
    { code: 'seramik', name: 'Seramik', sortOrder: 16 },
    { code: 'parke', name: 'Parke', sortOrder: 17 },
    { code: 'sihhi_tesisat', name: 'Sıhhi Tesisat', sortOrder: 18 },
    { code: 'dusakabin', name: 'Duşakabin', sortOrder: 19 },
    { code: 'elektrik', name: 'Elektrik', sortOrder: 20 },
    { code: 'mekanik', name: 'Mekanik', sortOrder: 21 },
    { code: 'otomatik_kapi', name: 'Otomatik Kapı', sortOrder: 22 },
    { code: 'cati', name: 'Çatı', sortOrder: 23 },
    { code: 'esya', name: 'Eşya', sortOrder: 24 },
    { code: 'temizlik', name: 'Temizlik', sortOrder: 25 },
    { code: 'teknik_temizlik', name: 'Teknik Temizlik', sortOrder: 26 },
    { code: 'diger', name: 'Diğer', sortOrder: 27 },
  ];

  for (const wg of workGroups) {
    await prisma.workGroup.upsert({
      where: { code: wg.code },
      update: { name: wg.name, sortOrder: wg.sortOrder },
      create: { code: wg.code, name: wg.name, sortOrder: wg.sortOrder, isSystem: true },
    });
  }
  console.log(`✅ Created/updated ${workGroups.length} work groups`);

  // ── Work Sub Groups (İş Alt Grupları / İş Tanımları) ──────────────────────
  const workSubGroupsData: {
    groupCode: string;
    items: { code: string; name: string; unitType: string; unitPrice?: number; sortOrder: number }[];
  }[] = [
    {
      groupCode: 'boya_isleri',
      items: [
        { code: 'boya_ic_cephe', name: 'İç Cephe Boya', unitType: 'm²', unitPrice: 45, sortOrder: 1 },
        { code: 'boya_dis_cephe', name: 'Dış Cephe Boya', unitType: 'm²', unitPrice: 85, sortOrder: 2 },
        { code: 'boya_tavan', name: 'Tavan Boya', unitType: 'm²', unitPrice: 55, sortOrder: 3 },
        { code: 'boya_yenileme', name: 'Boya Yenileme (Tek Kat)', unitType: 'm²', unitPrice: 30, sortOrder: 4 },
        { code: 'boya_antipas', name: 'Antipas Boya', unitType: 'm²', unitPrice: 60, sortOrder: 5 },
        { code: 'boya_ahsap', name: 'Ahşap Yüzey Boya', unitType: 'm²', unitPrice: 70, sortOrder: 6 },
      ],
    },
    {
      groupCode: 'seramik',
      items: [
        { code: 'seramik_yer', name: 'Yer Seramiği Döşeme', unitType: 'm²', unitPrice: 120, sortOrder: 1 },
        { code: 'seramik_duvar', name: 'Duvar Seramiği Döşeme', unitType: 'm²', unitPrice: 110, sortOrder: 2 },
        { code: 'seramik_banyo', name: 'Banyo Seramiği', unitType: 'm²', unitPrice: 130, sortOrder: 3 },
        { code: 'seramik_mutfak', name: 'Mutfak Tezgah Arası Seramik', unitType: 'm²', unitPrice: 115, sortOrder: 4 },
        { code: 'seramik_soke', name: 'Seramik Söküm', unitType: 'm²', unitPrice: 40, sortOrder: 5 },
      ],
    },
    {
      groupCode: 'parke',
      items: [
        { code: 'parke_laminant', name: 'Laminant Parke Döşeme', unitType: 'm²', unitPrice: 95, sortOrder: 1 },
        { code: 'parke_ahsap', name: 'Ahşap Parke Döşeme', unitType: 'm²', unitPrice: 180, sortOrder: 2 },
        { code: 'parke_yenileme', name: 'Parke Cilalama / Yenileme', unitType: 'm²', unitPrice: 50, sortOrder: 3 },
        { code: 'parke_soke', name: 'Parke Söküm', unitType: 'm²', unitPrice: 30, sortOrder: 4 },
      ],
    },
    {
      groupCode: 'siva_isleri',
      items: [
        { code: 'siva_ic', name: 'İç Sıva', unitType: 'm²', unitPrice: 65, sortOrder: 1 },
        { code: 'siva_dis', name: 'Dış Sıva', unitType: 'm²', unitPrice: 90, sortOrder: 2 },
        { code: 'siva_alcipan_ek', name: 'Alçıpan Ek Yeri Dolgusu', unitType: 'm²', unitPrice: 35, sortOrder: 3 },
        { code: 'siva_onarim', name: 'Sıva Onarım', unitType: 'm²', unitPrice: 55, sortOrder: 4 },
      ],
    },
    {
      groupCode: 'elektrik',
      items: [
        { code: 'elektrik_priz', name: 'Priz / Anahtar Değişimi', unitType: 'adet', unitPrice: 150, sortOrder: 1 },
        { code: 'elektrik_kablo', name: 'Kablo Döşeme', unitType: 'm', unitPrice: 25, sortOrder: 2 },
        { code: 'elektrik_panel', name: 'Elektrik Pano Kurulum', unitType: 'adet', unitPrice: 1200, sortOrder: 3 },
        { code: 'elektrik_aydinlatma', name: 'Aydınlatma Armatür Değişimi', unitType: 'adet', unitPrice: 200, sortOrder: 4 },
        { code: 'elektrik_topraklama', name: 'Topraklama Tesisatı', unitType: 'm', unitPrice: 35, sortOrder: 5 },
      ],
    },
    {
      groupCode: 'sihhi_tesisat',
      items: [
        { code: 'tesisat_boru', name: 'Su Borusu Değişimi', unitType: 'm', unitPrice: 80, sortOrder: 1 },
        { code: 'tesisat_pissu', name: 'Pis Su Borusu Değişimi', unitType: 'm', unitPrice: 70, sortOrder: 2 },
        { code: 'tesisat_lavabo', name: 'Lavabo Değişimi', unitType: 'adet', unitPrice: 600, sortOrder: 3 },
        { code: 'tesisat_klozet', name: 'Klozet Değişimi', unitType: 'adet', unitPrice: 800, sortOrder: 4 },
        { code: 'tesisat_batarya', name: 'Batarya Değişimi', unitType: 'adet', unitPrice: 350, sortOrder: 5 },
        { code: 'tesisat_radyator', name: 'Radyatör Değişimi', unitType: 'adet', unitPrice: 700, sortOrder: 6 },
      ],
    },
    {
      groupCode: 'alcipan',
      items: [
        { code: 'alcipan_bolme', name: 'Alçıpan Bölme Duvar', unitType: 'm²', unitPrice: 130, sortOrder: 1 },
        { code: 'alcipan_kaplama', name: 'Alçıpan Duvar Kaplaması', unitType: 'm²', unitPrice: 110, sortOrder: 2 },
        { code: 'alcipan_tavan', name: 'Alçıpan Tavan', unitType: 'm²', unitPrice: 120, sortOrder: 3 },
        { code: 'alcipan_soke', name: 'Alçıpan Söküm', unitType: 'm²', unitPrice: 35, sortOrder: 4 },
      ],
    },
    {
      groupCode: 'asma_tavan',
      items: [
        { code: 'asma_tavan_alci', name: 'Alçıpan Asma Tavan', unitType: 'm²', unitPrice: 140, sortOrder: 1 },
        { code: 'asma_tavan_pvc', name: 'PVC Asma Tavan', unitType: 'm²', unitPrice: 95, sortOrder: 2 },
        { code: 'asma_tavan_metal', name: 'Metal Panel Asma Tavan', unitType: 'm²', unitPrice: 175, sortOrder: 3 },
        { code: 'asma_tavan_soke', name: 'Asma Tavan Söküm', unitType: 'm²', unitPrice: 30, sortOrder: 4 },
      ],
    },
    {
      groupCode: 'pvc_dograma',
      items: [
        { code: 'pvc_pencere', name: 'PVC Pencere Değişimi', unitType: 'm²', unitPrice: 650, sortOrder: 1 },
        { code: 'pvc_kapi', name: 'PVC Kapı Değişimi', unitType: 'adet', unitPrice: 1800, sortOrder: 2 },
        { code: 'pvc_soke', name: 'PVC Doğrama Söküm', unitType: 'adet', unitPrice: 150, sortOrder: 3 },
        { code: 'pvc_cam_degisim', name: 'PVC Cam Değişimi', unitType: 'm²', unitPrice: 250, sortOrder: 4 },
      ],
    },
    {
      groupCode: 'cam_isleri',
      items: [
        { code: 'cam_tek', name: 'Tek Cam Değişimi', unitType: 'm²', unitPrice: 180, sortOrder: 1 },
        { code: 'cam_cift', name: 'Çift Cam (Isıcam) Değişimi', unitType: 'm²', unitPrice: 320, sortOrder: 2 },
        { code: 'cam_temperli', name: 'Temperli Cam', unitType: 'm²', unitPrice: 450, sortOrder: 3 },
        { code: 'cam_filmi', name: 'Cam Filmi Uygulaması', unitType: 'm²', unitPrice: 95, sortOrder: 4 },
      ],
    },
    {
      groupCode: 'duvar_isleri',
      items: [
        { code: 'duvar_gazbeton', name: 'Gazbeton Duvar Örme', unitType: 'm²', unitPrice: 145, sortOrder: 1 },
        { code: 'duvar_tugla', name: 'Tuğla Duvar Örme', unitType: 'm²', unitPrice: 120, sortOrder: 2 },
        { code: 'duvar_yikma', name: 'Duvar Yıkım', unitType: 'm²', unitPrice: 60, sortOrder: 3 },
        { code: 'duvar_dolgu', name: 'Duvar Dolgu ve Onarım', unitType: 'm²', unitPrice: 80, sortOrder: 4 },
      ],
    },
    {
      groupCode: 'cati',
      items: [
        { code: 'cati_kiremit', name: 'Kiremit Onarım / Değişim', unitType: 'm²', unitPrice: 120, sortOrder: 1 },
        { code: 'cati_membran', name: 'Çatı Membran Kaplama', unitType: 'm²', unitPrice: 95, sortOrder: 2 },
        { code: 'cati_oluk', name: 'Yağmur Oluğu Değişimi', unitType: 'm', unitPrice: 55, sortOrder: 3 },
        { code: 'cati_ondalin', name: 'Ondülin / Polikarbon Çatı', unitType: 'm²', unitPrice: 85, sortOrder: 4 },
      ],
    },
    {
      groupCode: 'temizlik',
      items: [
        { code: 'temizlik_genel', name: 'Genel Temizlik', unitType: 'm²', unitPrice: 15, sortOrder: 1 },
        { code: 'temizlik_yangin', name: 'Yangın Sonrası Temizlik', unitType: 'm²', unitPrice: 45, sortOrder: 2 },
        { code: 'temizlik_su', name: 'Su Baskını Sonrası Temizlik', unitType: 'm²', unitPrice: 35, sortOrder: 3 },
        { code: 'temizlik_moloz', name: 'Moloz Temizleme ve Taşıma', unitType: 'm³', unitPrice: 150, sortOrder: 4 },
      ],
    },
    {
      groupCode: 'teknik_temizlik',
      items: [
        { code: 'teknik_klima', name: 'Klima Teknik Temizlik', unitType: 'adet', unitPrice: 250, sortOrder: 1 },
        { code: 'teknik_havalandirma', name: 'Havalandırma Kanal Temizliği', unitType: 'm', unitPrice: 80, sortOrder: 2 },
        { code: 'teknik_baca', name: 'Baca Temizliği', unitType: 'adet', unitPrice: 300, sortOrder: 3 },
      ],
    },
    {
      groupCode: 'mobilya',
      items: [
        { code: 'mobilya_mutfak_dolabi', name: 'Mutfak Dolabı', unitType: 'mt', unitPrice: 3500, sortOrder: 1 },
        { code: 'mobilya_banyo_dolabi', name: 'Banyo Dolabı', unitType: 'adet', unitPrice: 1800, sortOrder: 2 },
        { code: 'mobilya_vestiyer', name: 'Vestiyer / Gardırop', unitType: 'adet', unitPrice: 4500, sortOrder: 3 },
        { code: 'mobilya_kapak_degisim', name: 'Mobilya Kapak Değişimi', unitType: 'adet', unitPrice: 350, sortOrder: 4 },
      ],
    },
    {
      groupCode: 'izolasyon_yalitim',
      items: [
        { code: 'izolasyon_su', name: 'Su Yalıtımı', unitType: 'm²', unitPrice: 85, sortOrder: 1 },
        { code: 'izolasyon_isi', name: 'Isı Yalıtımı (EPS)', unitType: 'm²', unitPrice: 110, sortOrder: 2 },
        { code: 'izolasyon_ses', name: 'Ses Yalıtımı', unitType: 'm²', unitPrice: 95, sortOrder: 3 },
        { code: 'izolasyon_teras', name: 'Teras / Çatı Su Yalıtımı', unitType: 'm²', unitPrice: 130, sortOrder: 4 },
      ],
    },
    {
      groupCode: 'mekanik',
      items: [
        { code: 'mekanik_klima', name: 'Klima Montaj / Değişim', unitType: 'adet', unitPrice: 1500, sortOrder: 1 },
        { code: 'mekanik_kombi', name: 'Kombi Değişimi', unitType: 'adet', unitPrice: 6500, sortOrder: 2 },
        { code: 'mekanik_fan_coil', name: 'Fan-Coil Değişimi', unitType: 'adet', unitPrice: 2500, sortOrder: 3 },
        { code: 'mekanik_boru_yalitim', name: 'Boru Yalıtımı', unitType: 'm', unitPrice: 40, sortOrder: 4 },
      ],
    },
  ];

  let subGroupTotal = 0;
  for (const group of workSubGroupsData) {
    const wg = await prisma.workGroup.findUnique({ where: { code: group.groupCode } });
    if (!wg) continue;
    for (const item of group.items) {
      await prisma.workSubGroup.upsert({
        where: { code: item.code },
        update: { name: item.name, unitType: item.unitType, unitPrice: item.unitPrice ?? null, sortOrder: item.sortOrder },
        create: {
          workGroupId: wg.id,
          code: item.code,
          name: item.name,
          unitType: item.unitType,
          unitPrice: item.unitPrice ?? null,
          sortOrder: item.sortOrder,
        },
      });
      subGroupTotal++;
    }
  }
  console.log(`✅ Created/updated ${subGroupTotal} work sub groups`);


  // ── Damage Type Repair Templates ─────────────────────────────────────────
  const quickRepairGroup = await prisma.workGroup.upsert({
    where: { code: 'hizli_onarim' },
    update: { name: 'Hızlı Onarım Kalemleri', sortOrder: 28 },
    create: { code: 'hizli_onarim', name: 'Hızlı Onarım Kalemleri', sortOrder: 28, isSystem: true },
  });
  const damageRepairTemplates = [
    ['FIRE_HOME','BOYA_001','Boya','m2',30,80,200],['FIRE_HOME','SIVA_001','Sıva','m2',20,50,150],['FIRE_HOME','ELK_001','Elektrik tesisatı kontrolü','adet',1,1,1],['FIRE_HOME','KAPI_001','Kapı değişimi','adet',1,3,8],['FIRE_HOME','PNC_001','Pencere değişimi','adet',1,3,8],['FIRE_HOME','TMZ_001','Temizlik / dezenfeksiyon','m2',30,80,200],['FIRE_HOME','DOLAP_001','Mutfak / banyo dolabı değişimi','adet',0,2,5],['FIRE_HOME','CATI_001','Çatı onarımı (konut)','m2',10,30,100],
    ['FIRE_INDUSTRIAL','YAP_001','Yapısal kontrol','adet',1,2,5],['FIRE_INDUSTRIAL','ELK_002','Elektrik tesisatı yenileme','metre',50,200,1000],['FIRE_INDUSTRIAL','BOYA_002','Boya (endüstriyel)','m2',100,500,2000],['FIRE_INDUSTRIAL','CATI_002','Çatı onarımı (endüstriyel)','m2',50,200,800],['FIRE_INDUSTRIAL','MAK_001','Makine parça değişimi','adet',1,3,10],['FIRE_INDUSTRIAL','SONDURME_001','Yangın söndürme sistemi bakımı','adet',1,1,2],['FIRE_INDUSTRIAL','IZOL_001','Isı/yangın izolasyonu','m2',50,200,800],
    ['WATER_INTERNAL','NEM_001','Nem alma/kurutma','m2',20,60,150],['WATER_INTERNAL','BOYA_001','Boya','m2',20,60,150],['WATER_INTERNAL','TST_001','Tesisat onarımı','metre',5,15,40],['WATER_INTERNAL','ZEMIN_001','Zemin kaplama değişimi','m2',15,40,100],['WATER_INTERNAL','SIVA_001','Sıva','m2',15,40,100],['WATER_INTERNAL','ELK_003','Elektrik kontrolü','adet',1,1,2],['WATER_INTERNAL','KUF_001','Küf önleme/temizlik','m2',20,60,150],
    ['VEHICLE_IMPACT','DUV_001','Duvar onarımı (çarpma)','m2',2,10,30],['VEHICLE_IMPACT','KAPI_002','Kapı değişimi (çarpma)','adet',1,2,5],['VEHICLE_IMPACT','BOYA_004','Boya (çarpma)','m2',5,20,50],['VEHICLE_IMPACT','ZEMIN_002','Zemin kaplama değişimi (çarpma)','m2',2,8,20],['VEHICLE_IMPACT','YAP_002','Yapısal kontrol (çarpma)','adet',1,1,2],['VEHICLE_IMPACT','BARI_001','Bariyer/korkuluk onarımı','metre',2,8,20],
    ['NATURAL_DISASTER','CATI_003','Çatı onarımı/değişimi (doğal afet)','m2',30,100,500],['NATURAL_DISASTER','CEPHE_001','Dış cephe boya','m2',50,200,800],['NATURAL_DISASTER','CAM_001','Cam değişimi (doğal afet)','m2',5,20,80],['NATURAL_DISASTER','YALT_001','Su yalıtımı','m2',30,100,500],['NATURAL_DISASTER','BAHC_001','Bahçe/çevre düzenleme','m2',50,200,1000],['NATURAL_DISASTER','OLUK_001','Oluk/su tahliye sistemi','metre',10,30,100],
    ['EARTHQUAKE','YAP_003','Yapısal kontrol (deprem)','adet',1,2,5],['EARTHQUAKE','DUV_002','Duvar onarımı (deprem)','m2',20,80,300],['EARTHQUAKE','CATI_004','Çatı onarımı (deprem)','m2',30,100,400],['EARTHQUAKE','KOLON_001','Kolon/kiriş kontrolü','adet',1,3,10],['EARTHQUAKE','ZEMIN_003','Zemin kaplama değişimi (deprem)','m2',30,100,400],['EARTHQUAKE','CAM_002','Cam/kapı/pencere değişimi (deprem)','adet',3,10,30],['EARTHQUAKE','TEM_001','Temel kontrolü','adet',1,1,2],
  ] as const;
  for (let i = 0; i < damageRepairTemplates.length; i++) {
    const [damageType, code, name, unitType, small, medium, large] = damageRepairTemplates[i];
    const subGroup = await prisma.workSubGroup.upsert({
      where: { code },
      update: { name, unitType, workGroupId: quickRepairGroup.id },
      create: { code, name, unitType, workGroupId: quickRepairGroup.id, sortOrder: i + 1 },
    });
    const existingTemplate = await prisma.damageTypeRepairTemplate.findFirst({ where: { damageType, workSubGroupId: subGroup.id, fileId: null } });
    if (existingTemplate) {
      await prisma.damageTypeRepairTemplate.update({
        where: { id: existingTemplate.id },
        data: { defaultQuantitySmall: small, defaultQuantityMedium: medium, defaultQuantityLarge: large, sortOrder: i + 1, isGlobal: true },
      });
    } else {
      await prisma.damageTypeRepairTemplate.create({
        data: { damageType, workSubGroupId: subGroup.id, defaultQuantitySmall: small, defaultQuantityMedium: medium, defaultQuantityLarge: large, sortOrder: i + 1, isGlobal: true },
      });
    }
  }
  console.log(`✅ Created/updated ${damageRepairTemplates.length} damage repair templates`);

  // ── Türkiye İl/İlçe Veritabanı ────────────────────────────────────────────
  console.log('🏙️  Seeding provinces and districts...');
  for (const prov of PROVINCES) {
    const province = await prisma.province.upsert({
      where: { plateCode: prov.plateCode },
      update: { name: prov.name },
      create: { plateCode: prov.plateCode, name: prov.name },
    });
    for (const distName of prov.districts) {
      await prisma.district.upsert({
        where: { provinceId_name: { provinceId: province.id, name: distName } },
        update: {},
        create: { provinceId: province.id, name: distName },
      });
    }
  }
  console.log(`✅ Seeded ${PROVINCES.length} provinces and districts`);

  // ── KVKK ve Gizlilik Taahhütnamesi ────────────────────────────────────────
  console.log('📄 Seeding default agreements...');

  const kvkkContent = KVKK_DEFAULT_CONTENT;
  const gizlilikContent = GIZLILIK_DEFAULT_CONTENT;
  const agreementVersion = '1.2';

  await Promise.all([
    prisma.agreement.upsert({
      where: { id: 'seed-kvkk-agreement-v1' },
      create: {
        id: 'seed-kvkk-agreement-v1',
        title: 'KVKK Aydınlatma Metni',
        content: kvkkContent,
        type: 'kvkk',
        version: agreementVersion,
        isActive: true,
      },
      update: {
        title: 'KVKK Aydınlatma Metni',
        content: kvkkContent,
        version: agreementVersion,
        isActive: true,
      },
    }),
    prisma.agreement.upsert({
      where: { id: 'seed-gizlilik-agreement-v1' },
      create: {
        id: 'seed-gizlilik-agreement-v1',
        title: 'Gizlilik ve Kişisel Veri Koruma Taahhütnamesi',
        content: gizlilikContent,
        type: 'gizlilik',
        version: agreementVersion,
        isActive: true,
      },
      update: {
        title: 'Gizlilik ve Kişisel Veri Koruma Taahhütnamesi',
        content: gizlilikContent,
        version: agreementVersion,
        isActive: true,
      },
    }),
  ]);
  console.log('✅ Seeded default KVKK and Gizlilik agreements');

  // ─── Faz 3: ExpenseCategory seed ─────────────────────────────────────────
  const expenseCategories = [
    // Değişken Giderler (isOverhead=false grubunun kategorileri)
    { id: 'cat-vendor-payment',    name: 'Tedarikçi Hakediş',              code: 'VENDOR_PAYMENT',   level: 1, sortOrder: 1 },
    { id: 'cat-manager-travel',    name: 'Yönetici Ulaşım Gideri',         code: 'MANAGER_TRAVEL',   level: 1, sortOrder: 2 },
    { id: 'cat-inspection-fee',    name: 'Yönetici Denetim ve Refakat',    code: 'INSPECTION_FEE',   level: 1, sortOrder: 3 },
    { id: 'cat-material',          name: 'Malzeme Gideri',                 code: 'MATERIAL',         level: 1, sortOrder: 4 },
    { id: 'cat-communication',     name: 'İletişim / Telefon Gideri',      code: 'COMMUNICATION',    level: 1, sortOrder: 5 },
    { id: 'cat-other-variable',    name: 'Diğer Değişken Giderler',        code: 'OTHER_VARIABLE',   level: 1, sortOrder: 6 },
    // Sabit / Genel Giderler (MonthlyOverheadEntry için)
    { id: 'cat-office-rent',       name: 'Ofis Kirası',                    code: 'OFFICE_RENT',      level: 1, sortOrder: 10 },
    { id: 'cat-payroll',           name: 'Personel Maaşları',              code: 'PAYROLL',          level: 1, sortOrder: 11 },
    { id: 'cat-vehicle-rent',      name: 'Araç Kiralama',                  code: 'VEHICLE_RENT',     level: 1, sortOrder: 12 },
    { id: 'cat-software',          name: 'Yazılım Lisansları',             code: 'SOFTWARE',         level: 1, sortOrder: 13 },
    { id: 'cat-insurance-premium', name: 'Sigorta Primleri',               code: 'INSURANCE_PREMIUM',level: 1, sortOrder: 14 },
    { id: 'cat-accounting-legal',  name: 'Muhasebe / Hukuk Giderleri',    code: 'ACCOUNTING_LEGAL', level: 1, sortOrder: 15 },
  ];

  for (const cat of expenseCategories) {
    await prisma.expenseCategory.upsert({
      where: { code: cat.code },
      create: {
        id:        cat.id,
        name:      cat.name,
        code:      cat.code,
        level:     cat.level,
        sortOrder: cat.sortOrder,
        isActive:  true,
      },
      update: {
        name:      cat.name,
        sortOrder: cat.sortOrder,
        isActive:  true,
      },
    });
  }
  console.log('✅ Seeded expense categories (Faz 3 P&L)');

  // ── Tedarikçi Sözleşme Şablonu ────────────────────────────────────────────
  const existingTemplate = await prisma.vendorContractTemplate.findFirst({ where: { isActive: true } });
  if (!existingTemplate) {
    const template = await prisma.vendorContractTemplate.create({
      data: { name: 'Tedarikçi Onarım Sözleşmesi', isActive: true, version: '1.0' },
    });

    const clauses = [
      {
        title: 'İşin Tanımı ve Kapsamı',
        content: `<p>İşbu sözleşme; <strong>{{dosya_no}}</strong> numaralı hasar dosyası kapsamında, <strong>{{hasar_adresi}}</strong> adresinde gerçekleştirilecek onarım/tadilat işlerini kapsamaktadır.</p>
<p>Yapılacak iş kalemleri aşağıda belirtilmiştir:</p>
{{is_kalemleri}}`,
        sortOrder: 0,
      },
      {
        title: 'Taraflar',
        content: `<p><strong>İşveren:</strong> Meridyen Assistance — Sigorta Hasar Yönetim Hizmetleri</p>
<p><strong>Taşeron/Tedarikçi:</strong> {{tedarikci_ad}}</p>
<p><strong>Vergi No / TC No:</strong> {{tedarikci_vergi_no}}</p>
<p><strong>Adres:</strong> {{tedarikci_adres}}</p>
<p><strong>Telefon:</strong> {{tedarikci_telefon}}</p>
<p>Sigortalı adına iş koordinasyonu Meridyen Assistance tarafından yürütülmektedir. Sigorta şirketi: <strong>{{sigorta_sirketi}}</strong></p>`,
        sortOrder: 1,
      },
      {
        title: 'Süre Taahhüdü',
        content: `<p>Taşeron, işe en geç <strong>{{baslangic_tarihi}}</strong> tarihinde başlamayı ve tüm işleri <strong>{{teslim_tarihi}}</strong> tarihine kadar eksiksiz tamamlamayı taahhüt eder.</p>
<p>Mücbir sebep halleri dışında süre uzatımı talepleri yazılı olarak bildirilmeli ve Meridyen Assistance tarafından onaylanmalıdır.</p>`,
        sortOrder: 2,
      },
      {
        title: 'Ücret ve Ödeme Koşulları',
        content: `<p>İşbu sözleşme kapsamındaki toplam iş bedeli <strong>{{toplam_tutar}}</strong> (KDV Dahil) olarak belirlenmiştir.</p>
<p>Ödeme, işlerin eksiksiz tamamlanması, kontrol/kabul süreci ve fatura ibrazı akabinde gerçekleştirilir. Parçalı ödeme talepleri ayrıca değerlendirilir.</p>`,
        sortOrder: 3,
      },
      {
        title: 'Kalite Standartları ve Malzeme',
        content: `<p>Tüm işler, ilgili Türk Standartları (TS) normlarına ve iyi işçilik kurallarına uygun olarak gerçekleştirilecektir.</p>
<p>Kullanılacak malzemeler birinci sınıf olacak; ikinci el veya kusurlu malzeme kullanılamaz. Taşeron, işin tamamlanmasından itibaren <strong>2 (iki) yıl</strong> süre ile yapılan işe ilişkin garanti vermekle yükümlüdür.</p>`,
        sortOrder: 4,
      },
      {
        title: 'Cezai Şartlar',
        content: `<p>Taşeron'un kendi kusurundan kaynaklanan gecikmeler için, gecikilen her gün başına sözleşme bedelinin <strong>%0,5 (binde beş)</strong>'i oranında cezai şart uygulanacaktır.</p>
<p>Yapılan işlerde ayıp veya kusur tespit edilmesi halinde Taşeron, kusuru kendi masraflarıyla gidermeyi kabul eder. Ek zarar ve ziyan talep hakkı saklıdır.</p>`,
        sortOrder: 5,
      },
      {
        title: 'Sorumluluk ve İş Güvenliği',
        content: `<p>Taşeron; çalışanlarının iş kazası, meslek hastalığı ve üçüncü şahıslara verebileceği zararlardan münferiden sorumludur. İş güvenliği mevzuatına uyum tamamen Taşeron'un sorumluluğundadır.</p>
<p>Hasar mahallinde kullanılacak ekipman ve işçilere ilişkin tüm yasal yükümlülükler (SGK, vergi vb.) Taşeron'a aittir.</p>`,
        sortOrder: 6,
      },
      {
        title: 'Gizlilik ve KVKK',
        content: `<p><strong>{{tedarikci_ad}}</strong>, bu sözleşme kapsamında edindiği sigortalıya, sigorta şirketine veya Meridyen Assistance'a ait tüm bilgileri gizli tutmakla yükümlüdür. Bu bilgiler üçüncü taraflarla paylaşılamaz.</p>
<p>Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında işlenen veriler yalnızca sözleşme amaçları doğrultusunda kullanılacaktır. Taşeron, bu yükümlülüğünü sözleşme sona erdikten sonra da <strong>5 (beş) yıl</strong> süre ile yerine getireceğini kabul eder.</p>`,
        sortOrder: 7,
      },
      {
        title: 'Uyuşmazlık Çözümü',
        content: `<p>Taraflar, uyuşmazlıkları öncelikle müzakere yoluyla çözmeye gayret edecektir. Çözüme kavuşturulamazsa <strong>İstanbul</strong> Mahkemeleri ve İcra Müdürlükleri yetkilidir.</p>`,
        sortOrder: 8,
      },
      {
        title: 'Fesih Koşulları ve İmza Yükümlülüğü',
        content: `<p>İşbu sözleşme, Meridyen Assistance tarafından düzenlenmiş olup Meridyen Assistance tarafı sözleşmenin oluşturulduğu tarihten itibaren <strong>elektronik imzalı kabul edilir</strong>.</p>
<p>Taşeron, sözleşmenin iletilmesinden itibaren <strong>{{imza_sure_gun}} ({{imza_sure_gun}}) gün</strong> içinde imzalamaması halinde Meridyen Assistance, iş emrini iptal etme ve başka bir tedarikçiye devretme hakkına sahiptir. Bu durum Taşeron'un hak talep etmesine engel teşkil eder.</p>
<p>Sözleşmeyi imzalamadan işe başlanması halinde Taşeron, sözleşme şartlarını kabul etmiş sayılır.</p>`,
        sortOrder: 9,
      },
    ];

    for (const c of clauses) {
      await prisma.vendorContractClause.create({
        data: { templateId: template.id, ...c, isRequired: true },
      });
    }
    console.log('✅ Seeded vendor contract template and 10 clauses');
  } else {
    console.log('ℹ️  Vendor contract template already exists, skipping');
  }

  // ── Sigorta Şirketleri ────────────────────────────────────────────────────
  const insuranceCompanies = [
    { code: 'turkiye-sigorta',   name: 'Türkiye Sigorta' },
    { code: 'anadolu-sigorta',   name: 'Anadolu Sigorta' },
    { code: 'neova-sigorta',     name: 'Neova Sigorta' },
    { code: 'ray-sigorta',       name: 'Ray Sigorta' },
    { code: 'allianz-sigorta',   name: 'Allianz Sigorta' },
    { code: 'quick-sigorta',     name: 'Quick Sigorta' },
    { code: 'bereket-sigorta',   name: 'Bereket Sigorta' },
    { code: 'sompo-sigorta',     name: 'Sompo Sigorta' },
    { code: 'hepiyi-sigorta',    name: 'Hepiyi Sigorta' },
    { code: 'aksigorta',         name: 'Aksigorta' },
  ];

  for (const ic of insuranceCompanies) {
    await prisma.insuranceCompany.upsert({
      where: { code: ic.code },
      update: { name: ic.name },
      create: { code: ic.code, name: ic.name, status: 'active' },
    });
  }
  console.log(`✅ Created/updated ${insuranceCompanies.length} insurance companies`);

  // ── Şubeler / Branşlar ────────────────────────────────────────────────────
  const branches = [
    { name: 'İstanbul', city: 'İstanbul', region: 'Marmara' },
    { name: 'Ankara',   city: 'Ankara',   region: 'İç Anadolu' },
    { name: 'İzmir',    city: 'İzmir',    region: 'Ege' },
    { name: 'Adana',    city: 'Adana',    region: 'Akdeniz' },
    { name: 'Antalya',  city: 'Antalya',  region: 'Akdeniz' },
  ];

  for (const br of branches) {
    const exists = await prisma.branch.findFirst({ where: { name: br.name } });
    if (!exists) {
      await prisma.branch.create({ data: br });
    }
  }
  console.log(`✅ Created/updated ${branches.length} branches`);

  // ── Domain Ayrıştırma: İhbar Konuları (ClaimSubject) ───────────────────────
  const claimSubjects = [
    // Hasar konuları
    { code: 'konut-yangin', name: 'Konut Yangın', category: 'hasar', sortOrder: 1 },
    { code: 'endustriyel-yangin', name: 'Endüstriyel Yangın', category: 'hasar', sortOrder: 2 },
    { code: 'dahili-su', name: 'Dahili Su', category: 'hasar', sortOrder: 3 },
    { code: 'hirsizlik', name: 'Hırsızlık', category: 'hasar', sortOrder: 4 },
    { code: 'cam-kirilmasi', name: 'Cam Kırılması', category: 'hasar', sortOrder: 5 },
    { code: 'dogal-afet', name: 'Doğal Afet', category: 'hasar', sortOrder: 6 },
    { code: 'sel', name: 'Sel', category: 'hasar', sortOrder: 7 },
    { code: 'firtina', name: 'Fırtına', category: 'hasar', sortOrder: 8 },
    { code: 'deprem', name: 'Deprem', category: 'hasar', sortOrder: 9 },
    { code: 'makine-kirilmasi', name: 'Makine Kırılması', category: 'hasar', sortOrder: 10 },
    { code: 'elektronik-cihaz', name: 'Elektronik Cihaz', category: 'hasar', sortOrder: 11 },
    { code: 'diger-hasar', name: 'Diğer', category: 'hasar', sortOrder: 12 },
    // Acil yardım konuları
    { code: 'su-baskini', name: 'Su Baskını', category: 'acil_yardim', sortOrder: 1 },
    { code: 'cati-hasari', name: 'Çatı Hasarı', category: 'acil_yardim', sortOrder: 2 },
    { code: 'cam-kirigi', name: 'Cam Kırığı', category: 'acil_yardim', sortOrder: 3 },
    { code: 'kapi-kilit-arizasi', name: 'Kapı/Kilit Arızası', category: 'acil_yardim', sortOrder: 4 },
    { code: 'elektrik-arizasi', name: 'Elektrik Arızası', category: 'acil_yardim', sortOrder: 5 },
    { code: 'dogalgaz-arizasi', name: 'Doğalgaz Arızası', category: 'acil_yardim', sortOrder: 6 },
    { code: 'yangin-hasari-acil', name: 'Yangın Hasarı', category: 'acil_yardim', sortOrder: 7 },
    { code: 'hirsizlik-guvenlik', name: 'Hırsızlık/Güvenlik', category: 'acil_yardim', sortOrder: 8 },
    { code: 'boru-patlamasi', name: 'Boru Patlaması', category: 'acil_yardim', sortOrder: 9 },
    { code: 'asansor-arizasi', name: 'Asansör Arızası', category: 'acil_yardim', sortOrder: 10 },
    { code: 'diger-acil', name: 'Diğer', category: 'acil_yardim', sortOrder: 11 },
  ];

  for (const cs of claimSubjects) {
    await prisma.claimSubject.upsert({
      where: { code: cs.code },
      update: { name: cs.name, category: cs.category, sortOrder: cs.sortOrder },
      create: { ...cs, isActive: true, metadata: {} },
    });
  }
  console.log(`✅ Created/updated ${claimSubjects.length} claim subjects`);

  // ── Domain Ayrıştırma: Gerçek Departmanlar (Organizasyon Birimleri) ────────
  const realDepartments = [
    {
      code: 'hasar-onarim',
      name: 'Hasar Onarım',
      description: 'Hasar dosyaları operasyonel yönetim departmanı',
      color: '#3B82F6',
      reportFormat: 'repair',
      sortOrder: 1,
    },
    {
      code: 'acil-yardim',
      name: 'Acil Yardım',
      description: 'Acil yardım operasyon departmanı',
      color: '#EF4444',
      reportFormat: 'emergency',
      sortOrder: 2,
    },
    {
      code: 'sovtaj',
      name: 'Sovtaj',
      description: 'Sovtaj operasyon departmanı',
      color: '#10B981',
      reportFormat: 'repair',
      sortOrder: 3,
    },
  ];

  for (const dept of realDepartments) {
    await prisma.department.upsert({
      where: { code: dept.code },
      update: { name: dept.name, description: dept.description, color: dept.color, reportFormat: dept.reportFormat, sortOrder: dept.sortOrder },
      create: { ...dept, isSystem: true, status: 'active' },
    });
  }
  console.log(`✅ Created/updated ${realDepartments.length} real departments (organizational units)`);

  // ── DEPRECATED: Eski Departments (Hasar Türleri) - backward compat için kalsın ───
  const departments = [
    {
      code: 'konut-yangin',
      name: 'Konut Yangın',
      description: 'Konut yangın hasar dosyaları',
      color: '#EF4444',
      sortOrder: 1,
      subjects: [
        { code: 'yangin-hasari',    name: 'Yangın Hasarı' },
        { code: 'is-kaybi',         name: 'İş Kaybı' },
        { code: 'duman-is-isi',     name: 'Duman/Isı/Is' },
      ],
    },
    {
      code: 'dahili-su',
      name: 'Dahili Su',
      description: 'Dahili su hasarı dosyaları',
      color: '#3B82F6',
      sortOrder: 2,
      subjects: [
        { code: 'boru-patlama',     name: 'Boru Patlaması' },
        { code: 'tesisat-sizinti',  name: 'Tesisat Sızıntısı' },
        { code: 'don-hasari',       name: 'Don Hasarı' },
      ],
    },
    {
      code: 'endustriyel-yangin',
      name: 'Endüstriyel Yangın',
      description: 'Endüstriyel yangın hasar dosyaları',
      color: '#F97316',
      sortOrder: 3,
      subjects: [
        { code: 'yangin',           name: 'Yangın' },
        { code: 'patlama',          name: 'Patlama' },
        { code: 'duman-is-isi',     name: 'Duman/Isı/Is' },
      ],
    },
    {
      code: 'deprem',
      name: 'Deprem',
      description: 'Deprem hasar dosyaları',
      color: '#8B5CF6',
      sortOrder: 4,
      subjects: [
        { code: 'yapisal-hasar',    name: 'Yapısal Hasar' },
        { code: 'içerik-hasari',    name: 'İçerik Hasarı' },
      ],
    },
    {
      code: 'hirsizlik',
      name: 'Hırsızlık',
      description: 'Hırsızlık hasar dosyaları',
      color: '#6B7280',
      sortOrder: 5,
      subjects: [
        { code: 'esya-hirsizligi',  name: 'Eşya Hırsızlığı' },
        { code: 'kirilma-zorlama',  name: 'Kırılma/Zorlama' },
      ],
    },
    {
      code: 'cam-kirilmasi',
      name: 'Cam Kırılması',
      description: 'Cam kırılması hasar dosyaları',
      color: '#06B6D4',
      sortOrder: 6,
      subjects: [
        { code: 'cam-kirilma',      name: 'Cam Kırılması' },
        { code: 'ayna-kirilma',     name: 'Ayna Kırılması' },
      ],
    },
    {
      code: 'dogal-afet',
      name: 'Doğal Afet',
      description: 'Doğal afet hasar dosyaları',
      color: '#10B981',
      sortOrder: 7,
      subjects: [
        { code: 'sel-su-baskini',   name: 'Sel/Su Baskını' },
        { code: 'firtina',          name: 'Fırtına' },
        { code: 'dolu',             name: 'Dolu' },
        { code: 'kar-agirlik',      name: 'Kar Ağırlığı' },
      ],
    },
    {
      code: 'elektronik-cihaz',
      name: 'Elektronik Cihaz',
      description: 'Elektronik cihaz hasar dosyaları',
      color: '#F59E0B',
      sortOrder: 8,
      subjects: [
        { code: 'arizalanma',       name: 'Arızalanma' },
        { code: 'kirilma-dusme',    name: 'Kırılma/Düşme' },
        { code: 'elektrik-surge',   name: 'Elektrik Dalgalanması' },
      ],
    },
    {
      code: 'makine-kirilmasi',
      name: 'Makine Kırılması',
      description: 'Makine kırılması hasar dosyaları',
      color: '#64748B',
      sortOrder: 9,
      subjects: [
        { code: 'mekanik-ariza',    name: 'Mekanik Arıza' },
        { code: 'elektriksel-ariza',name: 'Elektriksel Arıza' },
        { code: 'operator-hatasi',  name: 'Operatör Hatası' },
      ],
    },
  ];

  for (const dept of departments) {
    const { subjects, ...deptData } = dept;
    const created = await prisma.department.upsert({
      where: { code: deptData.code },
      update: { name: deptData.name, description: deptData.description, color: deptData.color, sortOrder: deptData.sortOrder },
      create: { ...deptData, isSystem: true, status: 'active', reportFormat: 'repair' },
    });

    for (let i = 0; i < subjects.length; i++) {
      const subj = subjects[i];
      const existingSubj = await prisma.departmentFileSubject.findFirst({
        where: { departmentId: created.id, code: subj.code },
      });
      if (!existingSubj) {
        await prisma.departmentFileSubject.create({
          data: {
            departmentId: created.id,
            code: subj.code,
            name: subj.name,
            isSystem: true,
            sortOrder: i + 1,
            status: 'active',
          },
        });
      }
    }
  }
  console.log(`✅ Created/updated ${departments.length} departments with file subjects`);

  // ── DEPRECATED: Meridyen Hizmet Branşları (ServiceBranch scope=meridyen) ──
  // Okuma artık department_file_subjects üzerinden yapılır; yeni kayıt eklenmez.
  const legacyMeridyenServiceBranches = [
    { name: 'Konut Yangın',         type: 'hasar',      sortOrder: 1 },
    { name: 'Dahili Su',            type: 'hasar',      sortOrder: 2 },
    { name: 'Endüstriyel Yangın',   type: 'hasar',      sortOrder: 3 },
    { name: 'Deprem',               type: 'hasar',      sortOrder: 4 },
    { name: 'Hırsızlık',            type: 'hasar',      sortOrder: 5 },
    { name: 'Cam Kırılması',        type: 'hasar',      sortOrder: 6 },
    { name: 'Doğal Afet',           type: 'hasar',      sortOrder: 7 },
    { name: 'Elektronik Cihaz',     type: 'hasar',      sortOrder: 8 },
    { name: 'Makine Kırılması',     type: 'hasar',      sortOrder: 9 },
    { name: 'Acil Su',              type: 'acil_yardim',sortOrder: 1 },
    { name: 'Acil Elektrik',        type: 'acil_yardim',sortOrder: 2 },
    { name: 'Çilingir',             type: 'acil_yardim',sortOrder: 3 },
  ];

  for (const sb of legacyMeridyenServiceBranches) {
    const exists = await prisma.serviceBranch.findFirst({ where: { name: sb.name, type: sb.type } });
    if (!exists) {
      await prisma.serviceBranch.create({ data: { ...sb, isActive: true } });
    }
  }
  console.log(`✅ Legacy meridyen service branches checked (${legacyMeridyenServiceBranches.length} defaults)`);

  // ── Hizmet Türleri (ServiceType) ──────────────────────────────────────────
  const serviceTypes = [
    { name: 'Hasar Onarım',           sortOrder: 1 },
    { name: 'Restorasyon',            sortOrder: 2 },
    { name: 'Güneş Enerjisi Onarım', sortOrder: 3 },
    { name: 'Sovtaj',                 sortOrder: 4 },
    { name: 'İş Makinası İade Parça', sortOrder: 5 },
    { name: 'Elektronik İade Parça',  sortOrder: 6 },
    { name: 'Danışmanlık',            sortOrder: 7 },
  ];

  for (const st of serviceTypes) {
    const exists = await prisma.serviceType.findUnique({ where: { name: st.name } });
    if (!exists) {
      await prisma.serviceType.create({ data: { ...st, isActive: true } });
    }
  }
  console.log(`✅ Created/updated ${serviceTypes.length} service types`);

  // ── Evrak Türleri (DocumentType) — tedarikçi kapsamı ─────────────────────
  const vendorDocumentTypes = [
    { code: 'DOC-00001', name: 'Hasar Tespit Raporu', sortOrder: 10, isRequired: false },
    { code: 'DOC-00002', name: 'Eksper Raporu', sortOrder: 20, isRequired: false },
    { code: 'DOC-00003', name: 'Poliçe Fotokopisi', sortOrder: 30, isRequired: false },
    { code: 'DOC-00004', name: 'Kimlik Fotokopisi', sortOrder: 40, isRequired: false },
    { code: 'DOC-00005', name: 'Onarım Faturası', sortOrder: 50, isRequired: false },
    { code: 'DOC-00006', name: 'Fotoğraflar (Hasar Öncesi)', sortOrder: 60, isRequired: false },
    { code: 'DOC-00007', name: 'Fotoğraflar (Hasar Sonrası)', sortOrder: 70, isRequired: false },
    { code: 'DOC-00008', name: 'Keşif Raporu', sortOrder: 80, isRequired: false },
    { code: 'DOC-00009', name: 'Teklif/Proforma', sortOrder: 90, isRequired: false },
    { code: 'DOC-00010', name: 'Ödeme Dekontu', sortOrder: 100, isRequired: false },
    { code: 'DOC-00011', name: 'Tutanak', sortOrder: 110, isRequired: false },
    { code: 'DOC-00012', name: 'Vekaletname', sortOrder: 120, isRequired: false },
    { code: 'DOC-OTHER', name: 'Diğer', sortOrder: 999, isRequired: false },
  ];

  for (const dt of vendorDocumentTypes) {
    await prisma.documentType.upsert({
      where: { code: dt.code },
      create: {
        ...dt,
        entityScope: 'vendor',
        serviceBranchTypes: ['hasar', 'acil_yardim'],
        customerSubTypes: [],
        departmentIds: [],
        serviceTypeIds: [],
        status: 'active',
      },
      update: {
        name: dt.name,
        sortOrder: dt.sortOrder,
        entityScope: 'vendor',
        serviceBranchTypes: ['hasar', 'acil_yardim'],
        status: 'active',
      },
    });
  }
  console.log(`✅ Created/updated ${vendorDocumentTypes.length} vendor document types`);

  await prisma.platformModule.upsert({
    where: { code: 'personnel' },
    update: { isEnabled: true, name: 'Personel Modülü', description: 'Puantaj, izin, hizmet kayıtları, dijital evrak arşivi' },
    create: {
      id: 'pod-personnel-v1',
      code: 'personnel',
      name: 'Personel Modülü',
      description: 'Puantaj, izin, hizmet kayıtları, dijital evrak arşivi',
      isEnabled: true,
      sortOrder: 10,
    },
  });
  console.log('✅ Personel modülü etkinleştirildi');

  console.log('🎉 Seeding completed!');
}

async function assignPermissions(
  roleId: string,
  permissionCodes: string[],
  allPermissions: any[]
) {
  const perms = allPermissions.filter((p) => permissionCodes.includes(p.code));
  await Promise.all(
    perms.map((p) =>
      prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId: p.id } },
        update: {},
        create: { roleId, permissionId: p.id },
      })
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
