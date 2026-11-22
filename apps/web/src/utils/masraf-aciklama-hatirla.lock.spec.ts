/**
 * Masraf Açıklama hatırlama + tarih satırı + Kasa türü kilidi.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  MASRAF_ACIKLAMA_HATIRLA_KEY,
  MASRAF_ACIKLAMA_HATIRLA_MAX,
  readMasrafAciklamaHatirla,
  rememberMasrafAciklama,
} from './masraf-aciklama-hatirla.ts';

const root = join(import.meta.dirname, '../../../..');

describe('Masraf açıklama hatırlama LOCK', () => {
  it('anahtar ve üst sınır durur', () => {
    assert.equal(MASRAF_ACIKLAMA_HATIRLA_KEY, 'finans-masraf-aciklama-son');
    assert.equal(MASRAF_ACIKLAMA_HATIRLA_MAX, 12);
  });

  it('form datalist ve kaydet hatırlamayı kullanır', () => {
    const page = readFileSync(
      join(root, 'apps/web/src/app/panel/finans/masraflar/page.tsx'),
      'utf8',
    );
    assert.match(page, /rememberMasrafAciklama/);
    assert.match(page, /readMasrafAciklamaHatirla/);
    assert.match(page, /finans-masraf-aciklama-hatirla/);
    assert.match(page, /list="finans-masraf-aciklama-hatirla"/);
    assert.match(page, /data-testid="masraf-aciklama"/);
  });

  it('Danışmanlıkta tarih tam satır kaplamaz', () => {
    const page = readFileSync(
      join(root, 'apps/web/src/app/panel/finans/masraflar/page.tsx'),
      'utf8',
    );
    assert.match(page, /data-testid="masraf-tarih-alan"/);
    assert.doesNotMatch(
      page,
      /data-testid="masraf-tarih-alan"[^>]*md:col-span-2/,
    );
    assert.doesNotMatch(
      page,
      /masraf-tarih-alan"[^>]*className=\{form\.expenseLane === 'hasar'/,
    );
  });

  it('hatırlama sırayı ve tekrarı korur (bellek mock)', () => {
    const store: Record<string, string> = {};
    const g = globalThis as typeof globalThis & {
      window?: {
        localStorage: {
          getItem: (k: string) => string | null;
          setItem: (k: string, v: string) => void;
        };
      };
    };
    const prev = g.window;
    g.window = {
      localStorage: {
        getItem: (k) => (k in store ? store[k]! : null),
        setItem: (k, v) => {
          store[k] = v;
        },
      },
    };
    try {
      assert.deepEqual(readMasrafAciklamaHatirla(), []);
      rememberMasrafAciklama('Ekmek ve Sigara Alımı');
      rememberMasrafAciklama('Muhtelif Yiyecek');
      rememberMasrafAciklama('Ekmek ve Sigara Alımı');
      assert.deepEqual(readMasrafAciklamaHatirla(), [
        'Ekmek ve Sigara Alımı',
        'Muhtelif Yiyecek',
      ]);
    } finally {
      if (prev === undefined) delete g.window;
      else g.window = prev;
    }
  });
});
