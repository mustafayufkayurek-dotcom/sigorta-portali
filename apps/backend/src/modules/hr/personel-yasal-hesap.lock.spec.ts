/**
 * Personel yasal hesap API (C8) kilidi.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/hr/personel-yasal-hesap.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('Personel yasal hesap API LOCK', () => {
  it('özlük brüt + kabul + mali müşavir + cari yazım kapıları durur', () => {
    const ctrl = readFileSync(join(here, 'hr.controller.ts'), 'utf8');
    const svc = readFileSync(join(here, 'hr.service.ts'), 'utf8');
    const mod = readFileSync(join(here, 'hr.module.ts'), 'utf8');
    const schema = readFileSync(join(here, '../../../prisma/schema.prisma'), 'utf8');
    const dto = readFileSync(join(here, 'dto/personel-yasal-hesap.dto.ts'), 'utf8');
    const upsert = readFileSync(join(here, 'dto/upsert-employee-profile.dto.ts'), 'utf8');

    assert.match(schema, /monthlyGrossSalary|monthly_gross_salary/);
    assert.match(schema, /yasalKabulJson|yasal_kabul_json/);
    assert.match(schema, /yasalKabulAt|yasal_kabul_at/);
    assert.match(upsert, /monthlyGrossSalary/);
    assert.match(dto, /PatchPersonelUcretDto/);
    assert.match(dto, /AcceptPersonelYasalHesapDto/);
    assert.match(dto, /SendPersonelYasalAccountantDto/);

    assert.match(ctrl, /employees\/:id\/yasal-hesap/);
    assert.match(ctrl, /employees\/:id\/ucret/);
    assert.match(ctrl, /yasal-hesap\/accept/);
    assert.match(ctrl, /yasal-hesap\/send-accountant/);

    assert.match(svc, /proposePersonelYasalHesap/);
    assert.match(svc, /canAcceptPersonelYasalHesap/);
    assert.match(svc, /acceptPersonelYasalHesap/);
    assert.match(svc, /sendPersonelYasalToAccountant/);
    assert.match(svc, /postPersonelMaasBorc/);
    assert.match(svc, /Kabul etmek için önce aylık brüt ücreti girin/);
    assert.match(svc, /personel carisine yazılır/);
    assert.doesNotMatch(svc, /Kıdem ve ihbar tazminatı hesabı sonraki fazdadır/);

    assert.match(mod, /FinanceModule/);
  });
});
