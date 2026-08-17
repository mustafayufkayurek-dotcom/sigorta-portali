#!/usr/bin/env bash
# KNOWN_GOOD_IMAGES.json — tek kaynak manifest okuyucu
# Diğer deploy script'leri bu dosyayı source eder.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
MANIFEST="${MANIFEST:-$PROJECT_DIR/deploy/manifests/KNOWN_GOOD_IMAGES.json}"

if [ ! -f "$MANIFEST" ]; then
  echo "[manifest] HATA: Bulunamadı: $MANIFEST" >&2
  exit 1
fi

manifest_get() {
  local key="$1"
  if command -v jq >/dev/null 2>&1; then
    jq -r --arg k "$key" '
      ($k | split(".")) as $p |
      if ($p | length) == 2 then .[$p[0]][$p[1]]
      elif ($p | length) == 1 then .[$p[0]]
      else empty end // empty
    ' "$MANIFEST"
  elif command -v node >/dev/null 2>&1; then
    node -e "
      const fs = require('fs');
      const m = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
      const p = process.argv[2].split('.');
      let v = m;
      for (const k of p) { v = v?.[k]; }
      if (v != null && v !== '') process.stdout.write(String(v));
    " "$MANIFEST" "$key"
  else
    case "$key" in
      images.backend)
        grep -o '"backend"[[:space:]]*:[[:space:]]*"[^"]*"' "$MANIFEST" | head -1 | sed 's/.*"\([^"]*\)"$/\1/'
        ;;
      images.web)
        grep -o '"web"[[:space:]]*:[[:space:]]*"[^"]*"' "$MANIFEST" | head -1 | sed 's/.*"\([^"]*\)"$/\1/'
        ;;
      rollbackImages.webPrevious)
        grep -o '"webPrevious"[[:space:]]*:[[:space:]]*"[^"]*"' "$MANIFEST" | sed 's/.*"\([^"]*\)"$/\1/'
        ;;
      rollbackImages.backendPrevious)
        grep -o '"backendPrevious"[[:space:]]*:[[:space:]]*"[^"]*"' "$MANIFEST" | sed 's/.*"\([^"]*\)"$/\1/'
        ;;
      remoteAppDir)
        grep -o '"remoteAppDir"[[:space:]]*:[[:space:]]*"[^"]*"' "$MANIFEST" | sed 's/.*"\([^"]*\)"$/\1/'
        ;;
      composeProject)
        grep -o '"composeProject"[[:space:]]*:[[:space:]]*"[^"]*"' "$MANIFEST" | sed 's/.*"\([^"]*\)"$/\1/'
        ;;
      *)
        echo "[manifest] HATA: jq/node yok; '$key' okunamıyor" >&2
        return 1
        ;;
    esac
  fi
}

# Manifest'ten bilinen tag'ler
MANIFEST_BACKEND_IMAGE="$(manifest_get images.backend)"
MANIFEST_WEB_IMAGE="$(manifest_get images.web)"
MANIFEST_ROLLBACK_BACKEND="$(manifest_get rollbackImages.backendPrevious)"
MANIFEST_ROLLBACK_WEB="$(manifest_get rollbackImages.webPrevious)"
MANIFEST_REMOTE_APP_DIR="$(manifest_get remoteAppDir)"
MANIFEST_COMPOSE_PROJECT="$(manifest_get composeProject)"

# Manifest'teki korunan image listesi (satır başına bir tag)
manifest_protected_images() {
  local img
  for img in \
    "$MANIFEST_BACKEND_IMAGE" \
    "$MANIFEST_WEB_IMAGE" \
    "$MANIFEST_ROLLBACK_BACKEND" \
    "$MANIFEST_ROLLBACK_WEB"; do
    if [ -n "$img" ] && [ "$img" != "null" ]; then
      echo "$img"
    fi
  done
}

# Çalışan container image'ları dahil, tekrarsız koruma listesi
manifest_collect_protected_images() {
  local -a collected=()
  local img running

  while IFS= read -r img; do
    [ -n "$img" ] || continue
    collected+=("$img")
  done < <(manifest_protected_images)

  if command -v docker >/dev/null 2>&1; then
    while IFS= read -r running; do
      [ -n "$running" ] || continue
      collected+=("$running")
    done < <(docker ps --format '{{.Image}}' 2>/dev/null | sort -u || true)
  fi

  # Tekrarları kaldır
  printf '%s\n' "${collected[@]}" | awk '!seen[$0]++'
}

# Korunan image'ların sunucuda varlığını kontrol et; eksikse uyarı (devam eder)
manifest_verify_protected_images() {
  local log_tag="${1:-[manifest]}"
  local img missing=0

  if ! command -v docker >/dev/null 2>&1; then
    echo "${log_tag} UYARI: docker yok — image doğrulaması atlandı"
    return 0
  fi

  while IFS= read -r img; do
    [ -n "$img" ] || continue
    if docker image inspect "$img" >/dev/null 2>&1; then
      echo "${log_tag} Korunan image mevcut: $img"
    else
      echo "${log_tag} UYARI: Korunan image sunucuda yok: $img"
      missing=$((missing + 1))
    fi
  done < <(manifest_protected_images)

  if [ "$missing" -gt 0 ]; then
    echo "${log_tag} UYARI: ${missing} korunan image eksik — rollback/deploy riski"
    return 1
  fi
  return 0
}
