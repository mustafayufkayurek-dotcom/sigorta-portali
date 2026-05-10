import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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

    const phone = to.replace(/\D/g, '').replace(/^0/, '');
    const internationalPhone = phone.startsWith('90') ? phone : `90${phone}`;

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
    const recipient = phone.replace(/\D/g, '').replace(/^0/, '');
    const internationalPhone = recipient.startsWith('90') ? recipient : `90${recipient}`;
    return `https://wa.me/${internationalPhone}?text=${encodeURIComponent(message)}`;
  }
}
