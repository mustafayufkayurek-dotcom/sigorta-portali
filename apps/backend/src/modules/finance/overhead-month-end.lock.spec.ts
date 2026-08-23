import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  isLastDayOfMonthIstanbul,
  isOverheadPoolProcessed,
  istanbulDateParts,
} from './overhead-month-end.helper.ts';

const dir = dirname(fileURLToPath(import.meta.url));

describe('yönetim gideri ay sonu hatırlatması LOCK', () => {
  it('31 Ağustos son gündür, 30 Ağustos değildir', () => {
    assert.equal(isLastDayOfMonthIstanbul(new Date('2026-08-31T06:00:00.000Z')), true);
    assert.equal(isLastDayOfMonthIstanbul(new Date('2026-08-30T06:00:00.000Z')), false);
    assert.equal(istanbulDateParts(new Date('2026-08-31T06:00:00.000Z')).month, 8);
  });

  it('boş havuz işlenmiş sayılmaz', () => {
    assert.equal(
      isOverheadPoolProcessed({ poolExpenseCount: 0, entryCount: 0, allocationComplete: true }),
      false,
    );
    assert.equal(
      isOverheadPoolProcessed({ poolExpenseCount: 2, entryCount: 1, allocationComplete: true }),
      true,
    );
    assert.equal(
      isOverheadPoolProcessed({ poolExpenseCount: 2, entryCount: 0, allocationComplete: false }),
      false,
    );
  });

  it('cron finans ve yöneticiye gider; tek dosyaya yazılmaz', () => {
    const svc = readFileSync(join(dir, 'monthly-overhead.service.ts'), 'utf8');
    const sch = readFileSync(join(dir, 'overhead-month-end.scheduler.ts'), 'utf8');
    assert.match(sch, /0 9 \* \* \*/);
    assert.match(sch, /Europe\/Istanbul/);
    assert.match(svc, /sendLastDayPoolReminders/);
    assert.match(svc, /admin/);
    assert.match(svc, /finance/);
    assert.match(svc, /sabit-giderler/);
    assert.match(svc, /tek dosyaya yazılmaz/);
  });
});
