import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export type PaytrCheckoutInput = {
  merchantOid: string;
  userIp: string;
  email: string;
  amount: number;
  userName: string;
  userAddress: string;
  userPhone: string;
  userBasket: [string, string, number][];
  okUrl: string;
  failUrl: string;
};

export type PaytrCallbackPayload = {
  merchant_oid: string;
  status: string;
  total_amount: string;
  hash: string;
  failed_reason_code?: string;
  failed_reason_msg?: string;
  [key: string]: unknown;
};

@Injectable()
export class PaytrService {
  private readonly logger = new Logger(PaytrService.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.get('PAYTR_MERCHANT_ID') &&
        this.config.get('PAYTR_MERCHANT_KEY') &&
        this.config.get('PAYTR_MERCHANT_SALT'),
    );
  }

  isEnabled(): boolean {
    return this.config.get('ONLINE_CARD_COLLECTION_ENABLED', 'false') === 'true';
  }

  isTestMode(): boolean {
    return this.config.get('PAYTR_TEST_MODE', '0') === '1';
  }

  buildUserBasket(items: PaytrCheckoutInput['userBasket']): string {
    return Buffer.from(JSON.stringify(items), 'utf8').toString('base64');
  }

  async getIframeToken(input: PaytrCheckoutInput): Promise<string> {
    const merchantId = this.config.get<string>('PAYTR_MERCHANT_ID', '');
    const merchantKey = this.config.get<string>('PAYTR_MERCHANT_KEY', '');
    const merchantSalt = this.config.get<string>('PAYTR_MERCHANT_SALT', '');

    const paymentAmount = Math.round(input.amount * 100);
    const userBasket = this.buildUserBasket(input.userBasket);
    const noInstallment = '1';
    const maxInstallment = '0';
    const currency = 'TL';
    const testMode = this.isTestMode() ? '1' : '0';

    const hashStr =
      merchantId +
      input.userIp +
      input.merchantOid +
      input.email +
      String(paymentAmount) +
      userBasket +
      noInstallment +
      maxInstallment +
      currency +
      testMode;

    const paytrToken = crypto
      .createHmac('sha256', merchantKey)
      .update(hashStr + merchantSalt)
      .digest('base64');

    const body = new URLSearchParams({
      merchant_id: merchantId,
      user_ip: input.userIp,
      merchant_oid: input.merchantOid,
      email: input.email,
      payment_amount: String(paymentAmount),
      paytr_token: paytrToken,
      user_basket: userBasket,
      debug_on: this.config.get('PAYTR_DEBUG_ON', '0') === '1' ? '1' : '0',
      no_installment: noInstallment,
      max_installment: maxInstallment,
      user_name: input.userName.slice(0, 60),
      user_address: input.userAddress.slice(0, 400),
      user_phone: input.userPhone.slice(0, 20),
      merchant_ok_url: input.okUrl,
      merchant_fail_url: input.failUrl,
      timeout_limit: this.config.get('PAYTR_TIMEOUT_MINUTES', '30'),
      currency,
      test_mode: testMode,
      lang: 'tr',
    });

    const res = await fetch('https://www.paytr.com/odeme/api/get-token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    const json = (await res.json()) as { status?: string; token?: string; reason?: string };
    if (json.status !== 'success' || !json.token) {
      this.logger.error(`PayTR token hatası: ${json.reason ?? 'bilinmeyen'}`);
      throw new Error(json.reason ?? 'PayTR ödeme oturumu başlatılamadı');
    }

    return json.token;
  }

  verifyCallback(payload: PaytrCallbackPayload): boolean {
    const merchantKey = this.config.get<string>('PAYTR_MERCHANT_KEY', '');
    const merchantSalt = this.config.get<string>('PAYTR_MERCHANT_SALT', '');

    const hashStr =
      payload.merchant_oid + merchantSalt + payload.status + payload.total_amount;
    const token = crypto.createHmac('sha256', merchantKey).update(hashStr).digest('base64');
    return token === payload.hash;
  }
}
