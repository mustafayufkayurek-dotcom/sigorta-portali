import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isAllowedRequestOrigin, parseAllowedOrigins } from './csrf-origin.ts';

describe('CSRF origin LOCK', () => {
  it('WEB_URL dışındaki origin yazma isteğinde geçmez', () => {
    const allowed = parseAllowedOrigins({ WEB_URL: 'https://panel.example.com' } as NodeJS.ProcessEnv);
    assert.equal(isAllowedRequestOrigin('https://panel.example.com', allowed), true);
    assert.equal(isAllowedRequestOrigin('https://evil.example', allowed), false);
    assert.equal(isAllowedRequestOrigin(undefined, allowed), true);
  });
});
