import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
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
    'Cam Kırığı',
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
  { value: 'eksper',           label: 'Eksper',           forType: 'individual', color: 'purple' },
  { value: 'eksper_firmasi',   label: 'Eksper Firması',   forType: 'corporate',  color: 'purple' },
  { value: 'insured',          label: 'Sigortalı',        forType: 'both',       color: 'orange' },
  { value: 'private_customer', label: 'Özel Müşteri',     forType: 'individual', color: 'green'  },
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

@Injectable()
export class SystemSettingsService {
  constructor(private prisma: PrismaService) {}

  async get(key: string): Promise<any> {
    const setting = await this.prisma.systemSetting.findUnique({ where: { key } });
    if (!setting) return null;
    return setting.value;
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
    return (value as CustomerSubType[]) ?? DEFAULT_CUSTOMER_SUB_TYPES;
  }

  async setCustomerSubTypes(values: CustomerSubType[]): Promise<CustomerSubType[]> {
    await this.set('customer_sub_types', values);
    return values;
  }

  async getIhbarKonulari(): Promise<IhbarKonulari> {
    const value = await this.get('ihbar_konulari');
    if (!value) return DEFAULT_IHBAR_KONULARI;
    const data = value as Partial<IhbarKonulari>;
    return {
      hasar: Array.isArray(data.hasar) ? data.hasar : DEFAULT_IHBAR_KONULARI.hasar,
      acil: Array.isArray(data.acil) ? data.acil : DEFAULT_IHBAR_KONULARI.acil,
    };
  }

  async setIhbarKonulari(values: IhbarKonulari): Promise<IhbarKonulari> {
    await this.set('ihbar_konulari', values);
    return values;
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
    };
    await this.set('notification_settings', merged);
    return merged;
  }

  // ── Company Info ──────────────────────────────────────────────────────────

  async getCompanyInfo(): Promise<CompanyInfo> {
    const value = await this.get('company_info');
    return (value as CompanyInfo) ?? DEFAULT_COMPANY_INFO;
  }

  async setCompanyInfo(info: CompanyInfo): Promise<CompanyInfo> {
    await this.set('company_info', info);
    return info;
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

  async sendTestMail(to: string): Promise<void> {
    const config = await this.getMailConfig();
    if (!config || !config.host || !config.username || !config.password) {
      throw new BadRequestException('Mail yapılandırması eksik veya henüz kaydedilmemiş.');
    }

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
      await transporter.sendMail({
        from: `"${config.fromName || 'Sigorta Hasar Sistemi'}" <${config.fromEmail || config.username}>`,
        to,
        subject: 'Test E-postası — Sigorta Hasar Sistemi',
        text: 'Bu bir test e-postasıdır. Mail yapılandırmanız başarıyla çalışmaktadır.',
        html: '<p>Bu bir <strong>test e-postasıdır</strong>. Mail yapılandırmanız başarıyla çalışmaktadır.</p>',
      });
    } catch (err: any) {
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
    };
    return (value as IntegrationConfig) ?? defaults;
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
}
