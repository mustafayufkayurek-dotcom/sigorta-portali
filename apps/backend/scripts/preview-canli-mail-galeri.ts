import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const outDir = join(__dirname, '../../../.preview');
mkdirSync(outDir, { recursive: true });

const live = [
  { href: 'welcome-email-meridyen-staff.html', label: 'Hoş geldin · Personel' },
  { href: 'welcome-email-expert.html', label: 'Hoş geldin · Eksper' },
  { href: 'welcome-email-insurance-company.html', label: 'Hoş geldin · Sigorta' },
  { href: 'welcome-email-broker.html', label: 'Hoş geldin · Broker' },
  { href: 'welcome-email-assistance-company.html', label: 'Hoş geldin · Asistans' },
  { href: 'kapanis-acil-asistans.html', label: 'Kapanış · Acil / Asistans' },
  { href: 'kapanis-hasar-sigorta.html', label: 'Kapanış · Hasar / Sigorta' },
  { href: 'kapanis-hasar-eksper.html', label: 'Kapanış · Hasar / Eksper' },
  { href: 'kapanis-hasar-broker.html', label: 'Kapanış · Hasar / Broker' },
  { href: 'anket-raporu-mail.html', label: 'Anket · Sigorta' },
  { href: 'anket-raporu-asistans-mail.html', label: 'Anket · Asistans' },
  { href: 'dis-onay-mail.html', label: 'Onay Talep' },
  { href: 'eksper-onay-verildi-mail.html', label: 'Rapor Onaylandı' },
  { href: 'sifre-sifirlama-mail.html', label: 'Şifre · Dış kullanıcı' },
  { href: 'sifre-sifirlama-meridyen-mail.html', label: 'Şifre · Personel' },
];

const nav = live
  .map((item) => `<a href="#${item.href.replace('.html', '')}">${item.label}</a>`)
  .join('\n      ');

const cards = live
  .map(
    (item) => `
  <section id="${item.href.replace('.html', '')}">
    <h2>${item.label}</h2>
    <iframe src="${item.href}" title="${item.label}"></iframe>
  </section>`,
  )
  .join('\n');

writeFileSync(
  join(outDir, 'canli-mail-galeri.html'),
  `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Canlıdaki mail tasarımları</title>
<style>
  body { margin:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background:#0F172A; color:#E2E8F0; }
  .bar { position:sticky; top:0; z-index:5; padding:14px 18px 12px; background:#020617; border-bottom:1px solid #1E293B; }
  h1 { font-size:18px; margin:0 0 4px; }
  .lead { margin:0 0 10px; font-size:13px; color:#94A3B8; }
  nav { display:flex; gap:6px; flex-wrap:wrap; }
  nav a { color:#94A3B8; text-decoration:none; font-size:12px; font-weight:700; padding:7px 10px; border-radius:8px; background:#0F172A; }
  nav a:hover { background:#1E293B; color:#fff; }
  main { padding:16px 18px 48px; }
  section { margin:0 0 28px; }
  h2 { font-size:14px; margin:0 0 8px; color:#CBD5E1; }
  iframe { width:100%; height:980px; border:0; border-radius:12px; background:#E2E8F0; }
</style>
</head>
<body>
  <div class="bar">
    <h1>Halen kullanımda olan mail tasarımları</h1>
    <p class="lead">Canlıdaki bildirim mailleri. Aşağı kaydırarak hepsini görün. Yeni ihbar bu listede yok — henüz canlıya alınmadı.</p>
    <nav>
      ${nav}
    </nav>
  </div>
  <main>
    ${cards}
  </main>
</body>
</html>`,
);

console.log('yazıldı: canli-mail-galeri.html');
