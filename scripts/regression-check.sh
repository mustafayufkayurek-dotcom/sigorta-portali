#!/usr/bin/env bash

set -uo pipefail

BASE_URL="${BASE_URL:-https://app.meridyen-tr.com}"
LOGIN_EMAIL="${LOGIN_EMAIL:-admin@meridyenassistance.com}"
LOGIN_PASSWORD="${LOGIN_PASSWORD:-admin123}"
TMP_DIR="$(mktemp -d)"
COOKIE_JAR="${TMP_DIR}/cookies.txt"
FAILURES=0

cleanup() {
  rm -rf "${TMP_DIR}"
}

trap cleanup EXIT

pass() {
  printf 'PASS %s\n' "$1"
}

fail() {
  printf 'FAIL %s\n' "$1"
  FAILURES=$((FAILURES + 1))
}

json_has() {
  local json="$1"
  local expr="$2"
  printf '%s' "$json" | jq -e "$expr" >/dev/null 2>&1
}

http_json() {
  local method="$1"
  local url="$2"
  local body="${3:-}"
  local auth_header="${4:-}"
  local response_file="${TMP_DIR}/response.json"
  local headers_file="${TMP_DIR}/headers.txt"
  local status

  rm -f "${response_file}" "${headers_file}"

  if [[ -n "${body}" ]]; then
    status="$(curl -sS -L -X "${method}" "${url}" \
      -H "Content-Type: application/json" \
      ${auth_header:+-H "${auth_header}"} \
      -c "${COOKIE_JAR}" -b "${COOKIE_JAR}" \
      -d "${body}" \
      -D "${headers_file}" \
      -o "${response_file}" \
      -w '%{http_code}')"
  else
    status="$(curl -sS -L -X "${method}" "${url}" \
      ${auth_header:+-H "${auth_header}"} \
      -c "${COOKIE_JAR}" -b "${COOKIE_JAR}" \
      -D "${headers_file}" \
      -o "${response_file}" \
      -w '%{http_code}')"
  fi

  HTTP_STATUS="${status}"
  HTTP_BODY="$(cat "${response_file}")"
}

http_head_status() {
  local url="$1"
  curl -sS -I -L "${url}" -o /dev/null -w '%{http_code}'
}

http_page_body() {
  local url="$1"
  curl -sS -L "${url}"
}

extract_token() {
  local json="$1"
  printf '%s' "${json}" | jq -r '
    .data.tokens.accessToken //
    .data.accessToken //
    .data.token //
    .accessToken //
    .token //
    .data.access_token //
    .access_token //
    empty
  ' 2>/dev/null | head -n 1
}

extract_session_seconds() {
  local json="$1"
  local token payload len mod
  token=$(printf '%s' "${json}" | jq -r '.data.tokens.accessToken // .data.accessToken // .accessToken // empty' 2>/dev/null | head -n 1)
  if [[ -z "${token}" ]]; then
    printf ''
    return
  fi
  payload=$(printf '%s' "${token}" | cut -d. -f2)
  len=${#payload}
  mod=$((len % 4))
  if [[ $mod -eq 2 ]]; then payload="${payload}=="; elif [[ $mod -eq 3 ]]; then payload="${payload}="; fi
  payload=$(printf '%s' "${payload}" | tr '_- ' '+/ ')
  printf '%s' "${payload}" | base64 -d 2>/dev/null | jq -r '.exp - .iat // empty' 2>/dev/null
}

check_auth() {
  local login_payload login_status login_body token protected_status protected_body session_seconds

  login_payload="$(jq -cn --arg email "${LOGIN_EMAIL}" --arg password "${LOGIN_PASSWORD}" '{email: $email, password: $password}')"
  http_json "POST" "${BASE_URL}/api/v1/auth/login" "${login_payload}"
  login_status="${HTTP_STATUS:-000}"
  login_body="${HTTP_BODY:-}"

  if [[ "${login_status}" == "200" ]] || [[ "${login_status}" == "201" ]]; then
    pass "Auth login endpoint ${login_status}"
  else
    fail "Auth login endpoint 200 (got ${login_status})"
  fi

  token="$(extract_token "${login_body}")"
  if [[ -n "${token}" ]]; then
    http_json "GET" "${BASE_URL}/api/v1/claim-files?limit=1" "" "Authorization: Bearer ${token}"
    protected_status="${HTTP_STATUS:-000}"
    protected_body="${HTTP_BODY:-}"

    if [[ "${protected_status}" == "200" ]] && json_has "${protected_body}" '.data | type == "array"' ; then
      pass "Auth protected endpoint token validation"
    else
      fail "Auth protected endpoint token validation (got ${protected_status})"
    fi
  else
    fail "Auth protected endpoint token validation (token missing)"
  fi

  session_seconds="$(extract_session_seconds "${login_body}")"
  if [[ "${session_seconds}" =~ ^[0-9]+$ ]] && [[ "${session_seconds}" -gt 0 ]]; then
    pass "Auth session timeout metadata present (${session_seconds}s)"
  else
    fail "Auth session timeout metadata present"
  fi
}

check_api_contract() {
  local token="$1"
  local status body

  http_json "GET" "${BASE_URL}/api/v1/claim-files?limit=1" "" "Authorization: Bearer ${token}"
  status="${HTTP_STATUS:-000}"
  body="${HTTP_BODY:-}"
  if [[ "${status}" == "200" ]] && json_has "${body}" '.success != null and (.data | type == "array") and (.meta.total | type == "number")'; then
    pass "API /claim-files response shape"
  else
    fail "API /claim-files response shape"
  fi

  http_json "GET" "${BASE_URL}/api/v1/dashboard/ownership-load" "" "Authorization: Bearer ${token}"
  status="${HTTP_STATUS:-000}"
  body="${HTTP_BODY:-}"
  if [[ "${status}" == "200" ]] && json_has "${body}" '.success != null and (.data.items | type == "array")'; then
    pass "API /dashboard/ownership-load response shape"
  else
    fail "API /dashboard/ownership-load response shape"
  fi

  http_json "GET" "${BASE_URL}/api/v1/dashboard/pending-actions" "" "Authorization: Bearer ${token}"
  status="${HTTP_STATUS:-000}"
  body="${HTTP_BODY:-}"
  if [[ "${status}" == "200" ]] && json_has "${body}" '.success != null and (.data.items | type == "array")'; then
    pass "API /dashboard/pending-actions response shape"
  else
    fail "API /dashboard/pending-actions response shape"
  fi

  http_json "GET" "${BASE_URL}/api/v1/revision-requests?limit=1" "" "Authorization: Bearer ${token}"
  status="${HTTP_STATUS:-000}"
  body="${HTTP_BODY:-}"
  if [[ "${status}" == "200" ]] && json_has "${body}" '((.success? != null) or true) and ((.data | type == "array") or (.items | type == "array") or (.data.items | type == "array"))'; then
    pass "API /revision-requests response shape"
  else
    fail "API /revision-requests response shape"
  fi

  http_json "GET" "${BASE_URL}/api/v1/finance/overhead/entries?limit=1" "" "Authorization: Bearer ${token}"
  status="${HTTP_STATUS:-000}"
  body="${HTTP_BODY:-}"
  if [[ "${status}" == "200" ]] && json_has "${body}" '(.success? != null or true) and ((.data | type == "array") or (.data.items | type == "array") or (.items | type == "array"))'; then
    pass "API /finance/overhead/entries response shape"
  else
    fail "API /finance/overhead/entries response shape"
  fi
}

check_data_integrity() {
  local token="$1"
  local status body

  http_json "GET" "${BASE_URL}/api/v1/claim-files?limit=1" "" "Authorization: Bearer ${token}"
  status="${HTTP_STATUS:-000}"
  body="${HTTP_BODY:-}"
  if [[ "${status}" == "200" ]] && json_has "${body}" '(.data | type == "array") and ((.data | length == 0) or (.data[0] | has("id") and (has("fileNo") or has("fileNumber")) and has("status")))' ; then
    pass "Data integrity claim-files first item fields"
  else
    fail "Data integrity claim-files first item fields"
  fi

  http_json "GET" "${BASE_URL}/api/v1/dashboard/ownership-load" "" "Authorization: Bearer ${token}"
  status="${HTTP_STATUS:-000}"
  body="${HTTP_BODY:-}"
  if [[ "${status}" == "200" ]] && json_has "${body}" '(.data.items | type == "array") and ((.data.items | length == 0) or (.data.items[0] | (has("userId") or has("id")) and (has("name") or has("fullName"))))'; then
    pass "Data integrity ownership-load first item fields"
  else
    fail "Data integrity ownership-load first item fields"
  fi
}

collect_panel_routes() {
  if [[ -f "ROUTE_INVENTORY.md" ]]; then
    sed -n 's/.*| `\([^`]*\/panel\/[^`]*\)` |.*/\1/p' "ROUTE_INVENTORY.md" | sort -u
  fi
}

check_route_mapping() {
  local route status

  while IFS= read -r route; do
    [[ -z "${route}" ]] && continue
    status="$(http_head_status "${BASE_URL}${route}")"
    if [[ "${status}" == "200" || "${status}" == "302" ]]; then
      pass "Route ${route} reachable (${status})"
    else
      fail "Route ${route} reachable (${status})"
    fi
  done < <(collect_panel_routes)

  for route in "/giris" "/kayit-ol"; do
    status="$(http_head_status "${BASE_URL}${route}")"
    if [[ "${status}" == "200" || "${status}" == "302" ]]; then
      pass "Public route ${route} reachable (${status})"
    else
      fail "Public route ${route} reachable (${status})"
    fi
  done
}

check_frontend_hydration() {
  local route body

  while IFS= read -r route; do
    [[ -z "${route}" ]] && continue
    body="$(http_page_body "${BASE_URL}${route}")"
    if printf '%s' "${body}" | rg -qi 'Loading|Yukleniyor'; then
      fail "Hydration placeholder absent ${route}"
    else
      pass "Hydration placeholder absent ${route}"
    fi

    if printf '%s' "${body}" | rg -q 'NaN|undefined|\[object Object\]'; then
      fail "Hydration invalid literal absent ${route}"
    else
      pass "Hydration invalid literal absent ${route}"
    fi
  done < <(printf '%s\n' "/giris" "/kayit-ol" "/panel" "/panel/hasar-dosyalari" "/panel/revizyon-talepleri" "/panel/finans/sabit-giderler")
}

main() {
  local login_payload login_status login_body token

  if ! command -v curl >/dev/null 2>&1; then
    printf 'curl not found\n' >&2
    exit 1
  fi

  if ! command -v jq >/dev/null 2>&1; then
    printf 'jq not found\n' >&2
    exit 1
  fi

  if ! command -v rg >/dev/null 2>&1; then
    printf 'rg not found\n' >&2
    exit 1
  fi

  check_auth

  login_payload="$(jq -cn --arg email "${LOGIN_EMAIL}" --arg password "${LOGIN_PASSWORD}" '{email: $email, password: $password}')"
  http_json "POST" "${BASE_URL}/api/v1/auth/login" "${login_payload}"
  login_status="${HTTP_STATUS:-000}"
  login_body="${HTTP_BODY:-}"
  token="$(extract_token "${login_body}")"

  if [[ "${login_status}" != "200" && "${login_status}" != "201" ]] || [[ -z "${token}" ]]; then
    printf 'Cannot continue without valid login token\n' >&2
    exit 1
  fi

  check_api_contract "${token}"
  check_route_mapping
  check_frontend_hydration
  check_data_integrity "${token}"

  if [[ "${FAILURES}" -gt 0 ]]; then
    exit 1
  fi
}

main "$@"