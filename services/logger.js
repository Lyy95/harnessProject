// services/logger.js — 结构化日志模块
// 纯逻辑层：不依赖 electron 包，只使用 Node.js 内置模块

const path = require('path');
const fs = require('fs');

const levels = { DEBUG: 10, INFO: 20, WARN: 30, ERROR: 40 };

function formatISO() {
  return new Date().toISOString();
}

function createLogger(logDir) {
  const logFile = path.join(logDir, 'kb.log');
  const MAX_SIZE = 500 * 1024; // 500KB 轮转

  function rotate() {
    try {
      if (fs.existsSync(logFile) && fs.statSync(logFile).size > MAX_SIZE) {
        const rotated = logFile + '.' + Date.now();
        fs.renameSync(logFile, rotated);
      }
    } catch (_) { /* 轮转失败不阻塞 */ }
  }

  function write(level, message, data) {
    const entry = {
      timestamp: formatISO(),
      level,
      message,
    };
    if (data !== undefined) entry.data = data;
    const line = JSON.stringify(entry) + '\n';
    try {
      rotate();
      fs.appendFileSync(logFile, line, 'utf-8');
    } catch (_) { /* 写入失败静默 */ }
  }

  return {
    debug(msg, data) { write('DEBUG', msg, data); },
    info(msg, data) { write('INFO', msg, data); },
    warn(msg, data) { write('WARN', msg, data); },
    error(msg, data) { write('ERROR', msg, data); },
  };
}

module.exports = { createLogger };
