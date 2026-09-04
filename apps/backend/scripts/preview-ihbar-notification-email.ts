import { copyFileSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { buildNotificationEmailHtml } from '../src/modules/notifications/email/email.template';
import { buildInboxIhbarEmailTemplate } from '../src/modules/operation-inbox/inbox-ihbar-email';

const outDir = join(__dirname, '../../../.preview');
mkdirSync(outDir, { recursive: true });

try {
  copyFileSync(
    join(__dirname, '../../web/public/docs/meridyen-logo-original.png'),
    join(outDir, 'meridyen-logo-original.png'),
  );
} catch {
  copyFileSync(
    join(__dirname, '../assets/meridyen-logo-original.png'),
    join(outDir, 'meridyen-logo-original.png'),
  );
}

function withLocalLogo(html: string): string {
  return html
    .replace(/https?:\/\/[^"'\s]+\/docs\/meridyen-logo-original\.png/g, 'meridyen-logo-original.png')
    .replace(/\/docs\/meridyen-logo-original\.png/g, 'meridyen-logo-original.png');
}

function write(name: string, html: string) {
  writeFileSync(join(outDir, name), withLocalLogo(html));
}

write(
  'ihbar-bildirim-mail.html',
  buildNotificationEmailHtml(
    buildInboxIhbarEmailTemplate({
      fileType: 'hasar',
      fileNo: 'RCS-20261868899',
      notificationAt: new Date('2026-08-31T16:42:00+03:00'),
      insuranceCompanyName: 'Ray Sigorta',
      customerLongName: 'Ray Sigorta A.Ş.',
      fileSubject: 'Tesisat',
      insuredName: 'Yunus Emre Kurt',
      city: 'İstanbul',
      district: 'Kadıköy',
      address: 'Caferağa Mah. Moda Cad. No:12 Kadıköy / İstanbul',
      actionUrl: 'https://app.meridyen-tr.com/panel/hasar-dosyalari/ornek',
      portalUrl: 'https://app.meridyen-tr.com/giris',
    }),
  ),
);

write(
  'ihbar-acil-bildirim-mail.html',
  buildNotificationEmailHtml(
    buildInboxIhbarEmailTemplate({
      fileType: 'acil',
      fileNo: 'AYF-202608-0004',
      notificationAt: new Date('2026-08-27T14:38:00+03:00'),
      assistantCompanyName: 'Remed Asistans',
      customerLongName: 'Remed Asistans',
      fileSubject: 'Tesisat',
      insuredName: 'Nafi İlhan',
      city: 'Kocaeli',
      district: 'İzmit',
      address: 'Körfez Mah. No:8 İzmit / Kocaeli',
      actionUrl: 'https://app.meridyen-tr.com/panel/acil-yardim/ornek',
      portalUrl: 'https://app.meridyen-tr.com/giris',
    }),
  ),
);

console.log('yazıldı: ihbar-bildirim-mail.html, ihbar-acil-bildirim-mail.html');
