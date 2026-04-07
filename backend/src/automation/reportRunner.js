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
const attendanceStore = require('../utils/attendanceStore');
const { getDailyFileName, getHourlyFileName, get3CXFileName } = require('../utils/dateUtils');
const historyStore = require('../utils/historyStore');
const logger = require('../utils/logger');

/**
 * Ejecuta el Daily Report completo
 */
async function runDailyReport({ date } = {}) {
  const reportId = `daily_${Date.now()}`;
  const startTime = new Date();
  const reportDate = date || new Date().toISOString().split('T')[0];

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
    // Daily solo excluye a las que faltaron TODO el día (las que se fueron a mitad SÍ aparecen)
    const allCoordinators = await getCoordinatorsFromSheet(process.env.SHEETS_DAILY_ID);
    if (!allCoordinators.length) throw new Error('No coordinators found in Daily Sheet.');
    const excluded = attendanceStore.getExcludedForDaily();
    const coordinators = allCoordinators.filter(c => !excluded.includes(c));
    if (excluded.length > 0) logger.info(`Daily — excluded (absent all day): ${excluded.join(', ')}`);

    logger.info(`Report date: ${reportDate}`);

    // 2. Scraping GHL
    logger.info('Step 1/4: Extracting GoHighLevel data...');
    const ghlData = await scrapeGHL('daily', coordinators, reportDate);

    // 3. Generar CSV de GHL
    const ghlFileName = getDailyFileName();
    cleanOldOutputFiles('Daily_');
    const ghlPath = generateDailyGHLCsv(ghlData, ghlFileName);

    // 4. Scraping 3CX
    logger.info('Step 2/4: Extracting 3CX data...');
    const threecxFileName = get3CXFileName('daily');
    cleanOldOutputFiles('3CX_Daily');
    const threecxPath = await scrape3CX(threecxFileName, reportDate);

    // 5. Subir a Google Drive
    logger.info('Step 3/4: Uploading CSVs to Google Drive...');
    await uploadReportFiles({
      ghlPath,
      ghlName: ghlFileName,
      threecxPath,
      threecxName: threecxFileName,
      folderName: process.env.DRIVE_FOLDER_DAILY || 'Daily_Source',
    });

    // 6. Disparar script del Sheet
    logger.info('Step 4/4: Triggering Google Sheet script...');
    await triggerSheetScript('daily');

    const endTime = new Date();
    const durationSec = Math.round((endTime - startTime) / 1000);

    historyStore.update(reportId, {
      status: 'success',
      endTime: endTime.toISOString(),
      durationSec,
      files: [ghlFileName, threecxFileName],
      coordinators: coordinators.length,
    });

    logger.info(`✅ Daily Report completed in ${durationSec}s`);
    logger.info('═══════════════════════════════════════\n');

    return { success: true, durationSec, files: [ghlFileName, threecxFileName] };

  } catch (err) {
    historyStore.update(reportId, {
      status: 'error',
      error: err.message,
      endTime: new Date().toISOString(),
    });

    logger.error(`❌ Daily Report FAILED: ${err.message}`);
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
    // Hourly excluye a las que faltaron todo el día + las que se fueron a mitad
    const allCoordinators = await getCoordinatorsFromSheet(process.env.SHEETS_HOURLY_ID);
    if (!allCoordinators.length) throw new Error('No coordinators found in Hourly Sheet.');
    const excluded = attendanceStore.getExcludedForHourly();
    const coordinators = allCoordinators.filter(c => !excluded.includes(c));
    if (excluded.length > 0) logger.info(`Hourly — excluded (absent or left early): ${excluded.join(', ')}`);

    // 2. Scraping GHL
    logger.info('Step 1/4: Extracting GoHighLevel data...');
    const ghlData = await scrapeGHL('hourly', coordinators);

    // 3. Generar CSV de GHL
    const ghlFileName = getHourlyFileName();
    const ghlPath = generateHourlyGHLCsv(ghlData, ghlFileName);

    // 4. Scraping 3CX
    logger.info('Step 2/4: Extracting 3CX data...');
    const threecxFileName = get3CXFileName('hourly');
    cleanOldOutputFiles('3CX_Hourly');
    const threecxPath = await scrape3CX(threecxFileName, new Date().toISOString().split('T')[0]);

    // 5. Subir a Google Drive
    logger.info('Step 3/4: Uploading CSVs to Google Drive...');
    await uploadReportFiles({
      ghlPath,
      ghlName: ghlFileName,
      threecxPath,
      threecxName: threecxFileName,
      folderName: process.env.DRIVE_FOLDER_HOURLY || 'Hourly_Source',
    });

    // 6. Disparar script del Sheet
    logger.info('Step 4/4: Triggering Google Sheet script...');
    await triggerSheetScript('hourly');

    const endTime = new Date();
    const durationSec = Math.round((endTime - startTime) / 1000);

    historyStore.update(reportId, {
      status: 'success',
      endTime: endTime.toISOString(),
      durationSec,
      files: [ghlFileName, threecxFileName],
      coordinators: coordinators.length,
    });

    logger.info(`✅ Hourly Report completed in ${durationSec}s`);
    logger.info('═══════════════════════════════════════\n');

    return { success: true, durationSec, files: [ghlFileName, threecxFileName] };

  } catch (err) {
    historyStore.update(reportId, {
      status: 'error',
      error: err.message,
      endTime: new Date().toISOString(),
    });

    logger.error(`❌ Hourly Report FAILED: ${err.message}`);
    logger.info('═══════════════════════════════════════\n');

    throw err;
  }
}

module.exports = { runDailyReport, runHourlyReport };
