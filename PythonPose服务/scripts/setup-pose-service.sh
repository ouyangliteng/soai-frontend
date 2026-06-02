#!/usr/bin/env bash
set -euo pipefail

PROFILE="${1:-base}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV_DIR="${SOAI_POSE_VENV_DIR:-$ROOT_DIR/.venv}"

case "$PROFILE" in
  base|yolo|rtmpose) ;;
  *)
    echo "Usage: $0 [base|yolo|rtmpose]" >&2
    exit 2
    ;;
esac

python3 -m venv "$VENV_DIR"
# shellcheck disable=SC1091
source "$VENV_DIR/bin/activate"
python -m pip install --upgrade pip wheel setuptools
python -m pip install -r "$ROOT_DIR/requirements-base.txt"

if [[ "$PROFILE" == "yolo" ]]; then
  python -m pip install -r "$ROOT_DIR/requirements-yolo.txt"
fi

if [[ "$PROFILE" == "rtmpose" ]]; then
  python -m pip install -r "$ROOT_DIR/requirements-rtmpose.txt"
  echo "RTMPose 还需要按服务器 CUDA/CPU 版本安装 torch 与 mmcv，请参考 OpenMMLab 官方安装说明。"
fi

python "$ROOT_DIR/pose_service.py" --check

echo "SOAI Python Pose Service setup finished: $PROFILE"
echo "Virtualenv: $VENV_DIR"
