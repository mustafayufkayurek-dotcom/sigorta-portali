import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  STORAGE_S3_USER_MESSAGES,
  classifyS3Error,
} from './storage-s3-errors.ts';

describe('storage-s3-errors lock — upload 500 sızıntı yok', () => {
  it('InvalidAccessKeyId → invalid_credentials (acil/hasar entity-documents)', () => {
    assert.equal(
      classifyS3Error({
        name: 'InvalidAccessKeyId',
        message: 'The Access Key Id you provided does not exist in our records.',
      }),
      'invalid_credentials',
    );
    assert.match(
      STORAGE_S3_USER_MESSAGES.invalid_credentials,
      /Dosya depolama/i,
    );
    assert.doesNotMatch(
      STORAGE_S3_USER_MESSAGES.invalid_credentials,
      /Internal server error|Access Key|MinIO|S3/i,
    );
  });

  it('NoSuchBucket → missing_bucket', () => {
    assert.equal(classifyS3Error({ name: 'NoSuchBucket' }), 'missing_bucket');
  });

  it('AccessDenied → access_denied', () => {
    assert.equal(classifyS3Error({ name: 'AccessDenied' }), 'access_denied');
  });

  it('bilinmeyen hata unknown kalır (üst katman karar verir)', () => {
    assert.equal(classifyS3Error({ name: 'WeirdError', message: 'boom' }), 'unknown');
  });
});
