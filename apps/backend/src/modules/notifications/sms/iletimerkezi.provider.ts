import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ISmsProvider } from './sms-provider.interface';

@Injectable()
export class IletimerkeziSmsProvider implements ISmsProvider {
  private readonly logger = new Logger(IletimerkeziSmsProvider.name);
  private readonly apiKey: string;
  private readonly sender: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('SMS_API_KEY', '');
    this.sender = this.config.get<string>('SMS_SENDER', 'SIGORTA');
  }

  async send(to: string, message: string): Promise<void> {
    const phone = to.replace(/\D/g, '').replace(/^0/, '');
    const internationalPhone = phone.startsWith('90') ? phone : `90${phone}`;

    const body = {
      api_key: this.apiKey,
      sender: this.sender,
      message,
      phones: [internationalPhone],
    };

    try {
      const response = await fetch('https://api.iletimerkezi.com/v1/send-sms/json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = (await response.json()) as any;

      if (data?.response?.status?.code !== 200) {
        throw new Error(
          `İletimerkezi hata: ${data?.response?.status?.message ?? 'Bilinmeyen hata'}`,
        );
      }

      this.logger.log(`[İletimerkezi] SMS gönderildi → ${internationalPhone}`);
    } catch (err: any) {
      this.logger.error(`[İletimerkezi] SMS gönderilemedi → ${internationalPhone}: ${err.message}`);
      throw err;
    }
  }
}
