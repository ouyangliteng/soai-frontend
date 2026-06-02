#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOAD_CHECK="0"
SMOKE_IMAGE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --load-check)
      LOAD_CHECK="1"
      shift
      ;;
    --smoke-image)
      SMOKE_IMAGE="${2:-}"
      if [[ -z "$SMOKE_IMAGE" ]]; then
        echo "--smoke-image requires a path" >&2
        exit 2
      fi
      shift 2
      ;;
    *)
      echo "Usage: $0 [--load-check] [--smoke-image /path/to/rider.jpg]" >&2
      exit 2
      ;;
  esac
done

cd "$ROOT_DIR"

python3 -m py_compile pose_service.py
python3 -m unittest discover -s tests -p "test_*.py"

if [[ "$LOAD_CHECK" == "1" ]]; then
  python3 pose_service.py --load-check
else
  python3 pose_service.py --check
fi

if [[ -n "$SMOKE_IMAGE" ]]; then
  python3 pose_service.py --smoke-image "$SMOKE_IMAGE"
fi

echo "SOAI Python Pose Service verification passed."
