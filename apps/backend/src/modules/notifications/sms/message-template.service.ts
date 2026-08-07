import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

export const DEFAULT_ASSIGNMENT_TEMPLATE =
  'Sayın {musteriAdi}, {sirketAdi} olarak hasar dosyanız ({dosyaNo}) ile ilgili onarım süreciniz başlamıştır. Süreç boyunca bizimle iletişime geçebilirsiniz: {sirketTelefon}. İyi günler dileriz.';

export const TEMPLATE_TYPES = {
  SMS_ASSIGNMENT: 'sms_assignment',
  WHATSAPP_ASSIGNMENT: 'whatsapp_assignment',
  WHATSAPP_VENDOR_ASSIGNMENT: 'whatsapp_vendor_assignment',
  WHATSAPP_HASAR_APPOINTMENT_INSURED: 'whatsapp_hasar_randevu_sigortali',
  WHATSAPP_HASAR_APPOINTMENT_ADJUSTER: 'whatsapp_hasar_randevu_tespitci',
  WHATSAPP_HASAR_APPOINTMENT_VENDOR: 'whatsapp_hasar_randevu_tedarikci',
  WHATSAPP_ACIL_INITIAL_INFORMATION: 'whatsapp_acil_ilk_bilgilendirme',
  WHATSAPP_ACIL_CLOSURE_SURVEY: 'whatsapp_acil_kapanis_anket',
} as const;

const TEMPLATE_NAMES: Record<string, string> = {
  [TEMPLATE_TYPES.SMS_ASSIGNMENT]: 'Atama SMS Şablonu',
  [TEMPLATE_TYPES.WHATSAPP_ASSIGNMENT]: 'Atama WhatsApp Şablonu',
  [TEMPLATE_TYPES.WHATSAPP_VENDOR_ASSIGNMENT]: 'Tedarikçi Atama WhatsApp Şablonu',
  [TEMPLATE_TYPES.WHATSAPP_HASAR_APPOINTMENT_INSURED]: 'Sigortalı Randevu Bilgilendirme',
  [TEMPLATE_TYPES.WHATSAPP_HASAR_APPOINTMENT_ADJUSTER]: 'Tespitçi Randevu Bilgilendirme',
  [TEMPLATE_TYPES.WHATSAPP_HASAR_APPOINTMENT_VENDOR]: 'Tedarikçi Randevu Bilgilendirme',
  [TEMPLATE_TYPES.WHATSAPP_ACIL_INITIAL_INFORMATION]: 'Sigortalıya İlk Bilgilendirme',
  [TEMPLATE_TYPES.WHATSAPP_ACIL_CLOSURE_SURVEY]: 'Kapanış / Anket Mesajı',
};

const DEFAULT_VENDOR_ASSIGNMENT_TEMPLATE =
  'Meridyen Assistance — Tedarikçi Ataması\nDosya No: {dosyaNo}\nSigortalı: {musteriAdi}\nİş: {isTanimi}\nKonum: {hasarAdresi}\n\nLütfen dosyayı panelden kontrol ediniz.';

const DEFAULT_HASAR_APPOINTMENT_INSURED_TEMPLATE =
  'Sayın {musteriAdi}, {dosyaNo} numaralı hasar dosyanız için tespit randevunuz {randevuTarih} günü saat {randevuSaat} olarak planlanmıştır. Adres: {hasarAdresi}. Tahmini süre: {tahminiSure}.';

const DEFAULT_HASAR_APPOINTMENT_ADJUSTER_TEMPLATE =
  '{dosyaNo} numaralı dosya için tespit randevusu: {randevuTarih} {randevuSaat}. Sigortalı: {musteriAdi}. Telefon: {musteriTelefon}. Adres: {hasarAdresi}. Tahmini süre: {tahminiSure}.';

const DEFAULT_HASAR_APPOINTMENT_VENDOR_TEMPLATE =
  '{dosyaNo} numaralı dosya için hizmet randevusu: {randevuTarih} {randevuSaat}. İş: {isTanimi}. Adres: {hasarAdresi}. Tahmini süre: {tahminiSure}.';

const DEFAULT_ACIL_INITIAL_INFORMATION_TEMPLATE =
  'Değerli Sigortalımız,\n\nAcil Yardım dosyanız (Dosya No: {Dosya No}) tarafımıza ulaşmış olup, dosya sorumlumuz {Dosya Sorumlusu} en kısa sürede sizinle irtibata geçecektir.\n\nDosya Konusu: {Dosya Konusu}\nDosya Sorumlusu Tlf: {Dosya Sorumlusu Telefon}\n\nSaygılarımızla,\nMeridyen Assistance';

const DEFAULT_ACIL_CLOSURE_SURVEY_TEMPLATE =
  'Değerli {Sigortalı Ad},\n\nAcil Yardım dosyanız ({Dosya No}) tamamlanmıştır. Hizmetimizden yararlandığınız için teşekkür ederiz.\n\nDosya Konusu: {Dosya Konusu}\nDeneyiminizi kısaca değerlendirmenizi rica ederiz; geri bildiriminiz Meridyen Assistance için çok değerlidir.\n\nSaygılarımızla,\nMeridyen Assistance';

const DEFAULT_TEMPLATES: Record<string, string> = {
  [TEMPLATE_TYPES.SMS_ASSIGNMENT]: DEFAULT_ASSIGNMENT_TEMPLATE,
  [TEMPLATE_TYPES.WHATSAPP_ASSIGNMENT]: DEFAULT_ASSIGNMENT_TEMPLATE,
  [TEMPLATE_TYPES.WHATSAPP_VENDOR_ASSIGNMENT]: DEFAULT_VENDOR_ASSIGNMENT_TEMPLATE,
  [TEMPLATE_TYPES.WHATSAPP_HASAR_APPOINTMENT_INSURED]: DEFAULT_HASAR_APPOINTMENT_INSURED_TEMPLATE,
  [TEMPLATE_TYPES.WHATSAPP_HASAR_APPOINTMENT_ADJUSTER]: DEFAULT_HASAR_APPOINTMENT_ADJUSTER_TEMPLATE,
  [TEMPLATE_TYPES.WHATSAPP_HASAR_APPOINTMENT_VENDOR]: DEFAULT_HASAR_APPOINTMENT_VENDOR_TEMPLATE,
  [TEMPLATE_TYPES.WHATSAPP_ACIL_INITIAL_INFORMATION]: DEFAULT_ACIL_INITIAL_INFORMATION_TEMPLATE,
  [TEMPLATE_TYPES.WHATSAPP_ACIL_CLOSURE_SURVEY]: DEFAULT_ACIL_CLOSURE_SURVEY_TEMPLATE,
};

@Injectable()
export class MessageTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll() {
    return this.prisma.messageTemplate.findMany({
      orderBy: { type: 'asc' },
    });
  }

  async getByType(type: string) {
    const template = await this.prisma.messageTemplate.findUnique({
      where: { type },
    });

    if (!template) {
      const defaultContent = DEFAULT_TEMPLATES[type] ?? DEFAULT_ASSIGNMENT_TEMPLATE;
      return this.prisma.messageTemplate.create({
        data: {
          type,
          name: TEMPLATE_NAMES[type] ?? 'Mesaj Şablonu',
          content: defaultContent,
          isActive: true,
        },
      });
    }

    return template;
  }

  async update(type: string, data: { content: string; isActive?: boolean }) {
    const existing = await this.prisma.messageTemplate.findUnique({ where: { type } });

    if (!existing) {
      const defaultContent = DEFAULT_TEMPLATES[type] ?? DEFAULT_ASSIGNMENT_TEMPLATE;
      return this.prisma.messageTemplate.create({
        data: {
          type,
          name: TEMPLATE_NAMES[type] ?? 'Mesaj Şablonu',
          content: data.content || defaultContent,
          isActive: data.isActive ?? true,
        },
      });
    }

    return this.prisma.messageTemplate.update({
      where: { type },
      data: {
        content: data.content,
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
  }

  /**
   * Şablon değişkenlerini doldurur
   */
  interpolate(
    template: string,
    vars: {
      musteriAdi?: string;
      musteriTelefon?: string;
      dosyaNo?: string;
      sirketAdi?: string;
      sirketTelefon?: string;
      tedarikciAdi?: string;
      isTanimi?: string;
      hasarAdresi?: string;
      randevuTarih?: string;
      randevuSaat?: string;
      tahminiSure?: string;
    },
  ): string {
    return template
      .replace(/\{musteriAdi\}/g, vars.musteriAdi ?? '')
      .replace(/\{musteriTelefon\}/g, vars.musteriTelefon ?? '')
      .replace(/\{dosyaNo\}/g, vars.dosyaNo ?? '')
      .replace(/\{sirketAdi\}/g, vars.sirketAdi ?? '')
      .replace(/\{sirketTelefon\}/g, vars.sirketTelefon ?? '')
      .replace(/\{tedarikciAdi\}/g, vars.tedarikciAdi ?? '')
      .replace(/\{isTanimi\}/g, vars.isTanimi ?? '')
      .replace(/\{hasarAdresi\}/g, vars.hasarAdresi ?? '')
      .replace(/\{randevuTarih\}/g, vars.randevuTarih ?? '')
      .replace(/\{randevuSaat\}/g, vars.randevuSaat ?? '')
      .replace(/\{tahminiSure\}/g, vars.tahminiSure ?? '');
  }
}
