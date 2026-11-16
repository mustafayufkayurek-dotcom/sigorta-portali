/**
 * Personel yasal hesap UI (C8) kilidi.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/components/hr/personel-yasal-hesap-ui.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('Personel yasal hesap UI LOCK', () => {
  it('özlük dosyasında Ücret sekmesi ve Kabul / Mali müşavir kapısı durur', () => {
    const drawer = readFileSync(join(here, 'HrEmployeeDossierDrawer.tsx'), 'utf8');
    const panel = readFileSync(join(here, 'HrPersonelUcretPanel.tsx'), 'utf8');

    assert.match(drawer, /HrPersonelUcretPanel/);
    assert.match(drawer, /key: 'pay'/);
    assert.match(drawer, /label: 'Ücret'/);
    assert.match(drawer, /tab === 'pay'/);

    assert.match(panel, /personel-ucret-panel/);
    assert.match(panel, /proposePersonelYasalHesap/);
    assert.match(panel, /yasal-hesap\/accept/);
    assert.match(panel, /yasal-hesap\/send-accountant/);
    assert.match(panel, /personel-yasal-kabul/);
    assert.match(panel, /Mali Müşavire Gönder/);
    assert.match(panel, /\{saving \? 'Kaydediliyor…' : 'Kaydet'\}/);
    assert.doesNotMatch(panel, /Brütü Kaydet/);
    assert.match(panel, /TrAmountInput/);
    assert.match(panel, /formatTryAmount/);
    assert.match(panel, /personel-hesap-ozeti/);
    assert.match(panel, /Personel gideri bütçelenir/);
    assert.match(panel, /personel carisine yazılır/);
    assert.match(panel, /Kabul Ediliyor/);
    assert.match(panel, /Kabul yerine geçmez/);
    assert.doesNotMatch(panel, /Ben yapay zekâyım/);

    assert.match(drawer, /personel-izin-ozeti/);
    assert.match(drawer, /İzin Özeti/);
    assert.match(drawer, /Hakedilen/);
    assert.match(drawer, /Onay Bekleyen/);
    assert.match(drawer, /personel-izin-detay/);
    assert.match(drawer, /setLeaveDetail/);
    assert.match(drawer, /personel-devam-ozeti/);
    assert.match(drawer, /Devam Özeti/);
    assert.match(drawer, /Eksik Gün Listesi/);

    const zimmet = readFileSync(join(here, 'HrAssignedAssetsPanel.tsx'), 'utf8');
    assert.match(zimmet, /Zimmetli Demirbaşlar/);
    assert.match(zimmet, /personel-zimmet-liste/);
    assert.match(zimmet, /personel-zimmet-satirlar/);
    assert.match(zimmet, /Seri No/);
    assert.match(zimmet, /Marka · Model/);
    assert.doesNotMatch(zimmet, /Bu personelde/);
  });
});

