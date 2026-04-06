/**
 * History Store — Historial de ejecuciones en memoria + disco
 * Guarda los últimos 100 reportes ejecutados
 */

const fs = require('fs');
const path = require('path');

const HISTORY_FILE = path.join(__dirname, '../../data/history.json');
const MAX_ENTRIES = 100;

// Asegurar directorio
const dataDir = path.dirname(HISTORY_FILE);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// Cargar historial desde disco al iniciar
let history = [];
try {
  if (fs.existsSync(HISTORY_FILE)) {
    history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
  }
} catch (_) {
  history = [];
}

function save() {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf8');
  } catch (_) {}
}

function add(entry) {
  history.unshift(entry); // más reciente primero
  if (history.length > MAX_ENTRIES) history = history.slice(0, MAX_ENTRIES);
  save();
}

function update(id, data) {
  const idx = history.findIndex(e => e.id === id);
  if (idx !== -1) {
    history[idx] = { ...history[idx], ...data };
    save();
  }
}

function getAll() {
  return history;
}

function getLastByType(type) {
  return history.find(e => e.type === type && e.status !== 'running') || null;
}

function getRunning() {
  return history.filter(e => e.status === 'running');
}

module.exports = { add, update, getAll, getLastByType, getRunning };
