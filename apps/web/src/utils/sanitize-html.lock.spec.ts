import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sanitizeHtml, sanitizeDocumentHtml } from './sanitize-html.ts';

describe('HTML XSS süzgeci LOCK', () => {
  it('script ve javascript URL kesilir', () => {
    const out = sanitizeHtml('<p onclick="alert(1)">ok</p><script>alert(1)</script><a href="javascript:alert(1)">x</a>');
    assert.doesNotMatch(out, /<script/i);
    assert.doesNotMatch(out, /onclick/i);
    assert.doesNotMatch(out, /javascript:/i);
  });

  it('style içindeki javascript kesilir', () => {
    const out = sanitizeDocumentHtml(
      '<style>body{background:url(javascript:alert(1))}</style><p style="behavior:url(#default#time2)">metin</p>',
    );
    assert.doesNotMatch(out, /javascript:/i);
    assert.doesNotMatch(out, /behavior:/i);
  });
});
