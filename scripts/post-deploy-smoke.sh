#!/usr/bin/env bash

set -u

BASE_URL="${BASE_URL:-https://app.meridyen-tr.com}"
LOGIN_EMAIL="${LOGIN_EMAIL:-admin@meridyenassistance.com}"
LOGIN_PASSWORD="${LOGIN_PASSWORD:-admin123}"
COOKIE_JAR="$(mktemp "${TMPDIR:-/tmp}/post-deploy-smoke-cookies.XXXXXX.txt")"
FAILURES=0

cleanup() {
  rm -f "$COOKIE_JAR"
}

trap cleanup EXIT

pass() {
  printf 'PASS: %s\n' "$1"
}

fail() {
  printf 'FAIL: %s\n' "$1"
  FAILURES=$((FAILURES + 1))
}

contains_text() {
  local json="$1"
  local needle="$2"
  printf '%s' "$json" | grep -F -q "$needle"
}

curl_capture() {
  local method="$1"
  local path="$2"
  local body="${3:-}"
  local auth_token="${4:-}"
  local response_file
  local status_file
  response_file="$(mktemp "${TMPDIR:-/tmp}/post-deploy-smoke-response.XXXXXX.txt")"
  status_file="$(mktemp "${TMPDIR:-/tmp}/post-deploy-smoke-status.XXXXXX.txt")"

  if [ -n "$body" ]; then
    if [ -n "$auth_token" ]; then
      curl -sS -L -X "$method" \
        -c "$COOKIE_JAR" \
        -b "$COOKIE_JAR" \
        -H 'Content-Type: application/json' \
        -H "Authorization: Bearer $auth_token" \
        -d "$body" \
        -o "$response_file" \
        -w '%{http_code}' \
        "$BASE_URL$path" > "$status_file"
    else
      curl -sS -L -X "$method" \
        -c "$COOKIE_JAR" \
        -b "$COOKIE_JAR" \
        -H 'Content-Type: application/json' \
        -d "$body" \
        -o "$response_file" \
        -w '%{http_code}' \
        "$BASE_URL$path" > "$status_file"
    fi
  else
    if [ -n "$auth_token" ]; then
      curl -sS -L -X "$method" \
        -c "$COOKIE_JAR" \
        -b "$COOKIE_JAR" \
        -H "Authorization: Bearer $auth_token" \
        -o "$response_file" \
        -w '%{http_code}' \
        "$BASE_URL$path" > "$status_file"
    else
      curl -sS -L -X "$method" \
        -c "$COOKIE_JAR" \
        -b "$COOKIE_JAR" \
        -o "$response_file" \
        -w '%{http_code}' \
        "$BASE_URL$path" > "$status_file"
    fi
  fi

  CURL_CAPTURE_STATUS="$(cat "$status_file")"
  CURL_CAPTURE_BODY="$(cat "$response_file")"

  rm -f "$response_file" "$status_file"
}

assert_status_and_body() {
  local label="$1"
  local expected_status="$2"
  local path="$3"
  local method="${4:-GET}"
  local body="${5:-}"
  local expected_body="${6:-}"

  if ! curl_capture "$method" "$path" "$body"; then
    fail "$label"
    return
  fi

  if [ "$CURL_CAPTURE_STATUS" != "$expected_status" ]; then
    fail "$label"
    return
  fi

  if [ -n "$expected_body" ] && ! contains_text "$CURL_CAPTURE_BODY" "$expected_body"; then
    fail "$label"
    return
  fi

  pass "$label"
}

extract_access_token() {
  printf '%s' "$1" | sed -n 's/.*"accessToken"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p'
}

assert_auth_json() {
  local label="$1"
  local path="$2"
  local expected_status="$3"
  local expected_body="${4:-}"
  local auth_token="${5:-}"

  if ! curl_capture "GET" "$path" "" "$auth_token"; then
    fail "$label"
    return
  fi

  if [ "$CURL_CAPTURE_STATUS" != "$expected_status" ]; then
    fail "$label"
    return
  fi

  if [ -n "$expected_body" ] && ! contains_text "$CURL_CAPTURE_BODY" "$expected_body"; then
    fail "$label"
    return
  fi

  pass "$label"
}

assert_frontend_route() {
  local label="$1"
  local path="$2"

  if ! curl_capture "GET" "$path"; then
    fail "$label"
    return
  fi

  if [ "$CURL_CAPTURE_STATUS" != "200" ]; then
    fail "$label"
    return
  fi

  pass "$label"
}

assert_status_and_body "GET /api/v1/health returns 200 and status ok" "200" "/api/v1/health" "GET" "" '"status":"ok"'
assert_status_and_body "GET /giris returns 200" "200" "/giris"

LOGIN_PAYLOAD=$(printf '{"email":"%s","password":"%s"}' "$LOGIN_EMAIL" "$LOGIN_PASSWORD")
ACCESS_TOKEN=""

if curl_capture "POST" "/api/v1/auth/login" "$LOGIN_PAYLOAD" && { [ "$CURL_CAPTURE_STATUS" = "200" ] || [ "$CURL_CAPTURE_STATUS" = "201" ]; }; then
  ACCESS_TOKEN="$(extract_access_token "$CURL_CAPTURE_BODY")"
  if [ -n "$ACCESS_TOKEN" ]; then
    pass "POST /api/v1/auth/login returns success and access token"
  else
    fail "POST /api/v1/auth/login returns success and access token"
  fi
else
  fail "POST /api/v1/auth/login returns success and access token (LOGIN_EMAIL/LOGIN_PASSWORD kontrol edin)"
fi

if [ -n "$ACCESS_TOKEN" ]; then
  assert_auth_json "GET /api/v1/claim-files returns 200 and data array" "/api/v1/claim-files" "200" '"data":[' "$ACCESS_TOKEN"
  assert_auth_json "GET /api/v1/dashboard/ownership-load returns 200" "/api/v1/dashboard/ownership-load" "200" "" "$ACCESS_TOKEN"
  assert_auth_json "GET /api/v1/dashboard/pending-actions returns 200" "/api/v1/dashboard/pending-actions" "200" "" "$ACCESS_TOKEN"
  assert_auth_json "GET /api/v1/finance/overhead/entries returns 200" "/api/v1/finance/overhead/entries" "200" "" "$ACCESS_TOKEN"
  assert_auth_json "GET /api/v1/customers returns 200 and data array" "/api/v1/customers?limit=1" "200" '"data":[' "$ACCESS_TOKEN"
  assert_auth_json "GET /api/v1/vendors/summary returns 200" "/api/v1/vendors/summary" "200" "" "$ACCESS_TOKEN"
fi

assert_frontend_route "GET /panel returns 200" "/panel"
assert_frontend_route "GET /panel/musteriler returns 200" "/panel/musteriler"
assert_frontend_route "GET /panel/tedarikciler returns 200" "/panel/tedarikciler"
assert_frontend_route "GET /panel/hasar-dosyalari returns 200" "/panel/hasar-dosyalari"
assert_frontend_route "GET /panel/operasyon returns 200" "/panel/operasyon"
assert_frontend_route "GET /panel/sahiplik returns 200" "/panel/sahiplik"
assert_frontend_route "GET /panel/finans returns 200" "/panel/finans"
assert_frontend_route "GET /panel/ayarlar returns 200" "/panel/ayarlar"
assert_frontend_route "GET /panel/ayarlar/tanimlar returns 200" "/panel/ayarlar/tanimlar"
assert_frontend_route "GET /panel/ayarlar/masraf-kategorileri returns 200" "/panel/ayarlar/masraf-kategorileri"
assert_frontend_route "GET /panel/ayarlar/is-gruplari returns 200" "/panel/ayarlar/is-gruplari"
assert_frontend_route "GET /panel/ayarlar/dosya-konulari returns 200" "/panel/ayarlar/dosya-konulari"
assert_frontend_route "GET /panel/ayarlar/evrak-turleri returns 200" "/panel/ayarlar/evrak-turleri"
assert_frontend_route "GET /panel/ayarlar/mahaller returns 200" "/panel/ayarlar/mahaller"
assert_frontend_route "GET /panel/ayarlar/hizmet-turleri returns 200" "/panel/ayarlar/hizmet-turleri"
assert_frontend_route "GET /panel/ayarlar/tedarikci-hizmet-kollari returns 200" "/panel/ayarlar/tedarikci-hizmet-kollari"
assert_frontend_route "GET /panel/guvenlik returns 200" "/panel/guvenlik"

if [ "$FAILURES" -gt 0 ]; then
  exit 1
fi

exit 0