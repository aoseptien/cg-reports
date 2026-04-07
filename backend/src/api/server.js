/**
 * Express API Server
 * ─────────────────────────────────────────────────────────────────────
 * REST API local que la Angular app consume desde localhost:3000
 * ─────────────────────────────────────────────────────────────────────
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');
const logger = require('../utils/logger');
const { startScheduler, getSchedulerStatus, saveConfig, restartScheduler } = require('../scheduler/cronScheduler');
const { runDailyReport, runHourlyReport } = require('../automation/reportRunner');
const { getAll, getLastByType, getRunning, cancelAllRunning, deleteById, deleteByIds, deleteAll } = require('../utils/historyStore');
const { getAuthUrl, exchangeCodeForTokens, isAuthenticated } = require('../drive/googleAuth');
const { getCoordinatorsFromSheet } = require('../sheets/sheetsReader');
const attendanceStore = require('../utils/attendanceStore');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────

// Permite que GitHub Pages (HTTPS) acceda a localhost (Private Network Access)
// Chrome envía un preflight OPTIONS con Access-Control-Request-Private-Network: true
// El servidor DEBE responder con Access-Control-Allow-Private-Network: true
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowed = ['http://localhost:4200', 'https://aoseptien.github.io'];

  if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');

  // Responder inmediatamente a preflights
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.use(cors({
  origin: [
    'http://localhost:4200',         // Angular dev
    'https://aoseptien.github.io',    // GitHub Pages
  ],
  credentials: true,
}));
app.use(express.json());

// ── Estado de ejecuciones en curso (para no ejecutar 2 a la vez) ──────
const runningTasks = new Set();

// ─────────────────────────────────────────────────────────────────────
// AUTH — Google OAuth2
// ─────────────────────────────────────────────────────────────────────

/** Inicia el flujo OAuth2 — abrir en el browser */
app.get('/auth/google', (req, res) => {
  const url = getAuthUrl();
  res.redirect(url);
});

/** Callback de OAuth2 */
app.get('/auth/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('Código de autorización no recibido.');

  try {
    await exchangeCodeForTokens(code);
    res.send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:50px">
        <h2>✅ Autenticación exitosa</h2>
        <p>Google Drive y Sheets están conectados.</p>
        <p>Puedes cerrar esta pestaña.</p>
      </body></html>
    `);
  } catch (err) {
    res.status(500).send('Error: ' + err.message);
  }
});

// ─────────────────────────────────────────────────────────────────────
// STATUS — Estado general del sistema
// ─────────────────────────────────────────────────────────────────────

app.get('/api/status', (req, res) => {
  res.json({
    online: true,
    googleAuth: isAuthenticated(),
    scheduler: getSchedulerStatus().enabled,
    running: getRunning().length > 0,
    lastDaily: getLastByType('daily'),
    lastHourly: getLastByType('hourly'),
    timestamp: new Date().toISOString(),
  });
});

// ─────────────────────────────────────────────────────────────────────
// REPORTS — Ejecutar manualmente
// ─────────────────────────────────────────────────────────────────────

app.post('/api/run/daily', async (req, res) => {
  if (runningTasks.has('daily')) {
    return res.status(409).json({ error: 'Daily Report is already running.' });
  }

  const reportDate = req.body.date || new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  res.json({ message: 'Daily Report started.', startTime: new Date().toISOString(), date: reportDate });

  runningTasks.add('daily');
  runDailyReport({ date: reportDate })
    .catch(err => logger.error(`Manual Daily failed: ${err.message}`))
    .finally(() => runningTasks.delete('daily'));
});

app.post('/api/run/hourly', async (req, res) => {
  if (runningTasks.has('hourly')) {
    return res.status(409).json({ error: 'Hourly Report is already running.' });
  }

  res.json({ message: 'Hourly Report started.', startTime: new Date().toISOString() });

  runningTasks.add('hourly');
  runHourlyReport()
    .catch(err => logger.error(`Manual Hourly failed: ${err.message}`))
    .finally(() => runningTasks.delete('hourly'));
});

// ─────────────────────────────────────────────────────────────────────
// STOP — Forzar detención de tareas en curso
// ─────────────────────────────────────────────────────────────────────

app.post('/api/run/stop', (req, res) => {
  const stopped = [...runningTasks];
  runningTasks.clear();
  cancelAllRunning();
  logger.warn(`⚠️  Manually stopped. Tasks cancelled: ${stopped.join(', ') || 'none'}`);
  res.json({ success: true, stopped });
});

// ─────────────────────────────────────────────────────────────────────
// HISTORY — Historial de ejecuciones
// ─────────────────────────────────────────────────────────────────────

app.get('/api/history', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const type = req.query.type; // 'daily' | 'hourly' | undefined

  let history = getAll();
  if (type) history = history.filter(e => e.type === type);

  res.json(history.slice(0, limit));
});

app.post('/api/history/delete', (req, res) => {
  const { ids } = req.body;
  if (Array.isArray(ids) && ids.length > 0) {
    deleteByIds(ids);
    res.json({ success: true, deleted: ids.length });
  } else {
    deleteAll();
    res.json({ success: true, deleted: 'all' });
  }
});

// ─────────────────────────────────────────────────────────────────────
// SCHEDULER — Configuración
// ─────────────────────────────────────────────────────────────────────

app.get('/api/scheduler', (req, res) => {
  res.json(getSchedulerStatus());
});

app.put('/api/scheduler', (req, res) => {
  try {
    const newConfig = saveConfig(req.body);
    restartScheduler();
    res.json({ success: true, config: newConfig });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────
// COORDINATORS — Lista y asistencia del día
// ─────────────────────────────────────────────────────────────────────

/** Obtiene la lista de coordinadoras del Sheet + estado de asistencia de hoy */
app.get('/api/coordinators', async (req, res) => {
  try {
    const all = await getCoordinatorsFromSheet(process.env.SHEETS_DAILY_ID);
    const attendance = attendanceStore.getAttendance();
    res.json({
      coordinators: all,
      absentAllDay: attendance.absentAllDay,
      leftEarly: attendance.leftEarly,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Guarda el estado de asistencia del día */
app.put('/api/coordinators/attendance', (req, res) => {
  try {
    const { absentAllDay, leftEarly } = req.body;
    if (!Array.isArray(absentAllDay) || !Array.isArray(leftEarly)) {
      return res.status(400).json({ error: 'absentAllDay y leftEarly deben ser arrays.' });
    }
    attendanceStore.setAttendance({ absentAllDay, leftEarly });
    res.json({ success: true, absentAllDay, leftEarly });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────
// LOGS — Live log buffer para el dashboard
// ─────────────────────────────────────────────────────────────────────

app.get('/api/logs', (req, res) => {
  const n = parseInt(req.query.n) || 80;
  res.json(logger.getRecentLogs(n));
});

app.delete('/api/logs', (req, res) => {
  logger.clearLogs();
  res.json({ success: true });
});

// ─────────────────────────────────────────────────────────────────────
// Health check
// ─────────────────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// ─────────────────────────────────────────────────────────────────────
// Servir Angular frontend (debe ir DESPUÉS de todas las rutas /api)
// ─────────────────────────────────────────────────────────────────────

const FRONTEND_DIST = path.join(__dirname, '../../../frontend/dist/frontend/browser');

app.use(express.static(FRONTEND_DIST));

// Catch-all: cualquier ruta desconocida → Angular se encarga del routing
app.get('*', (req, res) => {
  res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
});

// ─────────────────────────────────────────────────────────────────────
// Iniciar servidor
// ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  logger.info(`🚀 CG Reports Service corriendo en http://localhost:${PORT}`);
  logger.info(`   Auth Google: ${isAuthenticated() ? '✅ Configurado' : '⚠️  Pendiente — ve a http://localhost:${PORT}/auth/google'}`);

  // Iniciar scheduler automáticamente
  startScheduler();
});

module.exports = app;
