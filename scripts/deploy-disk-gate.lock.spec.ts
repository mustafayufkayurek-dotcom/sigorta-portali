/**
 * Alım disk kapısı kilidi.
 * 13.11.2026: v691 tam alımı 9 GB boşla başladı; iki derleme diski doldurdu, veritabanı durdu, canlı 502 verdi.
 * Çalıştır: node --experimental-strip-types --test scripts/deploy-disk-gate.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (f: string) => readFileSync(join(here, f), 'utf8');

describe('alım disk kapısı LOCK', () => {
  it('tam alım 12 GB ister; yetmezse güvenli temizlik, yine yetmezse başlamaz', () => {
    const src = read('deploy-full-production.sh');
    assert.match(src, /FULL_DEPLOY_MIN_FREE_GB="\$\{FULL_DEPLOY_MIN_FREE_GB:-12\}"/);
    assert.match(src, /server-disk-maintenance\.sh/);
    assert.match(src, /alım başlamadı, canlı aynı kaldı/);
    assert.doesNotMatch(src, /minimum 5 GB/);
  });

  it('derlemeler arası kalıntı temizlenir; servis değişmeden disk ve veritabanı bakılır', () => {
    const src = read('deploy-full-production.sh');
    const backendBuild = src.indexOf('docker build -f Dockerfile.backend');
    const webBuild = src.indexOf('docker build -f Dockerfile.web');
    const swap = src.indexOf('up -d --no-deps backend');
    assert.ok(backendBuild > 0 && webBuild > backendBuild && swap > webBuild);
    const between = src.slice(backendBuild, webBuild);
    assert.match(between, /docker builder prune -af/);
    assert.match(between, /disk_gate 'web derleme'/);
    const beforeSwap = src.slice(webBuild, swap);
    assert.match(beforeSwap, /disk_gate 'servis değişimi'/);
    assert.match(beforeSwap, /db_gate/);
    assert.match(src, /pg_isready/);
  });

  it('yeni backend açılmazsa önceki backend’e kendiliğinden döner', () => {
    const src = read('deploy-full-production.sh');
    assert.match(src, /backend_rollback\(\)/);
    assert.match(src, /\|\| backend_rollback 'yeni backend sağlık vermedi'/);
    assert.match(src, /cp -f \\"\\\$PREV_OVERRIDE\\" docker-compose\.override\.yml/);
  });

  it('yalnız web alımı 8 GB ister; derleme sonrası disk ve veritabanı bakılır', () => {
    const src = read('deploy-web-production.sh');
    assert.match(src, /minimum 8 GB/);
    assert.match(src, /docker builder prune -af/);
    assert.match(src, /pg_isready/);
  });

  it('bakım eski sürümü ayıklar; korunan ve en yeni dört sürüm durur; tam prune yok', () => {
    const src = read('server-disk-maintenance.sh');
    assert.match(src, /KEEP_RELEASES="\$\{KEEP_RELEASES:-4\}"/);
    assert.match(src, /PROTECTED_IMAGES\[@\]/);
    assert.match(src, /RUNNING_IMAGES/);
    assert.match(src, /docker rmi "\$img"/);
    assert.doesNotMatch(src, /^docker image prune -af/m);
    assert.doesNotMatch(src, /rm -rf[^\n]*uploads/);
  });

  it('canlı alım kapısında durur', () => {
    assert.match(read('smoke-canli-bitmis-is.sh'), /deploy-disk-gate\.lock\.spec/);
  });
});
