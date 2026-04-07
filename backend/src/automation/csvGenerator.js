/**
 * CSV Generator
 * ─────────────────────────────────────────────────────────────────────
 * Genera los archivos CSV con los headers exactos que esperan
 * los scripts de Google Sheets (fillFromDailySource / fillFromHourlySource)
 *
 * GHL Daily CSV:  Coordinator, MDHX, New Leads, Calls, Call Duration
 * GHL Hourly CSV: Coordinator, Unread, Hot, MDHX, Calls, Call Duration
 * 3CX CSV:        Agent Extension, Total Talking Time  (ya viene de 3CX)
 * ─────────────────────────────────────────────────────────────────────
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const OUTPUT_DIR = path.join(__dirname, '../../output');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

/**
 * Genera el CSV de GHL para el Daily Report
 * @param {Object[]} data - Array de { coordinator, mdhx, newLeads, calls, callDuration }
 * @param {string} fileName - Nombre del archivo (Daily_MM-DD-YYYY.csv)
 * @returns {string} Ruta completa del archivo generado
 */
function generateDailyGHLCsv(data, fileName) {
  const headers = ['Coordinator', 'MDHX', 'New Leads', 'Calls', 'Call Duration'];

  const rows = data.map(row => [
    escapeCsv(row.coordinator || ''),
    row.mdhx ?? 0,
    row.newLeads ?? 0,
    row.calls ?? 0,
    escapeCsv(formatDuration(row.callDuration)),
  ]);

  return writeCsv(headers, rows, fileName);
}

/**
 * Genera el CSV de GHL para el Hourly Report
 * @param {Object[]} data - Array de { coordinator, unread, hot, mdhx, calls, callDuration }
 * @param {string} fileName - Nombre del archivo (Hourly_MM-DD-YYYY-HH-MM-SS.csv)
 * @returns {string} Ruta completa del archivo generado
 */
function generateHourlyGHLCsv(data, fileName) {
  const headers = ['Coordinator', 'Unread', 'Hot', 'MDHX', 'Calls', 'Call Duration'];

  const rows = data.map(row => [
    escapeCsv(row.coordinator || ''),
    row.unread ?? 0,
    row.hot ?? 0,
    row.mdhx ?? 0,
    row.calls ?? 0,
    escapeCsv(formatDuration(row.callDuration)),
  ]);

  return writeCsv(headers, rows, fileName);
}

/**
 * Escribe los datos como CSV en disco
 */
function writeCsv(headers, rows, fileName) {
  const filePath = path.join(OUTPUT_DIR, fileName);

  const csvLines = [
    headers.join(','),
    ...rows.map(row => row.join(',')),
  ];

  fs.writeFileSync(filePath, csvLines.join('\n'), 'utf8');
  logger.info(`CSV generated: ${filePath} (${rows.length} rows)`);
  return filePath;
}

/**
 * Formatea duración para el CSV
 * Acepta: "3h 9m 52s", "3:09:52", 0, null → "3h 9m 52s"
 */
function formatDuration(value) {
  if (!value || value === 0) return '0h 0m 0s';
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  return String(value);
}

/**
 * Escapa un valor para CSV (agrega comillas si tiene comas, comillas o saltos de línea)
 */
function escapeCsv(value) {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Limpia archivos de output anteriores para un tipo dado
 */
function cleanOldOutputFiles(prefix) {
  try {
    const files = fs.readdirSync(OUTPUT_DIR);
    for (const file of files) {
      if (file.startsWith(prefix) && file.endsWith('.csv')) {
        fs.unlinkSync(path.join(OUTPUT_DIR, file));
        logger.info(`Output cleaned: ${file}`);
      }
    }
  } catch (err) {
    logger.warn(`Could not clean output: ${err.message}`);
  }
}

module.exports = {
  generateDailyGHLCsv,
  generateHourlyGHLCsv,
  cleanOldOutputFiles,
};
