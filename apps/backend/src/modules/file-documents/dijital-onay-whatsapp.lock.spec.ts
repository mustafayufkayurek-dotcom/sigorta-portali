import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));

describe('file-documents dijital onay WhatsApp', () => {
  const service = readFileSync(join(here, 'file-documents.service.ts'), 'utf8');

  it('gönderimde sigortalı telefonu yedekler ve mesaj döner', () => {
    assert.match(service, /resolveInsuredPhone/);
    assert.match(service, /suggestedPhone/);
    assert.match(service, /dto\.phone \?\? ''\)\.trim\(\) \|\|/);
    assert.match(service, /return \{ waUrl, link, message, phone \}/);
  });
});
