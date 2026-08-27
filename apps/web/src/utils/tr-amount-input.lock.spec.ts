import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { formatTrAmountInput } from './tr-amount-input.ts';

const dir = dirname(fileURLToPath(import.meta.url));

describe('tutar yazarken nokta', () => {
  it('125555 yazılınca 125.555 olur', () => {
    assert.equal(formatTrAmountInput('125555'), '125.555');
    assert.equal(formatTrAmountInput('1255'), '1.255');
  });

  it('dosya gelir ve tahsilat TrAmountInput kullanır', () => {
    const gelir = readFileSync(
      join(dir, '../components/finance/ClaimFileGelirTahsilatPanel.tsx'),
      'utf8',
    );
    assert.match(gelir, /TrAmountInput/);
    assert.doesNotMatch(gelir, /type="number".*gelir\.amount/);
  });
});
