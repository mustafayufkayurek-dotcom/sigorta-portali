import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { LogoConfigService } from './logo-config.service';
import {
  LogoTokenResponse,
  LogoArpCard,
  LogoSalesInvoice,
  LogoPurchaseInvoice,
  LogoCollectionSlip,
  LogoPaymentSlip,
} from '../types/logo-api.types';

interface CachedToken {
  token: string;
  expiresAt: number;
}

@Injectable()
export class LogoApiClientService {
  private readonly logger = new Logger(LogoApiClientService.name);
  private tokenCache: CachedToken | null = null;
  private readonly TOKEN_TTL_BUFFER_MS = 5 * 60 * 1000; // 5 dk erken yenile

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: LogoConfigService,
  ) {}

  // ── Auth ──────────────────────────────────────────────────────────────────

  private async authenticate(): Promise<string> {
    const config = await this.configService.getConfig();
    if (!config) throw new InternalServerErrorException('Logo konfigürasyonu bulunamadı.');

    const now = Date.now();
    if (this.tokenCache && this.tokenCache.expiresAt > now + this.TOKEN_TTL_BUFFER_MS) {
      return this.tokenCache.token;
    }

    const basicAuth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
    const params = new URLSearchParams({
      grant_type: 'password',
      username: config.username,
      password: config.password,
      firmno: String(config.firmNo),
    });

    const url = `${config.apiBaseUrl}/api/v1/token`;
    const response = await firstValueFrom(
      this.httpService.post<LogoTokenResponse>(url, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${basicAuth}`,
        },
      }),
    );

    const { access_token, expires_in } = response.data;
    this.tokenCache = {
      token: access_token,
      expiresAt: now + expires_in * 1000,
    };

    this.logger.debug('Logo token yenilendi.');
    return access_token;
  }

  private invalidateToken() {
    this.tokenCache = null;
  }

  // ── Generic HTTP ──────────────────────────────────────────────────────────

  async post<TBody, TResponse = unknown>(
    endpoint: string,
    body: TBody,
    retry = true,
  ): Promise<TResponse> {
    const config = await this.configService.getConfig();
    if (!config) throw new InternalServerErrorException('Logo konfigürasyonu bulunamadı.');

    const token = await this.authenticate();
    const url = `${config.apiBaseUrl}/api/v1/${endpoint}`;

    try {
      const response = await firstValueFrom(
        this.httpService.post<TResponse>(url, body, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }),
      );
      return response.data;
    } catch (err) {
      const axiosErr = err as AxiosError;
      if (axiosErr.response?.status === 401 && retry) {
        this.invalidateToken();
        return this.post<TBody, TResponse>(endpoint, body, false);
      }
      throw err;
    }
  }

  async get<TResponse = unknown>(
    endpoint: string,
    params?: Record<string, string>,
    retry = true,
  ): Promise<TResponse> {
    const config = await this.configService.getConfig();
    if (!config) throw new InternalServerErrorException('Logo konfigürasyonu bulunamadı.');

    const token = await this.authenticate();
    const url = `${config.apiBaseUrl}/api/v1/${endpoint}`;

    try {
      const response = await firstValueFrom(
        this.httpService.get<TResponse>(url, {
          params,
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        }),
      );
      return response.data;
    } catch (err) {
      const axiosErr = err as AxiosError;
      if (axiosErr.response?.status === 401 && retry) {
        this.invalidateToken();
        return this.get<TResponse>(endpoint, params, false);
      }
      throw err;
    }
  }

  // ── Bağlantı Testi ────────────────────────────────────────────────────────

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      await this.authenticate();
      await this.get('firms');
      return { success: true, message: 'Logo Wing bağlantısı başarılı.' };
    } catch (err) {
      const message = (err as Error).message || 'Bilinmeyen hata';
      return { success: false, message };
    }
  }

  // ── Domain Metodları ─────────────────────────────────────────────────────

  async createArp(data: LogoArpCard): Promise<unknown> {
    return this.post('Arps', data);
  }

  async findArpByCode(code: string): Promise<unknown> {
    return this.get('Arps', { $filter: `code eq '${code}'`, $top: '1' });
  }

  async createSalesInvoice(data: LogoSalesInvoice): Promise<unknown> {
    return this.post('salesInvoices', data);
  }

  async createPurchaseInvoice(data: LogoPurchaseInvoice): Promise<unknown> {
    return this.post('purchaseInvoices', data);
  }

  async createCollectionSlip(data: LogoCollectionSlip): Promise<unknown> {
    return this.post('collectionSlips', data);
  }

  async createPaymentSlip(data: LogoPaymentSlip): Promise<unknown> {
    return this.post('paymentSlips', data);
  }

  async getArpTransactions(arpCode: string): Promise<unknown> {
    return this.get('ArpTransactions', { $filter: `clCard/code eq '${arpCode}'` });
  }
}
