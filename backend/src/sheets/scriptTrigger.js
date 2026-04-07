/**
 * Trigger de Google Apps Script via Web App URL
 * Llama a fillFromDailySource() / fillFromHourlySource()
 * haciendo un GET a la URL del Web App publicado en Apps Script.
 */

const https = require('https');
const logger = require('../utils/logger');

/**
 * Dispara la función del Sheet via Web App URL
 * @param {'daily'|'hourly'} type
 */
async function triggerSheetScript(type) {
  const url = type === 'daily'
    ? process.env.APPS_SCRIPT_DAILY_URL
    : process.env.APPS_SCRIPT_HOURLY_URL;

  const functionName = type === 'daily'
    ? 'fillFromDailySource'
    : 'fillFromHourlySource';

  if (!url) {
    logger.warn(`APPS_SCRIPT_${type.toUpperCase()}_URL no configurada. El Sheet deberá actualizarse manualmente.`);
    return;
  }

  logger.info(`Ejecutando ${functionName} via Web App...`);

  await httpGet(`${url}?fn=${functionName}`);

  logger.info(`✅ ${functionName} ejecutado correctamente.`);
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 400) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    }).on('error', reject);
  });
}

module.exports = { triggerSheetScript };
