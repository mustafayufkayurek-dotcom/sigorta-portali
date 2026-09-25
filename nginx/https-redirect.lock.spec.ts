import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const nginx = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'nginx.conf'), 'utf8');

describe('şirket sitesi ve yazılım HTTPS LOCK', () => {
  it('HTTP açık adres HTTPS’e döner; kilitli sertifika durur', () => {
    assert.match(nginx, /return 301 https:\/\/\$host\$request_uri/);
    assert.match(nginx, /ssl_certificate \/etc\/letsencrypt\/live\/meridyen-tr\.com\/fullchain\.pem/);
    assert.match(nginx, /ssl_certificate \/etc\/letsencrypt\/live\/app\.meridyen-tr\.com\/fullchain\.pem/);
    assert.match(nginx, /add_header Strict-Transport-Security/);
  });
});
