/**
 * Acil liste: satır yokken tablo durur; KPI ile liste aynı kapsamdadır; cevap dizi olarak okunur.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/utils/emergency-cases-list.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { asList } from './emergency-list-unwrap.ts';

const here = dirname(fileURLToPath(import.meta.url));
const opsListe = readFileSync(join(here, '../app/panel/operasyon/page.tsx'), 'utf8');
const claimStats = readFileSync(
  join(here, '../../../backend/src/modules/claim-files/claim-files.service.ts'),
  'utf8',
);
const grants = readFileSync(
  join(here, '../../../backend/src/modules/operational-access-grants/operational-access-grants.service.ts'),
  'utf8',
);
const apiClient = readFileSync(join(here, '../lib/api-client.ts'), 'utf8');

describe('Acil liste kontrol kilidi', () => {
  it('Acil ekranında Hasar KPI filtresi listeyi boşaltmaz', () => {
    assert.match(opsListe, /apiClient\.get<unknown>\('\/emergency\/cases'\)/);
    assert.match(opsListe, /asList<EmergencyCase>/);
    assert.match(opsListe, /acilList \|\|/);
    assert.match(opsListe, /\[filterType, opsPreset\]/);
  });

  it('0 satırda tablo başlığı durur; sessiz boş klasör yok', () => {
    assert.match(opsListe, /pagedRows\.length === 0/);
    assert.match(opsListe, /Liste alınamadı/);
    assert.match(opsListe, /Kayıt yok/);
    assert.match(opsListe, /acilList/);
    assert.match(opsListe, /casesLoading/);
    assert.doesNotMatch(opsListe, /Henüz Acil Yardım Dosyası Yok/);
  });

  it('KPI açık acil sayısı liste kapsamını kullanır', () => {
    assert.match(claimStats, /buildEmergencyDelegationScope/);
    assert.match(claimStats, /emergencyScope/);
    assert.match(grants, /createdByUserId: userId/);
    assert.match(grants, /assignedUserId: \{ in: \[userId/);
  });

  it('liste yanıtı dizi / {data} / {data:{data}} okunur', () => {
    assert.deepEqual(asList([{ id: '1' }]), [{ id: '1' }]);
    assert.deepEqual(asList({ data: [{ id: '2' }] }), [{ id: '2' }]);
    assert.deepEqual(asList({ data: { data: [{ id: '3' }] } }), [{ id: '3' }]);
    assert.deepEqual(asList({ items: [{ id: '4' }] }), [{ id: '4' }]);
    assert.deepEqual(asList(null), []);
  });

  it('unwrap yardımcısı emergencyApi içinde durur', () => {
    const emergencyApi = readFileSync(join(here, 'emergencyApi.ts'), 'utf8');
    assert.match(emergencyApi, /from '@\/utils\/emergency-list-unwrap'/);
    assert.match(emergencyApi, /apiClient\.get<unknown>\('\/emergency\/cases'/);
  });

  it('tarayıcıda API aynı kökten gider', () => {
    assert.match(apiClient, /return '\/api\/v1'/);
  });
});
