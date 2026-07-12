import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

export const DEFAULT_ASSIGNMENT_TEMPLATE =
  'Sayın {musteriAdi}, {sirketAdi} olarak hasar dosyanız ({dosyaNo}) ile ilgili onarım süreciniz başlamıştır. Süreç boyunca bizimle iletişime geçebilirsiniz: {sirketTelefon}. İyi günler dileriz.';

export const TEMPLATE_TYPES = {
  SMS_ASSIGNMENT: 'sms_assignment',
  WHATSAPP_ASSIGNMENT: 'whatsapp_assignment',
  WHATSAPP_VENDOR_ASSIGNMENT: 'whatsapp_vendor_assignment',
} as const;

const TEMPLATE_NAMES: Record<string, string> = {
  [TEMPLATE_TYPES.SMS_ASSIGNMENT]: 'Atama SMS Şablonu',
  [TEMPLATE_TYPES.WHATSAPP_ASSIGNMENT]: 'Atama WhatsApp Şablonu',
  [TEMPLATE_TYPES.WHATSAPP_VENDOR_ASSIGNMENT]: 'Tedarikçi Atama WhatsApp Şablonu',
};

const DEFAULT_VENDOR_ASSIGNMENT_TEMPLATE =
  'Meridyen Assistance — Tedarikçi Ataması\nDosya No: {dosyaNo}\nSigortalı: {musteriAdi}\nİş: {isTanimi}\nKonum: {hasarAdresi}\n\nLütfen dosyayı panelden kontrol ediniz.';

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
      const defaultContent = type === TEMPLATE_TYPES.WHATSAPP_VENDOR_ASSIGNMENT
        ? DEFAULT_VENDOR_ASSIGNMENT_TEMPLATE
        : DEFAULT_ASSIGNMENT_TEMPLATE;
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
      const defaultContent = type === TEMPLATE_TYPES.WHATSAPP_VENDOR_ASSIGNMENT
        ? DEFAULT_VENDOR_ASSIGNMENT_TEMPLATE
        : DEFAULT_ASSIGNMENT_TEMPLATE;
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
      dosyaNo?: string;
      sirketAdi?: string;
      sirketTelefon?: string;
      tedarikciAdi?: string;
      isTanimi?: string;
      hasarAdresi?: string;
    },
  ): string {
    return template
      .replace(/\{musteriAdi\}/g, vars.musteriAdi ?? '')
      .replace(/\{dosyaNo\}/g, vars.dosyaNo ?? '')
      .replace(/\{sirketAdi\}/g, vars.sirketAdi ?? '')
      .replace(/\{sirketTelefon\}/g, vars.sirketTelefon ?? '')
      .replace(/\{tedarikciAdi\}/g, vars.tedarikciAdi ?? '')
      .replace(/\{isTanimi\}/g, vars.isTanimi ?? '')
      .replace(/\{hasarAdresi\}/g, vars.hasarAdresi ?? '');
  }
}
