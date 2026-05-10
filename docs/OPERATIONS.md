# Production Operations — Docker Build & Deploy Notları

## VPS Spesifikasyonları
- **Provider**: İHS (Türkiye)
- **OS**: Ubuntu 24.04
- **RAM**: 4GB
- **CPU**: 2 vCPU
- **Disk**: 40GB SSD
- **IP**: 94.138.216.18

## ⚠️ Docker Build RAM Riski

### Problem
`docker build --no-cache` 4GB RAM'in tamamını tüketebilir → VPS erişilemez (OOM).

### Önlemler
1. **Asla `--no-cache` ile backend + web'i aynı anda build etme**
2. Build sırasında RAM izle: `watch -n5 free -h`
3. Build öncesi `docker system prune -f` ile eski image'ları temizle
4. Build 4+ dakika sürer → `nohup` ile background'da çalıştır

### Güvenli Build Pattern
```bash
# 1. Temizlik
docker system prune -f

# 2. Tek servis build (background)
nohup bash -c "cd /opt/app/source && \
  docker compose -f docker-compose.prod.yml --env-file .env.production build backend && \
  docker stop sigorta-backend; docker rm sigorta-backend; \
  docker compose -f docker-compose.prod.yml --env-file .env.production up -d backend && \
  echo DONE" > /tmp/build.log 2>&1 &

# 3. Takip
tail -f /tmp/build.log
```

### OOM Recovery
```bash
# SSH ile bağlan (timeout olabilir, birkaç kez dene)
ssh root@94.138.216.18

# Tüm container'ları durdur
docker stop $(docker ps -q)

# Ghost nginx process kontrolü
ss -tlnp | grep ":80\|:443"
# Varsa kill
kill -9 <pid>

# Yeniden başlat
cd /opt/app/source
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

## Disk Yönetimi

### Mevcut Kullanım
- **Sağlıklı**: < %80
- **Uyarı**: %80-90
- **Kritik**: > %90

### Otomatik Temizlik
- **Cron**: Her Pazar 04:00 (`/opt/app/scripts/disk-cleanup.sh`)
- Docker prune + backup retention (7 gün)

### Manuel Temizlik
```bash
docker system prune -af --volumes  # DİKKAT: tüm unused volumes silinir
docker builder prune -af           # Build cache temizliği
```

## Deploy Sırası
1. `rsync` — kod senkronizasyonu
2. `docker build` — image oluştur (tek servis)
3. `docker stop/rm` — eski container kaldır
4. `docker compose up -d` — yeni container başlat
5. Healthcheck bekle (30s)
6. `curl` ile login + API test

## Rollback
```bash
# Önceki image'a dön (tag yoksa mümkün değil)
# En güvenli: rsync ile eski kodu gönder + rebuild
# Acil: docker-compose down + up (mevcut image ile restart)
```

## Cron Jobs
| Schedule | Script | Amaç |
|----------|--------|------|
| `0 3 * * *` | backup.sh | PostgreSQL pg_dump |
| `*/5 * * * *` | monitor.sh | RAM/CPU/Disk alarm |
| `0 4 * * 0` | disk-cleanup.sh | Docker prune + backup retention |
