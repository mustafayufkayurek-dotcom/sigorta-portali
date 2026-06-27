export interface SmsCredentials {
  apiKey: string;
  apiSecret: string;
  sender: string;
}

export function smsCredentialsFromEnv(config: {
  get: (key: string, defaultValue?: string) => string | undefined;
}): SmsCredentials {
  return {
    apiKey: config.get('SMS_API_KEY', '') ?? '',
    apiSecret: config.get('SMS_API_SECRET', '') ?? '',
    sender: config.get('SMS_SENDER', 'SIGORTA') ?? 'SIGORTA',
  };
}

export function isUsableSmsCredentials(creds: SmsCredentials): boolean {
  return Boolean(creds.apiKey.trim() && creds.sender.trim());
}
