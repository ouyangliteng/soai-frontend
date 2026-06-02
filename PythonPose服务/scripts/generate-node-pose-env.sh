#!/usr/bin/env bash
set -euo pipefail

PROVIDER="${1:-}"
POSE_URL="${2:-http://127.0.0.1:8793}"

case "$PROVIDER" in
  yolo-pose|rtmpose|synthetic) ;;
  *)
    echo "Usage: $0 [yolo-pose|rtmpose|synthetic] [pose_service_url]" >&2
    exit 2
    ;;
esac

cat <<EOF
SOAI_POSE_PROVIDER=http
SOAI_POSE_SERVICE_URL=$POSE_URL
SOAI_POSE_MODEL_PROVIDER=$PROVIDER
SOAI_POSE_SERVICE_TIMEOUT_MS=30000
EOF
