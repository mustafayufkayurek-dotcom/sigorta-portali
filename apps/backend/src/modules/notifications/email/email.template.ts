export interface EmailTemplateData {
  title: string;
  preheader?: string;
  rows: Array<{ label: string; value: string }>;
  actionUrl?: string;
  actionLabel?: string;
  footerNote?: string;
}

export function buildEmailHtml(data: EmailTemplateData): string {
  const rows = data.rows
    .map(
      (r) => `
      <tr>
        <td style="padding:8px 12px;background:#f9fafb;border-bottom:1px solid #e5e7eb;font-size:13px;color:#6b7280;width:40%;white-space:nowrap;">${r.label}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#111827;">${r.value}</td>
      </tr>`,
    )
    .join('');

  const actionButton = data.actionUrl
    ? `
    <div style="text-align:center;margin:32px 0;">
      <a href="${data.actionUrl}"
         style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:600;letter-spacing:.3px;">
        ${data.actionLabel ?? 'Dosyayı Görüntüle'}
      </a>
    </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${data.title}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);padding:28px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <div style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-.3px;">Sigorta Hasar Sistemi</div>
                  <div style="font-size:12px;color:rgba(255,255,255,.75);margin-top:2px;">Otomatik Bildirim</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#111827;">${data.title}</h1>
            ${data.preheader ? `<p style="margin:0 0 24px;font-size:14px;color:#6b7280;">${data.preheader}</p>` : '<div style="margin-bottom:24px;"></div>'}

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
              ${data.footerNote ? `<br/>${data.footerNote}` : ''}
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
