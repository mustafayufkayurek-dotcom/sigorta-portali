import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  CUSTOMER_SERVICE_SCOPE_GROUPS,
  CUSTOMER_SERVICE_SCOPE_OPTIONS,
  customerMatchesExpenseServiceScope,
  customerServiceScopeIsSelected,
  normalizeCustomerServiceScopes,
  toggleCustomerServiceScope,
} from './customer-service-scopes.ts';

describe('müşteri hizmet kapsamı LOCK', () => {
  it('Hepsi seçenekler arasındadır; Hepsi diğerlerini temizler', () => {
    assert.ok(CUSTOMER_SERVICE_SCOPE_OPTIONS.some((o) => o.id === 'hepsi' && o.label === 'Hepsi'));
    assert.deepEqual(toggleCustomerServiceScope([], 'hepsi'), ['hepsi']);
    assert.deepEqual(toggleCustomerServiceScope(['danismanlik'], 'hepsi'), ['hepsi']);
    assert.deepEqual(toggleCustomerServiceScope(['hepsi'], 'danismanlik'), [
      'acil',
      'hasar-onarim',
      'hasar-tespit',
      'police-yonetimi',
    ]);
    assert.deepEqual(
      normalizeCustomerServiceScopes(['hepsi', 'danismanlik', 'acil']),
      ['hepsi'],
    );
    assert.deepEqual(
      normalizeCustomerServiceScopes([
        'acil',
        'hasar-onarim',
        'danismanlik',
        'hasar-tespit',
        'police-yonetimi',
      ]),
      ['hepsi'],
    );
  });

  it('Hepsi seçiliyken tüm kutular işaretli görünür', () => {
    assert.equal(customerServiceScopeIsSelected(['hepsi'], 'hepsi'), true);
    assert.equal(customerServiceScopeIsSelected(['hepsi'], 'acil'), true);
    assert.equal(customerServiceScopeIsSelected(['hepsi'], 'danismanlik'), true);
    assert.equal(customerServiceScopeIsSelected(['acil'], 'danismanlik'), false);
  });

  it('sol menü ile aynı ana başlık / alt hizmet kırılımı', () => {
    assert.deepEqual(
      CUSTOMER_SERVICE_SCOPE_GROUPS.map((g) => g.label),
      ['Asistans Hizmetleri', 'Ek Hizmetler'],
    );
    assert.deepEqual(
      CUSTOMER_SERVICE_SCOPE_GROUPS[0]?.options.map((o) => o.id),
      ['acil', 'hasar-onarim'],
    );
    assert.deepEqual(
      CUSTOMER_SERVICE_SCOPE_GROUPS[1]?.options.map((o) => o.id),
      ['danismanlik', 'hasar-tespit', 'police-yonetimi'],
    );
  });

  it('Masraf listesi kapsam ve boş eski kartı okur', () => {
    assert.equal(customerMatchesExpenseServiceScope([], 'danismanlik'), true);
    assert.equal(customerMatchesExpenseServiceScope(['hepsi'], 'danismanlik'), true);
    assert.equal(customerMatchesExpenseServiceScope(['hepsi'], 'tespit'), true);
    assert.equal(customerMatchesExpenseServiceScope(['hepsi'], 'asistans'), true);
    assert.equal(customerMatchesExpenseServiceScope(['danismanlik'], 'danismanlik'), true);
    assert.equal(customerMatchesExpenseServiceScope(['hasar-tespit'], 'tespit'), true);
    assert.equal(customerMatchesExpenseServiceScope(['danismanlik'], 'tespit'), false);
    assert.equal(customerMatchesExpenseServiceScope(['danismanlik'], 'police'), false);
    assert.equal(customerMatchesExpenseServiceScope(['police-yonetimi'], 'police'), true);
    assert.equal(customerMatchesExpenseServiceScope(['acil'], 'asistans'), true);
    assert.equal(customerMatchesExpenseServiceScope(['acil'], 'danismanlik'), false);
  });

  it('şema, masraf listesi ve müşteri formu bu kapıyı kullanır', () => {
    const root = join(import.meta.dirname, '../../..');
    const schema = readFileSync(join(root, 'apps/backend/prisma/schema.prisma'), 'utf8');
    assert.match(schema, /serviceScopes/);
    assert.match(schema, /service_scopes/);
    const svc = readFileSync(
      join(root, 'apps/backend/src/modules/expenses/expenses.service.ts'),
      'utf8',
    );
    assert.match(svc, /customerMatchesExpenseServiceScope/);
    const page = readFileSync(join(root, 'apps/web/src/app/panel/musteriler/page.tsx'), 'utf8');
    assert.match(page, /CUSTOMER_SERVICE_SCOPE_GROUPS/);
    assert.match(page, /customerServiceScopeIsSelected/);
    assert.match(page, /toggleCustomerServiceScope/);
    assert.match(page, /serviceScopes/);
    assert.match(page, /Hepsi/);
    assert.match(page, /hizmetKapsamOpen/);
  });
});
