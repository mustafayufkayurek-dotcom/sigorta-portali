#!/usr/bin/env bash
# Ortak purge güvenlik kontrolleri — production gerçek veriyi korur
# shellcheck disable=SC2034
set -euo pipefail

# Varsayılanlar (script override edebilir)
PURGE_SCOPE="${PURGE_SCOPE:-test-markers}"
CONFIRM_PURGE="${CONFIRM_PURGE:-}"
CONFIRM_PURGE_ALL="${CONFIRM_PURGE_ALL:-}"
PURGE_ALLOW="${PURGE_ALLOW:-}"
DRY_RUN="${DRY_RUN:-1}"
EXCLUDE_RECENT_HOURS="${EXCLUDE_RECENT_HOURS:-48}"
PRODUCTION_DATA_PROTECTED="${PRODUCTION_DATA_PROTECTED:-true}"

purge_abort() {
  echo "HATA: $1" >&2
  exit 1
}

purge_warn() {
  echo "UYARI: $1" >&2
}

# Sunucu .env.production içinden PRODUCTION_DATA_PROTECTED oku (varsa)
purge_load_production_guard_from_remote() {
  local remote_host="$1"
  local remote_app="$2"
  local val
  val="$(ssh -o BatchMode=yes "$remote_host" "grep -E '^PRODUCTION_DATA_PROTECTED=' \"$remote_app/.env.production\" 2>/dev/null | tail -1 | cut -d= -f2-" || true)"
  if [ -n "$val" ]; then
    PRODUCTION_DATA_PROTECTED="$val"
  fi
}

purge_assert_safe_to_run() {
  if [ "$PRODUCTION_DATA_PROTECTED" = "true" ] || [ "$PRODUCTION_DATA_PROTECTED" = "1" ]; then
    if [ "$PURGE_SCOPE" = "all" ]; then
      purge_abort "PRODUCTION_DATA_PROTECTED aktif — PURGE_SCOPE=all yasak. Gerçek veri kaybı riski."
    fi
    if [ "$PURGE_ALLOW" != "EXPLICIT_TEST_MARKERS_ONLY" ]; then
      purge_abort "PRODUCTION_DATA_PROTECTED aktif — PURGE_ALLOW=EXPLICIT_TEST_MARKERS_ONLY ve CONFIRM_PURGE=YES gerekli."
    fi
  fi

  if [ "$PURGE_SCOPE" = "all" ]; then
    if [ "$CONFIRM_PURGE_ALL" != "I_ACCEPT_DATA_LOSS" ]; then
      purge_abort "PURGE_SCOPE=all için CONFIRM_PURGE_ALL=I_ACCEPT_DATA_LOSS zorunlu."
    fi
  fi

  if [ "$CONFIRM_PURGE" != "YES" ]; then
    if [ "$DRY_RUN" != "1" ]; then
      purge_abort "Gerçek silme için CONFIRM_PURGE=YES ve DRY_RUN=0 gerekli. Önce DRY_RUN=1 ile önizleme yapın."
    fi
    purge_warn "Önizleme modu (DRY_RUN=1). Gerçek silme: CONFIRM_PURGE=YES DRY_RUN=0 PURGE_ALLOW=EXPLICIT_TEST_MARKERS_ONLY"
  fi
}

purge_print_banner() {
  echo "=== Purge güvenlik ==="
  echo "PRODUCTION_DATA_PROTECTED=$PRODUCTION_DATA_PROTECTED"
  echo "PURGE_SCOPE=$PURGE_SCOPE"
  echo "DRY_RUN=$DRY_RUN"
  echo "EXCLUDE_RECENT_HOURS=$EXCLUDE_RECENT_HOURS"
  echo "CONFIRM_PURGE=${CONFIRM_PURGE:-<yok>}"
}
