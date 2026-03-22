#!/bin/bash
# CCDesk 视觉验证截图脚本
# 用法: ./scripts/screenshot.sh [output-dir] [light|dark|both]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

OUT_DIR="${1:-/tmp/ccdesk-screenshots}"
MODE="${2:-both}"
PORT=1421

mkdir -p "$OUT_DIR"

# 检查 Playwright
if ! command -v npx &>/dev/null; then
  echo "ERROR: npx not found"
  exit 1
fi

# 检查是否已有 dev server 在跑
if lsof -i :$PORT >/dev/null 2>&1; then
  echo "Port $PORT already in use, reusing existing dev server"
else
  echo "Starting Vite dev server on port $PORT..."
  npx vite --port $PORT --host 0.0.0.0 > /tmp/vite-screenshot.log 2>&1 &
  VITE_PID=$!
  
  # 等待 dev server 就绪
  for i in $(seq 1 30); do
    if curl -s "http://localhost:$PORT" > /dev/null 2>&1; then
      echo "Dev server ready (took ${i}s)"
      break
    fi
    sleep 1
  done
  
  if ! curl -s "http://localhost:$PORT" > /dev/null 2>&1; then
    echo "ERROR: Dev server failed to start. Check /tmp/vite-screenshot.log"
    cat /tmp/vite-screenshot.log
    exit 1
  fi
fi

screenshot() {
  local name="$1"
  local url="$2"
  local theme="$3"
  local wait="${4:-3000}"
  
  echo "  Screenshot: $name ($theme mode)..."
  
  npx playwright screenshot --browser chromium \
    --viewport-size "1280,800" \
    --color-scheme "$theme" \
    --wait-for-timeout "$wait" \
    "$url" \
    "$OUT_DIR/${name}.png" 2>/dev/null || echo "  WARNING: Screenshot failed for $name"
}

echo "Taking screenshots..."

if [ "$MODE" = "light" ] || [ "$MODE" = "both" ]; then
  echo "=== Light mode ==="
  screenshot "light-main" "http://localhost:$PORT" "light" 3000
fi

if [ "$MODE" = "dark" ] || [ "$MODE" = "both" ]; then
  echo "=== Dark mode ==="
  screenshot "dark-main" "http://localhost:$PORT" "dark" 3000
fi

# 如果是我们启动的 dev server，清理
if [ -n "${VITE_PID:-}" ]; then
  kill $VITE_PID 2>/dev/null || true
  echo "Dev server stopped"
fi

echo ""
echo "Done! Screenshots saved to: $OUT_DIR"
ls -la "$OUT_DIR"/*.png 2>/dev/null | awk '{print $NF}'
