/**
 * Lee la lista de coordinadoras desde el Google Sheet
 * Siempre usa la ÚLTIMA pestaña (más reciente)
 * Lee la columna USER entre el header y TOTALES
 */

const { google } = require('googleapis');
const logger = require('../utils/logger');
const { getAuthClient } = require('../drive/googleAuth');

/**
 * Obtiene la lista de coordinadoras activas desde el Sheet
 * @param {string} spreadsheetId - ID del Google Sheet
 * @returns {Promise<string[]>} Lista de nombres de coordinadoras
 */
async function getCoordinatorsFromSheet(spreadsheetId) {
  try {
    const auth = await getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });

    // 1. Obtener info del spreadsheet para encontrar la última pestaña
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetsList = meta.data.sheets;
    const lastSheet = sheetsList[sheetsList.length - 1];
    const sheetName = lastSheet.properties.title;

    logger.info(`Reading coordinators from sheet: "${sheetName}"`);

    // 2. Leer la columna A completa de la última pestaña
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A1:A100`,
    });

    const rows = response.data.values || [];

    // 3. Encontrar rango entre header USER y TOTALES
    let headerIdx = -1;
    let totalesIdx = -1;

    for (let i = 0; i < rows.length; i++) {
      const val = String(rows[i][0] || '').trim().toUpperCase();
      if (val === 'USER' && headerIdx === -1) headerIdx = i;
      if (val === 'TOTALES' && headerIdx !== -1) { totalesIdx = i; break; }
    }

    if (headerIdx === -1) {
      logger.warn('USER header not found in Sheet.');
      return [];
    }

    // 4. Extraer nombres entre USER y TOTALES
    const endIdx = totalesIdx !== -1 ? totalesIdx : rows.length;
    const coordinators = [];

    for (let i = headerIdx + 1; i < endIdx; i++) {
      const name = String(rows[i][0] || '').trim();
      if (name && name.toUpperCase() !== 'TOTALES') {
        coordinators.push(name);
      }
    }

    logger.info(`Coordinators found: ${coordinators.length} → ${coordinators.join(', ')}`);
    return coordinators;

  } catch (err) {
    logger.error(`Error leyendo Sheet: ${err.message}`);
    return [];
  }
}

module.exports = { getCoordinatorsFromSheet };
