/**
 * Çift atılma önlemi — eşzamanlı refresh tek promise paylaşır.
 * Çalıştır: node --experimental-strip-types apps/web/src/utils/share-inflight.regression.test.ts
 */
import assert from 'node:assert/strict';
import { shareInFlight, type InFlightHolder } from './share-inflight.ts';

async function main() {
  let runs = 0;
  const holder: InFlightHolder<string> = { current: null };

  const factory = () =>
    new Promise<string>((resolve) => {
      runs += 1;
      setTimeout(() => resolve('ok'), 30);
    });

  const [a, b, c] = await Promise.all([
    shareInFlight(holder, factory),
    shareInFlight(holder, factory),
    shareInFlight(holder, factory),
  ]);

  assert.equal(a, 'ok');
  assert.equal(b, 'ok');
  assert.equal(c, 'ok');
  assert.equal(runs, 1, 'eşzamanlı çağrılar tek factory çalıştırmalı');
  assert.equal(holder.current, null, 'bitince holder temizlenmeli');

  // İkinci dalga yeniden çalışabilir
  const d = await shareInFlight(holder, factory);
  assert.equal(d, 'ok');
  assert.equal(runs, 2, 'önceki bittikten sonra yeni çağrı çalışmalı');

  console.log('share-inflight.regression.test.ts PASS');
}

void main();
