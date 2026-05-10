import { Injectable, Logger } from '@nestjs/common';
import { ISmsProvider } from './sms-provider.interface';

@Injectable()
export class ConsoleSmsProvider implements ISmsProvider {
  private readonly logger = new Logger(ConsoleSmsProvider.name);

  async send(to: string, message: string): Promise<void> {
    this.logger.log(`[SMS] To: ${to} | Message: ${message}`);
  }
}
