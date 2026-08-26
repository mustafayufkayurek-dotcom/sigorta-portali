import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));

describe('Hasar dijital onay WhatsApp kilidi', () => {
  const panel = readFileSync(join(here, 'FileDocumentPanel.tsx'), 'utf8');
  const api = readFileSync(join(here, '../../utils/fileDocumentApi.ts'), 'utf8');
  const service = readFileSync(
    join(here, '../../../../backend/src/modules/file-documents/file-documents.service.ts'),
    'utf8',
  );
  const steps = readFileSync(
    join(here, '../hasar-operasyon-planlayicisi/steps.tsx'),
    'utf8',
  );

  it('sigortalı telefonu kutuya hazır gelir', () => {
    assert.match(panel, /defaultPhone/);
    assert.match(panel, /suggestedPhone/);
    assert.match(panel, /function insuredPhoneOf/);
    assert.match(panel, /doc\.whatsappPhone \|\| fallback \|\| doc\.suggestedPhone/);
    assert.match(steps, /defaultPhone=\{claim\.insuredPhone\}/);
    const evrak = readFileSync(
      join(here, '../../app/panel/hasar-dosyalari/[id]/_components/tabs/EvraklarTab.tsx'),
      'utf8',
    );
    assert.match(evrak, /defaultPhone=\{claim\?\.insuredPhone/);
    assert.match(service, /resolveInsuredPhone/);
    assert.match(service, /insuredPhone \|\| cf\?\.customer\?\.phone/);
    assert.match(api, /suggestedPhone/);
  });

  it('Link Oluştur kutuyu kapatmaz; WhatsApp gerçekten açılır', () => {
    assert.match(panel, /openWhatsAppChat/);
    assert.match(panel, /WhatsApp'ta Gönder/);
    assert.doesNotMatch(panel, /Link Oluştur/);
    assert.doesNotMatch(panel, /setWaModal\(null\); load\(\)/);
    assert.match(panel, /onSent=\{\(\) => \{ load\(\); \}\}/);
    assert.match(service, /return \{ waUrl, link, message, phone \}/);
  });
});
