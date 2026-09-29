import { copyFileSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  buildLoginApprovalCodeHtml,
  buildTransactionalEmailHtml,
  formatSnPersonGreeting,
} from '../src/modules/notifications/email/email.template';

const outDir = join(__dirname, '../../../.preview');
mkdirSync(outDir, { recursive: true });
const logo = 'meridyen-logo-original.png';
copyFileSync(join(__dirname, '../assets/meridyen-logo-original.png'), join(outDir, logo));

const greeting = formatSnPersonGreeting('MUSTAFA', 'YUFKAYÜREK');
let html = buildTransactionalEmailHtml({
  title: 'Giriş Onayı',
  greeting,
  intro: 'Aşağıdaki giriş kodunu kullanarak platforma giriş yapabilirsiniz.',
  bodyHtml: buildLoginApprovalCodeHtml('2 8 1 3 9 8'),
  portalUrl: 'http://localhost:3001/giris',
});
html = html
  .replace(/https?:\/\/[^"'\s]+\/docs\/meridyen-logo-original\.png/g, logo)
  .replace(/\/docs\/meridyen-logo-original\.png/g, logo)
  .replace(
    '</body>',
    `<script>
document.getElementById('giris-kodu-kopyala')?.addEventListener('click', async function (event) {
  event.preventDefault();
  const value = this.getAttribute('data-code') || '';
  if (!value) return;
  await navigator.clipboard.writeText(value);
  this.style.borderColor = '#16A34A';
});
</script></body>`,
  );

writeFileSync(join(outDir, 'giris-kodu-selam.html'), html);
console.log(greeting);
console.log(join(outDir, 'giris-kodu-selam.html'));
