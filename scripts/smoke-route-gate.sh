#!/usr/bin/env bash
# Route Gate kalıcı smoke — Dalga 1+
# Her geliştirme / deploy öncesi çalıştırılmalı.
#
# Bölüm A: Client gate matrisi (credentials gerekmez) — zorunlu
# Bölüm B: API oturum/token/logout (BASE_URL) — ağ/credential yoksa PARTIAL
#
# Kullanım:
#   bash scripts/smoke-route-gate.sh
#   pnpm smoke:route-gate
#   BASE_URL=... LOGIN_EMAIL=... LOGIN_PASSWORD=... bash scripts/smoke-route-gate.sh

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

BASE_URL="${BASE_URL:-https://app.meridyen-tr.com}"
LOGIN_EMAIL="${LOGIN_EMAIL:-}"
LOGIN_PASSWORD="${LOGIN_PASSWORD:-}"

FAILURES=0
PARTIALS=0

pass() { printf 'PASS: %s\n' "$1"; }
fail() { printf 'FAIL: %s\n' "$1"; FAILURES=$((FAILURES + 1)); }
partial() { printf 'PARTIAL: %s\n' "$1"; PARTIALS=$((PARTIALS + 1)); }

echo "=== Route Gate Smoke A — client matrix ==="
if node "$SCRIPT_DIR/lib/route-gate-smoke.mjs"; then
  pass "Yetkili/yetkisiz/portal/personel/URL/refresh/back-forward/deep-link matrisi"
else
  fail "Route Gate client matrix (scripts/lib/route-gate-smoke.mjs)"
fi

echo "=== Route Gate Smoke A2 — saha açık dosya listesi kilidi ==="
if bash "$SCRIPT_DIR/smoke-field-open-list.sh"; then
  pass "status=open boş liste regresyonu (fuzzy devam) kapalı"
else
  fail "Field open list smoke (scripts/smoke-field-open-list.sh)"
fi

echo "=== Route Gate Smoke A2b — acil tedarikçi öneri kilidi ==="
if bash "$SCRIPT_DIR/smoke-acil-supplier-assignment.sh"; then
  pass "Acil il/ilçe skor önerisi; ulusal A kesiti ve Google etiketi kapalı"
else
  fail "Acil supplier assignment smoke (scripts/smoke-acil-supplier-assignment.sh)"
fi

echo "=== Route Gate Smoke B — session / token / logout (API) ==="

curl_api() {
  local method="$1"
  local path="$2"
  local body="${3:-}"
  local token="${4:-}"
  local body_file status_file
  body_file="$(mktemp "${TMPDIR:-/tmp}/rg-smoke-body.XXXXXX")"
  status_file="$(mktemp "${TMPDIR:-/tmp}/rg-smoke-status.XXXXXX")"

  set +e
  if [ -n "$body" ]; then
    if [ -n "$token" ]; then
      curl -sS -o "$body_file" -w '%{http_code}' -X "$method" \
        -H 'Content-Type: application/json' \
        -H "Authorization: Bearer $token" \
        -d "$body" \
        "${BASE_URL}${path}" > "$status_file" 2>/dev/null
    else
      curl -sS -o "$body_file" -w '%{http_code}' -X "$method" \
        -H 'Content-Type: application/json' \
        -d "$body" \
        "${BASE_URL}${path}" > "$status_file" 2>/dev/null
    fi
  else
    if [ -n "$token" ]; then
      curl -sS -o "$body_file" -w '%{http_code}' -X "$method" \
        -H "Authorization: Bearer $token" \
        "${BASE_URL}${path}" > "$status_file" 2>/dev/null
    else
      curl -sS -o "$body_file" -w '%{http_code}' -X "$method" \
        "${BASE_URL}${path}" > "$status_file" 2>/dev/null
    fi
  fi
  local curl_rc=$?
  set -u

  if [ "$curl_rc" -ne 0 ]; then
    CURL_STATUS="000"
    CURL_BODY=""
  else
    CURL_STATUS="$(cat "$status_file" 2>/dev/null || echo 000)"
    CURL_BODY="$(cat "$body_file" 2>/dev/null || true)"
  fi
  rm -f "$body_file" "$status_file"
}

# Geçersiz token
curl_api "GET" "/api/v1/claim-files?limit=1" "" "invalid-token-route-gate-smoke"
if [ "$CURL_STATUS" = "401" ] || [ "$CURL_STATUS" = "403" ]; then
  pass "Geçersiz token → API reddi ($CURL_STATUS)"
elif [ "$CURL_STATUS" = "000" ]; then
  partial "Geçersiz token — API erişilemedi (ağ/BASE_URL); matrix PASS"
else
  fail "Geçersiz token beklenen 401/403, gelen $CURL_STATUS"
fi

# Oturumsuz / süresi dolmuş benzeri
curl_api "GET" "/api/v1/claim-files?limit=1" ""
if [ "$CURL_STATUS" = "401" ] || [ "$CURL_STATUS" = "403" ]; then
  pass "Oturum yok / süresi dolmuş benzeri → API reddi ($CURL_STATUS)"
elif [ "$CURL_STATUS" = "000" ]; then
  partial "Oturumsuz API — erişilemedi; matrix PASS"
else
  fail "Oturumsuz API beklenen 401/403, gelen $CURL_STATUS"
fi

# Login + logout sonrası eski token / URL
if [ -n "$LOGIN_EMAIL" ] && [ -n "$LOGIN_PASSWORD" ]; then
  LOGIN_PAYLOAD=$(printf '{"email":"%s","password":"%s"}' "$LOGIN_EMAIL" "$LOGIN_PASSWORD")
  curl_api "POST" "/api/v1/auth/login" "$LOGIN_PAYLOAD"
  ACCESS_TOKEN="$(printf '%s' "$CURL_BODY" | sed -n 's/.*"accessToken"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
  REFRESH_TOKEN="$(printf '%s' "$CURL_BODY" | sed -n 's/.*"refreshToken"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"

  if [ -z "$ACCESS_TOKEN" ]; then
    partial "Login credential var ama token alınamadı (status=$CURL_STATUS)"
  else
    pass "Login token alındı (session smoke)"

    if [ -n "$REFRESH_TOKEN" ]; then
      curl_api "POST" "/api/v1/auth/logout" "$(printf '{"refreshToken":"%s"}' "$REFRESH_TOKEN")" "$ACCESS_TOKEN"
    else
      curl_api "POST" "/api/v1/auth/logout" "{}" "$ACCESS_TOKEN"
    fi

    curl_api "GET" "/api/v1/claim-files?limit=1" "" "$ACCESS_TOKEN"
    if [ "$CURL_STATUS" = "401" ] || [ "$CURL_STATUS" = "403" ]; then
      pass "Çıkış sonrası eski token ile API / eski URL erişimi reddedildi ($CURL_STATUS)"
    elif [ -n "$REFRESH_TOKEN" ]; then
      curl_api "POST" "/api/v1/auth/refresh" "$(printf '{"refreshToken":"%s"}' "$REFRESH_TOKEN")"
      if [ "$CURL_STATUS" = "401" ] || [ "$CURL_STATUS" = "403" ] || [ "$CURL_STATUS" = "400" ]; then
        pass "Çıkış sonrası refresh reddedildi ($CURL_STATUS) — eski oturum yenilenemez"
      else
        fail "Çıkış sonrası eski oturum hâlâ yenilenebiliyor (status=$CURL_STATUS)"
      fi
    else
      fail "Çıkış sonrası eski access token hâlâ kabul ($CURL_STATUS)"
    fi
  fi
else
  partial "Çıkış sonrası eski URL — LOGIN_EMAIL/LOGIN_PASSWORD yok; API login smoke atlandı"
fi

echo "=== Route Gate Smoke özet ==="
echo "FAIL=$FAILURES PARTIAL=$PARTIALS"

if [ "$FAILURES" -gt 0 ]; then
  exit 1
fi

exit 0
