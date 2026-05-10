import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

type PilotUserKey = 'branchManager' | 'officeLead' | 'officeStaff' | 'fieldStaff' | 'financeStaff';

type PilotClaimSeed = {
  fileNo: string;
  claimNo: string;
  policyNo: string;
  customerEmail: string;
  insuranceCode: string;
  statusCode: string;
  branchName: string;
  officeUser: PilotUserKey | null;
  fieldUser: PilotUserKey | null;
  responsibleUser: PilotUserKey;
  responsibleRole: string;
  pendingActionOwner: string;
  priority: string;
  productBranch: string;
  lossType: string;
  propertyType: string;
  fileType: string;
  sourceChannel: string;
  description: string;
  incidentDaysAgo: number;
  notificationDaysAgo: number;
  createdDaysAgo: number;
  statusChangedHoursAgo: number;
  lastActivityHoursAgo: number;
  lastHumanActionHoursAgo: number;
  slaDueOffsetHours: number;
  closedDaysAgo?: number;
  amounts: {
    initialReserve: number;
    estimated: number;
    approved: number;
    actual: number;
    invoiced: number;
    collected: number;
  };
};

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export async function seedPilotOperationData(prisma: PrismaClient) {
  console.log('🎯 Seeding pilot operation demo data...');

  const admin = await prisma.user.findUnique({
    where: { email: 'admin@meridyenassistance.com' },
    include: { role: true },
  });

  if (!admin) {
    throw new Error('Admin kullanıcı bulunamadı. Önce temel seed çalışmalıdır.');
  }

  const hashedPassword = await bcrypt.hash('pilot123', 10);

  const roles = await prisma.role.findMany({
    where: { code: { in: ['manager', 'office_staff', 'field_staff', 'finance'] } },
  });
  const roleMap = new Map(roles.map((role) => [role.code, role]));

  const branchSeeds = [
    { name: 'İstanbul Anadolu Operasyon', city: 'İstanbul', region: 'Marmara', address: 'Kozyatağı Mah. Kaya Sultan Sk. No:12 Ataşehir/İstanbul', phone: '02165551212' },
    { name: 'Ankara Merkez Operasyon', city: 'Ankara', region: 'İç Anadolu', address: 'Mustafa Kemal Mah. 2142. Cad. No:18 Çankaya/Ankara', phone: '03125559898' },
  ];

  const branchMap = new Map<string, Awaited<ReturnType<typeof prisma.branch.upsert>>>();
  for (const branchSeed of branchSeeds) {
    const branch = await prisma.branch.upsert({
      where: { name: branchSeed.name },
      update: {
        city: branchSeed.city,
        region: branchSeed.region,
        address: branchSeed.address,
        phone: branchSeed.phone,
      },
      create: branchSeed,
    });
    branchMap.set(branch.name, branch);
  }

  const pilotUsers = [
    {
      key: 'branchManager' as const,
      email: 'selin.karaca@demo.local',
      firstName: 'Selin',
      lastName: 'Karaca',
      roleCode: 'manager',
      employeeCode: 'PLT001',
      branchName: 'İstanbul Anadolu Operasyon',
      isMobileUser: false,
    },
    {
      key: 'officeLead' as const,
      email: 'burak.ozdemir@demo.local',
      firstName: 'Burak',
      lastName: 'Özdemir',
      roleCode: 'office_staff',
      employeeCode: 'PLT002',
      branchName: 'İstanbul Anadolu Operasyon',
      isMobileUser: false,
    },
    {
      key: 'officeStaff' as const,
      email: 'ece.aydin@demo.local',
      firstName: 'Ece',
      lastName: 'Aydın',
      roleCode: 'office_staff',
      employeeCode: 'PLT003',
      branchName: 'Ankara Merkez Operasyon',
      isMobileUser: false,
    },
    {
      key: 'fieldStaff' as const,
      email: 'mert.yildirim@demo.local',
      firstName: 'Mert',
      lastName: 'Yıldırım',
      roleCode: 'field_staff',
      employeeCode: 'PLT004',
      branchName: 'İstanbul Anadolu Operasyon',
      isMobileUser: true,
    },
    {
      key: 'financeStaff' as const,
      email: 'dilek.sahin@demo.local',
      firstName: 'Dilek',
      lastName: 'Şahin',
      roleCode: 'finance',
      employeeCode: 'PLT005',
      branchName: 'Ankara Merkez Operasyon',
      isMobileUser: false,
    },
  ];

  const userMap = new Map<PilotUserKey, Awaited<ReturnType<typeof prisma.user.upsert>>>();
  for (const seed of pilotUsers) {
    const role = roleMap.get(seed.roleCode);
    const branch = branchMap.get(seed.branchName);
    if (!role || !branch) {
      throw new Error(`Pilot kullanıcı için rol/şube bulunamadı: ${seed.email}`);
    }
    const user = await prisma.user.upsert({
      where: { email: seed.email },
      update: {
        firstName: seed.firstName,
        lastName: seed.lastName,
        roleId: role.id,
        branchId: branch.id,
        employeeCode: seed.employeeCode,
        status: 'active',
        isWebUser: true,
        isMobileUser: seed.isMobileUser,
      },
      create: {
        firstName: seed.firstName,
        lastName: seed.lastName,
        email: seed.email,
        passwordHash: hashedPassword,
        roleId: role.id,
        branchId: branch.id,
        employeeCode: seed.employeeCode,
        status: 'active',
        isWebUser: true,
        isMobileUser: seed.isMobileUser,
      },
    });
    userMap.set(seed.key, user);
  }

  const manager = userMap.get('branchManager');
  if (manager) {
    await prisma.branch.update({
      where: { id: branchMap.get('İstanbul Anadolu Operasyon')!.id },
      data: { managerUserId: manager.id },
    });
  }

  const insuranceSeeds = [
    {
      code: 'ANADOLU_SIGORTA_DEMO',
      name: 'Anadolu Sigorta Pilot',
      taxNumber: '1234567890',
      contactEmail: 'pilot@anadolusigorta.com.tr',
      contactPhone: '02125550101',
      address: 'Rüzgarlıbahçe Mah. Cumhuriyet Cad. No:10 Beykoz/İstanbul',
      notes: 'Pilot açılış veri seti için oluşturuldu.',
    },
    {
      code: 'AKSIGORTA_DEMO',
      name: 'Aksigorta Pilot',
      taxNumber: '2345678901',
      contactEmail: 'operasyon@aksigorta.com.tr',
      contactPhone: '02165550102',
      address: 'Levent Mah. Büyükdere Cad. No:185 Beşiktaş/İstanbul',
      notes: 'Kurumsal hasar operasyonları için demo kayıt.',
    },
    {
      code: 'ALLIANZ_DEMO',
      name: 'Allianz Pilot',
      taxNumber: '3456789012',
      contactEmail: 'hasar@allianz.com.tr',
      contactPhone: '02125550103',
      address: 'Küçükbakkalköy Mah. Dudullu Cad. No:35 Ataşehir/İstanbul',
      notes: 'Finans darboğazı ve SLA senaryoları için kullanılır.',
    },
  ];

  const insuranceMap = new Map<string, Awaited<ReturnType<typeof prisma.insuranceCompany.upsert>>>();
  for (const seed of insuranceSeeds) {
    const company = await prisma.insuranceCompany.upsert({
      where: { code: seed.code },
      update: seed,
      create: seed,
    });
    insuranceMap.set(seed.code, company);
  }

  for (const user of userMap.values()) {
    for (const company of insuranceMap.values()) {
      await prisma.userInsuranceCompanyScope.upsert({
        where: {
          userId_insuranceCompanyId: {
            userId: user.id,
            insuranceCompanyId: company.id,
          },
        },
        update: {},
        create: {
          userId: user.id,
          insuranceCompanyId: company.id,
        },
      });
    }
  }

  const customerSeeds = [
    {
      email: 'sevgi.turan@example.com',
      phone: '05321110001',
      firstName: 'Sevgi',
      lastName: 'Turan',
      city: 'İstanbul',
      district: 'Kadıköy',
      address: 'Fikirtepe Mah. Mandıra Cad. No:44 D:6 Kadıköy/İstanbul',
      notes: 'Su baskını dosyaları için referans müşteri.',
      satisfactionScore: 4,
    },
    {
      email: 'orhan.kilic@example.com',
      phone: '05321110002',
      firstName: 'Orhan',
      lastName: 'Kılıç',
      city: 'Ankara',
      district: 'Çankaya',
      address: 'Yıldızevler Mah. 720. Sok. No:9 Çankaya/Ankara',
      notes: 'Yangın hasarı dosyası için kritik müşteri.',
      satisfactionScore: 3,
    },
    {
      email: 'gizem.arslan@example.com',
      phone: '05321110003',
      firstName: 'Gizem',
      lastName: 'Arslan',
      city: 'İzmir',
      district: 'Karşıyaka',
      address: 'Bostanlı Mah. Cemal Gürsel Cad. No:91 Karşıyaka/İzmir',
      notes: 'Eksper bekleyen dosyası mevcut.',
      satisfactionScore: 5,
    },
    {
      email: 'mustafa.erdem@example.com',
      phone: '05321110004',
      firstName: 'Mustafa',
      lastName: 'Erdem',
      city: 'Bursa',
      district: 'Nilüfer',
      address: 'Üçevler Mah. İzmir Yolu Cad. No:55 Nilüfer/Bursa',
      notes: 'Onarım tamamlanan dosyalar için kullanılır.',
      satisfactionScore: 4,
    },
    {
      email: 'elif.cetin@example.com',
      phone: '05321110005',
      firstName: 'Elif',
      lastName: 'Çetin',
      city: 'Kocaeli',
      district: 'İzmit',
      address: 'Yahya Kaptan Mah. Şehit Ergün Koncu Sok. No:7 İzmit/Kocaeli',
      notes: 'Tahsilat bekleyen kurumsal poliçe kullanıcısı.',
      satisfactionScore: 2,
    },
  ];

  const customerMap = new Map<string, Awaited<ReturnType<typeof prisma.customer.upsert>>>();
  for (const seed of customerSeeds) {
    const customer = await prisma.customer.upsert({
      where: { email: seed.email },
      update: {
        type: 'bireysel',
        entityType: 'individual',
        subType: 'insured',
        firstName: seed.firstName,
        lastName: seed.lastName,
        fullName: `${seed.firstName} ${seed.lastName}`,
        phone: seed.phone,
        city: seed.city,
        district: seed.district,
        address: seed.address,
        notes: seed.notes,
        serviceType: 'HASAR',
        serviceBranches: ['KONUT', 'ISYERI'],
        satisfactionScore: seed.satisfactionScore,
        source: 'insurance_referral',
        status: 'active',
      },
      create: {
        type: 'bireysel',
        entityType: 'individual',
        subType: 'insured',
        email: seed.email,
        firstName: seed.firstName,
        lastName: seed.lastName,
        fullName: `${seed.firstName} ${seed.lastName}`,
        phone: seed.phone,
        city: seed.city,
        district: seed.district,
        address: seed.address,
        notes: seed.notes,
        serviceType: 'HASAR',
        serviceBranches: ['KONUT', 'ISYERI'],
        satisfactionScore: seed.satisfactionScore,
        source: 'insurance_referral',
        status: 'active',
      },
    });
    customerMap.set(seed.email, customer);
  }

  const statuses = await prisma.claimStatus.findMany({
    where: {
      code: {
        in: [
          'new',
          'pre_review',
          'adjuster_assigned',
          'repair_in_progress',
          'repair_completed',
          'payment_pending',
          'closed',
        ],
      },
    },
  });
  const statusMap = new Map(statuses.map((status) => [status.code, status]));

  const now = new Date();
  const claims: PilotClaimSeed[] = [
    {
      fileNo: 'PLT-2026-001',
      claimNo: 'HSR-260001',
      policyNo: 'ANP-450012',
      customerEmail: 'sevgi.turan@example.com',
      insuranceCode: 'ANADOLU_SIGORTA_DEMO',
      statusCode: 'new',
      branchName: 'İstanbul Anadolu Operasyon',
      officeUser: 'officeLead',
      fieldUser: null,
      responsibleUser: 'officeLead',
      responsibleRole: 'office_staff',
      pendingActionOwner: 'office_staff',
      priority: 'high',
      productBranch: 'konut',
      lossType: 'water_damage',
      propertyType: 'daire',
      fileType: 'konut',
      sourceChannel: 'call_center',
      description: 'Mutfak tesisat patlağı nedeniyle alt kata su sızıntısı oluştu.',
      incidentDaysAgo: 6,
      notificationDaysAgo: 5,
      createdDaysAgo: 5,
      statusChangedHoursAgo: 30,
      lastActivityHoursAgo: 56,
      lastHumanActionHoursAgo: 52,
      slaDueOffsetHours: -6,
      amounts: { initialReserve: 35000, estimated: 42000, approved: 0, actual: 0, invoiced: 0, collected: 0 },
    },
    {
      fileNo: 'PLT-2026-002',
      claimNo: 'HSR-260002',
      policyNo: 'AKS-781245',
      customerEmail: 'orhan.kilic@example.com',
      insuranceCode: 'AKSIGORTA_DEMO',
      statusCode: 'pre_review',
      branchName: 'İstanbul Anadolu Operasyon',
      officeUser: 'officeLead',
      fieldUser: 'fieldStaff',
      responsibleUser: 'officeLead',
      responsibleRole: 'office_staff',
      pendingActionOwner: 'office_staff',
      priority: 'critical',
      productBranch: 'isyeri',
      lossType: 'fire_damage',
      propertyType: 'dükkan',
      fileType: 'ticari',
      sourceChannel: 'email',
      description: 'Elektrik panosunda başlayan yangın nedeniyle duman ve is hasarı mevcut.',
      incidentDaysAgo: 9,
      notificationDaysAgo: 8,
      createdDaysAgo: 8,
      statusChangedHoursAgo: 26,
      lastActivityHoursAgo: 49,
      lastHumanActionHoursAgo: 47,
      slaDueOffsetHours: -4,
      amounts: { initialReserve: 95000, estimated: 118000, approved: 0, actual: 0, invoiced: 0, collected: 0 },
    },
    {
      fileNo: 'PLT-2026-003',
      claimNo: 'HSR-260003',
      policyNo: 'ALL-550101',
      customerEmail: 'gizem.arslan@example.com',
      insuranceCode: 'ALLIANZ_DEMO',
      statusCode: 'adjuster_assigned',
      branchName: 'Ankara Merkez Operasyon',
      officeUser: 'officeStaff',
      fieldUser: 'fieldStaff',
      responsibleUser: 'fieldStaff',
      responsibleRole: 'field_staff',
      pendingActionOwner: 'field_staff',
      priority: 'high',
      productBranch: 'konut',
      lossType: 'storm_damage',
      propertyType: 'villa',
      fileType: 'konut',
      sourceChannel: 'mobile_app',
      description: 'Fırtına sonrası çatı izolasyonunda açılma ve salon tavanında akma var.',
      incidentDaysAgo: 11,
      notificationDaysAgo: 10,
      createdDaysAgo: 10,
      statusChangedHoursAgo: 22,
      lastActivityHoursAgo: 20,
      lastHumanActionHoursAgo: 18,
      slaDueOffsetHours: 10,
      amounts: { initialReserve: 62000, estimated: 71000, approved: 0, actual: 0, invoiced: 0, collected: 0 },
    },
    {
      fileNo: 'PLT-2026-004',
      claimNo: 'HSR-260004',
      policyNo: 'ANP-998871',
      customerEmail: 'mustafa.erdem@example.com',
      insuranceCode: 'ANADOLU_SIGORTA_DEMO',
      statusCode: 'repair_in_progress',
      branchName: 'İstanbul Anadolu Operasyon',
      officeUser: 'officeLead',
      fieldUser: 'fieldStaff',
      responsibleUser: 'fieldStaff',
      responsibleRole: 'field_staff',
      pendingActionOwner: 'field_staff',
      priority: 'medium',
      productBranch: 'konut',
      lossType: 'earthquake_damage',
      propertyType: 'daire',
      fileType: 'konut',
      sourceChannel: 'call_center',
      description: 'Deprem sonrası banyoda seramik kırıkları ve duvar çatlakları için onarım sürüyor.',
      incidentDaysAgo: 20,
      notificationDaysAgo: 18,
      createdDaysAgo: 18,
      statusChangedHoursAgo: 72,
      lastActivityHoursAgo: 16,
      lastHumanActionHoursAgo: 14,
      slaDueOffsetHours: 36,
      amounts: { initialReserve: 48000, estimated: 53000, approved: 50000, actual: 28000, invoiced: 0, collected: 0 },
    },
    {
      fileNo: 'PLT-2026-005',
      claimNo: 'HSR-260005',
      policyNo: 'AKS-100245',
      customerEmail: 'elif.cetin@example.com',
      insuranceCode: 'AKSIGORTA_DEMO',
      statusCode: 'repair_completed',
      branchName: 'Ankara Merkez Operasyon',
      officeUser: 'officeStaff',
      fieldUser: 'fieldStaff',
      responsibleUser: 'officeStaff',
      responsibleRole: 'office_staff',
      pendingActionOwner: 'office_staff',
      priority: 'medium',
      productBranch: 'isyeri',
      lossType: 'water_damage',
      propertyType: 'ofis',
      fileType: 'ticari',
      sourceChannel: 'email',
      description: 'Sunucu odasında klima drenaj kaçağı onarıldı, kapanış evrakı bekleniyor.',
      incidentDaysAgo: 14,
      notificationDaysAgo: 13,
      createdDaysAgo: 13,
      statusChangedHoursAgo: 12,
      lastActivityHoursAgo: 8,
      lastHumanActionHoursAgo: 6,
      slaDueOffsetHours: 14,
      amounts: { initialReserve: 27000, estimated: 31500, approved: 31000, actual: 29500, invoiced: 31500, collected: 0 },
    },
    {
      fileNo: 'PLT-2026-006',
      claimNo: 'HSR-260006',
      policyNo: 'ALL-221390',
      customerEmail: 'sevgi.turan@example.com',
      insuranceCode: 'ALLIANZ_DEMO',
      statusCode: 'payment_pending',
      branchName: 'İstanbul Anadolu Operasyon',
      officeUser: 'officeLead',
      fieldUser: null,
      responsibleUser: 'financeStaff',
      responsibleRole: 'finance',
      pendingActionOwner: 'finance',
      priority: 'high',
      productBranch: 'konut',
      lossType: 'fire_damage',
      propertyType: 'apartman',
      fileType: 'konut',
      sourceChannel: 'broker',
      description: 'Yangın sonrası boya ve elektrik işleri tamamlandı, ödeme mutabakatı bekliyor.',
      incidentDaysAgo: 24,
      notificationDaysAgo: 23,
      createdDaysAgo: 23,
      statusChangedHoursAgo: 90,
      lastActivityHoursAgo: 84,
      lastHumanActionHoursAgo: 80,
      slaDueOffsetHours: -18,
      amounts: { initialReserve: 88000, estimated: 92000, approved: 90000, actual: 87400, invoiced: 90500, collected: 0 },
    },
    {
      fileNo: 'PLT-2026-007',
      claimNo: 'HSR-260007',
      policyNo: 'ANP-453022',
      customerEmail: 'orhan.kilic@example.com',
      insuranceCode: 'ANADOLU_SIGORTA_DEMO',
      statusCode: 'closed',
      branchName: 'İstanbul Anadolu Operasyon',
      officeUser: 'officeLead',
      fieldUser: 'fieldStaff',
      responsibleUser: 'officeLead',
      responsibleRole: 'office_staff',
      pendingActionOwner: 'office_staff',
      priority: 'low',
      productBranch: 'konut',
      lossType: 'storm_damage',
      propertyType: 'müstakil_ev',
      fileType: 'konut',
      sourceChannel: 'call_center',
      description: 'Dolu hasarı sonrası çatı kiremit değişimi tamamlandı ve dosya kapatıldı.',
      incidentDaysAgo: 40,
      notificationDaysAgo: 39,
      createdDaysAgo: 39,
      statusChangedHoursAgo: 180,
      lastActivityHoursAgo: 170,
      lastHumanActionHoursAgo: 168,
      slaDueOffsetHours: 12,
      closedDaysAgo: 7,
      amounts: { initialReserve: 22000, estimated: 24000, approved: 24000, actual: 22150, invoiced: 24000, collected: 24000 },
    },
    {
      fileNo: 'PLT-2026-008',
      claimNo: 'HSR-260008',
      policyNo: 'AKS-802311',
      customerEmail: 'gizem.arslan@example.com',
      insuranceCode: 'AKSIGORTA_DEMO',
      statusCode: 'closed',
      branchName: 'Ankara Merkez Operasyon',
      officeUser: 'officeStaff',
      fieldUser: 'fieldStaff',
      responsibleUser: 'officeStaff',
      responsibleRole: 'office_staff',
      pendingActionOwner: 'office_staff',
      priority: 'medium',
      productBranch: 'konut',
      lossType: 'water_damage',
      propertyType: 'daire',
      fileType: 'konut',
      sourceChannel: 'mobile_app',
      description: 'Üst kattan gelen su sızıntısı için parkeler değiştirildi, tahsilat tamamlandı.',
      incidentDaysAgo: 33,
      notificationDaysAgo: 31,
      createdDaysAgo: 31,
      statusChangedHoursAgo: 220,
      lastActivityHoursAgo: 210,
      lastHumanActionHoursAgo: 205,
      slaDueOffsetHours: 18,
      closedDaysAgo: 4,
      amounts: { initialReserve: 18000, estimated: 21000, approved: 20500, actual: 19800, invoiced: 20500, collected: 20500 },
    },
    {
      fileNo: 'PLT-2026-009',
      claimNo: 'HSR-260009',
      policyNo: 'ALL-119931',
      customerEmail: 'mustafa.erdem@example.com',
      insuranceCode: 'ALLIANZ_DEMO',
      statusCode: 'new',
      branchName: 'İstanbul Anadolu Operasyon',
      officeUser: 'officeLead',
      fieldUser: null,
      responsibleUser: 'officeLead',
      responsibleRole: 'office_staff',
      pendingActionOwner: 'office_staff',
      priority: 'high',
      productBranch: 'isyeri',
      lossType: 'vehicle_impact',
      propertyType: 'depo',
      fileType: 'ticari',
      sourceChannel: 'email',
      description: 'Forklift çarpması sonucu depo duvarı ve raf sistemi hasar aldı.',
      incidentDaysAgo: 3,
      notificationDaysAgo: 2,
      createdDaysAgo: 2,
      statusChangedHoursAgo: 8,
      lastActivityHoursAgo: 7,
      lastHumanActionHoursAgo: 5,
      slaDueOffsetHours: 16,
      amounts: { initialReserve: 41000, estimated: 47000, approved: 0, actual: 0, invoiced: 0, collected: 0 },
    },
    {
      fileNo: 'PLT-2026-010',
      claimNo: 'HSR-260010',
      policyNo: 'ANP-441289',
      customerEmail: 'elif.cetin@example.com',
      insuranceCode: 'ANADOLU_SIGORTA_DEMO',
      statusCode: 'pre_review',
      branchName: 'Ankara Merkez Operasyon',
      officeUser: 'officeStaff',
      fieldUser: null,
      responsibleUser: 'officeStaff',
      responsibleRole: 'office_staff',
      pendingActionOwner: 'office_staff',
      priority: 'medium',
      productBranch: 'konut',
      lossType: 'natural_disaster',
      propertyType: 'site_dairesi',
      fileType: 'konut',
      sourceChannel: 'call_center',
      description: 'Şiddetli yağış sonrası teras izolasyonunda açılma ve salon tavanında kabarma oluştu.',
      incidentDaysAgo: 7,
      notificationDaysAgo: 6,
      createdDaysAgo: 6,
      statusChangedHoursAgo: 14,
      lastActivityHoursAgo: 12,
      lastHumanActionHoursAgo: 10,
      slaDueOffsetHours: 8,
      amounts: { initialReserve: 30000, estimated: 36500, approved: 0, actual: 0, invoiced: 0, collected: 0 },
    },
    {
      fileNo: 'PLT-2026-011',
      claimNo: 'HSR-260011',
      policyNo: 'AKS-994512',
      customerEmail: 'sevgi.turan@example.com',
      insuranceCode: 'AKSIGORTA_DEMO',
      statusCode: 'adjuster_assigned',
      branchName: 'İstanbul Anadolu Operasyon',
      officeUser: 'officeLead',
      fieldUser: 'fieldStaff',
      responsibleUser: 'fieldStaff',
      responsibleRole: 'field_staff',
      pendingActionOwner: 'field_staff',
      priority: 'high',
      productBranch: 'konut',
      lossType: 'water_damage',
      propertyType: 'daire',
      fileType: 'konut',
      sourceChannel: 'broker',
      description: 'Alt komşuya sirayet eden banyo kaçak hasarı için ekspertiz planlandı.',
      incidentDaysAgo: 5,
      notificationDaysAgo: 4,
      createdDaysAgo: 4,
      statusChangedHoursAgo: 20,
      lastActivityHoursAgo: 18,
      lastHumanActionHoursAgo: 17,
      slaDueOffsetHours: 2,
      amounts: { initialReserve: 26000, estimated: 34000, approved: 0, actual: 0, invoiced: 0, collected: 0 },
    },
    {
      fileNo: 'PLT-2026-012',
      claimNo: 'HSR-260012',
      policyNo: 'ALL-310088',
      customerEmail: 'orhan.kilic@example.com',
      insuranceCode: 'ALLIANZ_DEMO',
      statusCode: 'repair_in_progress',
      branchName: 'Ankara Merkez Operasyon',
      officeUser: 'officeStaff',
      fieldUser: 'fieldStaff',
      responsibleUser: 'fieldStaff',
      responsibleRole: 'field_staff',
      pendingActionOwner: 'field_staff',
      priority: 'medium',
      productBranch: 'isyeri',
      lossType: 'fire_damage',
      propertyType: 'atölye',
      fileType: 'ticari',
      sourceChannel: 'email',
      description: 'Atölyede yangın sonrası elektrik pano ve boya yenileme işlemleri devam ediyor.',
      incidentDaysAgo: 17,
      notificationDaysAgo: 16,
      createdDaysAgo: 16,
      statusChangedHoursAgo: 44,
      lastActivityHoursAgo: 15,
      lastHumanActionHoursAgo: 12,
      slaDueOffsetHours: 60,
      amounts: { initialReserve: 76000, estimated: 84000, approved: 80000, actual: 46500, invoiced: 0, collected: 0 },
    },
  ];

  const claimMap = new Map<string, Awaited<ReturnType<typeof prisma.claimFile.upsert>>>();
  for (const seed of claims) {
    const customer = customerMap.get(seed.customerEmail);
    const company = insuranceMap.get(seed.insuranceCode);
    const status = statusMap.get(seed.statusCode);
    const branch = branchMap.get(seed.branchName);
    const officeUser = seed.officeUser ? userMap.get(seed.officeUser) ?? null : null;
    const fieldUser = seed.fieldUser ? userMap.get(seed.fieldUser) ?? null : null;
    const responsibleUser = userMap.get(seed.responsibleUser);
    if (!customer || !company || !status || !branch || !responsibleUser) {
      throw new Error(`Pilot claim ilişkileri eksik: ${seed.fileNo}`);
    }

    const createdAt = new Date(now.getTime() - seed.createdDaysAgo * DAY_MS);
    const incidentDate = new Date(now.getTime() - seed.incidentDaysAgo * DAY_MS);
    const notificationDate = new Date(now.getTime() - seed.notificationDaysAgo * DAY_MS);
    const statusChangedAt = new Date(now.getTime() - seed.statusChangedHoursAgo * HOUR_MS);
    const lastActivityAt = new Date(now.getTime() - seed.lastActivityHoursAgo * HOUR_MS);
    const lastHumanActionAt = new Date(now.getTime() - seed.lastHumanActionHoursAgo * HOUR_MS);
    const slaDueAt = new Date(now.getTime() + seed.slaDueOffsetHours * HOUR_MS);
    const closedAt = seed.closedDaysAgo != null ? new Date(now.getTime() - seed.closedDaysAgo * DAY_MS) : null;

    const claim = await prisma.claimFile.upsert({
      where: { fileNo: seed.fileNo },
      update: {
        claimNo: seed.claimNo,
        policyNo: seed.policyNo,
        insuranceCompanyId: company.id,
        customerId: customer.id,
        currentStatusId: status.id,
        priority: seed.priority,
        sourceChannel: seed.sourceChannel,
        productBranch: seed.productBranch,
        lossType: seed.lossType,
        propertyType: seed.propertyType,
        fileType: seed.fileType,
        description: seed.description,
        initialReserveAmount: seed.amounts.initialReserve,
        estimatedCostAmount: seed.amounts.estimated,
        approvedBudgetAmount: seed.amounts.approved,
        actualCostAmount: seed.amounts.actual,
        invoicedAmount: seed.amounts.invoiced,
        collectedAmount: seed.amounts.collected,
        profitAmount: seed.amounts.invoiced - seed.amounts.actual,
        assignedBranchId: branch.id,
        assignedOfficeUserId: officeUser?.id ?? null,
        assignedFieldUserId: fieldUser?.id ?? null,
        currentResponsibleUserId: responsibleUser.id,
        currentResponsibleRole: seed.responsibleRole,
        pendingActionOwner: seed.pendingActionOwner,
        incidentDate,
        notificationDate,
        slaDueAt,
        statusChangedAt,
        lastActivityAt,
        lastHumanActionAt,
        closedAt,
        createdAt,
      },
      create: {
        fileNo: seed.fileNo,
        claimNo: seed.claimNo,
        policyNo: seed.policyNo,
        insuranceCompanyId: company.id,
        customerId: customer.id,
        currentStatusId: status.id,
        priority: seed.priority,
        sourceChannel: seed.sourceChannel,
        productBranch: seed.productBranch,
        lossType: seed.lossType,
        propertyType: seed.propertyType,
        fileType: seed.fileType,
        description: seed.description,
        initialReserveAmount: seed.amounts.initialReserve,
        estimatedCostAmount: seed.amounts.estimated,
        approvedBudgetAmount: seed.amounts.approved,
        actualCostAmount: seed.amounts.actual,
        invoicedAmount: seed.amounts.invoiced,
        collectedAmount: seed.amounts.collected,
        profitAmount: seed.amounts.invoiced - seed.amounts.actual,
        assignedBranchId: branch.id,
        assignedOfficeUserId: officeUser?.id ?? null,
        assignedFieldUserId: fieldUser?.id ?? null,
        currentResponsibleUserId: responsibleUser.id,
        currentResponsibleRole: seed.responsibleRole,
        pendingActionOwner: seed.pendingActionOwner,
        incidentDate,
        notificationDate,
        slaDueAt,
        statusChangedAt,
        lastActivityAt,
        lastHumanActionAt,
        closedAt,
        createdAt,
      },
    });
    claimMap.set(seed.fileNo, claim);
  }

  const noteSeeds = [
    { fileNo: 'PLT-2026-001', author: 'officeLead' as const, noteType: 'customer_update', content: 'Müşteri ile görüşüldü, eksper öncesi hasarlı alan fotoğrafları talep edildi.' },
    { fileNo: 'PLT-2026-002', author: 'branchManager' as const, noteType: 'escalation', content: 'SLA eşiği aşıldı, ofis ekibinden aynı gün eksper yönlendirmesi istendi.' },
    { fileNo: 'PLT-2026-005', author: 'officeStaff' as const, noteType: 'completion', content: 'Onarım tamamlandı, kapanış faturası ve teslim tutanağı yüklendi.' },
    { fileNo: 'PLT-2026-006', author: 'financeStaff' as const, noteType: 'finance_followup', content: 'Fatura vadesi geçti, sigorta şirketi muhasebesi ile ödeme planı görüşüldü.' },
    { fileNo: 'PLT-2026-012', author: 'fieldStaff' as const, noteType: 'site_update', content: 'Atölye elektrik hattı yenilemesi yüzde 60 tamamlandı, yarın boya ekibi sahada olacak.' },
  ];

  for (const seed of noteSeeds) {
    const claim = claimMap.get(seed.fileNo);
    const author = userMap.get(seed.author);
    if (!claim || !author) continue;
    const existing = await prisma.note.findFirst({
      where: {
        claimFileId: claim.id,
        authorUserId: author.id,
        content: seed.content,
      },
    });
    if (!existing) {
      await prisma.note.create({
        data: {
          claimFileId: claim.id,
          authorUserId: author.id,
          noteType: seed.noteType,
          content: seed.content,
          isPrivate: false,
        },
      });
    }
  }

  const documentSeeds = [
    { fileNo: 'PLT-2026-001', uploadedBy: 'officeLead' as const, fileName: 'hasar-fotograflari-001.pdf', storageKey: 'pilot/PLT-2026-001/hasar-fotograflari-001.pdf' },
    { fileNo: 'PLT-2026-005', uploadedBy: 'officeStaff' as const, fileName: 'teslim-tutanagi-005.pdf', storageKey: 'pilot/PLT-2026-005/teslim-tutanagi-005.pdf' },
    { fileNo: 'PLT-2026-006', uploadedBy: 'financeStaff' as const, fileName: 'fatura-mutabakat-006.pdf', storageKey: 'pilot/PLT-2026-006/fatura-mutabakat-006.pdf' },
    { fileNo: 'PLT-2026-012', uploadedBy: 'fieldStaff' as const, fileName: 'saha-raporu-012.jpg', storageKey: 'pilot/PLT-2026-012/saha-raporu-012.jpg' },
  ];

  for (const seed of documentSeeds) {
    const claim = claimMap.get(seed.fileNo);
    const uploader = userMap.get(seed.uploadedBy);
    if (!claim || !uploader) continue;
    const existing = await prisma.fileAsset.findFirst({
      where: {
        ownerType: 'claim_file',
        ownerId: claim.id,
        storageKey: seed.storageKey,
      },
    });
    if (!existing) {
      await prisma.fileAsset.create({
        data: {
          ownerType: 'claim_file',
          ownerId: claim.id,
          fileName: seed.fileName,
          fileExtension: seed.fileName.split('.').pop() ?? 'pdf',
          mimeType: seed.fileName.endsWith('.jpg') ? 'image/jpeg' : 'application/pdf',
          fileSize: seed.fileName.endsWith('.jpg') ? 845312 : 221184,
          storageKey: seed.storageKey,
          category: 'pilot_demo',
          uploadedByUserId: uploader.id,
        },
      });
    }
  }

  const taskSeeds = [
    { fileNo: 'PLT-2026-001', taskType: 'document_collection', title: 'Eksper öncesi fotoğraf setini tamamla', description: 'Eksik mutfak dolabı ve alt kat tavan fotoğrafları toplanacak.', priority: 'high', status: 'pending', assignedUser: 'officeLead' as const, dueDaysOffset: -1 },
    { fileNo: 'PLT-2026-002', taskType: 'expert_assignment', title: 'Yangın dosyasına ekspertiz planla', description: 'Kurumsal poliçe için ilk keşif randevusu oluşturulacak.', priority: 'critical', status: 'pending', assignedUser: 'branchManager' as const, dueDaysOffset: -2 },
    { fileNo: 'PLT-2026-003', taskType: 'site_visit', title: 'Çatı keşif raporunu sisteme gir', description: 'Fırtına kaynaklı çatı hasarı için fotoğraf ve keşif notları işlenecek.', priority: 'high', status: 'in_progress', assignedUser: 'fieldStaff' as const, dueDaysOffset: 1 },
    { fileNo: 'PLT-2026-005', taskType: 'closure', title: 'Kapanış evrakını kontrol et', description: 'Teslim tutanağı ve müşteri onayı finans öncesi teyit edilecek.', priority: 'medium', status: 'completed', assignedUser: 'officeStaff' as const, dueDaysOffset: -3 },
    { fileNo: 'PLT-2026-006', taskType: 'collection_followup', title: 'Geciken ödeme için muhasebe takibi yap', description: 'Sigorta şirketi ödeme planı ve dekont tarihi netleştirilecek.', priority: 'critical', status: 'pending', assignedUser: 'financeStaff' as const, dueDaysOffset: -4 },
    { fileNo: 'PLT-2026-011', taskType: 'appointment', title: 'Yerinde keşif saatini müşteriyle teyit et', description: 'Eksper ve saha personeli için ortak saat belirlenecek.', priority: 'medium', status: 'pending', assignedUser: 'officeLead' as const, dueDaysOffset: 0 },
    { fileNo: 'PLT-2026-012', taskType: 'repair_tracking', title: 'Elektrik malzeme tedarikini doğrula', description: 'Atölye pano malzemeleri ve boya tedarik teslimatı kontrol edilecek.', priority: 'medium', status: 'in_progress', assignedUser: 'fieldStaff' as const, dueDaysOffset: 2 },
  ];

  for (const seed of taskSeeds) {
    const claim = claimMap.get(seed.fileNo);
    const assignedUser = userMap.get(seed.assignedUser);
    if (!claim || !assignedUser) continue;
    const dueAt = new Date(now.getTime() + seed.dueDaysOffset * DAY_MS);
    const existing = await prisma.task.findFirst({
      where: {
        claimFileId: claim.id,
        title: seed.title,
      },
    });
    if (existing) {
      await prisma.task.update({
        where: { id: existing.id },
        data: {
          taskType: seed.taskType,
          description: seed.description,
          priority: seed.priority,
          status: seed.status,
          assignedUserId: assignedUser.id,
          dueAt,
          completedAt: seed.status === 'completed' ? new Date(now.getTime() - DAY_MS) : null,
        },
      });
    } else {
      await prisma.task.create({
        data: {
          claimFileId: claim.id,
          taskType: seed.taskType,
          title: seed.title,
          description: seed.description,
          priority: seed.priority,
          status: seed.status,
          assignedUserId: assignedUser.id,
          dueAt,
          completedAt: seed.status === 'completed' ? new Date(now.getTime() - DAY_MS) : null,
        },
      });
    }
  }

  const invoiceSeeds = [
    { fileNo: 'PLT-2026-004', invoiceNo: 'INV-PLT-001', invoiceType: 'sales', counterpartyType: 'insurance_company', status: 'sent', totalAmount: 29500, dueDaysOffset: 5, invoiceDaysAgo: 3, creator: 'financeStaff' as const, notes: 'Kısmi iş ilerleme faturası.' },
    { fileNo: 'PLT-2026-005', invoiceNo: 'INV-PLT-002', invoiceType: 'sales', counterpartyType: 'insurance_company', status: 'pending', totalAmount: 31500, dueDaysOffset: 2, invoiceDaysAgo: 2, creator: 'financeStaff' as const, notes: 'Kapanış evrakı sonrası ödeme bekleniyor.' },
    { fileNo: 'PLT-2026-006', invoiceNo: 'INV-PLT-003', invoiceType: 'sales', counterpartyType: 'insurance_company', status: 'overdue', totalAmount: 90500, dueDaysOffset: -6, invoiceDaysAgo: 14, creator: 'financeStaff' as const, notes: 'Vadesi geçti, ödeme hatırlatması gönderildi.' },
    { fileNo: 'PLT-2026-007', invoiceNo: 'INV-PLT-004', invoiceType: 'sales', counterpartyType: 'insurance_company', status: 'paid', totalAmount: 24000, dueDaysOffset: -10, invoiceDaysAgo: 20, creator: 'financeStaff' as const, notes: 'Tahsilat tamamlandı.' },
    { fileNo: 'PLT-2026-008', invoiceNo: 'INV-PLT-005', invoiceType: 'sales', counterpartyType: 'insurance_company', status: 'paid', totalAmount: 20500, dueDaysOffset: -7, invoiceDaysAgo: 18, creator: 'financeStaff' as const, notes: 'Tam tahsil edildi.' },
    { fileNo: 'PLT-2026-010', invoiceNo: 'INV-PLT-006', invoiceType: 'purchase', counterpartyType: 'vendor', status: 'draft', totalAmount: 12800, dueDaysOffset: 9, invoiceDaysAgo: 1, creator: 'financeStaff' as const, notes: 'İzolasyon tedarikçisi ön ödeme faturası.' },
    { fileNo: 'PLT-2026-011', invoiceNo: 'INV-PLT-007', invoiceType: 'sales', counterpartyType: 'insurance_company', status: 'partial', totalAmount: 34000, dueDaysOffset: -2, invoiceDaysAgo: 9, creator: 'financeStaff' as const, notes: 'Kısmi ödeme alındı.' },
    { fileNo: 'PLT-2026-012', invoiceNo: 'INV-PLT-008', invoiceType: 'sales', counterpartyType: 'insurance_company', status: 'overdue', totalAmount: 50200, dueDaysOffset: -3, invoiceDaysAgo: 11, creator: 'financeStaff' as const, notes: 'Atölye onarım faturası için vade aşıldı.' },
  ];

  const invoiceMap = new Map<string, Awaited<ReturnType<typeof prisma.invoice.upsert>>>();
  for (const seed of invoiceSeeds) {
    const claim = claimMap.get(seed.fileNo);
    const createdBy = userMap.get(seed.creator);
    if (!claim || !createdBy) continue;
    const invoiceDate = new Date(now.getTime() - seed.invoiceDaysAgo * DAY_MS);
    const dueDate = new Date(now.getTime() + seed.dueDaysOffset * DAY_MS);
    const subtotalAmount = Number((seed.totalAmount / 1.2).toFixed(2));
    const vatAmount = Number((seed.totalAmount - subtotalAmount).toFixed(2));
    const invoice = await prisma.invoice.upsert({
      where: { invoiceNo: seed.invoiceNo },
      update: {
        claimFileId: claim.id,
        invoiceType: seed.invoiceType,
        counterpartyType: seed.counterpartyType,
        counterpartyId: claim.insuranceCompanyId,
        invoiceDate,
        dueDate,
        subtotalAmount,
        vatAmount,
        withholdingAmount: 0,
        totalAmount: seed.totalAmount,
        status: seed.status,
        createdByUserId: createdBy.id,
        notes: seed.notes,
      },
      create: {
        claimFileId: claim.id,
        invoiceType: seed.invoiceType,
        invoiceNo: seed.invoiceNo,
        invoiceDate,
        dueDate,
        counterpartyType: seed.counterpartyType,
        counterpartyId: claim.insuranceCompanyId,
        subtotalAmount,
        vatAmount,
        withholdingAmount: 0,
        totalAmount: seed.totalAmount,
        status: seed.status,
        createdByUserId: createdBy.id,
        notes: seed.notes,
      },
    });
    invoiceMap.set(seed.invoiceNo, invoice);
  }

  const paymentSeeds = [
    { referenceNo: 'PAY-PLT-001', fileNo: 'PLT-2026-007', invoiceNo: 'INV-PLT-004', paymentType: 'incoming', amount: 24000, status: 'completed', paymentDaysAgo: 8, creator: 'financeStaff' as const, method: 'eft', note: 'Tam tahsilat alındı.' },
    { referenceNo: 'PAY-PLT-002', fileNo: 'PLT-2026-008', invoiceNo: 'INV-PLT-005', paymentType: 'incoming', amount: 20500, status: 'completed', paymentDaysAgo: 5, creator: 'financeStaff' as const, method: 'havale', note: 'Tahsilat tamamlandı.' },
    { referenceNo: 'PAY-PLT-003', fileNo: 'PLT-2026-011', invoiceNo: 'INV-PLT-007', paymentType: 'incoming', amount: 12000, status: 'completed', paymentDaysAgo: 3, creator: 'financeStaff' as const, method: 'eft', note: 'Kısmi tahsilat.' },
    { referenceNo: 'PAY-PLT-004', fileNo: 'PLT-2026-006', invoiceNo: 'INV-PLT-003', paymentType: 'incoming', amount: 0, status: 'pending', paymentDaysAgo: 1, creator: 'financeStaff' as const, method: 'eft', note: 'Tahsilat tarihi bekleniyor.' },
    { referenceNo: 'PAY-PLT-005', fileNo: 'PLT-2026-004', invoiceNo: 'INV-PLT-001', paymentType: 'outgoing', amount: 15000, status: 'completed', paymentDaysAgo: 2, creator: 'financeStaff' as const, method: 'eft', note: 'Tedarikçiye avans ödemesi yapıldı.' },
    { referenceNo: 'PAY-PLT-006', fileNo: 'PLT-2026-005', invoiceNo: 'INV-PLT-002', paymentType: 'incoming', amount: 0, status: 'pending', paymentDaysAgo: 0, creator: 'financeStaff' as const, method: 'eft', note: 'Ödeme onayı bekliyor.' },
  ];

  for (const seed of paymentSeeds) {
    const claim = claimMap.get(seed.fileNo);
    const invoice = invoiceMap.get(seed.invoiceNo);
    const creator = userMap.get(seed.creator);
    if (!claim || !creator) continue;
    const existing = await prisma.payment.findFirst({
      where: { referenceNo: seed.referenceNo },
    });
    const paymentDate = new Date(now.getTime() - seed.paymentDaysAgo * DAY_MS);
    if (existing) {
      await prisma.payment.update({
        where: { id: existing.id },
        data: {
          claimFileId: claim.id,
          invoiceId: invoice?.id ?? null,
          paymentType: seed.paymentType,
          paymentDate,
          amount: seed.amount,
          method: seed.method,
          payerType: seed.paymentType === 'incoming' ? 'insurance_company' : 'vendor',
          payerId: claim.insuranceCompanyId,
          status: seed.status,
          createdByUserId: creator.id,
          note: seed.note,
        },
      });
    } else {
      await prisma.payment.create({
        data: {
          claimFileId: claim.id,
          invoiceId: invoice?.id ?? null,
          paymentType: seed.paymentType,
          paymentDate,
          amount: seed.amount,
          method: seed.method,
          payerType: seed.paymentType === 'incoming' ? 'insurance_company' : 'vendor',
          payerId: claim.insuranceCompanyId,
          referenceNo: seed.referenceNo,
          status: seed.status,
          createdByUserId: creator.id,
          note: seed.note,
        },
      });
    }
  }

  const historySeeds = [
    { fileNo: 'PLT-2026-001', toStatus: 'new', user: 'officeLead' as const, changedHoursAgo: 120, note: 'Dosya açıldı.' },
    { fileNo: 'PLT-2026-002', toStatus: 'pre_review', user: 'branchManager' as const, changedHoursAgo: 96, note: 'Ön inceleme başlatıldı.' },
    { fileNo: 'PLT-2026-003', toStatus: 'adjuster_assigned', user: 'officeStaff' as const, changedHoursAgo: 48, note: 'Eksper ataması tamamlandı.' },
    { fileNo: 'PLT-2026-004', toStatus: 'repair_in_progress', user: 'fieldStaff' as const, changedHoursAgo: 36, note: 'Onarım sahada başladı.' },
    { fileNo: 'PLT-2026-005', toStatus: 'repair_completed', user: 'officeStaff' as const, changedHoursAgo: 10, note: 'Onarım tamamlandı.' },
    { fileNo: 'PLT-2026-006', toStatus: 'payment_pending', user: 'financeStaff' as const, changedHoursAgo: 6, note: 'Ödeme tahsilatı bekleniyor.' },
    { fileNo: 'PLT-2026-007', toStatus: 'closed', user: 'officeLead' as const, changedHoursAgo: 4, note: 'Dosya kapatıldı.' },
    { fileNo: 'PLT-2026-008', toStatus: 'closed', user: 'officeStaff' as const, changedHoursAgo: 3, note: 'Tahsilat tamamlanınca kapatıldı.' },
  ];

  for (const seed of historySeeds) {
    const claim = claimMap.get(seed.fileNo);
    const user = userMap.get(seed.user);
    const toStatus = statusMap.get(seed.toStatus);
    if (!claim || !user || !toStatus) continue;
    const changedAt = new Date(now.getTime() - seed.changedHoursAgo * HOUR_MS);
    const existing = await prisma.claimStatusHistory.findFirst({
      where: {
        claimFileId: claim.id,
        toStatusId: toStatus.id,
        changedByUserId: user.id,
        note: seed.note,
      },
    });
    if (!existing) {
      await prisma.claimStatusHistory.create({
        data: {
          claimFileId: claim.id,
          toStatusId: toStatus.id,
          changedByUserId: user.id,
          changedAt,
          note: seed.note,
        },
      });
    }
  }

  console.log('✅ Pilot operation demo data hazır');
}