/**
 * Kilit: Dış onay gönderim gövdesi ValidationPipe tarafından silinmesin.
 * «property approverType should not exist» — dekoratörsüz DTO + forbidNonWhitelisted.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('dış onay gönderim DTO kilidi', () => {
  const dto = readFileSync(join(here, 'dto/external-approvals.dto.ts'), 'utf8');
  const page = readFileSync(
    join(
      here,
      '../../../../../apps/web/src/app/panel/hasar-dosyalari/[id]/onarim-raporu/[reportId]/page.tsx',
    ),
    'utf8',
  );

  it('SendExternalApprovalDto alanları class-validator ile açık', () => {
    assert.match(dto, /class SendExternalApprovalDto/);
    assert.match(dto, /@IsIn\(\['expert', 'insurance_company'\]\)/);
    assert.match(dto, /approverType/);
    assert.match(dto, /approverName/);
    assert.match(dto, /approverEmail/);
    assert.match(dto, /approverPhone/);
    assert.match(dto, /@IsIn\(\['email', 'whatsapp', 'in_app'\]\)/);
    assert.match(dto, /expiresInHours/);
    assert.match(dto, /class-validator/);
  });

  it('rapor ekranı aynı gövdeyi send-external-approval’a yollar', () => {
    assert.match(page, /send-external-approval/);
    assert.match(page, /handleSendExternalApproval/);
    assert.match(page, /externalApprovalForm/);
    assert.match(page, /approverType/);
    assert.match(page, /expiresInHours/);
  });

  it('revize taslak da dış onaya gidebilir', () => {
    const svc = readFileSync(join(here, 'external-approvals.service.ts'), 'utf8');
    assert.match(svc, /'draft'/);
    assert.match(svc, /'rejected'/);
  });
});
