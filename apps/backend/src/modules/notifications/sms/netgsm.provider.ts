import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ISmsProvider } from './sms-provider.interface';

@Injectable()
export class NetgsmSmsProvider implements ISmsProvider {
  private readonly logger = new Logger(NetgsmSmsProvider.name);
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly sender: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('SMS_API_KEY', '');
    this.apiSecret = this.config.get<string>('SMS_API_SECRET', '');
    this.sender = this.config.get<string>('SMS_SENDER', 'SIGORTA');
  }

  async send(to: string, message: string): Promise<void> {
    const phone = to.replace(/\D/g, '').replace(/^0/, '');

    const params = new URLSearchParams({
      usercode: this.apiKey,
      password: this.apiSecret,
      gsmno: phone,
      message,
      msgheader: this.sender,
      dil: 'TR',
    });

    const url = `https://api.netgsm.com.tr/sms/send/get/?${params.toString()}`;

    try {
      const response = await fetch(url);
      const text = await response.text();
      const code = text.trim().split('\n')[0];

      if (!['00', '01', '02'].includes(code)) {
        throw new Error(`Netgsm hata kodu: ${code}`);
      }

      this.logger.log(`[Netgsm] SMS gönderildi → ${phone}`);
    } catch (err: any) {
      this.logger.error(`[Netgsm] SMS gönderilemedi → ${phone}: ${err.message}`);
      throw err;
    }
  }
}
