import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ISmsProvider } from './sms-provider.interface';
import { SmsCredentials, smsCredentialsFromEnv } from './sms-credentials';

@Injectable()
export class IletimerkeziSmsProvider implements ISmsProvider {
  private readonly logger = new Logger(IletimerkeziSmsProvider.name);
  private readonly creds: SmsCredentials;

  constructor(configOrCreds: ConfigService | SmsCredentials) {
    this.creds =
      'get' in configOrCreds ? smsCredentialsFromEnv(configOrCreds) : configOrCreds;
  }

  async send(to: string, message: string): Promise<void> {
    const phone = to.replace(/\D/g, '').replace(/^0/, '');
    const internationalPhone = phone.startsWith('90') ? phone : `90${phone}`;

    const body = {
      api_key: this.creds.apiKey,
      sender: this.creds.sender,
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
