/**
 * Onarım raporu teslim maili.
 * Kaynak: meridyen-birebir-referans.html. Maliyet ve kâr cümlesi yok.
 * E-posta istemcisi esnek yerleşimi keser; düzen tablodur. JavaScript yok.
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function icon(name: 'paperclip' | 'arrow' | 'phone' | 'mail', size: number, color: string): string {
  const paths: Record<typeof name, string> = {
    paperclip:
      '<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
    arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    phone:
      '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
    mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  };
  const gap = name === 'arrow' ? 'margin-left:12px;' : 'margin-right:7px;';
  return `<span style="display:inline-block;vertical-align:middle;${gap}line-height:0;"><svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;">${paths[name]}</svg></span>`;
}

function dash(value?: string | null): string {
  const text = (value || '').trim();
  return text || '—';
}

export function formatReportMailPhone(raw?: string | null): string | null {
  const digits = String(raw ?? '').replace(/\D/g, '');
  let local = digits;
  if (local.startsWith('90') && local.length > 10) local = local.slice(-10);
  if (local.startsWith('0') && local.length === 11) local = local.slice(1);
  if (local.length !== 10) return (raw || '').trim() || null;
  return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}

export function reportMailPhoneHref(raw?: string | null): string {
  const digits = String(raw ?? '').replace(/\D/g, '');
  let local = digits;
  if (local.startsWith('90') && local.length > 10) local = local.slice(-10);
  if (local.startsWith('0') && local.length === 11) local = local.slice(1);
  if (local.length === 10) return `+90${local}`;
  return digits ? `+${digits}` : '';
}

export type ReportDispatchEmailData = {
  reportNo: string;
  fileNo?: string | null;
  insuranceCompanyName?: string | null;
  fileSubject?: string | null;
  documentTitle?: string | null;
  actionUrl?: string | null;
  portalUrl?: string | null;
  ownerName?: string | null;
  ownerPhone?: string | null;
  ownerEmail?: string | null;
  operationRegion?: string | null;
  operationCity?: string | null;
  operationDistrict?: string | null;
  /** Hasar Tespit hitabında soyad; onarımda kullanılmaz. */
  recipientSurname?: string | null;
  /** Personelin açık mesaj kutusundan; varsa şablon hitap/gövdeyi ezer. */
  messageGreeting?: string | null;
  messageBody?: string | null;
};

/** Kişi adından soyad; firma / tek kelime boş kalır. */
export function approvalRecipientSurname(name?: string | null): string {
  const raw = String(name ?? '').trim();
  if (!raw) return '';
  if (/(sigorta|broker|eksper|ltd|a\.?\s?ş|assistance|asistans|şirket|firma|demo|pilot)/i.test(raw)) {
    return '';
  }
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return '';
  return parts[parts.length - 1] ?? '';
}

export function reportMailSignature(claim?: {
  assignedOfficeUser?: {
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
  propertyAddress?: { city?: string | null; district?: string | null } | null;
} | null): Pick<
  ReportDispatchEmailData,
  'ownerName' | 'ownerPhone' | 'ownerEmail' | 'operationRegion' | 'operationCity' | 'operationDistrict'
> {
  const user = claim?.assignedOfficeUser;
  const ownerName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || null;
  const city = (claim?.propertyAddress?.city || '').trim();
  const district = (claim?.propertyAddress?.district || '').trim();
  return {
    ownerName,
    ownerPhone: formatReportMailPhone(user?.phone),
    ownerEmail: (user?.email || '').trim() || null,
    operationCity: city || null,
    operationDistrict: district || null,
    operationRegion: [city, district].filter(Boolean).join('-') || null,
  };
}

function logoSrc(portalUrl?: string | null): string {
  const raw = (portalUrl || '').trim();
  if (!raw) return 'meridyen-logo.jpg';
  try {
    return `${new URL(raw).origin}/meridyen-logo.jpg`;
  } catch {
    return 'meridyen-logo.jpg';
  }
}

/** Hasar Tespit dosyasında belge adı ve hitap tespit dilidir; onarım metni değişmez. */
function dispatchWording(
  documentTitle?: string | null,
  recipientSurname?: string | null,
): { belge: string; hitap: string; intro: string } {
  if (String(documentTitle ?? '').trim() === 'Hasar Tespit Raporu') {
    const soyad = String(recipientSurname ?? '').trim();
    return {
      belge: 'Hasar Tespit Raporu',
      hitap: soyad ? `Sayın ${soyad},` : 'Sayın Yetkili,',
      intro: 'Dosyaya ait Hasar Tespit Raporu ekte bilgilerinize sunarız.',
    };
  }
  return {
    belge: 'Hasar Onarım Raporu',
    hitap: 'Sayın Eksperimiz,',
    intro:
      'İlgili dosyaya ait Hasar Onarım Raporu’nu bilgi ve değerlendirmenize sunarız. Değerlendirmenizi aşağıdaki bağlantı üzerinden iletmenizi rica ederiz.',
  };
}

function resolveDispatchWording(data: ReportDispatchEmailData): { belge: string; hitap: string; intro: string } {
  const base = dispatchWording(data.documentTitle, data.recipientSurname);
  const hasCustom =
    data.messageGreeting != null
    || data.messageBody != null;
  if (!hasCustom) return base;
  return {
    belge: base.belge,
    hitap: String(data.messageGreeting ?? '').trim(),
    intro: String(data.messageBody ?? '').trim(),
  };
}

export function buildReportDispatchEmailHtml(data: ReportDispatchEmailData): string {
  const wording = resolveDispatchWording(data);
  const dosyaNo = escapeHtml(dash(data.fileNo));
  const sigorta = escapeHtml(dash(data.insuranceCompanyName));
  const konu = escapeHtml(dash(data.fileSubject));
  const raporNo = escapeHtml(dash(data.reportNo));
  const url = escapeHtml((data.actionUrl || '').trim() || '#');
  const sorumlu = escapeHtml(dash(data.ownerName));
  const telefonGorunen = escapeHtml(dash(data.ownerPhone));
  const telefonUluslararasi = escapeHtml(reportMailPhoneHref(data.ownerPhone));
  const email = escapeHtml((data.ownerEmail || '').trim());
  const il = escapeHtml((data.operationCity || '').trim());
  const ilce = escapeHtml((data.operationDistrict || '').trim());
  const bolge = [il, ilce].filter(Boolean).join('-');
  const logo = escapeHtml(logoSrc(data.portalUrl));
  const intro = escapeHtml(wording.intro).replace(/\n/g, '<br>');
  const phoneLink = (data.ownerPhone || '').trim()
    ? `<a href="tel:${telefonUluslararasi}" style="color:#174b8a;text-decoration:none;font-size:12px;font-weight:500;">${icon('phone', 14, '#174b8a')}<span style="vertical-align:middle;">${telefonGorunen}</span></a>`
    : '';
  const mailLink = email
    ? `<a href="mailto:${email}" style="color:#174b8a;text-decoration:none;font-size:12px;font-weight:500;">${icon('mail', 14, '#174b8a')}<span style="vertical-align:middle;">E-posta Gönder</span></a>`
    : '';
  const regionRow = bolge
    ? `<div style="margin-top:5px;font-size:12px;line-height:1.6;color:#617180;"><span style="font-size:11px;">Operasyon Bölgesi</span> <span>${bolge} Network</span></div>`
    : '';

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>Meridyen Rapor Bildirimi</title>
  <style>
    @media (max-width:440px) {
      .m-pad { padding-left:22px !important; padding-right:22px !important; }
      .m-dept { padding-left:22px !important; padding-right:22px !important; }
      .m-logo { width:160px !important; height:61px !important; }
      .m-title { font-size:23px !important; }
      .m-stack, .m-meta { display:block !important; width:100% !important; max-width:100% !important; border-left:0 !important; padding-left:0 !important; box-sizing:border-box !important; }
      .m-meta { padding-top:14px !important; }
      .m-links { white-space:normal !important; text-align:left !important; padding-top:4px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#e9eef2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#152c40;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#e9eef2;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:660px;background:#ffffff;border:1px solid #dde5eb;border-radius:6px;table-layout:fixed;">
          <tr>
            <td class="m-pad" style="padding:20px 32px 0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <img class="m-logo" src="${logo}" alt="Meridyen Asistans" width="184" height="71" style="display:block;width:184px;height:71px;border:0;background:#ffffff;">
                  </td>
                  <td align="right" valign="middle" style="font-size:11px;line-height:1.6;color:#617180;padding-left:12px;">
                    Rapor Bildirimi
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 0 0;">
              <div class="m-dept" style="background:#102c44;color:#f6f9fc;font-size:12px;line-height:1.6;padding:12px 32px;">
                Hasar Onarım Ve Restorasyon Departmanı
              </div>
            </td>
          </tr>
          <tr>
            <td class="m-pad" style="padding:27px 32px 0;">
              <h1 class="m-title" style="margin:0;font-size:25px;line-height:1.35;letter-spacing:-0.5px;font-weight:600;color:#152c40;overflow-wrap:anywhere;">
                Dosya Değerlendirmeniz Bekleniyor
              </h1>
              ${wording.hitap
                ? `<p style="margin:20px 0 0;font-size:13px;line-height:1.65;font-weight:600;color:#152c40;">${escapeHtml(wording.hitap)}</p>`
                : ''}
              ${intro
                ? `<p style="margin:${wording.hitap ? '8px' : '20px'} 0 0;font-size:13px;line-height:1.75;color:#617180;overflow-wrap:anywhere;">${intro}</p>`
                : ''}
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:22px;border-top:1px solid #dde5eb;border-bottom:1px solid #dde5eb;">
                <tr>
                  <td class="m-stack" width="37%" valign="top" style="width:37%;padding:16px 16px 16px 0;">
                    <div style="font-size:11px;color:#617180;">Dosya No</div>
                    <div style="margin-top:5px;font-size:29px;font-weight:600;letter-spacing:0.5px;line-height:1.3;color:#152c40;">${dosyaNo}</div>
                  </td>
                  <td class="m-meta" valign="top" style="padding:16px 0 16px 22px;border-left:1px solid #dde5eb;">
                    <div style="font-size:11px;color:#617180;">Sigorta Şirketi</div>
                    <div style="margin-top:2px;font-size:14px;font-weight:600;color:#152c40;">${sigorta}</div>
                    <div style="margin-top:10px;font-size:11px;color:#617180;">Hasar Konusu</div>
                    <div style="margin-top:2px;font-size:14px;font-weight:600;color:#152c40;">${konu}</div>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:18px;background:#f3f6f8;border-radius:4px;">
                <tr>
                  <td width="58" valign="middle" style="padding:13px 0 13px 16px;">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td align="center" width="42" height="48" style="width:42px;height:48px;background:#ffffff;border:1px solid #dde5eb;border-radius:3px;color:#174b8a;font-size:11px;font-weight:600;">
                          PDF
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td valign="middle" style="padding:13px 16px;">
                    <div style="font-size:14px;font-weight:600;line-height:1.4;color:#152c40;">${wording.belge}</div>
                    <div style="font-size:12px;line-height:1.6;color:#617180;">Rapor No: ${raporNo}</div>
                    <div style="margin-top:5px;font-size:11px;line-height:1.5;color:#617180;">
                      ${icon('paperclip', 12, '#617180')}<span style="vertical-align:middle;">E-posta Ekinde Sunulmuştur</span>
                    </div>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:20px;">
                <tr>
                  <td align="center" bgcolor="#102c44" style="border-radius:4px;background:#102c44;">
                    <a href="${url}" target="_blank" style="display:block;min-height:52px;padding:16px;color:#f6f9fc;text-decoration:none;font-size:14px;line-height:1.5;font-weight:600;">
                      Dosyayı İncele Ve Değerlendir${icon('arrow', 16, '#f6f9fc')}
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:10px 0 0;text-align:center;font-size:11px;line-height:1.6;color:#617180;">
                Bağlantı üzerinden dosya bilgilerine ve değerlendirme alanına ulaşabilirsiniz.
              </p>
              <p style="margin:23px 0 0;font-size:12px;line-height:1.6;color:#617180;">Saygılarımızla,</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:7px;border-left:2px solid #dde5eb;">
                <tr>
                  <td style="padding-left:12px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td valign="middle" style="padding:6px 10px 6px 0;">
                          <div style="font-size:13px;font-weight:600;line-height:1.4;color:#152c40;">${sorumlu}</div>
                          <div style="font-size:11px;line-height:1.5;color:#617180;">Dosya Sorumlusu</div>
                        </td>
                        <td class="m-links" align="right" valign="middle" style="font-size:12px;line-height:1.4;">
                          ${phoneLink}${phoneLink && mailLink ? '<span style="display:inline-block;width:16px;"></span>' : ''}${mailLink}
                        </td>
                      </tr>
                    </table>
                    ${regionRow}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="m-pad" style="padding:15px 32px;background:#f3f6f8;border-top:1px solid #dde5eb;font-size:11px;line-height:1.7;color:#617180;">
              Bu e-posta otomatik olarak gönderilmiştir.<br>
              Meridyen Assistance · Safran Birleşik Hizmetler Alt Kuruluşudur.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildReportDispatchEmailText(data: ReportDispatchEmailData): string {
  const wording = resolveDispatchWording(data);
  const lines = [
    'Dosya Değerlendirmeniz Bekleniyor',
    wording.hitap,
    wording.intro,
    `Dosya No: ${dash(data.fileNo)}`,
    `Sigorta Şirketi: ${dash(data.insuranceCompanyName)}`,
    `Hasar Konusu: ${dash(data.fileSubject)}`,
    `Rapor No: ${data.reportNo}`,
    `Dosya Sorumlusu: ${dash(data.ownerName)}`,
  ];
  const ownerPhone = (data.ownerPhone || '').trim();
  if (ownerPhone) lines.push(`Telefon: ${ownerPhone}`);
  const region = [data.operationCity, data.operationDistrict].filter(Boolean).join('-')
    || (data.operationRegion || '').trim();
  if (region) lines.push(`Operasyon Bölgesi: ${region} Network`);
  if (data.actionUrl) lines.push(data.actionUrl);
  return lines.join('\n');
}
