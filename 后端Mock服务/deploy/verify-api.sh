#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-${SOAI_API_BASE_URL:-https://api.soai.yun}}"
ADMIN_TOKEN="${SOAI_ADMIN_TOKEN:-${2:-}}"

echo "== SOAI API verification =="
echo "Base URL: $BASE_URL"

request() {
  local method="$1"
  local path="$2"
  local payload="${3:-}"
  local auth="${4:-}"
  local tmp
  tmp="$(mktemp)"
  local code
  local auth_args=()
  if [ -n "$auth" ]; then
    auth_args=(-H "Authorization: Bearer $auth")
  fi

  if [ -n "$payload" ]; then
    code="$(curl -sS -o "$tmp" -w "%{http_code}" \
      -X "$method" \
      -H "Content-Type: application/json" \
      "${auth_args[@]}" \
      --data "$payload" \
      "$BASE_URL$path")"
  else
    code="$(curl -sS -o "$tmp" -w "%{http_code}" \
      -X "$method" \
      "${auth_args[@]}" \
      "$BASE_URL$path")"
  fi

  if [ "$code" -lt 200 ] || [ "$code" -ge 300 ]; then
    echo "FAIL $method $path -> HTTP $code"
    head -c 500 "$tmp"
    echo
    rm -f "$tmp"
    exit 1
  fi

  echo "OK   $method $path -> HTTP $code"
  head -c 220 "$tmp"
  echo
  rm -f "$tmp"
}

request GET "/health"
request GET "/api/student/profile"
request GET "/api/coach/dashboard"
request GET "/api/operations/dashboard"
request POST "/api/videos/upload-token" '{
  "fileName": "verify.mp4",
  "durationSec": 12,
  "sizeMb": 8,
  "format": "mp4",
  "cameraAngle": "left",
  "analysisConsent": true,
  "caseConsent": false
}'

if [ -n "$ADMIN_TOKEN" ]; then
  request GET "/api/admin/overview" "" "$ADMIN_TOKEN"
  request GET "/api/admin/oss/status" "" "$ADMIN_TOKEN"
else
  echo "SKIP admin checks: set SOAI_ADMIN_TOKEN or pass it as the second argument."
fi

echo "SOAI API verification passed."
