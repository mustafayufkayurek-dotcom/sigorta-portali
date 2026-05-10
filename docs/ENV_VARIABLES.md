# Production Environment Variables — Meridyen Assistance

## Core Application
| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Ortam | `production` |
| `DATABASE_URL` | PostgreSQL bağlantı | `postgresql://user:pass@postgres:5432/db` |
| `REDIS_URL` | Redis bağlantı | `redis://:pass@redis:6379` |
| `JWT_SECRET` | JWT imzalama anahtarı | Random 64 char |
| `JWT_EXPIRES_IN` | Token süresi | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token süresi | `7d` |

## Feature Flags
| Variable | Description | Default |
|----------|-------------|---------|
| `RATE_LIMIT_ENABLED` | NestJS ThrottlerGuard | `true` |
| `JWT_BLACKLIST_ENABLED` | Redis JWT blacklist | `true` |
| `UPLOAD_VALIDATION_ENABLED` | File validation pipe | `true` |

## Sentry (Error Tracking)
| Variable | Description | Kullanıldığı Yer |
|----------|-------------|-----------------|
| `SENTRY_DSN` | Sentry Data Source Name | Backend + Frontend (NEXT_PUBLIC) |
| `NEXT_PUBLIC_SENTRY_DSN` | Frontend Sentry DSN | Web container |

## Storage (MinIO/S3)
| Variable | Description | Example |
|----------|-------------|---------|
| `S3_ENDPOINT` | MinIO/S3 endpoint | `http://minio:9000` |
| `S3_ACCESS_KEY` | Erişim anahtarı | `meridyen_minio` |
| `S3_SECRET_KEY` | Gizli anahtar | `MeridyenMinioSecret2026` |
| `S3_BUCKET` | Bucket adı | `meridyen-files` |
| `S3_REGION` | Region | `us-east-1` |
| `STORAGE_PROVIDER` | Storage backend | `s3` |

## Frontend
| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | API base URL | `https://app.meridyen-tr.com/api/v1` |

## Notes
- `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET` — S3_* ile aynı fallback pattern (expenses service)
- `NEXT_PUBLIC_*` değişkenleri build-time'da bundle'a gömülür, runtime'da değiştirilemez
- Feature flag'ler `false` yapılırsa ilgili guard/pipe devre dışı kalır
