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
const { getAll, getLastByType, getRunning } = require('../utils/historyStore');
const { getAuthUrl, exchangeCodeForTokens, isAuthenticated } = require('../drive/googleAuth');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────
app.use(cors({
  origin: [
    'http://localhost:4200',         // Angular dev
    'https://tu-usuario.github.io',  // GitHub Pages (reemplazar)
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
    scheduler: getSchedulerStatus(),
    running: getRunning(),
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
    return res.status(409).json({ error: 'Daily Report ya está en ejecución.' });
  }

  res.json({ message: 'Daily Report iniciado.', startTime: new Date().toISOString() });

  // Ejecutar en background (no bloquea la respuesta)
  runningTasks.add('daily');
  runDailyReport()
    .catch(err => logger.error(`Manual Daily falló: ${err.message}`))
    .finally(() => runningTasks.delete('daily'));
});

app.post('/api/run/hourly', async (req, res) => {
  if (runningTasks.has('hourly')) {
    return res.status(409).json({ error: 'Hourly Report ya está en ejecución.' });
  }

  res.json({ message: 'Hourly Report iniciado.', startTime: new Date().toISOString() });

  runningTasks.add('hourly');
  runHourlyReport()
    .catch(err => logger.error(`Manual Hourly falló: ${err.message}`))
    .finally(() => runningTasks.delete('hourly'));
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
// Health check
// ─────────────────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
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
