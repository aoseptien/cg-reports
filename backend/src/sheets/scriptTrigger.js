/**
 * Trigger de Google Apps Script
 * Llama a fillFromDailySource() / fillFromHourlySource() vía Google Sheets API
 * usando spreadsheets.values.update como "ping" para activar onEdit,
 * o directamente via Apps Script API si está publicado como Web App.
 */

const { google } = require('googleapis');
const { getAuthClient } = require('../drive/googleAuth');
const logger = require('../utils/logger');

/**
 * Dispara la función del Sheet usando Sheets API
 * Escribe un valor trigger en una celda oculta para activar onEdit,
 * luego llama la función directamente via Apps Script API.
 *
 * @param {'daily'|'hourly'} type
 * @param {string} spreadsheetId
 * @param {string} scriptId - ID del Apps Script (de la URL del editor)
 */
async function triggerSheetScript(type, spreadsheetId, scriptId) {
  try {
    const auth = await getAuthClient();

    // Intentar via Apps Script API (método preferido)
    if (scriptId) {
      await triggerViaScriptApi(auth, scriptId, type);
    } else {
      logger.warn('APPS_SCRIPT_ID no configurado. El Sheet deberá recargarse manualmente.');
    }

  } catch (err) {
    logger.error(`Error al disparar script ${type}: ${err.message}`);
    // No lanzar error - la subida ya fue exitosa, el script puede correr manualmente
  }
}

/**
 * Llama la función via Google Apps Script API
 */
async function triggerViaScriptApi(auth, scriptId, type) {
  const script = google.script({ version: 'v1', auth });

  const functionName = type === 'daily'
    ? 'fillFromDailySource'
    : 'fillFromHourlySource';

  logger.info(`Ejecutando ${functionName} via Apps Script API...`);

  const response = await script.scripts.run({
    scriptId,
    requestBody: {
      function: functionName,
      devMode: false,
    },
  });

  if (response.data.error) {
    const err = response.data.error;
    throw new Error(`Apps Script error: ${JSON.stringify(err)}`);
  }

  logger.info(`✅ ${functionName} ejecutado correctamente.`);
  return response.data;
}

module.exports = { triggerSheetScript };
