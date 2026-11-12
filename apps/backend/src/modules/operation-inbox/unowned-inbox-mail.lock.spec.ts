/**
 * Sahiplenilmemiş gelen kutu maili: mavi bantta ham konu yok.
 * Özet: dosya numarası, müşteri, sigortalı, dosya konusu, il ve ilçe.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/operation-inbox/unowned-inbox-mail.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { smartInboxFileSubject, threadFilePlace, unownedInboxSummaryRows } from './unowned-inbox-mail.ts';

const here = dirname(fileURLToPath(import.meta.url));
const RAW = 'Ynt: 1190757025/ELİF MANUOĞLU KARA/RCS-20261940095/KONUT ANAHTAR';

describe('sahiplenilmemiş gelen kutu maili LOCK', () => {
  it('ham konu satırını dosya konusuna indirger', () => {
    assert.equal(smartInboxFileSubject(RAW, null), 'Konut Anahtar');
    assert.equal(smartInboxFileSubject(RAW, 'Konut Anahtar'), 'Konut Anahtar');
    assert.equal(smartInboxFileSubject(RAW, RAW), 'Konut Anahtar');
  });

  it('özet sırası dosya numarası, müşteri, sigortalı, konu ve ildir', () => {
    const rows = unownedInboxSummaryRows({
      fileNo: 'RCS-20261940095',
      customerName: 'Remed Assistance',
      insuredName: 'ELİF MANUOĞLU KARA',
      fileSubject: 'Konut Anahtar',
      rawSubject: RAW,
      city: null,
      district: null,
    });
    assert.deepEqual(rows.map((row) => row.label), [
      'Dosya Numarası',
      'Müşteri Adı',
      'Sigortalı Adı Soyadı',
      'Dosya Konusu',
      'Dosya İl İlçe',
    ]);
    assert.equal(rows[0]?.value, 'RCS-20261940095');
    assert.equal(rows[1]?.value, 'Remed Assistance');
    assert.equal(rows[2]?.value, 'Elif Manuoğlu Kara');
    assert.equal(rows[3]?.value, 'Konut Anahtar');
    assert.equal(rows[4]?.value, '—');
  });

  it('bu yazıda il yoksa ilk ihbarın ilini alır', () => {
    const place = threadFilePlace(
      { city: null, district: null },
      [{ city: null, district: null }, { city: 'Ankara', district: 'Çankaya' }],
    );
    assert.deepEqual(place, { city: 'Ankara', district: 'Çankaya' });
    const rows = unownedInboxSummaryRows({
      city: place.city,
      district: place.district,
    });
    assert.equal(rows[4]?.value, 'Çankaya · Ankara');
  });

  it('il ve ilçe ilçe · il biçimindedir', () => {
    const rows = unownedInboxSummaryRows({
      city: 'İSTANBUL',
      district: 'ÜSKÜDAR',
    });
    assert.equal(rows[4]?.value, 'Üsküdar · İstanbul');
  });

  it('mail şablonu konuyu mavi banda basmaz', () => {
    const src = readFileSync(join(here, 'operation-inbox-notification.service.ts'), 'utf8');
    const start = src.indexOf('async notifyUnownedEscalation');
    const end = src.indexOf('async notifyNewIhbarFromInbox');
    const body = src.slice(start, end);
    const routing = readFileSync(join(here, 'inbound-routing.service.ts'), 'utf8');
    assert.match(body, /Sahiplenilmemiş Yeni İhbar/);
    assert.doesNotMatch(body, /Sahiplenilmemiş Gelen Kutu Mesajı/);
    assert.match(routing, /threadFilePlace/);
    assert.match(routing, /earlierThreadPlaces/);
    assert.match(body, /unownedInboxSummaryRows/);
    assert.doesNotMatch(body, /preheader:\s*body/);
    assert.doesNotMatch(body, /label: 'Konu'/);
  });
});
