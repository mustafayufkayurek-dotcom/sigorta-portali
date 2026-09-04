import { copyFileSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  buildNewClaimFileEmailHtml,
  buildNotificationEmailHtml,
} from '../src/modules/notifications/email/email.template';

const outDir = join(__dirname, '../../../.preview');
mkdirSync(outDir, { recursive: true });
copyFileSync(
  join(__dirname, '../../web/public/docs/meridyen-logo-original.png'),
  join(outDir, 'meridyen-logo-original.png'),
);

function withLocalLogo(html: string): string {
  return html
    .replace(/https?:\/\/[^"'\s]+\/docs\/meridyen-logo-original\.png/g, 'meridyen-logo-original.png')
    .replace(/\/docs\/meridyen-logo-original\.png/g, 'meridyen-logo-original.png');
}

const sample = {
  fileNo: '49/19430902',
  customer: 'Osem',
  branch: 'diger',
  priority: 'normal',
  actionUrl: 'https://app.meridyen-tr.com/panel/hasar-dosyalari/ornek',
  portalUrl: 'https://app.meridyen-tr.com/giris',
};

const dogru = buildNewClaimFileEmailHtml(sample);
const bozuk = buildNotificationEmailHtml({
  title: 'Yeni Hasar Dosyası',
  preheader: `${sample.fileNo} numaralı yeni bir hasar dosyası oluşturuldu.`,
  rows: [
    { label: 'Dosya No', value: sample.fileNo },
    { label: 'Müşteri', value: sample.customer },
    { label: 'Branş', value: sample.branch },
    { label: 'Aciliyet', value: sample.priority },
  ],
  actionUrl: sample.actionUrl,
  actionLabel: 'Dosyayı Görüntüle',
  portalUrl: sample.portalUrl,
});

writeFileSync(join(outDir, 'yeni-hasar-dosyasi-mail.html'), withLocalLogo(dogru));
writeFileSync(join(outDir, 'yeni-hasar-dosyasi-mail-eski.html'), withLocalLogo(bozuk));
console.log('yazıldı: yeni-hasar-dosyasi-mail.html');
