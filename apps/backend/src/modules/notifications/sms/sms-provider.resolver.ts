import { ConfigService } from '@nestjs/config';
import { SmsConfig } from '@/modules/system-settings/system-settings.service';
import { ConsoleSmsProvider } from './console-sms.provider';
import { IletimerkeziSmsProvider } from './iletimerkezi.provider';
import { NetgsmSmsProvider } from './netgsm.provider';
import { ISmsProvider } from './sms-provider.interface';
import { isUsableSmsCredentials, smsCredentialsFromEnv } from './sms-credentials';

export function createSmsProvider(
  providerName: string,
  creds: { apiKey: string; apiSecret?: string; senderId: string },
): ISmsProvider {
  const credentials = {
    apiKey: creds.apiKey,
    apiSecret: creds.apiSecret ?? '',
    sender: creds.senderId,
  };

  switch (providerName) {
    case 'netgsm':
      return new NetgsmSmsProvider(credentials);
    case 'iletimerkezi':
      return new IletimerkeziSmsProvider(credentials);
    default:
      return new ConsoleSmsProvider();
  }
}

export function resolveEnvSmsProvider(config: ConfigService): { provider: ISmsProvider; name: string } {
  const providerName = config.get<string>('SMS_PROVIDER', 'console');
  const creds = smsCredentialsFromEnv(config);

  if (!isUsableSmsCredentials(creds)) {
    return { provider: new ConsoleSmsProvider(), name: 'console' };
  }

  return {
    provider: createSmsProvider(providerName, {
      apiKey: creds.apiKey,
      apiSecret: creds.apiSecret,
      senderId: creds.sender,
    }),
    name: providerName,
  };
}

export function resolveDbSmsProvider(
  dbConfig: SmsConfig | null | undefined,
): { provider: ISmsProvider; name: string } | null {
  if (!dbConfig?.active || !dbConfig.apiKey?.trim() || !dbConfig.senderId?.trim()) {
    return null;
  }
  if (dbConfig.provider === 'other') {
    return null;
  }

  return {
    provider: createSmsProvider(dbConfig.provider, {
      apiKey: dbConfig.apiKey,
      apiSecret: dbConfig.apiSecret,
      senderId: dbConfig.senderId,
    }),
    name: dbConfig.provider,
  };
}
