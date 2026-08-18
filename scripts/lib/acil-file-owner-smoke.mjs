/**
 * Acil yeni dosya — finans vekili dosya sorumlusu listesinde.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

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

const form = read('apps/web/src/components/emergency/EmergencyCaseNewForm.tsx');
if (!form.includes("includeDelegates: 'acil_yardim'")) {
  fail('Yeni Acil dosya formu finans vekillerini istemiyor');
}
if (!form.includes('dosya-sorumlusu-ilk-kullanim-seridi')) {
  fail('Dosya sorumlusu vekalet şeridi yok');
}
if (form.includes("params: { role: 'office_staff' }") && !form.includes('includeDelegates')) {
  fail('Dosya sorumlusu yalnız office_staff; vekalet düşmüş');
}
pass('Acil form: office_staff + acil_yardim vekalet');

const service = read('apps/backend/src/modules/claim-files/claim-files.service.ts');
if (!service.includes('mergeAssignableStaffWithDelegates') || !service.includes('listActiveFunctionDelegates')) {
  fail('assignable-staff finans vekillerini birleştirmiyor');
}
pass('API: atanabilir personel + fonksiyon vekili birleşir');
