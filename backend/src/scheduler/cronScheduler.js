/**
 * Cron Scheduler — Días y horas configurables
 * ─────────────────────────────────────────────────────────────────────
 * Los días laborables se configuran desde el dashboard Angular.
 * Se guardan en data/schedule-config.json
 *
 * Schedule por defecto:
 *   Daily:  9:00 AM (días configurados)
 *   Hourly: 1pm, 2pm, 3pm, 4pm, 5pm (días configurados)
 * ─────────────────────────────────────────────────────────────────────
 */

const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { runDailyReport, runHourlyReport } = require('../automation/reportRunner');
const logger = require('../utils/logger');

const CONFIG_FILE = path.join(__dirname, '../../data/schedule-config.json');
const dataDir = path.dirname(CONFIG_FILE);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// Configuración por defecto
const DEFAULT_CONFIG = {
  enabled: true,
  workDays: {
    0: false, // Domingo
    1: true,  // Lunes
    2: true,  // Martes
    3: true,  // Miércoles
    4: true,  // Jueves
    5: true,  // Viernes
    6: false, // Sábado
  },
  holidays: [], // Fechas en formato "MM/DD/YYYY" a saltarse
  daily: {
    enabled: true,
    hour: 9,
    minute: 0,
  },
  hourly: {
    enabled: true,
    hours: [13, 14, 15, 16, 17], // 1pm a 5pm
  },
};

// Jobs activos
let dailyJob = null;
let hourlyJob = null;

/**
 * Carga la configuración del scheduler desde disco
 */
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const saved = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      return { ...DEFAULT_CONFIG, ...saved };
    }
  } catch (_) {}
  return { ...DEFAULT_CONFIG };
}

/**
 * Guarda la configuración en disco
 */
function saveConfig(config) {
  const merged = { ...loadConfig(), ...config };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), 'utf8');
  return merged;
}

/**
 * Verifica si hoy es día laborable (según configuración y lista de feriados)
 */
function isTodayWorkDay(config) {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Dom, 1=Lun, ..., 6=Sab

  // Verificar día de semana
  if (!config.workDays[dayOfWeek]) {
    logger.info(`Hoy (${getDayName(dayOfWeek)}) no es día laborable. Saltando ejecución.`);
    return false;
  }

  // Verificar feriados
  const todayStr = formatDate(today);
  if (config.holidays && config.holidays.includes(todayStr)) {
    logger.info(`Hoy (${todayStr}) es feriado. Saltando ejecución.`);
    return false;
  }

  return true;
}

/**
 * Inicia el scheduler con la configuración actual
 */
function startScheduler() {
  stopScheduler(); // Detener jobs anteriores
  const config = loadConfig();

  if (!config.enabled) {
    logger.info('Scheduler deshabilitado por configuración.');
    return;
  }

  // ── Daily Job ──────────────────────────────────────────────────
  if (config.daily.enabled) {
    const dailyCron = `${config.daily.minute} ${config.daily.hour} * * *`;
    logger.info(`Scheduler Daily: "${dailyCron}" → ${config.daily.hour}:${String(config.daily.minute).padStart(2,'0')} AM`);

    dailyJob = cron.schedule(dailyCron, async () => {
      const cfg = loadConfig(); // Recargar por si cambió
      if (!cfg.enabled || !cfg.daily.enabled) return;
      if (!isTodayWorkDay(cfg)) return;

      logger.info('⏰ Cron: iniciando Daily Report...');
      try {
        await runDailyReport();
      } catch (err) {
        logger.error(`Cron Daily falló: ${err.message}`);
      }
    }, { timezone: 'America/New_York' }); // Ajustar timezone según necesidad
  }

  // ── Hourly Jobs ────────────────────────────────────────────────
  if (config.hourly.enabled && config.hourly.hours.length > 0) {
    const hoursList = config.hourly.hours.join(',');
    const hourlyCron = `0 ${hoursList} * * *`;
    logger.info(`Scheduler Hourly: "${hourlyCron}" → horas: ${config.hourly.hours.map(h => `${h > 12 ? h - 12 : h}pm`).join(', ')}`);

    hourlyJob = cron.schedule(hourlyCron, async () => {
      const cfg = loadConfig();
      if (!cfg.enabled || !cfg.hourly.enabled) return;
      if (!isTodayWorkDay(cfg)) return;

      const currentHour = new Date().getHours();
      if (!cfg.hourly.hours.includes(currentHour)) return;

      logger.info(`⏰ Cron: iniciando Hourly Report (${currentHour}:00)...`);
      try {
        await runHourlyReport();
      } catch (err) {
        logger.error(`Cron Hourly (${currentHour}h) falló: ${err.message}`);
      }
    }, { timezone: 'America/New_York' });
  }

  logger.info('✅ Scheduler iniciado correctamente.');
}

/**
 * Detiene todos los jobs activos
 */
function stopScheduler() {
  if (dailyJob) { dailyJob.stop(); dailyJob = null; }
  if (hourlyJob) { hourlyJob.stop(); hourlyJob = null; }
}

/**
 * Reinicia el scheduler (útil después de cambios de configuración)
 */
function restartScheduler() {
  logger.info('Reiniciando scheduler...');
  startScheduler();
}

/**
 * Retorna el estado actual del scheduler y próximas ejecuciones
 */
function getSchedulerStatus() {
  const config = loadConfig();
  const now = new Date();

  const nextDaily = getNextRun(config, 'daily');
  const nextHourly = getNextHourlyRuns(config);

  return {
    enabled: config.enabled,
    running: dailyJob !== null || hourlyJob !== null,
    workDays: config.workDays,
    holidays: config.holidays,
    daily: {
      ...config.daily,
      nextRun: nextDaily,
    },
    hourly: {
      ...config.hourly,
      nextRuns: nextHourly,
    },
  };
}

/**
 * Calcula la próxima fecha de ejecución del Daily
 */
function getNextRun(config, type) {
  if (!config.enabled) return null;

  const cfg = type === 'daily' ? config.daily : null;
  if (!cfg || !cfg.enabled) return null;

  const now = new Date();
  const candidate = new Date();
  candidate.setHours(cfg.hour, cfg.minute, 0, 0);

  // Si ya pasó hoy, ir al día siguiente
  if (candidate <= now) candidate.setDate(candidate.getDate() + 1);

  // Encontrar el próximo día laborable
  let attempts = 0;
  while (attempts < 14) {
    const dayOfWeek = candidate.getDay();
    const dateStr = formatDate(candidate);
    const isWorkDay = config.workDays[dayOfWeek];
    const isHoliday = config.holidays?.includes(dateStr);

    if (isWorkDay && !isHoliday) return candidate.toISOString();

    candidate.setDate(candidate.getDate() + 1);
    attempts++;
  }

  return null;
}

/**
 * Calcula las próximas ejecuciones de Hourly
 */
function getNextHourlyRuns(config) {
  if (!config.enabled || !config.hourly.enabled) return [];

  const now = new Date();
  const results = [];

  for (const hour of config.hourly.hours) {
    const candidate = new Date();
    candidate.setHours(hour, 0, 0, 0);

    if (candidate <= now) candidate.setDate(candidate.getDate() + 1);

    // Encontrar próximo día laborable para esa hora
    let attempts = 0;
    while (attempts < 14) {
      const dayOfWeek = candidate.getDay();
      const dateStr = formatDate(candidate);
      if (config.workDays[dayOfWeek] && !config.holidays?.includes(dateStr)) {
        results.push(candidate.toISOString());
        break;
      }
      candidate.setDate(candidate.getDate() + 1);
      attempts++;
    }
  }

  return results.sort();
}

function getDayName(day) {
  const names = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  return names[day] || 'Desconocido';
}

function formatDate(date) {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

module.exports = {
  startScheduler,
  stopScheduler,
  restartScheduler,
  getSchedulerStatus,
  loadConfig,
  saveConfig,
  isTodayWorkDay,
};
