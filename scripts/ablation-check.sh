#!/usr/bin/env bash
# scripts/ablation-check.sh — P06 kb-016~019 消融验证
# 验证每个 feature 的证据链完整性和 T-04 子项覆盖
set -euo pipefail

PASS=0
FAIL=0

check() {
  local label="$1"
  local result="$2"
  if [ "$result" = "true" ]; then
    echo "  [PASS] $label"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] $label"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== P06 消融实验 — kb-016~019 证据链验证 ==="
echo ""

# ---- kb-016: 生命周期监控 ----
echo "kb-016: 应用生命周期监控"
check "main.js 含 app_ready 日志调用" "$(grep -q "logger.info('app_ready'" main.js && echo true || echo false)"
check "main.js 含 window_created 日志调用" "$(grep -q "logger.info('window_created'" main.js && echo true || echo false)"
check "main.js 含 app_close 日志调用" "$(grep -q "logger.info('app_close'" main.js && echo true || echo false)"
check "ready-to-show 事件监听已注册" "$(grep -q "ready-to-show" main.js && echo true || echo false)"
echo "  → 影响 T-04: 生命周期事件 app_ready / window_created"
echo ""

# ---- kb-017: IPC 性能包装 ----
echo "kb-017: IPC 调用性能自动包装"
check "main.js 含 wrapHandler 或 ipcMain.handle 重写" "$(grep -q "durationMs" main.js && echo true || echo false)"
check "main.js 含 ipc_call 日志记录" "$(grep -q "ipc_call" main.js && echo true || echo false)"
check "main.js 含 Date.now() 计时" "$(grep -q "Date.now()" main.js && echo true || echo false)"
echo "  → 影响 T-04: IPC 调用记录 handler 名称 + durationMs"
echo ""

# ---- kb-018: 全局错误捕获 ----
echo "kb-018: 全局错误捕获"
check "main.js 含 uncaughtException handler" "$(grep -q "uncaughtException" main.js && echo true || echo false)"
check "main.js 含 unhandledRejection handler" "$(grep -q "unhandledRejection" main.js && echo true || echo false)"
check "main.js 含 report-renderer-error handler" "$(grep -q "report-renderer-error" main.js && echo true || echo false)"
check "preload.js 含 error 事件监听" "$(grep -q "window.addEventListener('error'" preload.js && echo true || echo false)"
check "preload.js 含 unhandledrejection 事件监听" "$(grep -q "window.addEventListener('unhandledrejection'" preload.js && echo true || echo false)"
check "ERROR 级别日志调用存在" "$(grep -q "logger.error" main.js && echo true || echo false)"
echo "  → 影响 T-04: 错误发生时日志含 ERROR 级别条目"
echo ""

# ---- kb-019: 运行时指标仪表板 ----
echo "kb-019: 运行时指标仪表板 UI"
check "main.js 含 get-runtime-metrics handler" "$(grep -q "get-runtime-metrics" main.js && echo true || echo false)"
check "preload.js 暴露 getRuntimeMetrics API" "$(grep -q "getRuntimeMetrics" preload.js && echo true || echo false)"
check "index.html 含 #runtime-panel" "$(grep -q "runtime-panel" index.html && echo true || echo false)"
check "renderer.js 含 loadRuntimeMetrics" "$(grep -q "loadRuntimeMetrics" renderer.js && echo true || echo false)"
check "renderer.js 含 setInterval 定时刷新" "$(grep -q "setInterval(loadRuntimeMetrics" renderer.js && echo true || echo false)"
echo "  → 影响 T-04: UI 展示 logCount/errorCount/avgIpcDuration/uptime"
echo ""

# ---- 汇总 ----
echo "=== 消融汇总 ==="
TOTAL=$((PASS + FAIL))
echo "通过: $PASS / $TOTAL"
if [ $FAIL -eq 0 ]; then
  echo "结果: 全部通过 — kb-016~019 证据链完整"
else
  echo "结果: $FAIL 项未通过 — 需修复后重跑"
fi
