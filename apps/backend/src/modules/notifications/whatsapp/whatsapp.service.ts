import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { buildWhatsAppMeUrl, normalizeWhatsAppPhone } from '@/common/utils/whatsapp-phone';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly enabled: boolean;
  private readonly apiUrl: string;
  private readonly token: string;

  constructor(private readonly config: ConfigService) {
    this.enabled = this.config.get<string>('WHATSAPP_ENABLED', 'false') === 'true';
    this.apiUrl = this.config.get<string>('WHATSAPP_API_URL', '');
    this.token = this.config.get<string>('WHATSAPP_TOKEN', '');
  }

  get isEnabled(): boolean {
    return this.enabled && !!this.apiUrl && !!this.token;
  }

  /**
   * WhatsApp Business API üzerinden şablon mesaj gönderir.
   * Şimdilik altyapı hazır, aktif kullanım daha sonra yapılacak.
   */
  async sendWhatsApp(
    to: string,
    templateName: string,
    params: string[],
  ): Promise<void> {
    if (!this.isEnabled) {
      this.logger.debug('[WhatsApp] Devre dışı, mesaj gönderilmedi.');
      return;
    }

    const internationalPhone = normalizeWhatsAppPhone(to);
    if (!internationalPhone) {
      this.logger.warn(`[WhatsApp] Geçersiz telefon, mesaj gönderilmedi: ${to}`);
      return;
    }

    const body = {
      messaging_product: 'whatsapp',
      to: internationalPhone,
      type: 'template',
      template: {
        name: templateName,
        language: { code: 'tr' },
        components: [
          {
            type: 'body',
            parameters: params.map((p) => ({ type: 'text', text: p })),
          },
        ],
      },
    };

    try {
      const response = await fetch(`${this.apiUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`WhatsApp API hatası: ${response.status} ${errText}`);
      }

      this.logger.log(`[WhatsApp] Mesaj gönderildi → ${internationalPhone} (şablon: ${templateName})`);
    } catch (err: any) {
      this.logger.error(`[WhatsApp] Mesaj gönderilemedi → ${internationalPhone}: ${err.message}`);
      // Sessiz fail
    }
  }

  /**
   * Fallback: WhatsApp web URL'si oluştur
   */
  buildWhatsAppUrl(phone: string, message: string): string {
    return buildWhatsAppMeUrl(phone, message) ?? `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
  }
}
