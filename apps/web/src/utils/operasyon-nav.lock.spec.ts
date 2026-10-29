/**
 * Operasyon menüsü — alfabetik sıra, Danışmanlık, Asistans Hizmetleri.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/utils/operasyon-nav.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  acilListPageTitle,
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
      'Acil Yardım Dosyaları',
      'Asistans Hizmetleri',
      'Danışmanlık',
      'Dosya Özeti',
      'Gelen Kutusu',
      'Hasar Dosyaları',
    ]);
    const danismanlik = children.find((c) => c.title === 'Danışmanlık');
    assert.equal(danismanlik?.groupOnly, true);
    assert.equal(danismanlik?.children?.[0]?.title, 'Hasar Tespit');
    assert.match(danismanlik?.children?.[0]?.href ?? '', new RegExp(`${HASAR_LIST_HIZMET_PARAM}=${HASAR_HIZMET_TESPIT}`));
    const asistans = children.find((c) => c.title === 'Asistans Hizmetleri');
    assert.equal(asistans?.groupOnly, true);
    assert.deepEqual(asistans?.children?.map((c) => c.title), ['Acil Yardım', 'Hasar']);
    assert.match(asistans?.children?.[0]?.href ?? '', /filter=acil/);
    assert.match(asistans?.children?.[0]?.href ?? '', new RegExp(`${MUSTERI_KAYNAK_PARAM}=${MUSTERI_KAYNAK_ASISTANS}`));
    assert.match(asistans?.children?.[1]?.href ?? '', new RegExp(`${MUSTERI_KAYNAK_PARAM}=${MUSTERI_KAYNAK_ASISTANS}`));
  });

  it('liste başlığı ve seçili menü hizmete ve kaynağa göre durur', () => {
    assert.equal(hasarListPageTitle(HASAR_HIZMET_TESPIT), 'Hasar Tespit');
    assert.equal(hasarListPageTitle(null), 'Hasar Dosyaları');
    assert.equal(hasarListPageTitle(null, MUSTERI_KAYNAK_ASISTANS), 'Asistans Hasar');
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
