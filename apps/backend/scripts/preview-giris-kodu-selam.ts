import { copyFileSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  buildTransactionalEmailHtml,
  formatSnPersonGreeting,
} from '../src/modules/notifications/email/email.template';

const outDir = join(__dirname, '../../../.preview');
mkdirSync(outDir, { recursive: true });
const logo = 'meridyen-logo-original.png';
copyFileSync(join(__dirname, '../assets/meridyen-logo-original.png'), join(outDir, logo));

const greeting = formatSnPersonGreeting('MUSTAFA', 'YUFKAYÜREK');
let html = buildTransactionalEmailHtml({
  title: 'Giriş Kodu',
  greeting,
  intro:
    'Giriş için 6 haneli kod. Kodu kopyalayıp giriş ekranına dönün; kutu dolar. 10 dakika geçerlidir. Bu talebi siz oluşturmadıysanız yok sayın.',
  bodyHtml:
    '<p style="margin:0 0 12px;font-size:28px;line-height:1.2;letter-spacing:0.18em;font-weight:800;">Kod 847291</p>',
  portalUrl: 'http://localhost:3001/giris',
});
html = html
  .replace(/https?:\/\/[^"'\s]+\/docs\/meridyen-logo-original\.png/g, logo)
  .replace(/\/docs\/meridyen-logo-original\.png/g, logo);

const bar = `<div style="max-width:640px;margin:0 auto;padding:16px 16px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="background:#ffffff;border:1px solid #E2E8F0;border-radius:10px;padding:12px 14px;margin-bottom:8px;">
    <div style="font-size:11px;font-weight:700;color:#64748B;">Kayıtta Yazılan</div>
    <div style="font-size:15px;font-weight:700;color:#94A3B8;margin-top:4px;text-decoration:line-through;">MUSTAFA YUFKAYÜREK</div>
    <div style="font-size:11px;font-weight:700;color:#64748B;margin-top:12px;">Mailde Duran</div>
    <div style="font-size:18px;font-weight:800;color:#0F172A;margin-top:4px;">${greeting}</div>
  </div>
</div>`;
html = html.replace(/<body([^>]*)>/i, `<body$1>${bar}`);
writeFileSync(join(outDir, 'giris-kodu-selam.html'), html);
console.log(greeting);
console.log(join(outDir, 'giris-kodu-selam.html'));
