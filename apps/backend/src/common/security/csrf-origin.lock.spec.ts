import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isAllowedRequestOrigin, parseAllowedOrigins } from './csrf-origin.ts';

describe('CSRF origin LOCK', () => {
  it('WEB_URL dışındaki origin yazma isteğinde geçmez', () => {
    const allowed = parseAllowedOrigins({ WEB_URL: 'https://panel.example.com', NODE_ENV: 'production' } as NodeJS.ProcessEnv);
    assert.equal(isAllowedRequestOrigin('https://panel.example.com', allowed), true);
    assert.equal(isAllowedRequestOrigin('https://evil.example', allowed), false);
    assert.equal(isAllowedRequestOrigin(undefined, allowed), true);
  });

  it('lokal girişte localhost ve 127.0.0.1 aynı kapıdır', () => {
    const allowed = parseAllowedOrigins({ WEB_URL: 'http://localhost:3001', NODE_ENV: 'development' } as NodeJS.ProcessEnv);
    assert.equal(isAllowedRequestOrigin('http://localhost:3001', allowed), true);
    assert.equal(isAllowedRequestOrigin('http://127.0.0.1:3001', allowed), true);
  });
});
