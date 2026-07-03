import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface M365Credentials {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

export interface M365MailboxProbe {
  address: string;
  label: string;
  ok: boolean;
  totalItems?: number;
  error?: string;
}

export interface M365ConnectionTestResult {
  success: boolean;
  message: string;
  mailboxes: M365MailboxProbe[];
}

@Injectable()
export class GraphAuthService {
  private readonly logger = new Logger(GraphAuthService.name);

  constructor(private readonly http: HttpService) {}

  async getAccessToken(creds: M365Credentials): Promise<string> {
    const url = `https://login.microsoftonline.com/${creds.tenantId}/oauth2/v2.0/token`;
    const body = new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    });

    try {
      const res = await firstValueFrom(
        this.http.post<{ access_token?: string; error?: string; error_description?: string }>(
          url,
          body.toString(),
          {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            validateStatus: () => true,
          },
        ),
      );

      if (res.status >= 400 || !res.data.access_token) {
        const desc = res.data.error_description ?? res.data.error ?? `HTTP ${res.status}`;
        throw new Error(this.translateTokenError(desc, res.status));
      }
      return res.data.access_token;
    } catch (err) {
      if (err instanceof Error && !err.message.includes('status code')) throw err;
      throw new Error(
        'Microsoft oturum açılamadı. Gizli anahtarı (Client Secret) Azure’dan yeniden oluşturup yapıştırın.',
      );
    }
  }

  async testConnection(
    creds: M365Credentials,
    mailboxes: { address: string; label: string }[],
  ): Promise<M365ConnectionTestResult> {
    try {
      const token = await this.getAccessToken(creds);
      const probes: M365MailboxProbe[] = [];

      for (const mb of mailboxes) {
        probes.push(await this.probeMailbox(token, mb.address, mb.label));
      }

      const allOk = probes.every((p) => p.ok);
      const anyOk = probes.some((p) => p.ok);

      if (allOk) {
        return {
          success: true,
          message:
            'Microsoft 365 bağlantısı başarılı. Her iki paylaşımlı kutu okunabiliyor. '
            + 'E-posta yanıtlamak için Azure’da Mail.Send (Uygulama) izni ve yönetici onayı gerekir.',
          mailboxes: probes,
        };
      }
      if (anyOk) {
        return {
          success: false,
          message: 'Bağlantı kısmen başarılı — bazı kutular okunamadı. Adresleri ve Exchange erişimini kontrol edin.',
          mailboxes: probes,
        };
      }
      return {
        success: false,
        message: 'Posta kutularına erişilemedi. Mail.Read izni ve paylaşımlı kutu erişimini kontrol edin.',
        mailboxes: probes,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Bağlantı testi başarısız';
      this.logger.warn(`M365 test failed: ${message}`);
      return {
        success: false,
        message,
        mailboxes: mailboxes.map((mb) => ({
          address: mb.address,
          label: mb.label,
          ok: false,
          error: message,
        })),
      };
    }
  }

  private async probeMailbox(
    token: string,
    address: string,
    label: string,
  ): Promise<M365MailboxProbe> {
    try {
      const encoded = encodeURIComponent(address);
      const url = `https://graph.microsoft.com/v1.0/users/${encoded}/mailFolders/inbox?$select=displayName,totalItemCount`;
      const res = await firstValueFrom(
        this.http.get<{ totalItemCount?: number }>(url, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      );
      return {
        address,
        label,
        ok: true,
        totalItems: res.data.totalItemCount ?? 0,
      };
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { error?: { message?: string } } } };
      const status = axiosErr.response?.status;
      const graphMsg = axiosErr.response?.data?.error?.message;
      let error = graphMsg ?? 'Erişim reddedildi';
      if (status === 404) error = 'Posta kutusu bulunamadı';
      if (status === 403) error = 'Erişim izni yok (Mail.Read veya kutu erişimi)';
      return { address, label, ok: false, error };
    }
  }

  private translateTokenError(desc: string, status?: number): string {
    const lower = desc.toLowerCase();
    if (status === 401 || lower.includes('invalid_client') || lower.includes('client secret') || lower.includes('unauthorized')) {
      return 'Gizli anahtar (Client Secret) hatalı veya süresi dolmuş. Azure’da yeni secret oluşturup Değer sütununu kopyalayın.';
    }
    if (lower.includes('invalid_request') || status === 400) {
      return 'Kiracı kimliği (Tenant ID) veya uygulama kimliği (Client ID) hatalı olabilir.';
    }
    return desc;
  }
}
