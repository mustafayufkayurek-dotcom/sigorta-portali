import { resolveWelcomeEmailLogoUrl } from './email-brand.util';

/** Şifre / davet ve geriye uyumlu basit şablon verisi */
export interface EmailTemplateData {
  title: string;
  preheader?: string;
  rows: Array<{ label: string; value?: string; html?: string }>;
  actionUrl?: string;
  actionLabel?: string;
  footerNote?: string;
}

/** Operasyon bilgilendirme mailleri (dosya atama, SLA, rapor vb.) */
export interface NotificationEmailTemplateData extends EmailTemplateData {
  badgeLabel?: string;
  summaryTitle?: string;
  greeting?: string;
  bodyNote?: string;
  nextStepTitle?: string;
  nextStepText?: string;
  portalUrl?: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const EXTERNAL_PORTAL_ROLE_CODES = new Set([
  'expert',
  'insurance_company_user',
  'broker_user',
  'assistance_company_user',
]);

export function isMeridyenStaffRole(roleCode?: string | null): boolean {
  const code = String(roleCode ?? '').trim().toLowerCase();
  if (!code) return false;
  return !EXTERNAL_PORTAL_ROLE_CODES.has(code);
}

/** Firma satırı — Meridyen personelinde yok; dış kullanıcıda ismin üstünde durur. */
export function organizationLineForMail(
  organizationName?: string | null,
  roleCode?: string | null,
): string | undefined {
  const name = String(organizationName ?? '').trim();
  if (!name) return undefined;
  if (isMeridyenStaffRole(roleCode)) return undefined;
  return name;
}

/** Onay / şifre: «Sn. Ad Soyad» — firma adı selamlama satırına yazılmaz. */
export function formatSnPersonGreeting(
  firstName?: string | null,
  lastName?: string | null,
  fullName?: string | null,
  organizationName?: string | null,
): string {
  const fromParts = [String(firstName ?? '').trim(), String(lastName ?? '').trim()]
    .filter(Boolean)
    .join(' ');
  let name = fromParts || String(fullName ?? '').replace(/^(sayın|sn\.?)\s+/i, '').trim();
  const org = String(organizationName ?? '').trim();
  if (org && name && name.localeCompare(org, 'tr', { sensitivity: 'accent' }) === 0) {
    name = '';
  }
  if (!name || /^(yetkili|kullanıcı|kullanici)$/i.test(name)) {
    return 'Sn. Yetkili,';
  }
  return `Sn. ${name},`;
}

export function formatTrDateTime(date: Date): string {
  return date.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function joinMailSubjectParts(...parts: Array<string | null | undefined>): string {
  return parts.map((p) => String(p ?? '').trim()).filter(Boolean).join('-');
}

/** 1. Eksperden / sigortadan onay istenirken */
export function onarimRaporuRequestSubject(
  insuranceCompanyName?: string | null,
  fileNo?: string | null,
): string {
  return joinMailSubjectParts(insuranceCompanyName, fileNo, 'Onay Talep');
}

/** 2–3. Eksper onay verdi / içeride rapor onaylandı */
export function raporOnaylandiSubject(
  insuranceCompanyName?: string | null,
  fileNo?: string | null,
): string {
  return joinMailSubjectParts('Rapor Onaylandı', insuranceCompanyName, fileNo);
}

export function buildRaporOnaylandiEmailHtml(params: {
  insuranceCompanyName?: string | null;
  fileNo?: string | null;
  approvedBy?: string | null;
  approvedAt?: Date | string | null;
  greeting?: string;
  intro?: string;
  actionUrl?: string;
  portalUrl?: string;
}): string {
  return buildTransactionalEmailHtml({
    title: 'Rapor Onaylandı',
    organizationName: String(params.insuranceCompanyName ?? '').trim() || undefined,
    greeting: params.greeting,
    intro:
      params.intro
      || 'Eksper onarım raporunu onaylanmıştır.\nOperasyon planlama aşamasına geçiniz.',
    bodyHtml: buildRaporOnaylandiSummaryHtml({
      insuranceCompanyName: params.insuranceCompanyName,
      fileNo: params.fileNo,
      approvedBy: params.approvedBy,
      approvedAt: params.approvedAt,
    }),
    actionUrl: params.actionUrl,
    actionLabel: 'Raporu Görüntüle',
    portalUrl: params.portalUrl,
  });
}

export function buildRaporOnaylandiSummaryHtml(params: {
  insuranceCompanyName?: string | null;
  fileNo?: string | null;
  approvedBy?: string | null;
  approvedAt?: Date | string | null;
}): string {
  const company = escapeHtml(String(params.insuranceCompanyName ?? '').trim() || '—');
  const fileNo = escapeHtml(String(params.fileNo ?? '').trim() || '—');
  const approvedBy = String(params.approvedBy ?? '').trim();
  const approvedAtRaw = params.approvedAt
    ? params.approvedAt instanceof Date
      ? params.approvedAt
      : new Date(params.approvedAt)
    : null;
  const approvedAt =
    approvedAtRaw && !Number.isNaN(approvedAtRaw.getTime())
      ? escapeHtml(formatTrDateTime(approvedAtRaw))
      : '';
  const extra = approvedBy
    ? `
              <tr>
                <td style="width:34%;padding:13px 16px;border-top:1px solid #E2E8F0;font-size:13px;font-weight:700;color:#64748B;">Onaylayan</td>
                <td style="padding:13px 16px;border-top:1px solid #E2E8F0;font-size:14px;color:#0F172A;">${escapeHtml(approvedBy)}</td>
              </tr>`
    : approvedAt
      ? `
              <tr>
                <td style="width:34%;padding:13px 16px;border-top:1px solid #E2E8F0;font-size:13px;font-weight:700;color:#64748B;">Onay tarihi</td>
                <td style="padding:13px 16px;border-top:1px solid #E2E8F0;font-size:14px;color:#0F172A;">${approvedAt}</td>
              </tr>`
      : '';
  return `
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;background:#ffffff;">
              <tr>
                <td colspan="2" style="padding:14px 16px;background:#F8FAFC;font-size:13px;font-weight:800;color:#123A63;border-bottom:1px solid #E2E8F0;">Dosya Özeti</td>
              </tr>
              <tr>
                <td style="width:34%;padding:13px 16px;border-top:1px solid #E2E8F0;font-size:13px;font-weight:700;color:#64748B;">Sigorta şirketi</td>
                <td style="padding:13px 16px;border-top:1px solid #E2E8F0;font-size:14px;font-weight:800;color:#0F172A;">${company}</td>
              </tr>
              <tr>
                <td style="width:34%;padding:13px 16px;border-top:1px solid #E2E8F0;font-size:13px;font-weight:700;color:#64748B;background:#F8FAFC;">Dosya No</td>
                <td style="padding:13px 16px;border-top:1px solid #E2E8F0;font-size:14px;color:#0F172A;background:#F8FAFC;">${fileNo}</td>
              </tr>${extra}
            </table>`;
}

export function buildExternalApprovalSummaryHtml(params: {
  insuranceCompanyName: string;
  fileNo: string;
  sentAt: Date;
}): string {
  const company = escapeHtml(params.insuranceCompanyName?.trim() || '—');
  const fileNo = escapeHtml(params.fileNo?.trim() || '—');
  const sentAt = escapeHtml(formatTrDateTime(params.sentAt));
  return `
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;background:#ffffff;">
              <tr>
                <td colspan="2" style="padding:14px 16px;background:#F8FAFC;font-size:13px;font-weight:800;color:#123A63;border-bottom:1px solid #E2E8F0;">Rapor Özeti</td>
              </tr>
              <tr>
                <td style="width:34%;padding:13px 16px;border-top:1px solid #E2E8F0;font-size:13px;font-weight:700;color:#64748B;">Sigorta şirketi</td>
                <td style="padding:13px 16px;border-top:1px solid #E2E8F0;font-size:14px;font-weight:800;color:#0F172A;">${company}</td>
              </tr>
              <tr>
                <td style="width:34%;padding:13px 16px;border-top:1px solid #E2E8F0;font-size:13px;font-weight:700;color:#64748B;background:#F8FAFC;">Dosya No</td>
                <td style="padding:13px 16px;border-top:1px solid #E2E8F0;font-size:14px;color:#0F172A;background:#F8FAFC;">${fileNo}</td>
              </tr>
              <tr>
                <td style="width:34%;padding:13px 16px;border-top:1px solid #E2E8F0;font-size:13px;font-weight:700;color:#64748B;">Onay Gönderim tarihi</td>
                <td style="padding:13px 16px;border-top:1px solid #E2E8F0;font-size:14px;color:#0F172A;">${sentAt}</td>
              </tr>
            </table>
            <p style="margin:0 0 8px;font-size:14px;line-height:1.7;color:#64748B;">Rapor PDF ektedir. İncelemek ve onaylamak için aşağıdaki düğmeyi kullanın.</p>
        `;
}

function buildTemporaryPasswordEmailBlock(temporaryPassword: string): string {
  const safePassword = escapeHtml(temporaryPassword);

  return `
    <div style="background:#0f172a;border-radius:8px;padding:12px 14px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="vertical-align:middle;">
            <div style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace;font-size:16px;font-weight:600;color:#ffffff;letter-spacing:0.04em;word-break:break-all;-webkit-user-select:all;user-select:all;">
              ${safePassword}
            </div>
          </td>
          <td align="right" valign="middle" style="padding-left:12px;white-space:nowrap;vertical-align:middle;">
            <span style="display:inline-block;border:1px solid rgba(255,255,255,0.25);background:rgba(255,255,255,0.1);color:#ffffff;padding:6px 10px;border-radius:6px;font-size:11px;font-weight:600;line-height:1;">
              Kopyala
            </span>
          </td>
        </tr>
      </table>
      <p style="margin:8px 0 0;font-size:11px;color:#cbd5e1;line-height:1.45;">
        Şifreyi seçmek için üzerine dokunun veya tıklayın, ardından kopyalayın.
      </p>
    </div>`;
}

/**
 * Basit şablon — şifre / davet mailleri için.
 * Enterprise bilgilendirme tasarımına bağlanmaz; kasten ayrı tutulur.
 */
export function buildEmailHtml(data: EmailTemplateData): string {
  const rows = data.rows
    .map(
      (r) => `
      <tr>
        <td style="padding:8px 12px;background:#f9fafb;border-bottom:1px solid #e5e7eb;font-size:13px;color:#6b7280;width:40%;white-space:nowrap;vertical-align:top;">${escapeHtml(r.label)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#111827;">${r.html ?? escapeHtml(r.value ?? '—')}</td>
      </tr>`,
    )
    .join('');

  const actionButton = data.actionUrl
    ? `
    <div style="text-align:center;margin:32px 0;">
      <a href="${escapeHtml(data.actionUrl)}"
         style="display:inline-block;background:#1852a0;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:600;letter-spacing:.3px;">
        ${escapeHtml(data.actionLabel ?? 'Dosyayı Görüntüle')}
      </a>
    </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(data.title)}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0b1f3a 0%,#1852a0 100%);padding:28px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <div style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-.3px;">Meridyen Assistance</div>
                  <div style="font-size:12px;color:rgba(255,255,255,.75);margin-top:2px;">Hasar Platformu</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#111827;">${escapeHtml(data.title)}</h1>
            ${data.preheader ? `<p style="margin:0 0 24px;font-size:14px;color:#6b7280;">${escapeHtml(data.preheader)}</p>` : '<div style="margin-bottom:24px;"></div>'}

            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
              ${rows}
            </table>

            ${actionButton}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
              Bu email otomatik olarak gönderilmiştir.
              ${data.footerNote ? `<br/>${escapeHtml(data.footerNote)}` : ''}
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Enterprise bilgilendirme şablonu — dosya atama, SLA, rapor onay/red vb.
 * Şifre / davet maillerinde kullanılmaz.
 */
export function buildNotificationEmailHtml(data: NotificationEmailTemplateData): string {
  const logoUrl = escapeHtml(resolveWelcomeEmailLogoUrl(data.portalUrl));
  const summaryTitle = escapeHtml(data.summaryTitle ?? 'Özet');
  const actionLabel = escapeHtml(data.actionLabel ?? 'Dosyayı Görüntüle');
  const title = escapeHtml(data.title);
  const preheader = data.preheader ? escapeHtml(data.preheader) : '';
  const badgeLabel = data.badgeLabel ? escapeHtml(data.badgeLabel) : '';
  const greeting = data.greeting ? escapeHtml(data.greeting) : '';
  const bodyNote = data.bodyNote
    ? escapeHtml(data.bodyNote)
    : 'İlgili kaydı inceleyebilir, süreci panel üzerinden takip edebilirsiniz.';
  const nextStepTitle = escapeHtml(data.nextStepTitle ?? 'Sonraki Adım');
  const nextStepText = data.nextStepText ? escapeHtml(data.nextStepText) : '';
  const footerNote = data.footerNote ? escapeHtml(data.footerNote) : '';
  const safeActionUrl = data.actionUrl ? escapeHtml(data.actionUrl) : '';

  const rows = data.rows
    .map((r, index) => {
      const zebra = index % 2 === 1 ? 'background:#F8FAFC;' : 'background:#ffffff;';
      const valueCell = r.html ?? escapeHtml(r.value ?? '—');
      const valueStrong =
        r.label === 'Dosya No' || r.label === 'Rapor No'
          ? 'font-weight:800;font-variant-numeric:tabular-nums;'
          : '';
      return `
      <tr>
        <td style="width:34%;padding:13px 16px;border-top:1px solid #E2E8F0;font-size:13px;font-weight:700;color:#64748B;${zebra}">${escapeHtml(r.label)}</td>
        <td style="padding:13px 16px;border-top:1px solid #E2E8F0;font-size:14px;color:#0F172A;${valueStrong}${zebra}">${valueCell}</td>
      </tr>`;
    })
    .join('');

  const badgeHtml = badgeLabel
    ? `<div style="display:inline-block;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.22);color:#FFFFFF;font-size:11px;font-weight:700;letter-spacing:.04em;padding:5px 10px;border-radius:999px;margin-bottom:12px;">${badgeLabel}</div>`
    : '';

  const greetingHtml = greeting
    ? `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#0F172A;font-weight:700;">${greeting}</p>`
    : '';

  const bodyNoteHtml = `<p style="margin:0 0 18px;font-size:14px;line-height:1.65;color:#64748B;">${bodyNote}</p>`;

  const nextStepHtml = nextStepText
    ? `
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 22px;background:#EFF6FF;border:1px solid #BFDBFE;border-left:4px solid #1E5AA8;border-radius:10px;">
                <tr>
                  <td style="padding:14px 16px;">
                    <div style="font-size:12px;font-weight:800;color:#1E5AA8;margin-bottom:4px;">${nextStepTitle}</div>
                    <div style="font-size:13px;line-height:1.55;color:#123A63;">${nextStepText}</div>
                  </td>
                </tr>
              </table>`
    : '';

  const actionButton = safeActionUrl
    ? `
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 10px;">
                <tr>
                  <td align="center" style="padding:0 0 8px;">
                    <a href="${safeActionUrl}"
                       style="display:inline-block;background:#1E5AA8;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:10px;font-size:14px;font-weight:800;box-shadow:0 4px 12px rgba(30,90,168,.28);">
                      ${actionLabel}
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="font-size:12px;color:#64748B;padding-bottom:8px;">
                    Buton çalışmazsa panele giriş yapıp ilgili kaydı arayın.
                  </td>
                </tr>
              </table>`
    : '';

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#E2E8F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#E2E8F0;padding:32px 16px;">
    <tr><td align="center">
      <table width="640" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;max-width:640px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #E2E8F0;box-shadow:0 8px 24px rgba(15,23,42,.06);">

        <tr>
          <td style="padding:14px 24px;background:#ffffff;border-bottom:2px solid #1E5AA8;">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="vertical-align:middle;">
                  <div style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#64748B;">Operasyon Bildirimi</div>
                </td>
                <td align="right" style="vertical-align:middle;">
                  <img src="${logoUrl}" alt="Meridyen Asistans" width="120" style="display:block;width:120px;max-width:100%;height:auto;margin:0 0 0 auto;border:0;outline:none;text-decoration:none;"/>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:22px 24px 20px;background:linear-gradient(135deg,#0b2847 0%,#123A63 55%,#1E5AA8 100%);">
            ${badgeHtml}
            <h1 style="margin:0 0 8px;font-size:22px;line-height:1.25;font-weight:800;color:#ffffff;">${title}</h1>
            ${
              preheader
                ? `<p style="margin:0;font-size:14px;line-height:1.55;color:rgba(255,255,255,.88);">${preheader}</p>`
                : ''
            }
          </td>
        </tr>

        <tr>
          <td style="padding:26px 24px 8px;background:#ffffff;">
            ${greetingHtml}
            ${bodyNoteHtml}

            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 22px;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;background:#ffffff;">
              <tr>
                <td colspan="2" style="padding:14px 16px;background:#F8FAFC;font-size:13px;font-weight:800;color:#123A63;border-bottom:1px solid #E2E8F0;">
                  ${summaryTitle}
                </td>
              </tr>
              ${rows}
            </table>

            ${nextStepHtml}
            ${actionButton}
          </td>
        </tr>

        <tr>
          <td style="padding:18px 24px 22px;background:#F8FAFC;border-top:1px solid #E2E8F0;">
            <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#123A63;text-align:center;">Meridyen Asistans</p>
            <p style="margin:0;font-size:11px;line-height:1.5;color:#94A3B8;text-align:center;">
              Bu e-posta otomatik olarak gönderilmiştir.
              ${footerNote ? `<br/>${footerNote}` : '<br/>Safran Birleşik Hizmetler Alt Kuruluşudur.'}
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Hoş geldin ile aynı kabuk: logo 120px, lacivert başlık. Dış onay ve şifre sıfırlama. */
export interface TransactionalEmailData {
  title: string;
  /** Dış kullanıcıda ismin üstünde; Meridyen personelinde boş. */
  organizationName?: string;
  greeting?: string;
  intro?: string;
  bodyHtml?: string;
  actionUrl?: string;
  actionLabel?: string;
  footerNote?: string;
  portalUrl?: string;
}

export function buildTransactionalEmailHtml(data: TransactionalEmailData): string {
  const logoUrl = escapeHtml(resolveWelcomeEmailLogoUrl(data.portalUrl));
  const title = escapeHtml(data.title);
  const organizationName = data.organizationName ? escapeHtml(data.organizationName.trim()) : '';
  const greeting = data.greeting ? escapeHtml(data.greeting) : '';
  const intro = data.intro
    ? escapeHtml(data.intro).replace(/\r\n|\n|\r/g, '<br/>')
    : '';
  const actionLabel = escapeHtml(data.actionLabel ?? 'Devam Et');
  const footerNote = data.footerNote ? escapeHtml(data.footerNote) : '';
  const safeActionUrl = data.actionUrl ? escapeHtml(data.actionUrl) : '';
  const bodyHtml = data.bodyHtml ?? '';

  const actionButton = safeActionUrl
    ? `
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 18px;">
                <tr>
                  <td>
                    <a href="${safeActionUrl}" style="display:inline-block;background:#1E5AA8;color:#ffffff;text-decoration:none;padding:13px 24px;border-radius:8px;font-size:14px;font-weight:800;box-shadow:0 4px 12px rgba(30,90,168,.28);">
                      ${actionLabel}
                    </a>
                  </td>
                </tr>
              </table>`
    : '';

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0F172A;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="640" cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #E2E8F0;box-shadow:0 8px 24px rgba(15,23,42,.06);">
          <tr>
            <td style="padding:8px 20px;background:#ffffff;border-bottom:2px solid #1E5AA8;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="right" style="vertical-align:top;">
                    <img src="${logoUrl}" alt="Meridyen Asistans" width="120" style="display:block;width:120px;max-width:100%;height:auto;margin:0 0 0 auto;border:0;outline:none;text-decoration:none;"/>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 20px;background:linear-gradient(135deg,#0b2847 0%,#123A63 55%,#1E5AA8 100%);">
              <h1 style="margin:0;font-size:20px;line-height:1.28;font-weight:800;color:#ffffff;">${title}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 22px 26px;background:#ffffff;">
              ${organizationName ? `<div style="font-size:13px;font-weight:800;color:#123A63;letter-spacing:.01em;margin:0 0 2px;">${organizationName}</div>` : ''}
              ${greeting ? `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#0F172A;font-weight:700;">${greeting}</p>` : ''}
              ${intro ? `<p style="margin:0 0 18px;font-size:14px;line-height:1.7;color:#64748B;">${intro}</p>` : ''}
              ${bodyHtml}
              ${actionButton}
              ${
                footerNote
                  ? `<p style="margin:12px 0 0;color:#64748B;font-size:12px;line-height:1.55;">${footerNote}</p>`
                  : ''
              }
            </td>
          </tr>
          <tr>
            <td style="padding:18px 24px 22px;background:#F8FAFC;border-top:1px solid #E2E8F0;">
              <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#123A63;text-align:center;">Meridyen Asistans</p>
              <p style="margin:0;font-size:11px;line-height:1.5;color:#94A3B8;text-align:center;">Safran Birleşik Hizmetler Yan Kuruluşudur.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Kullanıcı davet / hoş geldin e-postası — şifre bloğu; basit şablon (değiştirilmez) */
export function buildWelcomeInviteEmailHtml(params: {
  fullName: string;
  email: string;
  temporaryPassword: string;
  loginUrl: string;
}): string {
  const safeLoginUrl = escapeHtml(params.loginUrl);

  return buildEmailHtml({
    title: 'Meridyen Assistance Hesabınız Hazır',
    preheader: 'Geçici şifrenizle giriş yapıp ilk oturumda şifrenizi güncelleyebilirsiniz.',
    rows: [
      { label: 'Ad Soyad', value: params.fullName || '—' },
      { label: 'Giriş E-postası', value: params.email },
      { label: 'Geçici Şifre', html: buildTemporaryPasswordEmailBlock(params.temporaryPassword) },
      {
        label: 'Giriş Adresi',
        html: `<a href="${safeLoginUrl}" style="color:#1852a0;text-decoration:underline;word-break:break-all;">${safeLoginUrl}</a>`,
      },
    ],
    actionUrl: params.loginUrl,
    actionLabel: 'Giriş Yap ve Şifre Belirle',
    footerNote: 'Güvenliğiniz için ilk girişten sonra şifrenizi değiştirmeniz gerekir. Bu e-postayı kimseyle paylaşmayın.',
  });
}
