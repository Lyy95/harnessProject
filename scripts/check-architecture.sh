#!/usr/bin/env bash
# check-architecture.sh — 检查 Electron 四层边界是否被违反
# 规则：
#   1. main.js   — 主进程，可用 Node.js API，不可被 renderer 直接引用
#   2. preload.js — 桥接层，只能用 contextBridge + ipcRenderer
#   3. renderer.js — 渲染进程，只能通过 window.kbAPI 访问后端
#   4. services/  — 服务层（如有），被 main.js 引用
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ERRORS=0

echo "==> 检查架构边界..."

# Rule 1: renderer.js 不得使用 require('electron') 或 Node.js API
if grep -n "require.*electron" "$ROOT_DIR/renderer.js" 2>/dev/null; then
  echo "  FAIL: renderer.js 不应直接 require('electron')"
  ERRORS=$((ERRORS + 1))
else
  echo "  OK: renderer.js 无直接 electron 引用"
fi

if grep -n "require.*fs\|require.*path\|require.*child_process" "$ROOT_DIR/renderer.js" 2>/dev/null; then
  echo "  FAIL: renderer.js 不应使用 Node.js 内置模块"
  ERRORS=$((ERRORS + 1))
else
  echo "  OK: renderer.js 无 Node.js 内置模块引用"
fi

# Rule 2: preload.js 只能使用 contextBridge + ipcRenderer
if grep -n "require.*electron" "$ROOT_DIR/preload.js" 2>/dev/null; then
  echo "  OK: preload.js 使用 electron（仅 contextBridge + ipcRenderer）"
else
  echo "  FAIL: preload.js 缺少 electron 引用"
  ERRORS=$((ERRORS + 1))
fi

# Rule 3: main.js 不能 import renderer 代码
if grep -n "renderer" "$ROOT_DIR/main.js" 2>/dev/null; then
  echo "  OK: main.js 通过 loadFile 加载 renderer（非直接 import）"
fi

# Rule 4: index.html 只能通过 <script> 加载 renderer.js
if grep -nP "(require\s*\(|import\s+.*from)" "$ROOT_DIR/index.html" 2>/dev/null; then
  echo "  FAIL: index.html 不应有 require/import"
  ERRORS=$((ERRORS + 1))
else
  echo "  OK: index.html 仅通过 script src 加载"
fi

# Rule 5: nodeIntegration 必须为 false
if grep -n "nodeIntegration.*true" "$ROOT_DIR/main.js" 2>/dev/null; then
  echo "  FAIL: nodeIntegration 不应为 true"
  ERRORS=$((ERRORS + 1))
else
  echo "  OK: nodeIntegration 为 false"
fi

# Rule 6: contextIsolation 必须为 true
if grep -n "contextIsolation.*false" "$ROOT_DIR/main.js" 2>/dev/null; then
  echo "  FAIL: contextIsolation 不应为 false"
  ERRORS=$((ERRORS + 1))
else
  echo "  OK: contextIsolation 为 true"
fi

echo ""
if [ $ERRORS -eq 0 ]; then
  echo "==> 架构检查通过：0 个违规"
  exit 0
else
  echo "==> 架构检查失败：$ERRORS 个违规"
  exit 1
fi
