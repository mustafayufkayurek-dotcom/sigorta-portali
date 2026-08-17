import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { departmentToMeridyenType } from '@/common/utils/file-subject-meridyen-branch';
import * as nodemailer from 'nodemailer';

export interface MailConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  security: 'SSL' | 'TLS' | 'None';
  fromName: string;
  fromEmail: string;
}

export interface TurmobConfig {
  apiUrl: string;
  apiKey: string;
  username: string;
  password: string;
  active: boolean;
}

// Varsayılan müşteri alanı yapılandırması
const DEFAULT_CUSTOMER_FIELDS = [
  { key: 'phone', label: 'Telefon', required: true, visible: true },
  { key: 'identityNo', label: 'TC Kimlik No', required: false, visible: true },
  { key: 'taxNumber', label: 'Vergi No', required: false, visible: true },
  { key: 'email', label: 'E-posta', required: false, visible: true },
];

const DEFAULT_VENDOR_TYPES = ['Taşeron', 'Malzeme Tedarikçisi', 'Lojistik', 'Ekipman', 'Diğer'];

const DEFAULT_LOCATION_FIELDS = {
  code: { required: true },
  name: { required: true },
  description: { required: false },
  sortOrder: { required: false },
};

const DEFAULT_WORK_GROUP_FIELDS = {
  code: { required: true },
  name: { required: true },
  description: { required: false },
  unit: { required: false },
  sortOrder: { required: false },
};

const DEFAULT_WORK_SUB_GROUP_FIELDS = {
  code: { required: true },
  name: { required: true },
  description: { required: false },
  unitType: { required: true },
  unitPrice: { required: false },
  sortOrder: { required: false },
};

const DEFAULT_UNIT_OPTIONS = ['m²', 'adet', 'metre', 'saat', 'kg', 'ton'];

const DEFAULT_CUSTOMER_SOURCES = [
  'Sigorta Şirketi Yönlendirmesi',
  'Referans',
  'Web',
  'Tekrar Gelen Müşteri',
];

export interface RelationshipType {
  label: string;
  active: boolean;
  usageAreas?: ('musteri' | 'eksper' | 'tedarikci' | 'dosya')[];
}

const DEFAULT_RELATIONSHIP_TYPES: RelationshipType[] = [
  { label: 'Sekreter', active: true, usageAreas: ['musteri'] },
  { label: 'Ofis Müdürü', active: true, usageAreas: ['musteri', 'tedarikci'] },
  { label: 'Saha Sorumlusu', active: true, usageAreas: ['tedarikci'] },
  { label: 'Muhasebeci', active: true, usageAreas: ['musteri', 'tedarikci'] },
  { label: 'Aile Üyesi', active: true, usageAreas: ['musteri'] },
  { label: 'Vekil', active: true, usageAreas: ['musteri', 'dosya'] },
  { label: 'Diğer', active: true, usageAreas: ['musteri', 'eksper', 'tedarikci', 'dosya'] },
];

export interface HrLeaveTypeOption {
  code: string;
  label: string;
  active: boolean;
}

const DEFAULT_HR_LEAVE_TYPES: HrLeaveTypeOption[] = [
  { code: 'annual', label: 'Yıllık İzin', active: true },
  { code: 'sick', label: 'Hastalık İzni', active: true },
  { code: 'unpaid', label: 'Ücretsiz İzin', active: true },
  { code: 'other', label: 'Diğer', active: true },
];

/** Zimmet demirbaş kategorileri — Ayarlar → Tanımlar → Personel */
export type HrAssetCategoryOption = HrLeaveTypeOption;

const DEFAULT_HR_ASSET_CATEGORIES: HrAssetCategoryOption[] = [
  { code: 'phone', label: 'Cep Telefonu', active: true },
  { code: 'laptop', label: 'Dizüstü', active: true },
  { code: 'tablet', label: 'Tablet', active: true },
  { code: 'other', label: 'Diğer', active: true },
];

const DEFAULT_SERVICE_TYPES = [
  'Hasar Onarım',
  'Restorasyon',
  'Güneş Enerjisi Onarım',
  'Sovtaj',
  'İş Makinası İade Parça',
  'Elektronik İade Parça',
  'Danışmanlık',
  'Tadilat',
  'Bakım',
  'Montaj',
  'Diğer',
];

export interface IhbarKonulari {
  hasar: string[];
  acil: string[];
}

const DEFAULT_IHBAR_KONULARI: IhbarKonulari = {
  hasar: [
    'Konut Yangın',
    'Endüstriyel Yangın',
    'Dahili Su',
    'Hırsızlık',
    'Cam Kırılması',
    'Doğal Afet',
    'Sel',
    'Fırtına',
    'Deprem',
    'Makine Kırılması',
    'Elektronik Cihaz',
    'Diğer',
  ],
  acil: [
    'Su Baskını',
    'Çatı Hasarı',
    'Cam Kırılması',
    'Kapı/Kilit Arızası',
    'Elektrik Arızası',
    'Doğalgaz Arızası',
    'Yangın Hasarı',
    'Hırsızlık/Güvenlik',
    'Boru Patlaması',
    'Asansör Arızası',
    'Diğer',
  ],
};

export interface CustomerSubType {
  value: string;   // slug / API değeri (örn. 'insured')
  label: string;   // görünen isim (örn. 'Sigortalı')
  forType: 'individual' | 'corporate' | 'both'; // hangi müşteri tipine ait
  color: 'orange' | 'green' | 'purple' | 'blue' | 'gray'; // badge rengi
}

const DEFAULT_CUSTOMER_SUB_TYPES: CustomerSubType[] = [
  { value: 'sigorta_sirketi',  label: 'Sigorta Şirketi',  forType: 'corporate',  color: 'blue'   },
  { value: 'broker_firmasi',   label: 'Broker Firması',   forType: 'corporate',  color: 'gray'   },
  { value: 'asistan_firmasi',  label: 'Asistan Firması',  forType: 'corporate',  color: 'orange' },
  { value: 'eksper_firmasi',   label: 'Eksper Firması',   forType: 'corporate',  color: 'purple' },
  { value: 'insured',          label: 'Sigortalı',        forType: 'both',       color: 'orange' },
  { value: 'private_customer', label: 'Özel Müşteri',     forType: 'individual', color: 'green'  },
];

function mergeCustomerSubTypes(stored: CustomerSubType[]): CustomerSubType[] {
  const byValue = new Map(stored.map((row) => [row.value, { ...row }]));
  for (const def of DEFAULT_CUSTOMER_SUB_TYPES) {
    const existing = byValue.get(def.value);
    if (!existing) {
      byValue.set(def.value, { ...def });
    } else {
      byValue.set(def.value, { ...existing, label: def.label, forType: def.forType, color: def.color });
    }
  }
  byValue.delete('eksper');
  return DEFAULT_CUSTOMER_SUB_TYPES.map((def) => byValue.get(def.value)).filter(Boolean) as CustomerSubType[];
}

export interface FieldInspectionBranch {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
}

export interface ExpertInsuranceLink {
  expertCustomerId: string;
  insuranceCompanyId: string;
}

export interface ExpertInsuranceLinksConfig {
  links: ExpertInsuranceLink[];
}

const DEFAULT_SAHA_TESPIT_KOLLARI: FieldInspectionBranch[] = [
  { id: 'tespit-hasar', name: 'Hasar Tespiti', isActive: true, sortOrder: 10 },
  { id: 'tespit-kesif', name: 'Saha Keşfi', isActive: true, sortOrder: 20 },
  { id: 'tespit-ozel', name: 'Özel Talep Tespiti', isActive: true, sortOrder: 30 },
  { id: 'tespit-on', name: 'Ön İnceleme', isActive: true, sortOrder: 40 },
];

export interface TespitAlaniEntry {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
}

const DEFAULT_TESPIT_ALANLARI: TespitAlaniEntry[] = [
  { id: 'tespit-alan-sigortali-konut', name: 'Sigortalı Konut', isActive: true, sortOrder: 10 },
  { id: 'tespit-alan-ortak', name: 'Ortak Alan', isActive: true, sortOrder: 20 },
  { id: 'tespit-alan-depo', name: 'Depo', isActive: true, sortOrder: 30 },
  { id: 'tespit-alan-dukkkan', name: 'Dükkan', isActive: true, sortOrder: 40 },
  { id: 'tespit-alan-ofis', name: 'Ofis', isActive: true, sortOrder: 50 },
];

export interface FieldRequirementsConfig {
  customerSubTypeRequired: boolean;
}

export interface DocumentReportTemplate {
  id: string;
  name: string;
  type: 'tespit' | 'maliyet' | 'kesif' | 'hasar';
  description?: string;
  content: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ContractTemplate {
  id: string;
  name: string;
  type: 'tedarikci' | 'musteri' | 'gizlilik' | 'kvkk';
  description?: string;
  content: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyInfo {
  name: string;
  logoUrl?: string;
  address?: string;
  phone?: string;
  email?: string;
  taxNumber?: string;
  tradeRegistryNo?: string;
  website?: string;
  /** KVKK başvuru e-postası; boşsa email kullanılır */
  kvkkEmail?: string;
  /** Sözleşmelerde geçen uygulama adresi */
  appUrl?: string;
  /** Bordro / iş sözleşmesi işvereni (ör. Safran Birleşik Hizmetler) */
  payrollEmployerName?: string;
  payrollEmployerAddress?: string;
  payrollEmployerTaxNumber?: string;
  /** true ise sözleşmelere bordro işvereni bilgilendirme maddesi eklenir */
  payrollEmployerEnabled?: boolean;
  payrollEmployerTradeRegistryNo?: string;
  payrollEmployerPhone?: string;
  payrollEmployerEmail?: string;
  /** Puantaj mali müşavir gönderiminde varsayılan alıcı */
  accountantEmail?: string;
}

export interface SmsConfig {
  provider: 'netgsm' | 'iletimerkezi' | 'other';
  apiKey: string;
  apiSecret?: string;
  senderId: string;
  active: boolean;
}

export interface IntegrationConfig {
  logoWings: {
    apiUrl: string;
    apiKey: string;
    username: string;
    password: string;
    active: boolean;
  };
  googlePlaces?: {
    apiKey: string;
    active: boolean;
  };
}

export interface M365GraphConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  ihbarMailbox: string;
  hasarMailbox: string;
  active: boolean;
  lastTestAt?: string;
  lastTestSuccess?: boolean;
  lastTestMessage?: string;
}

const DEFAULT_COMPANY_INFO: CompanyInfo = {
  name: '',
  logoUrl: '',
  address: '',
  phone: '',
  email: '',
  taxNumber: '',
  tradeRegistryNo: '',
  website: '',
  kvkkEmail: '',
  appUrl: 'https://app.meridyen-tr.com',
  payrollEmployerName: '',
  payrollEmployerAddress: '',
  payrollEmployerTaxNumber: '',
  payrollEmployerEnabled: false,
  payrollEmployerTradeRegistryNo: '',
  payrollEmployerPhone: '',
  payrollEmployerEmail: '',
  accountantEmail: '',
};

export interface SystemConfig {
  currency: string;
  dateFormat: string;
  language: string;
  maxFileSizeMb: number;
  timezone: string;
}

const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
  currency: 'TRY',
  dateFormat: 'DD.MM.YYYY',
  language: 'tr',
  maxFileSizeMb: 10,
  timezone: 'Europe/Istanbul',
};

export interface NotificationSettings {
  emailEnabled: boolean;
  notifications: {
    key: string;
    label: string;
    enabled: boolean;
  }[];
  signalRules?: {
    key: string;
    name: string;
    area: 'operasyon' | 'finans' | 'sistem' | 'gorev';
    level: 'bilgi' | 'uyari' | 'kritik';
    trigger: string;
    targetRoles: string[];
    channels: {
      inApp: boolean;
      telegram: boolean;
      email: boolean;
    };
    repeatPolicy: string;
    active: boolean;
  }[];
}

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  emailEnabled: true,
  notifications: [
    { key: 'file_assigned', label: 'Dosya Atama', enabled: true },
    { key: 'appointment_reminder', label: 'Randevu Hatırlatma', enabled: true },
    { key: 'report_approval', label: 'Rapor Onay', enabled: true },
    { key: 'invoice_notification', label: 'Fatura Bildirimi', enabled: true },
    { key: 'file_opened', label: 'Dosya Açıldı', enabled: false },
    { key: 'file_closed', label: 'Dosya Kapatıldı', enabled: false },
    { key: 'revision_requested', label: 'Revizyon Talep', enabled: true },
    { key: 'payment_received', label: 'Ödeme Alındı', enabled: false },
  ],
  signalRules: [
    {
      key: 'disk_critical',
      name: 'Disk alanı kritik seviyede',
      area: 'sistem',
      level: 'kritik',
      trigger: 'Disk kullanımı yüzde 95 ve üzerine çıktığında',
      targetRoles: ['Sistem Yöneticisi'],
      channels: { inApp: false, telegram: true, email: false },
      repeatPolicy: 'Durum değişince ve günlük özet içinde',
      active: true,
    },
    {
      key: 'api_unhealthy',
      name: 'API sağlık kontrolü başarısız',
      area: 'sistem',
      level: 'kritik',
      trigger: 'API sağlık kontrolü başarısız olduğunda',
      targetRoles: ['Sistem Yöneticisi'],
      channels: { inApp: false, telegram: true, email: false },
      repeatPolicy: 'Durum değişince',
      active: true,
    },
    {
      key: 'sla_risk',
      name: 'SLA riski oluştu',
      area: 'operasyon',
      level: 'uyari',
      trigger: 'Dosya hedef süresine yaklaştığında',
      targetRoles: ['Operasyon', 'Sistem Yöneticisi'],
      channels: { inApp: true, telegram: false, email: false },
      repeatPolicy: 'Günlük özet ve dosya kartı üzerinde',
      active: true,
    },
    {
      key: 'overdue_collection',
      name: 'Geciken tahsilat',
      area: 'finans',
      level: 'uyari',
      trigger: 'Vadesi geçen tahsilat kaydı oluştuğunda',
      targetRoles: ['Finans', 'Sistem Yöneticisi'],
      channels: { inApp: true, telegram: false, email: false },
      repeatPolicy: 'Günlük özet ve finans ekranı üzerinde',
      active: true,
    },
    {
      key: 'hr_attendance_month_close',
      name: 'Puantaj ay kapanış hatırlatması',
      area: 'operasyon',
      level: 'uyari',
      trigger: 'Ayın son 6 günü ve takip eden ayın ilk 5 günü',
      targetRoles: ['İK', 'Finans Süreç Sorumlusu', 'Sistem Yöneticisi'],
      channels: { inApp: true, telegram: false, email: true },
      repeatPolicy: 'Günde bir kez; eksik onay/kilit varsa tekrarlar',
      active: true,
    },
    {
      key: 'pending_task',
      name: 'Bekleyen görev veya aksiyon',
      area: 'gorev',
      level: 'bilgi',
      trigger: 'Sorumlu kişiye atanmış açık görev bulunduğunda',
      targetRoles: ['Operasyon', 'Sistem Yöneticisi'],
      channels: { inApp: true, telegram: false, email: false },
      repeatPolicy: 'Kullanıcı ekranında sürekli görünür',
      active: true,
    },
  ],
};

const DEFAULT_DOCUMENT_REPORT_TEMPLATES: DocumentReportTemplate[] = [
  {
    id: 'tpl-tespit-001',
    name: 'Standart Tespit Raporu',
    type: 'tespit',
    description: 'Hasar tespitine yönelik standart rapor şablonu',
    content: '<h2>TESPİT RAPORU</h2>\n<p><strong>Dosya No:</strong> {dosyaNo}</p>\n<p><strong>Sigortalı:</strong> {musteriAdi}</p>\n<p><strong>Hasar Adresi:</strong> {hasarAdresi}</p>\n<hr/>\n<h3>Tespit Bilgileri</h3>\n<p>{tespitBilgileri}</p>',
    isActive: true,
    sortOrder: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tpl-maliyet-001',
    name: 'Standart Maliyet Raporu',
    type: 'maliyet',
    description: 'Hasar maliyet hesaplama rapor şablonu',
    content: '<h2>MALİYET RAPORU</h2>\n<p><strong>Dosya No:</strong> {dosyaNo}</p>\n<p><strong>Sigortalı:</strong> {musteriAdi}</p>\n<hr/>\n<h3>İş Kalemleri</h3>\n<p>{isKalemleri}</p>\n<p><strong>Toplam Tutar:</strong> {toplamTutar}</p>',
    isActive: true,
    sortOrder: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tpl-kesif-001',
    name: 'Standart Keşif Raporu',
    type: 'kesif',
    description: 'Saha keşif raporu şablonu',
    content: '<h2>KEŞİF RAPORU</h2>\n<p><strong>Dosya No:</strong> {dosyaNo}</p>\n<p><strong>Sigortalı:</strong> {musteriAdi}</p>\n<p><strong>Keşif Tarihi:</strong> {kesifTarihi}</p>\n<hr/>\n<h3>Keşif Bulguları</h3>\n<p>{kesifBulgulari}</p>',
    isActive: true,
    sortOrder: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tpl-hasar-001',
    name: 'Standart Hasar Raporu',
    type: 'hasar',
    description: 'Hasar değerlendirme rapor şablonu',
    content: '<h2>HASAR RAPORU</h2>\n<p><strong>Dosya No:</strong> {dosyaNo}</p>\n<p><strong>Sigortalı:</strong> {musteriAdi}</p>\n<p><strong>Sigorta Şirketi:</strong> {sigortaSirketi}</p>\n<hr/>\n<h3>Hasar Değerlendirmesi</h3>\n<p>{hasarDegerlendirmesi}</p>',
    isActive: true,
    sortOrder: 4,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const DEFAULT_CONTRACT_TEMPLATES: ContractTemplate[] = [
  {
    id: 'ctr-tedarikci-001',
    name: 'Standart Tedarikçi Sözleşmesi',
    type: 'tedarikci',
    description: 'Tedarikçilerle yapılan standart sözleşme şablonu',
    content: '<h2>TEDARİKÇİ SÖZLEŞMESİ</h2>\n<p>Bu sözleşme, <strong>{{tedarikci_ad}}</strong> ile şirketimiz arasında akdedilmiştir.</p>\n<p><strong>Sözleşme No:</strong> {{sozlesme_no}}</p>\n<p><strong>Tarih:</strong> {{sozlesme_tarihi}}</p>',
    isActive: true,
    sortOrder: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ctr-musteri-001',
    name: 'Standart Müşteri Sözleşmesi',
    type: 'musteri',
    description: 'Müşterilerle yapılan hizmet sözleşmesi şablonu',
    content: '<h2>MÜŞTERİ HİZMET SÖZLEŞMESİ</h2>\n<p>Bu sözleşme, <strong>{{sigorta_musteri_ad}}</strong> ile şirketimiz arasında akdedilmiştir.</p>\n<p><strong>Dosya No:</strong> {{dosya_no}}</p>\n<p><strong>Tarih:</strong> {{sozlesme_tarihi}}</p>',
    isActive: true,
    sortOrder: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ctr-gizlilik-001',
    name: 'Gizlilik Sözleşmesi (NDA)',
    type: 'gizlilik',
    description: 'Gizlilik anlaşması şablonu',
    content: '<h2>GİZLİLİK SÖZLEŞMESİ</h2>\n<p>Bu Gizlilik Sözleşmesi, taraflar arasındaki gizli bilgilerin korunmasına ilişkin hükümleri düzenlemektedir.</p>\n<p><strong>Tarih:</strong> {{sozlesme_tarihi}}</p>',
    isActive: true,
    sortOrder: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ctr-kvkk-001',
    name: 'KVKK Aydınlatma Metni',
    type: 'kvkk',
    description: 'KVKK kapsamında aydınlatma metni şablonu',
    content: '<h2>KİŞİSEL VERİLERİN KORUNMASI KANUNU AYDINLATMA METNİ</h2>\n<p>6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında kişisel verileriniz işlenmektedir.</p>',
    isActive: true,
    sortOrder: 4,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// ── Pazartesi Toplantısı Notları ─────────────────────────────────────────────

export interface MondayMeetingTemplate {
  id: string;
  text: string;
  sortOrder: number;
  active: boolean;
}

export interface MondayMeetingNote {
  id: string;
  text: string;
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
  weekKey: string;
  templateId: string | null;
}

export interface MondayMeetingData {
  templates: MondayMeetingTemplate[];
  notes: MondayMeetingNote[];
  initialized: boolean;
}

const DEFAULT_MONDAY_MEETING_TEMPLATES: MondayMeetingTemplate[] = [
  { id: 'mm-tpl-1', text: 'Geçen Hafta Kapanan Dosya Sayısı ve SLA Uyumu', sortOrder: 10, active: true },
  { id: 'mm-tpl-2', text: 'Bu Hafta Öncelikli SLA Riskleri', sortOrder: 20, active: true },
  { id: 'mm-tpl-3', text: 'Geciken Tahsilat ve Fatura Durumu', sortOrder: 30, active: true },
  { id: 'mm-tpl-4', text: 'Onay Gecikmeleri (Revizyon / Rapor)', sortOrder: 40, active: true },
  { id: 'mm-tpl-5', text: 'Personel Yük Dağılımı ve Kapasite', sortOrder: 50, active: true },
  { id: 'mm-tpl-6', text: 'Gelen Kutu Bekleyen Kayıtlar', sortOrder: 60, active: true },
  { id: 'mm-tpl-7', text: 'Finans Özeti (Ciro / Gider)', sortOrder: 70, active: true },
  { id: 'mm-tpl-8', text: 'Yeni Süreç veya Sistem Geliştirmeleri', sortOrder: 80, active: true },
];

function mondayWeekKey(date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  d.setHours(12, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function newMondayId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

@Injectable()
export class SystemSettingsService {
  constructor(private prisma: PrismaService) {}

  async get(key: string): Promise<any> {
    const setting = await this.prisma.systemSetting.findUnique({ where: { key } });
    if (!setting) return null;
    return setting.value;
  }

  async getBackupHealth(): Promise<any> {
    return (await this.get('backup_health')) ?? {
      result: 'UNKNOWN',
      error: 'Yedek sağlık kaydı henüz yok',
      lastSuccessAt: null,
    };
  }

  async set(key: string, value: any): Promise<any> {
    return this.prisma.systemSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  async getCustomerFields() {
    const value = await this.get('customer_fields');
    return value ?? DEFAULT_CUSTOMER_FIELDS;
  }

  async setCustomerFields(fields: any[]) {
    return this.set('customer_fields', fields);
  }

  async getVendorTypes(): Promise<string[]> {
    const value = await this.get('vendor_types');
    return (value as string[]) ?? DEFAULT_VENDOR_TYPES;
  }

  async setVendorTypes(types: string[]): Promise<string[]> {
    await this.set('vendor_types', types);
    return types;
  }

  private readonly DEFAULT_MAIL_CONFIG: MailConfig = {
    host: '',
    port: 587,
    username: '',
    password: '',
    security: 'None',
    fromName: '',
    fromEmail: '',
  };

  async getMailConfig(): Promise<MailConfig> {
    try {
      const value = await this.get('mail_config');
      return (value as MailConfig) ?? this.DEFAULT_MAIL_CONFIG;
    } catch {
      return this.DEFAULT_MAIL_CONFIG;
    }
  }

  async setMailConfig(config: MailConfig): Promise<MailConfig> {
    await this.set('mail_config', config);
    return config;
  }

  async getTurmobConfig(): Promise<TurmobConfig | null> {
    const value = await this.get('turmob_config');
    return value as TurmobConfig | null;
  }

  async setTurmobConfig(config: TurmobConfig): Promise<TurmobConfig> {
    await this.set('turmob_config', config);
    return config;
  }

  async getLocationFields() {
    const value = await this.get('location_fields');
    return value ?? DEFAULT_LOCATION_FIELDS;
  }

  async setLocationFields(fields: Record<string, { required: boolean }>) {
    await this.set('location_fields', fields);
    return fields;
  }

  async getWorkGroupFields() {
    const value = await this.get('work_group_fields');
    return value ?? DEFAULT_WORK_GROUP_FIELDS;
  }

  async setWorkGroupFields(fields: Record<string, { required: boolean }>) {
    await this.set('work_group_fields', fields);
    return fields;
  }

  async getWorkSubGroupFields() {
    const value = await this.get('work_sub_group_fields');
    return value ?? DEFAULT_WORK_SUB_GROUP_FIELDS;
  }

  async setWorkSubGroupFields(fields: Record<string, { required: boolean }>) {
    await this.set('work_sub_group_fields', fields);
    return fields;
  }

  async getUnitOptions(): Promise<string[]> {
    const value = await this.get('unit_options');
    return (value as string[]) ?? DEFAULT_UNIT_OPTIONS;
  }

  async setUnitOptions(options: string[]): Promise<string[]> {
    await this.set('unit_options', options);
    return options;
  }

  async getCustomerSources(): Promise<string[]> {
    const value = await this.get('customer_sources');
    return (value as string[]) ?? DEFAULT_CUSTOMER_SOURCES;
  }

  async setCustomerSources(values: string[]): Promise<string[]> {
    await this.set('customer_sources', values);
    return values;
  }

  async getRelationshipTypes(): Promise<RelationshipType[]> {
    try {
      const value = await this.get('relationship_types');
      if (!value) return DEFAULT_RELATIONSHIP_TYPES;
      // Geriye dönük uyumluluk: eski string[] formatını dönüştür
      if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
        return (value as string[]).map((label) => ({ label, active: true }));
      }
      return value as RelationshipType[];
    } catch {
      return [];
    }
  }

  async setRelationshipTypes(values: RelationshipType[]): Promise<RelationshipType[]> {
    await this.set('relationship_types', values);
    return values;
  }

  async getHrLeaveTypes(): Promise<HrLeaveTypeOption[]> {
    try {
      const value = await this.get('hr_leave_types');
      if (!value) return DEFAULT_HR_LEAVE_TYPES;
      if (Array.isArray(value) && value.length > 0) {
        return value as HrLeaveTypeOption[];
      }
      return DEFAULT_HR_LEAVE_TYPES;
    } catch {
      return DEFAULT_HR_LEAVE_TYPES;
    }
  }

  async setHrLeaveTypes(
    values: Array<{ code: string; label: string; active?: boolean }>,
  ): Promise<HrLeaveTypeOption[]> {
    const cleaned = (values ?? [])
      .map((item) => ({
        code: String(item.code ?? '')
          .trim()
          .toLowerCase()
          .replace(/\s+/g, '_')
          .replace(/[^a-z0-9_]/g, '')
          .slice(0, 40),
        label: String(item.label ?? '').trim(),
        active: item.active !== false,
      }))
      .filter((item) => item.code && item.label);
    await this.set('hr_leave_types', cleaned);
    return cleaned;
  }

  async getHrAssetCategories(): Promise<HrAssetCategoryOption[]> {
    try {
      const value = await this.get('hr_asset_categories');
      if (!value) return DEFAULT_HR_ASSET_CATEGORIES;
      if (Array.isArray(value) && value.length > 0) {
        return value as HrAssetCategoryOption[];
      }
      return DEFAULT_HR_ASSET_CATEGORIES;
    } catch {
      return DEFAULT_HR_ASSET_CATEGORIES;
    }
  }

  async setHrAssetCategories(
    values: Array<{ code: string; label: string; active?: boolean }>,
  ): Promise<HrAssetCategoryOption[]> {
    const cleaned = (values ?? [])
      .map((item) => ({
        code: String(item.code ?? '')
          .trim()
          .toLowerCase()
          .replace(/\s+/g, '_')
          .replace(/[^a-z0-9_]/g, '')
          .slice(0, 40),
        label: String(item.label ?? '').trim(),
        active: item.active !== false,
      }))
      .filter((item) => item.code && item.label);
    await this.set('hr_asset_categories', cleaned);
    return cleaned;
  }

  async getServiceTypes(): Promise<string[]> {
    const value = await this.get('service_types');
    return (value as string[]) ?? DEFAULT_SERVICE_TYPES;
  }

  async setServiceTypes(values: string[]): Promise<string[]> {
    await this.set('service_types', values);
    return values;
  }

  // ── Customer Types (Müşteri Tipleri) ──────────────────────────────────────
  async getCustomerTypes(): Promise<any[]> {
    const value = await this.get('customer_types');
    return (value as any[]) ?? [];
  }

  async setCustomerTypes(values: any[]): Promise<any[]> {
    await this.set('customer_types', values);
    return values;
  }

  async getCustomerSubTypes(): Promise<CustomerSubType[]> {
    const value = await this.get('customer_sub_types');
    const stored = value as CustomerSubType[] | null | undefined;
    if (!stored?.length) return DEFAULT_CUSTOMER_SUB_TYPES;
    return mergeCustomerSubTypes(stored);
  }

  async setCustomerSubTypes(values: CustomerSubType[]): Promise<CustomerSubType[]> {
    await this.set('customer_sub_types', values);
    return values;
  }

  async getIhbarKonulari(): Promise<IhbarKonulari> {
    const subjects = await this.prisma.departmentFileSubject.findMany({
      where: {
        department: { status: 'active' },
        status: 'active',
      },
      include: { department: { select: { code: true, reportFormat: true } } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    if (subjects.length === 0) {
      return DEFAULT_IHBAR_KONULARI;
    }

    const hasar: string[] = [];
    const acil: string[] = [];
    const seenByType = {
      hasar: new Set<string>(),
      acil: new Set<string>(),
    };
    for (const subject of subjects) {
      const isAcil = departmentToMeridyenType(subject.department) === 'acil_yardim';
      const bucket = isAcil ? acil : hasar;
      const seen = isAcil ? seenByType.acil : seenByType.hasar;
      const normalizedName = subject.name.trim().toLocaleLowerCase('tr-TR');
      if (seen.has(normalizedName)) continue;
      seen.add(normalizedName);
      bucket.push(subject.name);
    }

    return {
      hasar: hasar.length > 0 ? hasar : DEFAULT_IHBAR_KONULARI.hasar,
      acil: acil.length > 0 ? acil : DEFAULT_IHBAR_KONULARI.acil,
    };
  }

  async setIhbarKonulari(_values: IhbarKonulari): Promise<IhbarKonulari> {
    throw new BadRequestException(
      'İhbar konuları artık Ayarlar → Dosya Konuları ekranından yönetilir.',
    );
  }

  async getFieldRequirements(): Promise<FieldRequirementsConfig> {
    const value = await this.get('field_requirements');
    const defaults: FieldRequirementsConfig = { customerSubTypeRequired: true };
    if (!value) return defaults;
    return { ...defaults, ...(value as Partial<FieldRequirementsConfig>) };
  }

  async setFieldRequirements(config: Partial<FieldRequirementsConfig>): Promise<FieldRequirementsConfig> {
    const current = await this.getFieldRequirements();
    const updated = { ...current, ...config };
    await this.set('field_requirements', updated);
    return updated;
  }

  // ── Document Report Templates ─────────────────────────────────────────────

  async getDocumentReportTemplates(): Promise<DocumentReportTemplate[]> {
    const value = await this.get('document_report_templates');
    return (value as DocumentReportTemplate[]) ?? DEFAULT_DOCUMENT_REPORT_TEMPLATES;
  }

  async setDocumentReportTemplates(values: DocumentReportTemplate[]): Promise<DocumentReportTemplate[]> {
    await this.set('document_report_templates', values);
    return values;
  }

  async createDocumentReportTemplate(data: Omit<DocumentReportTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<DocumentReportTemplate> {
    const current = await this.getDocumentReportTemplates();
    const newItem: DocumentReportTemplate = {
      ...data,
      id: `tpl-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await this.setDocumentReportTemplates([...current, newItem]);
    return newItem;
  }

  async updateDocumentReportTemplate(id: string, data: Partial<DocumentReportTemplate>): Promise<DocumentReportTemplate> {
    const current = await this.getDocumentReportTemplates();
    const idx = current.findIndex((t) => t.id === id);
    if (idx === -1) throw new BadRequestException('Şablon bulunamadı');
    const updated = { ...current[idx], ...data, id, updatedAt: new Date().toISOString() };
    current[idx] = updated;
    await this.setDocumentReportTemplates(current);
    return updated;
  }

  async deleteDocumentReportTemplate(id: string): Promise<void> {
    const current = await this.getDocumentReportTemplates();
    const filtered = current.filter((t) => t.id !== id);
    if (filtered.length === current.length) throw new BadRequestException('Şablon bulunamadı');
    await this.setDocumentReportTemplates(filtered);
  }

  // ── Contract Templates ─────────────────────────────────────────────────────

  async getContractTemplates(): Promise<ContractTemplate[]> {
    const value = await this.get('contract_templates');
    return (value as ContractTemplate[]) ?? DEFAULT_CONTRACT_TEMPLATES;
  }

  async setContractTemplates(values: ContractTemplate[]): Promise<ContractTemplate[]> {
    await this.set('contract_templates', values);
    return values;
  }

  async createContractTemplate(data: Omit<ContractTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<ContractTemplate> {
    const current = await this.getContractTemplates();
    const newItem: ContractTemplate = {
      ...data,
      id: `ctr-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await this.setContractTemplates([...current, newItem]);
    return newItem;
  }

  async updateContractTemplate(id: string, data: Partial<ContractTemplate>): Promise<ContractTemplate> {
    const current = await this.getContractTemplates();
    const idx = current.findIndex((t) => t.id === id);
    if (idx === -1) throw new BadRequestException('Şablon bulunamadı');
    const updated = { ...current[idx], ...data, id, updatedAt: new Date().toISOString() };
    current[idx] = updated;
    await this.setContractTemplates(current);
    return updated;
  }

  async deleteContractTemplate(id: string): Promise<void> {
    const current = await this.getContractTemplates();
    const filtered = current.filter((t) => t.id !== id);
    if (filtered.length === current.length) throw new BadRequestException('Şablon bulunamadı');
    await this.setContractTemplates(filtered);
  }

  // ── Notification Settings ──────────────────────────────────────────────────

  async getNotificationSettings(): Promise<NotificationSettings> {
    const value = await this.get('notification_settings');
    if (!value) return DEFAULT_NOTIFICATION_SETTINGS;
    const data = value as Partial<NotificationSettings>;
    return {
      emailEnabled: data.emailEnabled ?? DEFAULT_NOTIFICATION_SETTINGS.emailEnabled,
      notifications: Array.isArray(data.notifications) && data.notifications.length > 0
        ? data.notifications
        : DEFAULT_NOTIFICATION_SETTINGS.notifications,
      signalRules: Array.isArray(data.signalRules) && data.signalRules.length > 0
        ? data.signalRules
        : DEFAULT_NOTIFICATION_SETTINGS.signalRules,
    };
  }

  async setNotificationSettings(settings: NotificationSettings): Promise<NotificationSettings> {
    // Merge-safe: boş notifications gelirse mevcut veya default değerleri koru
    const current = await this.getNotificationSettings();
    const merged: NotificationSettings = {
      emailEnabled: settings.emailEnabled ?? current.emailEnabled,
      notifications: Array.isArray(settings.notifications) && settings.notifications.length > 0
        ? settings.notifications
        : current.notifications,
      signalRules: Array.isArray(settings.signalRules) && settings.signalRules.length > 0
        ? settings.signalRules
        : current.signalRules,
    };
    await this.set('notification_settings', merged);
    return merged;
  }

  // ── Company Info ──────────────────────────────────────────────────────────

  async getCompanyInfo(): Promise<CompanyInfo> {
    const value = await this.get('company_info');
    return { ...DEFAULT_COMPANY_INFO, ...(value as Partial<CompanyInfo> ?? {}) };
  }

  async setCompanyInfo(info: Partial<CompanyInfo>): Promise<CompanyInfo> {
    const current = await this.getCompanyInfo();
    const updated: CompanyInfo = { ...current, ...info };
    await this.set('company_info', updated);
    return updated;
  }

  // ── System Config ──────────────────────────────────────────────────────────

  async getSystemConfig(): Promise<SystemConfig> {
    const value = await this.get('system_config');
    return { ...DEFAULT_SYSTEM_CONFIG, ...(value as Partial<SystemConfig> ?? {}) };
  }

  async setSystemConfig(config: Partial<SystemConfig>): Promise<SystemConfig> {
    const current = await this.getSystemConfig();
    const updated = { ...current, ...config };
    await this.set('system_config', updated);
    return updated;
  }

  async sendTestMail(to: string): Promise<{
    accepted: string[];
    rejected: string[];
    messageId?: string;
    response?: string;
  }> {
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      throw new BadRequestException('Geçerli bir alıcı e-posta adresi giriniz.');
    }

    const config = await this.getMailConfig();
    if (!config || !config.host || !config.username || !config.password) {
      throw new BadRequestException('Mail yapılandırması eksik veya henüz kaydedilmemiş.');
    }

    const subject = 'Test E-postası — Sigorta Hasar Sistemi';
    const logEntry = await this.prisma.emailLog.create({
      data: { to, subject, status: 'queued' },
    });

    const secure = config.security === 'SSL';
    const transportOptions: nodemailer.TransportOptions = {
      host: config.host,
      port: config.port || 587,
      secure,
      auth: {
        user: config.username,
        pass: config.password,
      },
    } as nodemailer.TransportOptions;

    if (config.security === 'TLS') {
      (transportOptions as any).requireTLS = true;
    }

    const transporter = nodemailer.createTransport(transportOptions);

    try {
      await transporter.verify();
      const result = await transporter.sendMail({
        from: `"${config.fromName || 'Sigorta Hasar Sistemi'}" <${config.fromEmail || config.username}>`,
        to,
        subject,
        text: 'Bu bir test e-postasıdır. Mail yapılandırmanız başarıyla çalışmaktadır.',
        html: '<p>Bu bir <strong>test e-postasıdır</strong>. Mail yapılandırmanız başarıyla çalışmaktadır.</p>',
      });
      await this.prisma.emailLog.update({
        where: { id: logEntry.id },
        data: {
          status: result.rejected?.length ? 'failed' : 'sent',
          sentAt: result.rejected?.length ? null : new Date(),
          errorMsg: result.rejected?.length
            ? `Reddedilen alıcılar: ${result.rejected.map(String).join(', ')}`
            : null,
        },
      });
      return {
        accepted: (result.accepted ?? []).map(String),
        rejected: (result.rejected ?? []).map(String),
        messageId: result.messageId,
        response: result.response,
      };
    } catch (err: any) {
      await this.prisma.emailLog.update({
        where: { id: logEntry.id },
        data: {
          status: 'failed',
          errorMsg: err?.message ?? 'Mail gönderilemedi. SMTP bağlantısını kontrol edin.',
        },
      });
      throw new BadRequestException(err?.message ?? 'Mail gönderilemedi. SMTP bağlantısını kontrol edin.');
    }
  }

  // ── SMS Config ──────────────────────────────────────────────────────────

  async getSmsConfig(): Promise<SmsConfig | null> {
    const value = await this.get('sms_config');
    return value as SmsConfig | null;
  }

  async setSmsConfig(config: SmsConfig): Promise<SmsConfig> {
    await this.set('sms_config', config);
    return config;
  }

  // ── Integration Config ──────────────────────────────────────────────────

  async getIntegrationConfig(): Promise<IntegrationConfig> {
    const value = await this.get('integration_config');
    const defaults: IntegrationConfig = {
      logoWings: { apiUrl: '', apiKey: '', username: '', password: '', active: false },
      googlePlaces: { apiKey: '', active: false },
    };
    const stored = (value as IntegrationConfig) ?? defaults;
    return {
      ...defaults,
      ...stored,
      logoWings: { ...defaults.logoWings, ...stored.logoWings },
      googlePlaces: { ...defaults.googlePlaces!, ...(stored.googlePlaces ?? {}) },
    };
  }

  async setIntegrationConfig(config: IntegrationConfig): Promise<IntegrationConfig> {
    await this.set('integration_config', config);
    return config;
  }

  // ── Theme Config ──────────────────────────────────────────────────────────

  async getThemeConfig(): Promise<{ mode: 'light' | 'dark' | 'system'; colorScheme: string }> {
    const value = await this.get('theme_config');
    return (value as any) ?? { mode: 'system', colorScheme: 'blue' };
  }

  async setThemeConfig(config: { mode: 'light' | 'dark' | 'system'; colorScheme: string }): Promise<typeof config> {
    const normalized = {
      mode: ['light', 'dark', 'system'].includes(config.mode) ? config.mode : 'system',
      colorScheme: config.colorScheme || 'blue',
    } as const;
    await this.set('theme_config', normalized);
    return normalized;
  }

  // ── Microsoft 365 Graph (Operasyon Gelen Kutusu) ───────────────────────

  private readonly DEFAULT_M365_CONFIG: M365GraphConfig = {
    tenantId: '',
    clientId: '',
    clientSecret: '',
    ihbarMailbox: 'ihbar@safranbh.com',
    hasarMailbox: 'hasar@safranbh.com',
    active: false,
  };

  async getM365GraphConfig(): Promise<M365GraphConfig> {
    const value = await this.get('m365_graph_config');
    return { ...this.DEFAULT_M365_CONFIG, ...(value as Partial<M365GraphConfig> | null) };
  }

  async setM365GraphConfig(config: M365GraphConfig): Promise<M365GraphConfig> {
    await this.set('m365_graph_config', config);
    return config;
  }

  async getSahaTespitKollari(): Promise<FieldInspectionBranch[]> {
    const value = await this.get('saha_tespit_kollari');
    const list = (value as FieldInspectionBranch[] | null) ?? DEFAULT_SAHA_TESPIT_KOLLARI;
    return [...list].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'tr'));
  }

  async setSahaTespitKollari(values: FieldInspectionBranch[]): Promise<FieldInspectionBranch[]> {
    await this.set('saha_tespit_kollari', values);
    return values;
  }

  async getTespitAlanlari(): Promise<TespitAlaniEntry[]> {
    const value = await this.get('tespit_alanlari');
    const list = (value as TespitAlaniEntry[] | null) ?? DEFAULT_TESPIT_ALANLARI;
    return [...list]
      .filter((e) => e.isActive !== false)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'tr'));
  }

  private slugTespitAlaniId(name: string): string {
    const base = name
      .toLowerCase()
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ı/g, 'i')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    return `tespit-alan-${base || 'yeni'}-${Date.now()}`;
  }

  async appendTespitAlani(name: string): Promise<TespitAlaniEntry> {
    const trimmed = (name ?? '').trim();
    if (!trimmed) {
      throw new BadRequestException('Tespit alanı adı zorunludur.');
    }
    const value = await this.get('tespit_alanlari');
    const list: TespitAlaniEntry[] = [...((value as TespitAlaniEntry[] | null) ?? DEFAULT_TESPIT_ALANLARI)];
    const normalized = trimmed.replace(/\s+/g, ' ');
    const existing = list.find(
      (e) => e.name.localeCompare(normalized, 'tr', { sensitivity: 'base' }) === 0,
    );
    if (existing) {
      return existing;
    }
    const maxOrder = list.reduce((m, e) => Math.max(m, e.sortOrder ?? 0), 0);
    const entry: TespitAlaniEntry = {
      id: this.slugTespitAlaniId(normalized),
      name: normalized,
      isActive: true,
      sortOrder: maxOrder + 10,
    };
    list.push(entry);
    await this.set('tespit_alanlari', list);
    return entry;
  }

  async getExpertInsuranceLinks(): Promise<ExpertInsuranceLinksConfig> {
    const value = await this.get('eksper_sigorta_baglantilari');
    const raw = value as ExpertInsuranceLinksConfig | null;
    return { links: Array.isArray(raw?.links) ? raw.links : [] };
  }

  async setExpertInsuranceLinks(config: ExpertInsuranceLinksConfig): Promise<ExpertInsuranceLinksConfig> {
    const links = (config.links ?? []).filter(
      (l) => typeof l.expertCustomerId === 'string' && typeof l.insuranceCompanyId === 'string',
    );
    const normalized = { links };
    await this.set('eksper_sigorta_baglantilari', normalized);
    return normalized;
  }

  // ── Pazartesi Toplantısı ───────────────────────────────────────────────────

  private normalizeMondayMeeting(raw: unknown): MondayMeetingData {
    const data = (raw ?? {}) as Partial<MondayMeetingData>;
    const templates = Array.isArray(data.templates) && data.templates.length > 0
      ? data.templates
      : DEFAULT_MONDAY_MEETING_TEMPLATES;
    const notes = Array.isArray(data.notes) ? data.notes : [];
    return {
      templates: templates.map((t, idx) => ({
        id: String(t.id ?? `mm-tpl-${idx}`),
        text: String(t.text ?? '').trim(),
        sortOrder: typeof t.sortOrder === 'number' ? t.sortOrder : idx * 10,
        active: t.active !== false,
      })).filter((t) => t.text.length > 0),
      notes: notes.map((n) => ({
        id: String(n.id),
        text: String(n.text ?? '').trim(),
        completed: Boolean(n.completed),
        completedAt: n.completedAt ? String(n.completedAt) : null,
        createdAt: String(n.createdAt ?? new Date().toISOString()),
        weekKey: String(n.weekKey ?? mondayWeekKey()),
        templateId: n.templateId ? String(n.templateId) : null,
      })).filter((n) => n.text.length > 0 && n.id),
      initialized: Boolean(data.initialized),
    };
  }

  private ensureCurrentWeekNotes(data: MondayMeetingData, weekKey: string): MondayMeetingData {
    const hasWeek = data.notes.some((n) => n.weekKey === weekKey);
    if (hasWeek) return data;

    const now = new Date().toISOString();
    const seeded = data.templates
      .filter((t) => t.active)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((t) => ({
        id: newMondayId('mm-note'),
        text: t.text,
        completed: false,
        completedAt: null,
        createdAt: now,
        weekKey,
        templateId: t.id,
      }));

    return { ...data, notes: [...data.notes, ...seeded] };
  }

  async getMondayMeeting(): Promise<MondayMeetingData & { weekKey: string }> {
    const weekKey = mondayWeekKey();
    const raw = await this.get('monday_meeting');
    let data = this.normalizeMondayMeeting(raw);
    const beforeLen = data.notes.length;
    data = this.ensureCurrentWeekNotes(data, weekKey);
    const needsPersist = !data.initialized || data.notes.length !== beforeLen;
    if (needsPersist) {
      data.initialized = true;
      await this.set('monday_meeting', data);
    }
    return { ...data, weekKey };
  }

  async updateMondayMeetingTemplates(templates: MondayMeetingTemplate[]): Promise<MondayMeetingData & { weekKey: string }> {
    const current = await this.getMondayMeeting();
    const normalized = templates
      .map((t, idx) => ({
        id: t.id || newMondayId('mm-tpl'),
        text: String(t.text ?? '').trim(),
        sortOrder: typeof t.sortOrder === 'number' ? t.sortOrder : idx * 10,
        active: t.active !== false,
      }))
      .filter((t) => t.text.length > 0);
    if (normalized.length === 0) {
      throw new BadRequestException('En az bir mutatap konu gerekli');
    }
    const next = { ...current, templates: normalized };
    const { weekKey: _wk, ...persist } = next;
    await this.set('monday_meeting', persist);
    return this.getMondayMeeting();
  }

  async toggleMondayMeetingNote(noteId: string): Promise<MondayMeetingData & { weekKey: string }> {
    const current = await this.getMondayMeeting();
    const idx = current.notes.findIndex((n) => n.id === noteId);
    if (idx < 0) throw new BadRequestException('Not bulunamadı');
    const note = current.notes[idx];
    const completed = !note.completed;
    const notes = [...current.notes];
    notes[idx] = {
      ...note,
      completed,
      completedAt: completed ? new Date().toISOString() : null,
    };
    const { weekKey: _wk, ...persist } = current;
    await this.set('monday_meeting', { ...persist, notes });
    return this.getMondayMeeting();
  }

  async addMondayMeetingNote(text: string): Promise<MondayMeetingData & { weekKey: string }> {
    const trimmed = String(text ?? '').trim();
    if (!trimmed) throw new BadRequestException('Not metni zorunludur');
    const current = await this.getMondayMeeting();
    const note: MondayMeetingNote = {
      id: newMondayId('mm-note'),
      text: trimmed,
      completed: false,
      completedAt: null,
      createdAt: new Date().toISOString(),
      weekKey: current.weekKey,
      templateId: null,
    };
    const { weekKey: _wk, ...persist } = current;
    await this.set('monday_meeting', { ...persist, notes: [...current.notes, note] });
    return this.getMondayMeeting();
  }
}
