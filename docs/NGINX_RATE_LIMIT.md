# Nginx & Rate Limit Konfigürasyonu — Production

## Rate Limiting (nginx)

### API Genel
- **Rate**: 120 request/minute
- **Burst**: 30 (nodelay)
- **Zone**: `api_limit` (10MB shared memory)
- **Key**: `$binary_remote_addr` (IP bazlı)
- **Status code**: 429 (`limit_req_status 429`)

### Auth Endpoint
- **Rate**: 5 request/minute
- **Burst**: 3 (nodelay)
- **Zone**: `auth_limit` (5MB shared memory)
- **Uygulanan path**: `/api/v1/auth/login`
- **Amaç**: Brute-force koruması

### NestJS ThrottlerGuard (Backup)
- Nginx pass ederse NestJS seviyesinde de throttling var
- `RATE_LIMIT_ENABLED=true` ile aktif
- Nginx rate limit birincil, NestJS ikincil (defense-in-depth)

## SSL / TLS
- **Sertifika**: Let's Encrypt (certbot)
- **Yenileme**: certbot auto-renew (cron)
- **Protokol**: TLSv1.2 + TLSv1.3

## Security Headers
- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(self)`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`

## Redirects
- HTTP → HTTPS (301)
- `/login` → `/giris` (301, query params korunur)

## Healthcheck
- **Path**: `GET /health` (HTTP port 80)
- **Response**: 200 OK
- **Docker interval**: 30s, timeout 10s, retries 3

## Proxy Paths
| Path | Backend | Port |
|------|---------|------|
| `/api/*` | backend | 3000 |
| `/socket.io` | backend | 3000 (WebSocket) |
| `/_next/static/*` | web | 3001 (cache 1y) |
| `/*` (fallback) | web | 3001 |
