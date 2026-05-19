#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "==> 当前目录: $PWD"
echo "==> 安装依赖"
npm install

echo "==> 验证 Electron 可执行"
npx electron --version

echo "==> 启动命令: npm start"

if [ "${RUN_START_COMMAND:-0}" = "1" ]; then
  echo "==> 启动应用"
  exec npx electron .
fi

echo "如果希望 init.sh 直接启动应用，请设置 RUN_START_COMMAND=1。"
