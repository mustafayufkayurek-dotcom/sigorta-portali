/**
 * Operasyon menüsü — alfabetik sıra, Danışmanlık, Asistans Hizmetleri.
 * Acil Yardım yalnız Asistans altındadır; üstte ayrı satır yok.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/utils/operasyon-nav.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  acilListPageTitle,
  buildAsistansNavChildren,
  buildOperasyonNavChildren,
  HASAR_HIZMET_TESPIT,
  HASAR_LIST_HIZMET_PARAM,
  MUSTERI_KAYNAK_ASISTANS,
  MUSTERI_KAYNAK_PARAM,
  hasarListPageTitle,
  isHasarHizmetNavActive,
} from './operasyon-nav.ts';

describe('operasyon nav danışmanlık ve asistans kilidi', () => {
  it('Operasyon alt menü alfabetik durur; Asistans ve Danışmanlık gruplanır', () => {
    const children = buildOperasyonNavChildren();
    const titles = children.map((c) => c.title);
    assert.deepEqual(titles, [
      'Asistans Hizmetleri',
      'Dosya Özeti',
      'Ek Hizmetler',
      'Gelen Kutusu',
    ]);
    assert.ok(!titles.includes('Hasar Dosyaları'));
    assert.ok(!titles.includes('Acil Yardım Dosyaları'));
    assert.ok(!titles.includes('Danışmanlık'));
    const danismanlik = children.find((c) => c.title === 'Ek Hizmetler');
    assert.equal(danismanlik?.groupOnly, true);
    assert.equal(danismanlik?.children?.some((c) => c.title === 'Hasar Tespit'), true);
    assert.equal(danismanlik?.children?.some((c) => c.title === 'Poliçe Yönetimi'), true);
    assert.match(
      danismanlik?.children?.find((c) => c.title === 'Hasar Tespit')?.href ?? '',
      new RegExp(`${HASAR_LIST_HIZMET_PARAM}=${HASAR_HIZMET_TESPIT}`),
    );
    assert.match(danismanlik?.children?.find((c) => c.title === 'Poliçe Yönetimi')?.href ?? '', /police-yonetimi/);
    const asistans = children.find((c) => c.title === 'Asistans Hizmetleri');
    assert.equal(asistans?.groupOnly, true);
    assert.deepEqual(asistans?.children?.map((c) => c.title), ['Acil Yardım', 'Hasar Onarım']);
    assert.match(asistans?.children?.[0]?.href ?? '', /filter=acil/);
    assert.match(asistans?.children?.[0]?.href ?? '', new RegExp(`${MUSTERI_KAYNAK_PARAM}=${MUSTERI_KAYNAK_ASISTANS}`));
    const hasar = asistans?.children?.find((c) => c.title === 'Hasar Onarım');
    assert.equal(hasar?.groupOnly, undefined);
    assert.equal(hasar?.children, undefined);
    assert.match(hasar?.href ?? '', /hizmet=hasar-onarim/);
  });

  it('yeni asistans hizmeti sol menüde aynı grubun altına düşer', () => {
    const children = buildAsistansNavChildren([{ name: 'Cam İşleri', code: 'cam-isleri' }]);
    assert.equal(children.some((c) => c.title === 'Cam İşleri'), true);
    assert.match(children.find((c) => c.title === 'Cam İşleri')?.href ?? '', /hizmet=cam-isleri/);
    assert.equal(children.some((c) => c.title === 'Hasar Onarım'), true);
    assert.equal(children.some((c) => c.title === 'Acil Yardım'), true);
  });

  it('liste başlığı ve seçili menü hizmete ve kaynağa göre durur', () => {
    assert.equal(hasarListPageTitle(HASAR_HIZMET_TESPIT), 'Hasar Tespit');
    assert.equal(hasarListPageTitle('hasar-onarim'), 'Hasar Onarım');
    assert.equal(hasarListPageTitle(null), 'Hasar Onarım');
    assert.equal(hasarListPageTitle(null, MUSTERI_KAYNAK_ASISTANS), 'Hasar Onarım');
    assert.equal(acilListPageTitle(MUSTERI_KAYNAK_ASISTANS), 'Asistans Acil Yardım');
    assert.equal(
      isHasarHizmetNavActive('/panel/hasar-dosyalari', `/panel/hasar-dosyalari?${HASAR_LIST_HIZMET_PARAM}=${HASAR_HIZMET_TESPIT}`, HASAR_HIZMET_TESPIT),
      true,
    );
    assert.equal(
      isHasarHizmetNavActive('/panel/hasar-dosyalari', '/panel/hasar-dosyalari', HASAR_HIZMET_TESPIT),
      false,
    );
    assert.equal(
      isHasarHizmetNavActive(
        '/panel/hasar-dosyalari',
        `/panel/hasar-dosyalari?${MUSTERI_KAYNAK_PARAM}=${MUSTERI_KAYNAK_ASISTANS}`,
        null,
        MUSTERI_KAYNAK_ASISTANS,
      ),
      true,
    );
    assert.equal(
      isHasarHizmetNavActive(
        '/panel/hasar-dosyalari',
        '/panel/hasar-dosyalari',
        null,
        MUSTERI_KAYNAK_ASISTANS,
      ),
      false,
    );
  });
});
