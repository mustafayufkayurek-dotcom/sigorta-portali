import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  FINANS_VERIMLILIK_ANALIZ_UYARI_METNI,
  formatFinansVerimlilikAnalizUyari,
} from './finans-verimlilik-analiz-uyari.ts';

const here = dirname(fileURLToPath(import.meta.url));
const webSrc = join(here, '..');

describe('finans verimlilik analiz uyarısı LOCK', () => {
  it('metin sabit; bant finans kâr-zarar sayfalarında durur', () => {
    assert.match(FINANS_VERIMLILIK_ANALIZ_UYARI_METNI, /Verimlilik Analizi/);
    assert.match(FINANS_VERIMLILIK_ANALIZ_UYARI_METNI, /inceleyiniz/i);
    const formatted = formatFinansVerimlilikAnalizUyari({
      kind: 'dosya',
      label: '2026 YE 1',
      at: '2026-11-22T00:00:00.000Z',
    });
    assert.ok(formatted);
    assert.match(formatted!, /2026 YE 1/);
    assert.match(formatted!, /Verimlilik Analizi/);

    const ikon = readFileSync(
      join(webSrc, 'components/finance/FinansTarihDonemUyariIkon.tsx'),
      'utf8',
    );
    assert.match(ikon, /finans-tarih-donem-uyari-ikon/);
    assert.match(ikon, /animate|blink|closed/);

    const masraf = readFileSync(
      join(webSrc, 'app/panel/finans/masraflar/page.tsx'),
      'utf8',
    );
    assert.match(masraf, /FinansTarihDonemUyariIkon/);
    assert.match(masraf, /pushFinansVerimlilikAnalizUyari/);
    assert.match(masraf, /FINANS_DONEM_KAPALI_MESAJ/);

    const karlilik = readFileSync(
      join(webSrc, 'app/panel/finans/karlilik/page.tsx'),
      'utf8',
    );
    const dosyaPl = readFileSync(
      join(webSrc, 'app/panel/finans/dosya-pl/page.tsx'),
      'utf8',
    );
    const home = readFileSync(join(webSrc, 'app/panel/finans/page.tsx'), 'utf8');
    assert.match(karlilik, /FinansVerimlilikAnalizUyariBant/);
    assert.match(dosyaPl, /FinansVerimlilikAnalizUyariBant/);
    assert.match(home, /FinansVerimlilikAnalizUyariBant/);
  });
});
