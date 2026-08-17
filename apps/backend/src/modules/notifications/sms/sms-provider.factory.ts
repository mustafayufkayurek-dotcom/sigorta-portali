import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SMS_PROVIDER } from './sms-provider.interface';
import { ConsoleSmsProvider } from './console-sms.provider';
import { NetgsmSmsProvider } from './netgsm.provider';
import { IletimerkeziSmsProvider } from './iletimerkezi.provider';

export const SmsProviderFactory: Provider = {
  provide: SMS_PROVIDER,
  useFactory: (config: ConfigService) => {
    const providerName = config.get<string>('SMS_PROVIDER', 'console');

    switch (providerName) {
      case 'netgsm':
        return new NetgsmSmsProvider(config);
      case 'iletimerkezi':
        return new IletimerkeziSmsProvider(config);
      default:
        return new ConsoleSmsProvider();
    }
  },
  inject: [ConfigService],
};
