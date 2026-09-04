/**
 * Çalışırken dışarı atılma — refresh tek sırada, GET de yeniler.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/utils/auth-session-refresh.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('oturum yenileme LOCK', () => {
  it('refresh tek promise altında; GET 401 de yeniler', () => {
    const session = readFileSync(join(here, 'auth-session.ts'), 'utf8');
    const apiClient = readFileSync(join(here, '../lib/api-client.ts'), 'utf8');
    const api = readFileSync(join(here, 'api.ts'), 'utf8');
    const axiosAuth = readFileSync(join(here, 'setup-axios-auth.ts'), 'utf8');

    assert.match(session, /export async function refreshSessionTokens/);
    assert.match(session, /refreshInFlight/);
    assert.match(session, /return refreshSessionTokens\(base\)/);

    assert.match(apiClient, /refreshSessionTokens/);
    assert.doesNotMatch(apiClient, /401 && method !== 'GET'/);
    assert.match(api, /refreshSessionTokens/);
    assert.doesNotMatch(api, /401 && method !== 'GET'/);
    assert.match(axiosAuth, /refreshSessionTokens/);
    assert.doesNotMatch(axiosAuth, /axios\.post\(`\$\{API\}\/auth\/refresh`/);
  });
});
