/**
 * Kilit: Sözleşme muafiyeti yalnız üç geriye dönük dosyadır.
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/hasar-vendor-contract-waiver.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  HASAR_VENDOR_CONTRACT_WAIVED_FILES,
  isHasarVendorContractWaived,
} from './hasar-vendor-contract-waiver.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('hasar tedarikçi sözleşmesi muafiyeti LOCK', () => {
  it('yalnız Adalet / Serap Richard / İlknur Yılmaz dosyaları muaftır', () => {
    assert.equal(HASAR_VENDOR_CONTRACT_WAIVED_FILES.length, 3);
    assert.equal(
      isHasarVendorContractWaived({ id: '82805b75-173b-44d1-99e0-356f8c50fdd1' }),
      true,
    );
    assert.equal(isHasarVendorContractWaived({ fileNo: '14102847240002' }), true);
    assert.equal(isHasarVendorContractWaived({ fileNo: 'eureko' }), true);
    assert.equal(isHasarVendorContractWaived({ id: 'c0a1e001-7e51-4000-8000-10ca1000a001' }), false);
    assert.equal(isHasarVendorContractWaived({ fileNo: 'AY-DEMO-1' }), false);
    assert.equal(isHasarVendorContractWaived({}), false);
  });

  it('hakediş ve evrak bu muafiyeti kullanır; başka dosyaya yayılmaz', () => {
    const panel = readFileSync(
      join(here, '../../../apps/web/src/components/finance/HasarFileHakedisPanel.tsx'),
      'utf8',
    );
    const evrak = readFileSync(
      join(here, '../../../apps/web/src/app/panel/hasar-dosyalari/[id]/_components/tabs/EvrakOzetPanel.tsx'),
      'utf8',
    );
    const svc = readFileSync(
      join(here, '../../../apps/backend/src/modules/file-documents/file-documents.service.ts'),
      'utf8',
    );
    const rule = readFileSync(
      join(here, '../../../.cursor/rules/hasar-uc-dosya-sozlesme-muafiyeti.mdc'),
      'utf8',
    );
    assert.match(panel, /isHasarVendorContractWaived/);
    assert.match(panel, /sozlesmeMuaf/);
    assert.match(evrak, /vendorContractWaived/);
    assert.match(svc, /isHasarVendorContractWaived/);
    assert.match(svc, /vendorContractWaived/);
    assert.match(rule, /822017/);
    assert.match(rule, /14102847240002/);
    assert.match(rule, /EUREKO/);
  });
});
