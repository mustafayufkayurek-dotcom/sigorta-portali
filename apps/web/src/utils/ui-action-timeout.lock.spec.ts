/**
 * Puantaj onay ve Hasar işlem: 10 sn sonra kutuyu kapat, ekranı kilitleme.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/utils/ui-action-timeout.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  UI_ACTION_TIMEOUT_MESSAGE,
  UI_ACTION_TIMEOUT_MS,
  UiActionTimeoutError,
  isUiActionTimeout,
  withUiActionTimeout,
} from './ui-action-timeout.ts';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(here, rel), 'utf8');

describe('işlem zaman aşımı LOCK', () => {
  it('metin ve 10 saniye kilitli durur', () => {
    assert.equal(UI_ACTION_TIMEOUT_MS, 10_000);
    assert.equal(
      UI_ACTION_TIMEOUT_MESSAGE,
      'İşlem zaman aşımına uğradı. Lütfen internet bağlantınızı kontrol edip tekrar deneyiniz',
    );
    assert.equal(isUiActionTimeout(new UiActionTimeoutError()), true);
    assert.equal(isUiActionTimeout({ code: 'ECONNABORTED' }), true);
    assert.equal(isUiActionTimeout(new Error('başka')), false);
  });

  it('süre dolunca bekleyen iş çözülür', async () => {
    const started = Date.now();
    await assert.rejects(
      () => withUiActionTimeout(new Promise(() => undefined), 20),
      (err: unknown) => err instanceof UiActionTimeoutError,
    );
    assert.ok(Date.now() - started < 500);
  });

  it('puantaj onay ve Hasar işlem bu kalkanı kullanır', () => {
    const ozluk = read('../app/panel/personel-ozluk/page.tsx');
    const gate = read('../components/hr/AttendancePanelGate.tsx');
    const hasar = read('../app/panel/hasar-dosyalari/[id]/page.tsx');
    const planner = read('../components/hasar-operasyon-planlayicisi/planner-context.tsx');
    assert.match(ozluk, /withUiActionTimeout/);
    assert.match(ozluk, /hr\/attendance\/confirm-day/);
    assert.match(gate, /withUiActionTimeout/);
    assert.match(hasar, /timeout: UI_ACTION_TIMEOUT_MS/);
    assert.match(planner, /timeout: UI_ACTION_TIMEOUT_MS/);
    assert.doesNotMatch(read('../lib/api-client.ts'), /timeoutMs|UI_ACTION_TIMEOUT/);
  });
});
