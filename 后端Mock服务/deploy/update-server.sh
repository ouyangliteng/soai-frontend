#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${APP_ROOT:-/www/wwwroot/soai-frontend}"
API_ROOT="${API_ROOT:-$APP_ROOT/后端Mock服务}"
STORAGE_ROOT="${SOAI_STORAGE_ROOT:-/data/soai-storage}"

echo "== SOAI API server update =="
echo "App root: $APP_ROOT"
echo "API root: $API_ROOT"
echo "Storage root: $STORAGE_ROOT"

if [ ! -d "$APP_ROOT/.git" ]; then
  echo "未找到 Git 仓库：$APP_ROOT"
  echo "请先在服务器执行："
  echo "  mkdir -p /www/wwwroot"
  echo "  cd /www/wwwroot"
  echo "  git clone git@github.com:ouyangliteng/soai-frontend.git"
  exit 1
fi

cd "$APP_ROOT"
git pull --ff-only

cd "$API_ROOT"
npm install
npm test

mkdir -p "$STORAGE_ROOT/uploads" "$STORAGE_ROOT/frames" "$STORAGE_ROOT/db"

if ! command -v pm2 >/dev/null 2>&1; then
  echo "pm2 未安装，正在全局安装 pm2..."
  npm install -g pm2
fi

pm2 startOrReload deploy/ecosystem.config.cjs
pm2 save
pm2 status

echo "== Local checks =="
curl -fsS http://127.0.0.1:8787/health
echo
curl -fsS http://127.0.0.1:8787/api/student/profile >/dev/null
echo "本机 API 检查通过：/health、/api/student/profile"

echo "== Next external checks =="
echo "curl https://api.soai.yun/health"
echo "curl https://api.soai.yun/api/student/profile"
