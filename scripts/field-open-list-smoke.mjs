#!/usr/bin/env node
/**
 * Saha / Hasar «Açık Dosyalar» regressyon kapısı (credential yok, tsx gerekmez).
 *
 * Yakalanan sınıf: dashboard ?status=open → tek duruma fuzzy bağlanıp
 * (örn. «Onarım Devam Ediyor») atanan dosyaların listeden kaybolması.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');

function read(rel) {
  const p = join(ROOT, rel);
  if (!existsSync(p)) throw new Error(`Dosya yok: ${rel}`);
  return readFileSync(p, 'utf8');
}

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function pass(msg) {
  console.log(`PASS: ${msg}`);
}

const page = read('apps/web/src/app/panel/hasar-dosyalari/page.tsx');
if (page.includes("urlStatusCode === 'open'") && page.includes("'devam'")) {
  fail("hasar-dosyalari/page.tsx içinde status=open → 'devam' fuzzy eşleşmesi geri geldi");
}
if (!page.includes('claimListStatusFilterFromUrl') || !page.includes('appendClaimListStatusParams')) {
  fail('hasar-dosyalari/page.tsx claim-list-url-status yardımcısını kullanmıyor');
}
if (!page.includes('value="__open__"') || !page.includes('Açık Dosyalar')) {
  fail('Durum filtresinde Açık Dosyalar (__open__) seçeneği yok');
}
pass('Liste sayfası open/closed semantic yardımcıya bağlı; fuzzy devam yok');

const nav = read('apps/web/src/features/dashboard/utils/claim-nav-href.ts');
if (!nav.includes("'/panel/hasar-dosyalari?status=open'")) {
  fail('CLAIM_LIST_OPEN_HREF status=open sözleşmesi bozulmuş');
}
pass('Dashboard Açık Dosyalar linki status=open (beklenen sözleşme)');

const util = read('apps/web/src/utils/claim-list-url-status.ts');
if (!util.includes("raw === 'open'") || !util.includes("params.set('statusCode', 'open')")) {
  fail('claim-list-url-status open → statusCode=open üretmiyor');
}
if (util.includes("'devam'") || util.includes('in_progress')) {
  fail('claim-list-url-status içinde tehlikeli fuzzy anahtar geri geldi');
}
pass('URL çözümleyici open/closed → statusCode (fuzzy yok)');

// Çalışma zamanı — .ts import yalnızca Node destekliyorsa (yerel). Aksi halde kaynak kilidi yeterli.
const utilPath = join(ROOT, 'apps/web/src/utils/claim-list-url-status.ts');
try {
  const mod = await import(pathToFileURL(utilPath).href);
  const statuses = [
    { id: 's-pre', code: 'pre_review', name: 'Ön İnceleme' },
    { id: 's-repair', code: 'repair_in_progress', name: 'Onarım Devam Ediyor' },
  ];
  assert.deepEqual(mod.resolveClaimListUrlStatus('open', statuses), { kind: 'open' });
  assert.notEqual(mod.claimListStatusFilterFromUrl('open', statuses), 's-repair');
  assert.equal(mod.claimListStatusFilterFromUrl('open', statuses), '__open__');
  const params = new URLSearchParams();
  mod.appendClaimListStatusParams(params, '__open__');
  assert.equal(params.get('statusCode'), 'open');
  assert.equal(params.get('statusId'), null);
  pass('Çalışma: status=open → statusCode=open; Onarım Devam Ediyor seçilmez');
} catch (err) {
  const msg = String(err && err.message ? err.message : err);
  if (msg.includes('Unknown file extension') || msg.includes('ERR_UNKNOWN_FILE_EXTENSION') || msg.includes('strip-types')) {
    pass('Çalışma import atlandı (sunucu Node .ts desteklemiyor) — kaynak kilidi yeterli');
  } else {
    fail(`Çalışma assert: ${msg}`);
  }
}

const service = read('apps/backend/src/modules/claim-files/claim-files.service.ts');
if (!service.includes("statusCode === 'open'") || !service.includes('isClosedState: false')) {
  fail('Backend statusCode=open isClosedState:false kullanmıyor');
}
if (!service.includes("statusCode === 'closed'") || !service.includes('isClosedState: true')) {
  fail('Backend statusCode=closed isClosedState:true kullanmıyor');
}
pass('Backend open/closed kapalı bayrağına bağlı');

console.log('=== field-open-list-smoke: PASS ===');
