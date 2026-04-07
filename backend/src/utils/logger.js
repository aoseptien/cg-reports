const { createLogger, format, transports } = require('winston');
const Transport = require('winston-transport');
const path = require('path');
const fs = require('fs');

const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

// ── In-memory log buffer (últimas 150 líneas para el dashboard) ────────
const LOG_BUFFER = [];
const MAX_BUFFER = 150;

class MemoryTransport extends Transport {
  log(info, callback) {
    const entry = {
      ts: new Date().toISOString(),
      level: info.level.toUpperCase(),
      message: info.message,
    };
    LOG_BUFFER.push(entry);
    if (LOG_BUFFER.length > MAX_BUFFER) LOG_BUFFER.shift();
    callback();
  }
}

const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp({ format: 'MM/DD/YYYY HH:mm:ss' }),
    format.printf(({ timestamp, level, message }) =>
      `[${timestamp}] ${level.toUpperCase()}: ${message}`
    )
  ),
  transports: [
    new transports.Console(),
    new transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
    }),
    new transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5 * 1024 * 1024,
      maxFiles: 10,
    }),
    new MemoryTransport(),
  ],
});

/** Devuelve las últimas N líneas del buffer */
logger.getRecentLogs = (n = 80) => LOG_BUFFER.slice(-n);

/** Limpia el buffer en memoria */
logger.clearLogs = () => { LOG_BUFFER.length = 0; };

module.exports = logger;
