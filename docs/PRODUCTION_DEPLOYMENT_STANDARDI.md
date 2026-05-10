# Production Deployment Standardı

**Son Güncelleme:** 6 Mayıs 2026

---

## Dizin Yapısı

```
/opt/app/
├── docker-compose.yml          ← Ana compose dosyası (TEK kaynak)
├── .env.production             ← Ortam değişkenleri
├── Dockerfile.backend          ← Backend build
├── Dockerfile.web              ← Frontend build
├── nginx/nginx.conf            ← Nginx konfigürasyonu (SSL dahil)
├── source/                     ← Kaynak kod (rsync hedefi)
│   ├── apps/backend/
│   ├── apps/web/
│   ├── packages/
│   └── ...
├── backups/                    ← DB backup'ları
└── scripts/                    ← Deploy scriptleri
```

**Symlink'ler** (`/opt/app/` root'unda):
- `apps -> source/apps`
- `packages -> source/packages`
- `package.json -> source/package.json`
- `pnpm-workspace.yaml -> source/pnpm-workspace.yaml`
- `pnpm-lock.yaml -> source/pnpm-lock.yaml`
- `tsconfig.base.json -> source/tsconfig.base.json`

---

## Compose Dosyası

- **Tek compose:** `/opt/app/docker-compose.yml`
- **Env file:** `/opt/app/.env.production`
- **Volumes:** External, `source_*` prefix'li (eski volume'lar korunuyor)
  - `source_postgres_data`
  - `source_redis_data`
  - `source_minio_data`
  - `source_nginx_certs`
  - `source_nginx_html`

---

## Deploy Prosedürü

### Kod Güncelleme
```bash
# Local'den VPS'e kaynak kod sync
rsync -avz --exclude node_modules --exclude .next --exclude dist --exclude .git \
  ./ root@94.138.216.18:/opt/app/source/
```

### Backend Deploy
```bash
ssh root@94.138.216.18
cd /opt/app
docker compose --env-file .env.production build backend --no-cache
docker compose --env-file .env.production up -d backend
```

### Frontend Deploy
```bash
ssh root@94.138.216.18
cd /opt/app
docker compose --env-file .env.production build web --no-cache
docker compose --env-file .env.production up -d web
```

### Full Deploy (tüm servisler)
```bash
ssh root@94.138.216.18
cd /opt/app
docker compose --env-file .env.production build --no-cache
docker compose --env-file .env.production up -d
```

### Nginx Config Güncelleme (rebuild gerekmez)
```bash
scp nginx.conf root@94.138.216.18:/opt/app/nginx/nginx.conf
ssh root@94.138.216.18 "docker exec sigorta-nginx nginx -t && docker exec sigorta-nginx nginx -s reload"
```

---

## Migration Sırası

1. **Backup al:**
   ```bash
   ssh root@94.138.216.18 "docker exec sigorta-postgres bash -c 'pg_dump -U \$POSTGRES_USER \$POSTGRES_DB' | gzip > /opt/app/backups/pre_migration_$(date +%Y%m%d_%H%M%S).sql.gz"
   ```

2. **Migration SQL çalıştır:**
   ```bash
   cat migration.sql | ssh root@94.138.216.18 "docker exec -i sigorta-postgres psql -U meridyen meridyen_db"
   ```

3. **Backend rebuild** (yeni Prisma client):
   ```bash
   # Yukarıdaki Backend Deploy adımları
   ```

4. **Doğrulama:**
   ```bash
   ssh root@94.138.216.18 "docker exec sigorta-backend wget -qO- http://localhost:3000/api/v1/health"
   ```

---

## Rollback Akışı

1. Backend durdur: `docker compose --env-file .env.production stop backend`
2. DB rollback: `cat rollback.sql | docker exec -i sigorta-postgres psql -U meridyen meridyen_db`
3. Eski image ile başlat: `docker compose --env-file .env.production up -d backend`
4. Doğrulama: health + login + claim-files endpoint'leri test

---

## Healthcheck Doğrulama Standardı

Deploy sonrası çalıştırılacak kontroller:

```bash
# 1. Container durumu
docker ps --format 'table {{.Names}}\t{{.Status}}'
# Beklenen: Tüm container'lar "healthy"

# 2. Backend health
curl -s http://localhost/api/v1/health
# Beklenen: {"status":"ok","services":{"database":{"status":"up"},"redis":{"status":"up"}}}

# 3. Login testi
curl -s http://localhost/api/v1/auth/login -X POST \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@meridyenassistance.com","password":"admin123"}'
# Beklenen: {"success":true,...}

# 4. Dashboard erişimi
curl -s -o /dev/null -w '%{http_code}' http://localhost/panel
# Beklenen: 200

# 5. Dış erişim (HTTPS)
curl -sk -o /dev/null -w '%{http_code}' https://app.meridyen-tr.com/
# Beklenen: 200
```

---

## Servis Listesi

| Container | Port | Healthcheck |
|-----------|------|-------------|
| sigorta-postgres | 5432 (internal) | pg_isready |
| sigorta-redis | 6379 (internal) | redis-cli ping |
| sigorta-minio | 9000 (internal), 9001 (localhost) | /minio/health/live |
| sigorta-backend | 3000 (internal) | /api/v1/health |
| sigorta-web | 3001 (internal) | wget localhost:3001 |
| sigorta-nginx | 80, 443 (public) | wget localhost/health |
| sigorta-certbot | - | - |
