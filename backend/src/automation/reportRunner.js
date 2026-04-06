/**
 * Report Runner — Orquestador Principal
 * ─────────────────────────────────────────────────────────────────────
 * Coordina el flujo completo de cada reporte:
 *
 *  1. Lee coordinadoras del Google Sheet
 *  2. Scraping GHL  → CSV GHL
 *  3. Scraping 3CX  → CSV 3CX
 *  4. Sube ambos CSVs a Google Drive
 *  5. Dispara el script del Google Sheet
 *  6. Registra resultado en historial
 * ─────────────────────────────────────────────────────────────────────
 */

const { scrapeGHL } = require('./ghlScraper');
const { scrape3CX } = require('./threecxScraper');
const { generateDailyGHLCsv, generateHourlyGHLCsv, cleanOldOutputFiles } = require('./csvGenerator');
const { uploadReportFiles } = require('../drive/driveUploader');
const { triggerSheetScript } = require('../sheets/scriptTrigger');
const { getCoordinatorsFromSheet } = require('../sheets/sheetsReader');
const { getDailyFileName, getHourlyFileName, get3CXFileName } = require('../utils/dateUtils');
const historyStore = require('../utils/historyStore');
const logger = require('../utils/logger');

/**
 * Ejecuta el Daily Report completo
 */
async function runDailyReport() {
  const reportId = `daily_${Date.now()}`;
  const startTime = new Date();

  logger.info('═══════════════════════════════════════');
  logger.info('  DAILY REPORT — ' + startTime.toLocaleString());
  logger.info('═══════════════════════════════════════');

  historyStore.add({
    id: reportId,
    type: 'daily',
    status: 'running',
    startTime: startTime.toISOString(),
  });

  try {
    // 1. Leer coordinadoras del Sheet
    const coordinators = await getCoordinatorsFromSheet(process.env.SHEETS_DAILY_ID);
    if (!coordinators.length) throw new Error('No se encontraron coordinadoras en el Daily Sheet.');

    // 2. Scraping GHL
    logger.info('Paso 1/4: Extrayendo datos de GoHighLevel...');
    const ghlData = await scrapeGHL('daily', coordinators);

    // 3. Generar CSV de GHL
    const ghlFileName = getDailyFileName();
    cleanOldOutputFiles('Daily_');
    const ghlPath = generateDailyGHLCsv(ghlData, ghlFileName);

    // 4. Scraping 3CX
    logger.info('Paso 2/4: Extrayendo datos de 3CX...');
    const threecxFileName = get3CXFileName('daily');
    cleanOldOutputFiles('3CX_Daily');
    const threecxPath = await scrape3CX(threecxFileName);

    // 5. Subir a Google Drive
    logger.info('Paso 3/4: Subiendo CSVs a Google Drive...');
    await uploadReportFiles({
      ghlPath,
      ghlName: ghlFileName,
      threecxPath,
      threecxName: threecxFileName,
      folderName: process.env.DRIVE_FOLDER_DAILY || 'Daily_Source',
    });

    // 6. Disparar script del Sheet
    logger.info('Paso 4/4: Ejecutando script del Google Sheet...');
    await triggerSheetScript('daily', process.env.SHEETS_DAILY_ID, process.env.APPS_SCRIPT_DAILY_ID);

    const endTime = new Date();
    const durationSec = Math.round((endTime - startTime) / 1000);

    historyStore.update(reportId, {
      status: 'success',
      endTime: endTime.toISOString(),
      durationSec,
      files: [ghlFileName, threecxFileName],
      coordinators: coordinators.length,
    });

    logger.info(`✅ Daily Report completado en ${durationSec}s`);
    logger.info('═══════════════════════════════════════\n');

    return { success: true, durationSec, files: [ghlFileName, threecxFileName] };

  } catch (err) {
    historyStore.update(reportId, {
      status: 'error',
      error: err.message,
      endTime: new Date().toISOString(),
    });

    logger.error(`❌ Daily Report FALLIDO: ${err.message}`);
    logger.info('═══════════════════════════════════════\n');

    throw err;
  }
}

/**
 * Ejecuta el Hourly Report completo
 */
async function runHourlyReport() {
  const reportId = `hourly_${Date.now()}`;
  const startTime = new Date();

  logger.info('═══════════════════════════════════════');
  logger.info('  HOURLY REPORT — ' + startTime.toLocaleString());
  logger.info('═══════════════════════════════════════');

  historyStore.add({
    id: reportId,
    type: 'hourly',
    status: 'running',
    startTime: startTime.toISOString(),
  });

  try {
    // 1. Leer coordinadoras del Sheet
    const coordinators = await getCoordinatorsFromSheet(process.env.SHEETS_HOURLY_ID);
    if (!coordinators.length) throw new Error('No se encontraron coordinadoras en el Hourly Sheet.');

    // 2. Scraping GHL
    logger.info('Paso 1/4: Extrayendo datos de GoHighLevel...');
    const ghlData = await scrapeGHL('hourly', coordinators);

    // 3. Generar CSV de GHL
    const ghlFileName = getHourlyFileName();
    const ghlPath = generateHourlyGHLCsv(ghlData, ghlFileName);

    // 4. Scraping 3CX
    logger.info('Paso 2/4: Extrayendo datos de 3CX...');
    const threecxFileName = get3CXFileName('hourly');
    cleanOldOutputFiles('3CX_Hourly');
    const threecxPath = await scrape3CX(threecxFileName);

    // 5. Subir a Google Drive
    logger.info('Paso 3/4: Subiendo CSVs a Google Drive...');
    await uploadReportFiles({
      ghlPath,
      ghlName: ghlFileName,
      threecxPath,
      threecxName: threecxFileName,
      folderName: process.env.DRIVE_FOLDER_HOURLY || 'Hourly_Source',
    });

    // 6. Disparar script del Sheet
    logger.info('Paso 4/4: Ejecutando script del Google Sheet...');
    await triggerSheetScript('hourly', process.env.SHEETS_HOURLY_ID, process.env.APPS_SCRIPT_HOURLY_ID);

    const endTime = new Date();
    const durationSec = Math.round((endTime - startTime) / 1000);

    historyStore.update(reportId, {
      status: 'success',
      endTime: endTime.toISOString(),
      durationSec,
      files: [ghlFileName, threecxFileName],
      coordinators: coordinators.length,
    });

    logger.info(`✅ Hourly Report completado en ${durationSec}s`);
    logger.info('═══════════════════════════════════════\n');

    return { success: true, durationSec, files: [ghlFileName, threecxFileName] };

  } catch (err) {
    historyStore.update(reportId, {
      status: 'error',
      error: err.message,
      endTime: new Date().toISOString(),
    });

    logger.error(`❌ Hourly Report FALLIDO: ${err.message}`);
    logger.info('═══════════════════════════════════════\n');

    throw err;
  }
}

module.exports = { runDailyReport, runHourlyReport };
