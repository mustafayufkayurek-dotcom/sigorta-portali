import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { buildFileClosureEmailHtml } from '../src/modules/notifications/email/file-closure-email.template';
import {
  buildRaporOnaylandiEmailHtml,
  formatSnPersonGreeting,
  onarimRaporuRequestSubject,
  raporOnaylandiSubject,
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

const acilBase = {
  fileNo: 'AYF-202608-0004',
  insuranceCompanyName: 'Ray Sigorta',
  fileSubject: 'Tesisat',
  insuredName: 'Nafi İlhan',
  insuredPhone: '05362041497',
  notificationAt: new Date('2026-08-27T14:38:00+03:00'),
  workStartedAt: new Date('2026-08-28T12:51:00+03:00'),
  closedAt: new Date('2026-08-28T14:22:00+03:00'),
  fileFeeAmount: 1250,
};

write(
  'kapanis-acil-asistans.html',
  buildFileClosureEmailHtml({
    ...acilBase,
    departmentName: 'Acil Yardım',
    organizationName: 'Remed Asistans',
    audience: 'assistance',
  }),
);

const hasarBase = {
  fileNo: 'RCS-20261868899',
  insuranceCompanyName: 'Ray Sigorta',
  fileSubject: 'Dahili Su',
  insuredName: 'Ahmet Yılmaz',
  insuredPhone: '05321234567',
  notificationAt: new Date('2026-08-20T09:10:00+03:00'),
  closedAt: new Date('2026-09-02T11:40:00+03:00'),
  fileFeeAmount: 18500,
  nextStepText: 'Dosya kapatılmıştır. Sorularınız için bizimle iletişime geçebilirsiniz.',
};

write(
  'kapanis-hasar-sigorta.html',
  buildFileClosureEmailHtml({
    ...hasarBase,
    departmentName: 'Hasar Onarım',
    organizationName: 'Ray Sigorta',
    audience: 'other',
  }),
);

write(
  'kapanis-hasar-eksper.html',
  buildFileClosureEmailHtml({
    ...hasarBase,
    departmentName: 'Hasar Onarım',
    organizationName: 'Anadolu Eksperlik',
    audience: 'other',
  }),
);

write(
  'kapanis-hasar-broker.html',
  buildFileClosureEmailHtml({
    ...hasarBase,
    departmentName: 'Hasar Onarım',
    organizationName: 'Atlas Broker',
    audience: 'other',
  }),
);

write(
  'kapanis-mail-onizleme.html',
  `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Dosya kapanış maili</title>
<style>
  body { margin:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background:#0F172A; color:#E2E8F0; }
  h1 { font-size:18px; margin:0; }
  .bar { padding:16px 20px; background:#020617; border-bottom:1px solid #1E293B; display:flex; gap:16px; align-items:center; flex-wrap:wrap; }
  .tabs a { color:#94A3B8; text-decoration:none; font-size:13px; font-weight:700; padding:8px 12px; border-radius:8px; }
  .tabs a:hover, .tabs a.on { background:#1E293B; color:#fff; }
  iframe { width:100%; height:calc(100vh - 64px); border:0; background:#E2E8F0; }
</style>
</head>
<body>
  <div class="bar">
    <h1>Dosya kapanışı</h1>
    <nav class="tabs">
      <a class="on" href="kapanis-acil-asistans.html" target="mail">Acil · Asistans</a>
      <a href="kapanis-hasar-sigorta.html" target="mail">Hasar · Sigorta</a>
      <a href="kapanis-hasar-eksper.html" target="mail">Hasar · Eksper</a>
      <a href="kapanis-hasar-broker.html" target="mail">Hasar · Broker</a>
    </nav>
  </div>
  <iframe name="mail" src="kapanis-acil-asistans.html"></iframe>
  <script>
    document.querySelectorAll('.tabs a').forEach((a) => {
      a.addEventListener('click', () => {
        document.querySelectorAll('.tabs a').forEach((x) => x.classList.remove('on'));
        a.classList.add('on');
      });
    });
  </script>
</body>
</html>`,
);

write(
  'acil-kapanis-mail.html',
  buildFileClosureEmailHtml({
    ...acilBase,
    departmentName: 'Acil Yardım',
    organizationName: 'Remed Asistans',
    audience: 'assistance',
  }),
);

write(
  'rapor-onaylandi-mail.html',
  withSubjectBar(
    raporOnaylandiSubject('Ray Sigorta', 'RCS-20261868899', 'Fidar'),
    buildRaporOnaylandiEmailHtml({
      insuranceCompanyName: 'Ray Sigorta',
      fileNo: 'RCS-20261868899',
      approvedBy: 'Ayşe Yılmaz',
      greeting: formatSnPersonGreeting('Mehmet', 'Kaya'),
      intro: 'Eksper onarım raporunu onaylanmıştır.\nOperasyon planlama aşamasına geçiniz.',
      actionUrl: 'https://app.meridyen-tr.com/giris',
      portalUrl: 'https://app.meridyen-tr.com/giris',
    }),
  ),
);

write(
  'eksper-onay-verildi-mail.html',
  withSubjectBar(
    raporOnaylandiSubject('Ray Sigorta', 'RCS-20261868899', 'Fidar'),
    buildRaporOnaylandiEmailHtml({
      insuranceCompanyName: 'Ray Sigorta',
      fileNo: 'RCS-20261868899',
      approvedBy: 'Ahmet Demir',
      greeting: formatSnPersonGreeting('Mehmet', 'Kaya'),
      intro: 'Eksper onarım raporunu onaylanmıştır.\nOperasyon planlama aşamasına geçiniz.',
      actionUrl: 'https://app.meridyen-tr.com/giris',
      portalUrl: 'https://app.meridyen-tr.com/giris',
    }),
  ),
);

const expertRequestSubject = onarimRaporuRequestSubject('Ray Sigorta', 'RCS-20261868899');
const approvedSubject = raporOnaylandiSubject('Ray Sigorta', 'RCS-20261868899', 'Fidar');

write(
  'eksper-onay-konu.html',
  `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Eksper onay — mail konusu</title>
<style>
  body { margin:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background:#F1F5F9; color:#0F172A; }
  .wrap { max-width:820px; margin:0 auto; padding:24px 16px 48px; }
  h1 { font-size:20px; margin:0 0 8px; }
  .lead { color:#475569; font-size:14px; line-height:1.55; margin:0 0 20px; }
  .card { background:#fff; border:1px solid #E2E8F0; border-radius:14px; overflow:hidden; margin:0 0 18px; }
  .card h2 { margin:0; font-size:15px; padding:14px 16px; background:#0F172A; color:#fff; }
  .meta { padding:12px 16px; border-bottom:1px solid #E2E8F0; font-size:13px; }
  .meta b { display:inline-block; min-width:64px; color:#64748B; }
  .subject { font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; font-size:13px; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:10px 12px; margin-top:8px; word-break:break-word; }
  .body { padding:14px 16px 18px; font-size:14px; line-height:1.6; color:#334155; }
  .ok { color:#065F46; font-weight:700; }
  .no { color:#9A3412; font-weight:700; }
  a { color:#1E5AA8; }
</style>
</head>
<body>
  <div class="wrap">
    <h1>Onarım raporu — konu alanları</h1>
    <p class="lead">Konu sırası: sigorta şirketi, dosya numarası. Rapor numarası konu ve özette yok.</p>

    <div class="card">
      <h2>1. Eksperden onay istenirken</h2>
      <div class="meta">
        <div><b>Kime</b> Eksper</div>
        <div><b>Konu</b></div>
        <div class="subject">${expertRequestSubject}</div>
      </div>
      <div class="body">
        Format: <code>Sigorta Şirketi-Dosya Numarası-Onay Talep</code>
        <p style="margin:12px 0 0;"><a href="dis-onay-mail.html">Gövde önizlemesi</a></p>
      </div>
    </div>

    <div class="card">
      <h2>2. Eksper onay verdiğinde</h2>
      <div class="meta">
        <div><b>Kime</b> Onayı isteyen personel</div>
        <div><b>Konu</b></div>
        <div class="subject">${approvedSubject}</div>
      </div>
      <div class="body">
        Format: <code>Rapor Onaylandı (Eksper Ofisi)-Sigorta Şirketi-Dosya Numarası</code>
        <p style="margin:12px 0 0;"><a href="eksper-onay-verildi-mail.html">Gövde önizlemesi</a></p>
      </div>
    </div>

    <div class="card">
      <h2>3. Meridyen içeride raporu onaylarsa</h2>
      <div class="meta">
        <div><b>Kime</b> Raporu yazan personel</div>
        <div><b>Konu</b></div>
        <div class="subject">${approvedSubject}</div>
      </div>
      <div class="body">
        Format: <code>Rapor Onaylandı (Eksper Ofisi)-Sigorta Şirketi-Dosya Numarası</code>
        <p style="margin:12px 0 0;"><a href="rapor-onaylandi-mail.html">Gövde önizlemesi</a></p>
      </div>
    </div>
  </div>
</body>
</html>`,
);

console.log(
  'yazıldı: kapanis-mail-onizleme.html, kapanis-acil-asistans.html, kapanis-hasar-sigorta.html, kapanis-hasar-eksper.html, kapanis-hasar-broker.html, eksper-onay-konu.html',
);
