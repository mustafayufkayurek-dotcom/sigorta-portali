import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { buildSurveyReportHtml } from '../src/modules/surveys/survey-report.template';
import {
  buildExternalApprovalSummaryHtml,
  buildTransactionalEmailHtml,
  formatSnPersonGreeting,
  onarimRaporuRequestSubject,
} from '../src/modules/notifications/email/email.template';

const outDir = join(__dirname, '../../../.preview');
mkdirSync(outDir, { recursive: true });
const logo = 'meridyen-logo-original.png';

function withLocalLogo(html: string): string {
  return html
    .replace(/https?:\/\/[^"'\s]+\/docs\/meridyen-logo-original\.png/g, logo)
    .replace(/\/docs\/meridyen-logo-original\.png/g, logo);
}

function write(name: string, html: string) {
  writeFileSync(join(outDir, name), withLocalLogo(html));
}

function withSubjectBar(subject: string, html: string): string {
  const bar = `<div style="max-width:720px;margin:0 auto;padding:16px 16px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <div style="background:#ffffff;border:1px solid #E2E8F0;border-radius:10px;padding:10px 14px;margin-bottom:8px;">
      <div style="font-size:11px;font-weight:700;color:#64748B;">Konu</div>
      <div style="font-size:15px;font-weight:800;color:#0F172A;margin-top:4px;">${subject}</div>
    </div>
  </div>`;
  return html.replace(/<body([^>]*)>/i, `<body$1>${bar}`);
}

const sampleReport = {
  year: 2026,
  month: 8,
  totalSent: 40,
  totalCompleted: 28,
  responseRate: 70,
  averages: { q1: 4.6, q2: 4.4, q3: 4.2, q4: 4.5, q5: 4.3, overall: 4.4 },
  recommendRate: 86,
  trend: [
    { period: 'Mart 2026', overall: 4.1, count: 18 },
    { period: 'Nisan 2026', overall: 4.2, count: 21 },
    { period: 'Mayıs 2026', overall: 4.0, count: 19 },
    { period: 'Haziran 2026', overall: 4.2, count: 22 },
    { period: 'Temmuz 2026', overall: 4.3, count: 25 },
    { period: 'Ağustos 2026', overall: 4.4, count: 28 },
  ],
  highlights: [
    'Ekip hızlı ulaştı, sigortalıyı süreç boyunca bilgilendirdi.',
    'Onarım kalitesi beklediğimiz seviyenin üzerindeydi.',
  ],
  lowScoreComments: ['İlk günde dönüş biraz gecikti, sonrasında toparlandı.'],
};

write(
  'anket-raporu-mail.html',
  buildSurveyReportHtml({
    ...sampleReport,
    period: 'Ağustos 2026',
    insuranceCompanyName: 'Ray Sigorta',
    insuranceCompanyEmail: 'ornek@ray.com',
  }),
);

write(
  'anket-raporu-asistans-mail.html',
  buildSurveyReportHtml({
    ...sampleReport,
    period: 'Ağustos 2026',
    insuranceCompanyName: 'Remed Asistans',
    insuranceCompanyEmail: 'ornek@remed.com',
  }),
);

write(
  'dis-onay-mail.html',
  withSubjectBar(
    onarimRaporuRequestSubject('Ray Sigorta', 'RCS-20261868899'),
    buildTransactionalEmailHtml({
    title: 'Onay Talep',
    organizationName: 'Ray Sigorta',
    greeting: formatSnPersonGreeting('Ayşe', 'Yılmaz'),
    intro: 'Hasar onarım raporu onay ve görüşleriniz beklemektedir.',
    bodyHtml: buildExternalApprovalSummaryHtml({
      insuranceCompanyName: 'Ray Sigorta',
      fileNo: 'RCS-20261868899',
      sentAt: new Date(2026, 8, 2, 12, 16),
    }),
    actionUrl: 'https://app.meridyen-tr.com/giris',
    actionLabel: 'Raporu İncele ve Onayla',
    footerNote: 'Bu link 72 saat geçerlidir. Sorun yaşarsanız lütfen bizimle iletişime geçin.',
    portalUrl: 'https://app.meridyen-tr.com/giris',
  }),
  ),
);

write(
  'sifre-sifirlama-mail.html',
  buildTransactionalEmailHtml({
    title: 'Şifre Sıfırlama',
    organizationName: 'Ray Sigorta',
    greeting: formatSnPersonGreeting('Ayşe', 'Yılmaz'),
    intro: 'Hesabınız için şifre sıfırlama talebi alındı. Bağlantı 1 saat geçerlidir.',
    actionUrl: 'https://app.meridyen-tr.com/giris/sifre-sifirla?token=ornek',
    actionLabel: 'Şifreyi Sıfırla',
    footerNote: 'Bu talebi siz oluşturmadıysanız bu e-postayı yok sayın.',
    portalUrl: 'https://app.meridyen-tr.com/giris',
  }),
);

write(
  'sifre-sifirlama-meridyen-mail.html',
  buildTransactionalEmailHtml({
    title: 'Şifre Sıfırlama',
    greeting: formatSnPersonGreeting('Ayşe', 'Yılmaz'),
    intro: 'Hesabınız için şifre sıfırlama talebi alındı. Bağlantı 1 saat geçerlidir.',
    actionUrl: 'https://app.meridyen-tr.com/giris/sifre-sifirla?token=ornek',
    actionLabel: 'Şifreyi Sıfırla',
    footerNote: 'Bu talebi siz oluşturmadıysanız bu e-postayı yok sayın.',
    portalUrl: 'https://app.meridyen-tr.com/giris',
  }),
);

console.log(
  'yazıldı: anket-raporu-mail.html, anket-raporu-asistans-mail.html, dis-onay-mail.html, sifre-sifirlama-mail.html, sifre-sifirlama-meridyen-mail.html',
);
