/**
 * S3/MinIO upload hatalarını Nest HTTP istisnalarına çevirir.
 * Ham InvalidAccessKeyId vb. → kullanıcıya "Internal server error" sızdırılmaz.
 */

export type StorageS3ErrorKind =
  | 'missing_bucket'
  | 'invalid_credentials'
  | 'access_denied'
  | 'service_unavailable'
  | 'unknown';

export function classifyS3Error(err: unknown): StorageS3ErrorKind {
  if (!err || typeof err !== 'object') return 'unknown';
  const e = err as {
    name?: string;
    Code?: string;
    code?: string;
    message?: string;
    $metadata?: { httpStatusCode?: number };
  };
  const name = String(e.name ?? e.Code ?? e.code ?? '');
  const message = String(e.message ?? '');
  const status = e.$metadata?.httpStatusCode;

  if (
    name === 'NoSuchBucket'
    || name === 'NotFound'
    || (status === 404 && /bucket/i.test(message))
  ) {
    return 'missing_bucket';
  }

  if (
    name === 'InvalidAccessKeyId'
    || name === 'SignatureDoesNotMatch'
    || name === 'InvalidToken'
    || /Access Key Id you provided does not exist/i.test(message)
    || /The request signature we calculated does not match/i.test(message)
  ) {
    return 'invalid_credentials';
  }

  if (name === 'AccessDenied' || name === 'AllAccessDisabled' || status === 403) {
    return 'access_denied';
  }

  if (
    name === 'ServiceUnavailable'
    || name === 'SlowDown'
    || name === 'RequestTimeout'
    || name === 'TimeoutError'
    || status === 503
    || /ECONNREFUSED|ENOTFOUND|ECONNRESET|ETIMEDOUT/i.test(message)
  ) {
    return 'service_unavailable';
  }

  return 'unknown';
}

export const STORAGE_S3_USER_MESSAGES: Record<
  Exclude<StorageS3ErrorKind, 'unknown'>,
  string
> = {
  missing_bucket:
    'Dosya depolama alanı hazır değil. Lütfen kısa süre sonra tekrar deneyin.',
  invalid_credentials:
    'Dosya depolama bağlantısı şu anda kullanılamıyor. Lütfen kısa süre sonra tekrar deneyin.',
  access_denied:
    'Dosya depolama alanı için yetki yok. Lütfen sistem yöneticisine bildirin.',
  service_unavailable:
    'Dosya depolama alanı geçici olarak yanıt vermiyor. Lütfen kısa süre sonra tekrar deneyin.',
};
