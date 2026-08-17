import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ISmsProvider } from './sms-provider.interface';
import { SmsCredentials, smsCredentialsFromEnv } from './sms-credentials';

@Injectable()
export class NetgsmSmsProvider implements ISmsProvider {
  private readonly logger = new Logger(NetgsmSmsProvider.name);
  private readonly creds: SmsCredentials;

  constructor(configOrCreds: ConfigService | SmsCredentials) {
    this.creds =
      'get' in configOrCreds ? smsCredentialsFromEnv(configOrCreds) : configOrCreds;
  }

  async send(to: string, message: string): Promise<void> {
    const phone = to.replace(/\D/g, '').replace(/^0/, '');

    const params = new URLSearchParams({
      usercode: this.creds.apiKey,
      password: this.creds.apiSecret,
      gsmno: phone,
      message,
      msgheader: this.creds.sender,
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
