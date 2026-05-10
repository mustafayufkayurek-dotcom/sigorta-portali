import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

export const DEFAULT_ASSIGNMENT_TEMPLATE =
  'Sayın {musteriAdi}, {sirketAdi} olarak hasar dosyanız ({dosyaNo}) ile ilgili onarım süreciniz başlamıştır. Süreç boyunca bizimle iletişime geçebilirsiniz: {sirketTelefon}. İyi günler dileriz.';

export const TEMPLATE_TYPES = {
  SMS_ASSIGNMENT: 'sms_assignment',
  WHATSAPP_ASSIGNMENT: 'whatsapp_assignment',
} as const;

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
      // İlk çalıştırmada varsayılan şablonu oluştur
      return this.prisma.messageTemplate.create({
        data: {
          type,
          name: type === TEMPLATE_TYPES.SMS_ASSIGNMENT ? 'Atama SMS Şablonu' : 'Atama WhatsApp Şablonu',
          content: DEFAULT_ASSIGNMENT_TEMPLATE,
          isActive: true,
        },
      });
    }

    return template;
  }

  async update(type: string, data: { content: string; isActive?: boolean }) {
    const existing = await this.prisma.messageTemplate.findUnique({ where: { type } });

    if (!existing) {
      return this.prisma.messageTemplate.create({
        data: {
          type,
          name: type === TEMPLATE_TYPES.SMS_ASSIGNMENT ? 'Atama SMS Şablonu' : 'Atama WhatsApp Şablonu',
          content: data.content,
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
    },
  ): string {
    return template
      .replace(/\{musteriAdi\}/g, vars.musteriAdi ?? '')
      .replace(/\{dosyaNo\}/g, vars.dosyaNo ?? '')
      .replace(/\{sirketAdi\}/g, vars.sirketAdi ?? '')
      .replace(/\{sirketTelefon\}/g, vars.sirketTelefon ?? '');
  }
}
