export interface ISmsProvider {
  send(to: string, message: string): Promise<void>;
}

export const SMS_PROVIDER = 'SMS_PROVIDER';
