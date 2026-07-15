import { writeFileSync, copyFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import {
  generateWelcomeEmail,
  type WelcomeEmailRole,
} from '../src/modules/notifications/email/welcome-email.template';

const outDir = join(__dirname, '../../../.preview');
mkdirSync(outDir, { recursive: true });

function wrapPreview(body: string, title: string): string {
  return `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${title}</title><style>body{margin:0;padding:12px;background:#cbd5e1;}</style></head><body>${body}</body></html>`;
}

function writeRolePreview(
  role: WelcomeEmailRole,
  label: string,
  recipientName: string,
  organizationName: string,
  guideUrl: string,
  accountEmail: string,
) {
  const rendered = generateWelcomeEmail(role, {
    recipientName,
    organizationName,
    portalUrl: 'https://app.meridyen-tr.com/giris',
    guideUrl,
    accountEmail,
    temporaryPassword: 'Ge7#kLm9xQ2!',
    forcePasswordChange: true,
  });

  // Preview'da HTTPS CDN yerine lokal PNG — oran bozulmadan aynı dosya.
  const html = rendered.html.replace(
    /https?:\/\/[^"'\s]+\/docs\/meridyen-logo-original\.png/g,
    './meridyen-logo-original.png',
  );
  const cardMatch = html.match(/<table width="640"[\s\S]*<\/table>\s*<\/td>\s*<\/tr>\s*<\/table>\s*<\/body>/i);
  const cardHtml = cardMatch?.[0].replace(/\s*<\/body>$/, '') ?? html;

  const slug = role.toLowerCase().replace(/_/g, '-');
  writeFileSync(
    join(outDir, `welcome-email-${slug}.html`),
    wrapPreview(`<p style="text-align:center;font:13px sans-serif;color:#475569;margin:0 0 12px;">Hoş geldin maili — ${label}</p>${cardHtml}`, label),
  );
}

const GUIDE_MAIN_TITLE = 'Meridyen Hasar Yönetim Platformu Kullanım Kılavuzu';

const previews = [
  {
    role: 'EXPERT' as const,
    label: 'Eksper',
    guideAudience: 'Eksper Kullanıcıları İçin',
    recipientName: 'Mustafa Yufkayurek',
    organizationName: 'Safran BH Sigorta Ekspertiz Hizmetleri',
    guideUrl: 'https://app.meridyen-tr.com/docs/03-eksper-portal-tanitim.pdf',
    accountEmail: 'mustafa.ornek@ekspertiz.com',
    guideHtml: '/docs/03-eksper-portal-tanitim.html',
  },
  {
    role: 'MERIDYEN_STAFF' as const,
    label: 'Meridyen Personeli (Ofis / Saha / Finans / Yönetim)',
    guideAudience: 'Meridyen Personeli İçin',
    recipientName: 'Ayşe Yılmaz',
    organizationName: 'Meridyen İstanbul Operasyon',
    guideUrl: 'https://app.meridyen-tr.com/docs/01-personel-kullanim-kilavuzu.pdf',
    accountEmail: 'ayse.ornek@meridyen-tr.com',
    guideHtml: '/docs/01-personel-kullanim-kilavuzu.html',
  },
  {
    role: 'INSURANCE_COMPANY' as const,
    label: 'Sigorta Şirketi Kullanıcısı',
    guideAudience: 'Sigorta Şirketi Kullanıcıları İçin',
    recipientName: 'Mehmet Kaya',
    organizationName: 'Türkiye Sigorta',
    guideUrl: 'https://app.meridyen-tr.com/docs/02-sigorta-portal-kilavuzu.pdf',
    accountEmail: 'sigorta.ornek@turkiyesigorta.com.tr',
    guideHtml: '/docs/02-sigorta-portal-kilavuzu.html',
  },
  {
    role: 'BROKER' as const,
    label: 'Broker Kullanıcısı',
    guideAudience: 'Broker Kullanıcıları İçin',
    recipientName: 'Elif Arslan',
    organizationName: 'Neova Broker',
    guideUrl: 'https://app.meridyen-tr.com/docs/04-broker-portal-kilavuzu.pdf',
    accountEmail: 'elif@neova.com',
    guideHtml: '/docs/04-broker-portal-kilavuzu.html',
  },
];

for (const item of previews) {
  writeRolePreview(
    item.role,
    item.label,
    item.recipientName,
    item.organizationName,
    item.guideUrl,
    item.accountEmail,
  );
}

const indexRows = previews
  .map((item) => {
    const slug = item.role.toLowerCase().replace(/_/g, '-');
    return `<tr>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-weight:600;">${item.label}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;">${GUIDE_MAIN_TITLE}<br/><span style="color:#64748b;">${item.guideAudience}</span></td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;"><a href="./welcome-email-${slug}.html">Mail önizleme</a></td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;"><a href="http://localhost:8765${item.guideHtml}">Kılavuz HTML</a></td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;"><a href="${item.guideUrl.replace('https://app.meridyen-tr.com', 'http://localhost:8765')}">Kılavuz PDF</a></td>
    </tr>`;
  })
  .join('\n');

writeFileSync(
  join(outDir, 'welcome-email-index.html'),
  `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"/><title>Hoş Geldin Maili — Kontrol Listesi</title>
<style>body{font-family:Segoe UI,sans-serif;max-width:960px;margin:24px auto;padding:0 16px;color:#0f172a}table{width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden}th{background:#123a63;color:#fff;text-align:left;padding:12px}a{color:#1e5aa8}</style></head>
<body><h1>Hoş Geldin Maili ve Kılavuz — Kontrol Listesi</h1>
<p>Canlıya almadan önce kullanıcı tipine göre mail ve kılavuzu kontrol edin. Sunucu: <code>pnpm preview:docs</code></p>
<table><thead><tr><th>Kullanıcı Tipi</th><th>Kılavuz Başlığı</th><th>Mail</th><th>Kılavuz HTML</th><th>Kılavuz PDF</th></tr></thead><tbody>${indexRows}</tbody></table></body></html>`,
);

copyFileSync(
  join(__dirname, '../assets/meridyen-logo-original.png'),
  join(outDir, 'meridyen-logo-original.png'),
);

console.log('Previews written:', outDir);
console.log('Index:', join(outDir, 'welcome-email-index.html'));
