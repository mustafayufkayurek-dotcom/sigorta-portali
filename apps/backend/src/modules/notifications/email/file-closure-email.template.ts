import { resolveWelcomeEmailLogoUrl } from './email-brand.util';

export type FileClosureAudience = 'assistance' | 'other';

export type FileClosureEmailData = {
  departmentName: string;
  organizationName: string;
  greeting?: string;
  notificationAt?: Date | string | null;
  insuranceCompanyName?: string | null;
  fileNo: string;
  fileSubject?: string | null;
  insuredName?: string | null;
  insuredPhone?: string | null;
  workStartedAt?: Date | string | null;
  closedAt?: Date | string | null;
  fileFeeAmount?: number | null;
  audience: FileClosureAudience;
  nextStepText?: string;
  portalUrl?: string;
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function dash(value?: string | null): string {
  const t = String(value ?? '').trim();
  return t || '—';
}

function toDate(value?: Date | string | null): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatClosureDateTime(value?: Date | string | null): string {
  const d = toDate(value);
  if (!d) return '—';
  return d.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** İşe başlama → kapanış. */
export function formatClosureDuration(
  startedAt?: Date | string | null,
  closedAt?: Date | string | null,
): string {
  const start = toDate(startedAt);
  const end = toDate(closedAt);
  if (!start || !end) return '—';
  const ms = end.getTime() - start.getTime();
  if (ms < 0) return '—';
  const totalMin = Math.round(ms / 60000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const minutes = totalMin % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days} gün`);
  if (hours) parts.push(`${hours} saat`);
  if (minutes) parts.push(`${minutes} dakika`);
  if (!parts.length) return '0 dakika';
  return parts.join(' ');
}

export function isMeridyenInternalMailbox(email: string): boolean {
  const host = String(email.split('@')[1] || '').trim().toLowerCase();
  return !host || host === 'localhost' || host === 'meridyen-tr.com' || host.endsWith('.meridyen-tr.com');
}

export function customerFirmTitle(c?: {
  companyName?: string | null;
  fullName?: string | null;
  shortName?: string | null;
} | null): string {
  return String(c?.companyName || c?.fullName || c?.shortName || '').trim();
}

/** Karttaki yetkili adı; yoksa Sn. Yetkili. */
export function closureCardGreeting(
  c?: {
    contactFirstName?: string | null;
    contactLastName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    authorizedPerson?: string | null;
  } | null,
  contactFullName?: string | null,
): string {
  const fromContact = [c?.contactFirstName, c?.contactLastName].filter(Boolean).join(' ').trim();
  const fromPerson = [c?.firstName, c?.lastName].filter(Boolean).join(' ').trim();
  const name = (
    fromContact
    || String(contactFullName ?? '').trim()
    || String(c?.authorizedPerson ?? '').trim()
    || fromPerson
  ).replace(/^(sayın|sn\.?)\s+/i, '').trim();
  if (!name || /^(yetkili|kullanıcı|kullanici)$/i.test(name)) {
    return 'Sn. Yetkili,';
  }
  return `Sn. ${name},`;
}

export function formatFileFeeWithVat(amount?: number | null): string {
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return '—';
  const money = amount.toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${money} TL +KDV`;
}

export function buildFileClosureEmailRows(
  data: FileClosureEmailData,
): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = [
    { label: 'İhbar Tarihi', value: formatClosureDateTime(data.notificationAt) },
    { label: 'Sigorta şirketi', value: dash(data.insuranceCompanyName) },
    { label: 'Dosya No', value: dash(data.fileNo) },
    { label: 'Dosya Konusu', value: dash(data.fileSubject) },
    { label: 'Sigortalı Adı Soyadı', value: dash(data.insuredName) },
    { label: 'Sigortalı Telefon', value: dash(data.insuredPhone) },
  ];
  if (data.audience === 'assistance') {
    rows.push(
      { label: 'İşe Başlama', value: formatClosureDateTime(data.workStartedAt) },
      { label: 'Kapanış Tarihi', value: formatClosureDateTime(data.closedAt) },
      { label: 'Süre', value: formatClosureDuration(data.workStartedAt, data.closedAt) },
    );
  }
  rows.push({ label: 'Dosya bedeli', value: formatFileFeeWithVat(data.fileFeeAmount) });
  return rows;
}

export function buildFileClosureEmailPlaintext(data: FileClosureEmailData): string {
  const rows = buildFileClosureEmailRows(data);
  const org = dash(data.organizationName);
  const greeting = (data.greeting || 'Sn. Yetkili,').trim();
  return [
    org !== '—' ? org : '',
    greeting,
    '',
    ...rows.map((row) => `${row.label}: ${row.value}`),
    '',
    data.nextStepText || 'Kapanış raporu ve belgeler bu e-postanın ekindedir.',
    '',
    'Saygılarımızla,',
    'Meridyen Asistans',
  ]
    .filter((line, i, arr) => !(line === '' && arr[i - 1] === ''))
    .join('\n');
}

export function buildFileClosureEmailHtml(data: FileClosureEmailData): string {
  const logoUrl = escapeHtml(resolveWelcomeEmailLogoUrl(data.portalUrl));
  const department = escapeHtml(dash(data.departmentName));
  const organizationName = escapeHtml(data.organizationName?.trim() || '');
  const greeting = escapeHtml((data.greeting || 'Sn. Yetkili,').trim());
  const nextStep = escapeHtml(
    data.nextStepText || 'Kapanış raporu ve belgeler bu e-postanın ekindedir.',
  );
  const rows = buildFileClosureEmailRows(data)
    .map((r, index) => {
      const zebra = index % 2 === 1 ? 'background:#F8FAFC;' : 'background:#ffffff;';
      const strong =
        r.label === 'Dosya No' ? 'font-weight:800;font-variant-numeric:tabular-nums;' : '';
      return `
              <tr>
                <td style="width:34%;padding:13px 16px;border-top:1px solid #E2E8F0;font-size:13px;font-weight:700;color:#64748B;${zebra}">${escapeHtml(r.label)}</td>
                <td style="padding:13px 16px;border-top:1px solid #E2E8F0;font-size:14px;color:#0F172A;${strong}${zebra}">${escapeHtml(r.value)}</td>
              </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Dosya Kapanışı</title>
</head>
<body style="margin:0;padding:0;background:#E2E8F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0F172A;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#E2E8F0;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="640" cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #E2E8F0;box-shadow:0 8px 24px rgba(15,23,42,.06);">
          <tr>
            <td style="padding:8px 20px;background:#ffffff;border-bottom:2px solid #047857;">
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
            <td style="padding:18px 20px;background:linear-gradient(180deg,#064E3B 0%,#047857 100%);">
              <div style="display:inline-block;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.22);color:#FFFFFF;font-size:11px;font-weight:700;letter-spacing:.04em;padding:5px 10px;border-radius:999px;margin-bottom:12px;">${department}</div>
              <h1 style="margin:0;font-size:22px;line-height:1.25;font-weight:800;color:#ffffff;">Dosya Kapanışı</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 22px 26px;background:#ffffff;">
              ${organizationName ? `<div style="font-size:13px;font-weight:800;color:#065F46;letter-spacing:.01em;margin:0 0 2px;">${organizationName}</div>` : ''}
              <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#0F172A;font-weight:700;">${greeting}</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;background:#ffffff;">
                <tr>
                  <td colspan="2" style="padding:14px 16px;background:#ECFDF5;font-size:13px;font-weight:800;color:#065F46;border-bottom:1px solid #A7F3D0;">Dosya Bilgileri</td>
                </tr>
                ${rows}
              </table>
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#ECFDF5;border:1px solid #A7F3D0;border-left:4px solid #059669;border-radius:10px;">
                <tr>
                  <td style="padding:14px 16px;">
                    <div style="font-size:12px;font-weight:800;color:#065F46;margin-bottom:4px;">Sonraki Adım</div>
                    <div style="font-size:13px;line-height:1.55;color:#065F46;">${nextStep}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 24px 22px;background:#F8FAFC;border-top:1px solid #E2E8F0;">
              <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#065F46;text-align:center;">Meridyen Asistans</p>
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
