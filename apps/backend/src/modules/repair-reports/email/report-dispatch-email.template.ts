import { resolveWelcomeEmailLogoUrl } from '@/modules/notifications/email/email-brand.util';

/**
 * Onarım raporu teslim maili — operasyon bildirimi kartı, teal palet.
 * Operasyon mavisi ve 72s turuncusu kullanılmaz; PDF teslimi ayrı renk.
 */

const TEAL_DEEP = '#042F2E';
const TEAL_MID = '#115E59';
const TEAL = '#0F766E';
const TEAL_SOFT = '#F0FDFA';
const TEAL_LINE = '#99F6E4';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export type ReportDispatchEmailData = {
  reportNo: string;
  fileNo?: string | null;
  actionUrl?: string | null;
  portalUrl?: string | null;
};

export function buildReportDispatchEmailHtml(data: ReportDispatchEmailData): string {
  const reportNo = escapeHtml(data.reportNo);
  const fileNo = escapeHtml((data.fileNo || '').trim() || '—');
  const logoUrl = escapeHtml(resolveWelcomeEmailLogoUrl(data.portalUrl ?? undefined));
  const actionUrl = data.actionUrl ? escapeHtml(data.actionUrl) : '';
  const title = 'Hasar Onarım Raporu';
  const preheader = `${data.reportNo} numaralı dış kullanım raporu PDF ektedir.`;

  const actionButton = actionUrl
    ? `
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 10px;">
                <tr>
                  <td align="center" style="padding:0 0 8px;">
                    <a href="${actionUrl}"
                       style="display:inline-block;background:${TEAL};color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:10px;font-size:14px;font-weight:800;box-shadow:0 4px 12px rgba(15,118,110,.28);">
                      Dosyayı Görüntüle
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="font-size:12px;color:#64748B;padding-bottom:8px;">
                    PDF ektedir. Buton çalışmazsa panele giriş yapıp ilgili kaydı arayın.
                  </td>
                </tr>
              </table>`
    : `
              <p style="margin:0 0 10px;font-size:13px;line-height:1.55;color:#64748B;text-align:center;">
                PDF ektedir. Panele giriş yapıp ilgili kaydı arayın.
              </p>`;

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#E2E8F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#E2E8F0;padding:32px 16px;">
    <tr><td align="center">
      <table width="640" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;max-width:640px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #E2E8F0;box-shadow:0 8px 24px rgba(15,23,42,.06);">

        <tr>
          <td style="padding:14px 24px;background:#ffffff;border-bottom:2px solid ${TEAL};">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="vertical-align:middle;">
                  <div style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#64748B;">Rapor Bildirimi</div>
                </td>
                <td align="right" style="vertical-align:middle;">
                  <img src="${logoUrl}" alt="Meridyen Asistans" width="120" style="display:block;width:120px;max-width:100%;height:auto;margin:0 0 0 auto;border:0;outline:none;text-decoration:none;"/>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:22px 24px 20px;background:linear-gradient(135deg,${TEAL_DEEP} 0%,${TEAL_MID} 55%,${TEAL} 100%);">
            <div style="display:inline-block;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.22);color:#FFFFFF;font-size:11px;font-weight:700;letter-spacing:.04em;padding:5px 10px;border-radius:999px;margin-bottom:12px;">Dış kullanım PDF</div>
            <h1 style="margin:0 0 8px;font-size:22px;line-height:1.25;font-weight:800;color:#ffffff;">${escapeHtml(title)}</h1>
            <p style="margin:0;font-size:14px;line-height:1.55;color:rgba(255,255,255,.88);">${escapeHtml(preheader)}</p>
          </td>
        </tr>

        <tr>
          <td style="padding:26px 24px 8px;background:#ffffff;">
            <p style="margin:0 0 18px;font-size:14px;line-height:1.65;color:#64748B;">İlgili kaydı inceleyebilir, süreci panel üzerinden takip edebilirsiniz.</p>

            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 22px;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;background:#ffffff;">
              <tr>
                <td colspan="2" style="padding:14px 16px;background:#F8FAFC;font-size:13px;font-weight:800;color:${TEAL_MID};border-bottom:1px solid #E2E8F0;">
                  Özet
                </td>
              </tr>
              <tr>
                <td style="width:34%;padding:13px 16px;border-top:1px solid #E2E8F0;font-size:13px;font-weight:700;color:#64748B;background:#ffffff;">Dosya No</td>
                <td style="padding:13px 16px;border-top:1px solid #E2E8F0;font-size:14px;color:#0F172A;font-weight:800;font-variant-numeric:tabular-nums;background:#ffffff;">${fileNo}</td>
              </tr>
              <tr>
                <td style="width:34%;padding:13px 16px;border-top:1px solid #E2E8F0;font-size:13px;font-weight:700;color:#64748B;background:#F8FAFC;">Rapor No</td>
                <td style="padding:13px 16px;border-top:1px solid #E2E8F0;font-size:14px;color:#0F172A;font-weight:800;font-variant-numeric:tabular-nums;background:#F8FAFC;">${reportNo}</td>
              </tr>
              <tr>
                <td style="width:34%;padding:13px 16px;border-top:1px solid #E2E8F0;font-size:13px;font-weight:700;color:#64748B;background:#ffffff;">Ek</td>
                <td style="padding:13px 16px;border-top:1px solid #E2E8F0;font-size:14px;color:#0F172A;background:#ffffff;">Dış kullanım PDF</td>
              </tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 22px;background:${TEAL_SOFT};border:1px solid ${TEAL_LINE};border-left:4px solid ${TEAL};border-radius:10px;">
              <tr>
                <td style="padding:14px 16px;">
                  <div style="font-size:12px;font-weight:800;color:${TEAL};margin-bottom:4px;">Ek</div>
                  <div style="font-size:13px;line-height:1.55;color:${TEAL_MID};">Maliyet veya kâr sütunu bu e-postada yoktur. Yalnız dış kullanım raporu eklenir.</div>
                </td>
              </tr>
            </table>

            ${actionButton}
          </td>
        </tr>

        <tr>
          <td style="padding:18px 24px 22px;background:#F8FAFC;border-top:1px solid #E2E8F0;">
            <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:${TEAL_MID};text-align:center;">Meridyen Asistans</p>
            <p style="margin:0;font-size:11px;line-height:1.5;color:#94A3B8;text-align:center;">
              Bu e-posta otomatik olarak gönderilmiştir.<br/>Safran Birleşik Hizmetler Alt Kuruluşudur.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function buildReportDispatchEmailText(data: ReportDispatchEmailData): string {
  const fileNo = (data.fileNo || '').trim() || '—';
  const lines = [
    'Hasar Onarım Raporu',
    `${data.reportNo} numaralı dış kullanım raporu PDF ektedir.`,
    `Dosya No: ${fileNo}`,
    `Rapor No: ${data.reportNo}`,
    'Ek: Dış kullanım PDF',
  ];
  if (data.actionUrl) lines.push(data.actionUrl);
  return lines.join('\n');
}
