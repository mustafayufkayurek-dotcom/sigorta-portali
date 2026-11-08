import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

test('poliçe yönetimi dosyadaki poliçe numarasını listeler', () => {
  assert.match(page, /Poliçe Yönetimi/);
  assert.match(page, /Poliçe No/);
  assert.match(page, /\/claim-files\?limit=200/);
  assert.match(page, /belirtilmedi/);
  assert.match(page, /hasar-dosyalari\/\$\{row\.id\}/);
  assert.match(page, /yeni=1/);
  assert.doesNotMatch(page, /Yakında/);
  const rules = readFileSync(new URL('../../../../utils/panel-route-access.rules.json', import.meta.url), 'utf8');
  assert.match(rules, /\/panel\/danismanlik\/police-yonetimi/);
});
