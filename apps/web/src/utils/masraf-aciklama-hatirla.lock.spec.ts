/**
 * Masraf Açıklama + Belge Sahibi hatırlama kilidi.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  MASRAF_ACIKLAMA_HATIRLA_KEY,
  MASRAF_ACIKLAMA_HATIRLA_MAX,
  MASRAF_BELGE_SAHIBI_HATIRLA_KEY,
  readMasrafAciklamaHatirla,
  readMasrafBelgeSahibiHatirla,
  rememberMasrafAciklama,
  rememberMasrafBelgeSahibi,
} from './masraf-aciklama-hatirla.ts';

const root = join(import.meta.dirname, '../../../..');

describe('Masraf açıklama / belge sahibi hatırlama LOCK', () => {
  it('anahtar ve üst sınır durur', () => {
    assert.equal(MASRAF_ACIKLAMA_HATIRLA_KEY, 'finans-masraf-aciklama-son');
    assert.equal(MASRAF_BELGE_SAHIBI_HATIRLA_KEY, 'finans-masraf-belge-sahibi-son');
    assert.equal(MASRAF_ACIKLAMA_HATIRLA_MAX, 12);
  });

  it('form datalist, chip ve kaydet hatırlamayı kullanır', () => {
    const page = readFileSync(
      join(root, 'apps/web/src/app/panel/finans/masraflar/page.tsx'),
      'utf8',
    );
    assert.match(page, /rememberMasrafAciklama/);
    assert.match(page, /readMasrafAciklamaHatirla/);
    assert.match(page, /rememberMasrafBelgeSahibi/);
    assert.match(page, /readMasrafBelgeSahibiHatirla/);
    assert.match(page, /finans-masraf-aciklama-hatirla/);
    assert.match(page, /list="finans-masraf-aciklama-hatirla"/);
    assert.match(page, /list="finans-masraf-belge-sahibi-hatirla"/);
    assert.match(page, /data-testid="masraf-aciklama"/);
    assert.match(page, /data-testid="masraf-belge-sahibi"/);
    assert.match(page, /MasrafHatirlaChips/);
    assert.match(page, /masraf-aciklama-hatirla-liste/);
    assert.match(page, /masraf-belge-sahibi-hatirla-liste/);
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
      rememberMasrafAciklama('Akatyakıt Alımı (Bodrum Dönüş)');
      assert.equal(readMasrafAciklamaHatirla()[0], 'Akaryakıt Alımı (Bodrum Dönüş)');
      rememberMasrafAciklama('Akatyakıt Alımı');
      assert.ok(readMasrafAciklamaHatirla().every((x) => !/akatyak/i.test(x)));

      assert.deepEqual(readMasrafBelgeSahibiHatirla(), []);
      rememberMasrafBelgeSahibi('SHELL');
      rememberMasrafBelgeSahibi('manav ahmet');
      rememberMasrafBelgeSahibi('Shell');
      assert.deepEqual(readMasrafBelgeSahibiHatirla(), ['Shell', 'Manav Ahmet']);
    } finally {
      if (prev === undefined) delete g.window;
      else g.window = prev;
    }
  });
});
