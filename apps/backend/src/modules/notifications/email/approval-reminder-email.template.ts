/**
 * 72s onay hatırlatma e-postası — müşteriye.
 * Atama / operasyon bildirimi (mavi enterprise) şablonundan kasıtlı olarak ayrılır;
 * aşinalık riski için sıcak / charcoal aciliyet dili kullanır.
 * Logo: resmi kurumsal PNG (`email-brand.util`).
 */

import { resolveWelcomeEmailLogoUrl } from './email-brand.util';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export type ApprovalReminderEmailData = {
  /** Müşteri yetkilisi adı soyadı */
  recipientName?: string | null;
  fileNo: string;
  /** Müşteri ünvanı — hitapta üst satır */
  customerName: string;
  /** Dosya özeti: sigorta şirketi */
  insuranceCompanyName?: string | null;
  /** Dosya özeti: sigortalı adı soyadı */
  insuredName?: string | null;
  /** Dosya özeti: İl / İlçe */
  cityDistrict?: string | null;
  hoursWaiting: number;
  actionUrl?: string | null;
  portalUrl?: string | null;
};

function buildCustomerGreetingHtml(data: ApprovalReminderEmailData): string {
  const title = (data.customerName || '').trim();
  const person = (data.recipientName || '').trim();
  const titleHtml = title
    ? `<p style="margin:0 0 4px;font-size:15px;line-height:1.5;color:#1C1917;font-weight:800;">${escapeHtml(title)}</p>`
    : '';
  const sayin = person
    ? `Sayın ${escapeHtml(person)},`
    : 'Sayın Yetkili,';
  return `${titleHtml}<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#1C1917;font-weight:700;">${sayin}</p>`;
}

function buildCustomerGreetingText(data: ApprovalReminderEmailData): string {
  const title = (data.customerName || '').trim();
  const person = (data.recipientName || '').trim();
  const sayin = person ? `Sayın ${person},` : 'Sayın Yetkili,';
  return title ? `${title}\n${sayin}` : sayin;
}

function summaryValue(value?: string | null): string {
  const v = (value || '').trim();
  return escapeHtml(v || '—');
}

export function buildApprovalReminderEmailHtml(data: ApprovalReminderEmailData): string {
  const fileNo = escapeHtml(data.fileNo);
  void data.hoursWaiting; // eşik maali; özet satırında sabit 72 Saat+ gösterilir
  const greetingBlock = buildCustomerGreetingHtml(data);
  const actionUrl = data.actionUrl ? escapeHtml(data.actionUrl) : '';
  const logoUrl = escapeHtml(resolveWelcomeEmailLogoUrl(data.portalUrl ?? undefined));
  const insuranceCompany = summaryValue(data.insuranceCompanyName);
  const insuredName = summaryValue(data.insuredName);
  const cityDistrict = summaryValue(data.cityDistrict);

  const actionBlock = actionUrl
    ? `
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:8px 0 6px;">
                <tr>
                  <td align="center" style="padding:0 0 8px;">
                    <a href="${actionUrl}"
                       style="display:inline-block;background:#1C1917;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:10px;font-size:14px;font-weight:800;">
                      Onayı Tamamlayın
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="font-size:12px;color:#78716C;padding-bottom:4px;">
                    Buton çalışmazsa lütfen dosya sorumlunuzla iletişime geçin.
                  </td>
                </tr>
              </table>`
    : '';

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Onay Süresi Aşıldı</title>
</head>
<body style="margin:0;padding:0;background:#F5F0E8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#F5F0E8;padding:32px 16px;">
    <tr><td align="center">
      <table width="640" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;max-width:640px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #E7E0D4;box-shadow:0 8px 24px rgba(28,25,23,.08);">

        <tr>
          <td style="padding:14px 24px;background:#FAFAF9;border-bottom:1px solid #E7E0D4;">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="vertical-align:middle;">
                  <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#A8A29E;">Onay Hatırlatması</div>
                </td>
                <td align="right" style="vertical-align:middle;">
                  <img src="${logoUrl}" alt="Meridyen Asistans" width="120" style="display:block;width:120px;max-width:100%;height:auto;margin:0 0 0 auto;border:0;outline:none;text-decoration:none;"/>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:22px 24px 20px;background:linear-gradient(135deg,#9A3412 0%,#C2410C 45%,#EA580C 100%);">
            <div style="display:inline-block;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.28);color:#FFF7ED;font-size:11px;font-weight:700;letter-spacing:.04em;padding:5px 10px;border-radius:999px;margin-bottom:12px;">
              72 Saat+
            </div>
            <h1 style="margin:0 0 8px;font-size:22px;line-height:1.25;font-weight:800;color:#ffffff;">Onay Süresi Aşıldı</h1>
            <p style="margin:0;font-size:14px;line-height:1.55;color:rgba(255,255,255,.92);">
              ${fileNo} Numaralı Dosya İşlemi.
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding:26px 24px 10px;background:#ffffff;">
            ${greetingBlock}
            <p style="margin:0 0 18px;font-size:14px;line-height:1.65;color:#57534E;">
              Operasyon sürecinin ilerleyebilmesi için lütfen dosya durumunu netleştiriniz.
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 20px;border:1px solid #E7E0D4;border-radius:12px;overflow:hidden;background:#ffffff;">
              <tr>
                <td colspan="2" style="padding:14px 16px;background:#FFF7ED;font-size:13px;font-weight:800;color:#9A3412;border-bottom:1px solid #FED7AA;">
                  Dosya Özeti
                </td>
              </tr>
              <tr>
                <td style="width:34%;padding:13px 16px;border-top:1px solid #F5F5F4;font-size:13px;font-weight:700;color:#78716C;background:#ffffff;">Sigorta Şirketi</td>
                <td style="padding:13px 16px;border-top:1px solid #F5F5F4;font-size:14px;color:#1C1917;background:#ffffff;">${insuranceCompany}</td>
              </tr>
              <tr>
                <td style="padding:13px 16px;border-top:1px solid #F5F5F4;font-size:13px;font-weight:700;color:#78716C;background:#FAFAF9;">Dosya No</td>
                <td style="padding:13px 16px;border-top:1px solid #F5F5F4;font-size:14px;color:#1C1917;font-weight:800;font-variant-numeric:tabular-nums;background:#FAFAF9;">${fileNo}</td>
              </tr>
              <tr>
                <td style="padding:13px 16px;border-top:1px solid #F5F5F4;font-size:13px;font-weight:700;color:#78716C;background:#ffffff;">Sigortalı Adı Soyadı</td>
                <td style="padding:13px 16px;border-top:1px solid #F5F5F4;font-size:14px;color:#1C1917;background:#ffffff;">${insuredName}</td>
              </tr>
              <tr>
                <td style="padding:13px 16px;border-top:1px solid #F5F5F4;font-size:13px;font-weight:700;color:#78716C;background:#FAFAF9;">İl / İlçe</td>
                <td style="padding:13px 16px;border-top:1px solid #F5F5F4;font-size:14px;color:#1C1917;background:#FAFAF9;">${cityDistrict}</td>
              </tr>
              <tr>
                <td style="padding:13px 16px;border-top:1px solid #F5F5F4;font-size:13px;font-weight:700;color:#78716C;background:#ffffff;">Bekleme</td>
                <td style="padding:13px 16px;border-top:1px solid #F5F5F4;font-size:14px;color:#C2410C;font-weight:800;background:#ffffff;">72 Saat+</td>
              </tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 22px;background:#FFFBEB;border:1px solid #FDE68A;border-left:4px solid #D97706;border-radius:10px;">
              <tr>
                <td style="padding:14px 16px;">
                  <div style="font-size:12px;font-weight:800;color:#B45309;margin-bottom:4px;">Sonraki Adım</div>
                  <div style="font-size:13px;line-height:1.55;color:#78350F;">
                    Lütfen dosya durumunu netleştiriniz.
                  </div>
                </td>
              </tr>
            </table>

            ${actionBlock}
          </td>
        </tr>

        <tr>
          <td style="padding:18px 24px 22px;background:#FAFAF9;border-top:1px solid #E7E0D4;">
            <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#44403C;text-align:center;">Meridyen Asistans</p>
            <p style="margin:0 0 8px;font-size:11px;line-height:1.5;color:#78716C;text-align:center;">
              Safran Birleşik Hizmetler Yan Kuruluşudur.
            </p>
            <p style="margin:0;font-size:11px;line-height:1.5;color:#A8A29E;text-align:center;">
              Bu e-posta onay gecikmesi nedeniyle müşteriye otomatik gönderilmiştir.<br/>
              Operasyon atama bildirimlerinden bağımsız bir hatırlatmadır.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function buildApprovalReminderEmailSubject(fileNo: string): string {
  return `Onay Hatırlatması — ${fileNo}`;
}

export function buildApprovalReminderEmailText(data: ApprovalReminderEmailData): string {
  return [
    buildCustomerGreetingText(data),
    '',
    `${data.fileNo} Numaralı Dosya İşlemi.`,
    `Sigorta Şirketi: ${(data.insuranceCompanyName || '').trim() || '—'}`,
    `Dosya No: ${data.fileNo}`,
    `Sigortalı Adı Soyadı: ${(data.insuredName || '').trim() || '—'}`,
    `İl / İlçe: ${(data.cityDistrict || '').trim() || '—'}`,
    'Bekleme: 72 Saat+',
    '',
    'Operasyon sürecinin ilerleyebilmesi için lütfen dosya durumunu netleştiriniz.',
    data.actionUrl ? `Onayı tamamlamak için: ${data.actionUrl}` : 'Lütfen dosya sorumlunuzla iletişime geçerek onayı tamamlayın.',
    '',
    'Meridyen Asistans',
    'Safran Birleşik Hizmetler Yan Kuruluşudur.',
  ].join('\n');
}
