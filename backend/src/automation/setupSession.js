/**
 * SETUP DE SESIÓN — ejecutar UNA SOLA VEZ por PC
 *
 * Este script abre Chrome visible para que el usuario haga login
 * con Google SSO en GHL y 3CX. Después guarda la sesión automáticamente.
 *
 * Uso: node src/automation/setupSession.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { getBrowser, newPage } = require('./browserManager');
const logger = require('../utils/logger');

const GHL_URL = process.env.GHL_URL || 'https://app.gohighlevel.com';
const THREECX_URL = process.env.THREECX_URL || 'https://3cx.cg-suite.com';

async function setupSession() {
  logger.info('=== SETUP DE SESIÓN ===');
  logger.info('Se abrirá Chrome para que hagas login en GHL y 3CX.');
  logger.info('Después de hacer login en ambos, cierra este script con Ctrl+C.');

  const browser = await getBrowser(false); // headless: false = visible

  try {
    // --- GoHighLevel ---
    logger.info('Abriendo GoHighLevel...');
    const ghlPage = await newPage(browser);
    await ghlPage.goto(GHL_URL, { waitUntil: 'networkidle2' });
    logger.info('✅ GoHighLevel abierto. Haz login con Google SSO.');

    // --- 3CX ---
    logger.info('Abriendo 3CX...');
    const threecxPage = await newPage(browser);
    await threecxPage.goto(THREECX_URL, { waitUntil: 'networkidle2' });
    logger.info('✅ 3CX abierto. Haz login con Google SSO.');

    logger.info('');
    logger.info('👆 Haz login en AMBAS pestañas.');
    logger.info('Cuando hayas terminado, presiona Enter aquí para guardar la sesión...');

    // Esperar input del usuario
    await waitForEnter();

    logger.info('✅ Sesión guardada en ./sessions/');
    logger.info('Ya puedes cerrar Chrome y ejecutar el servicio normalmente.');

  } catch (err) {
    logger.error('Error durante setup: ' + err.message);
  } finally {
    await browser.close();
  }
}

function waitForEnter() {
  return new Promise((resolve) => {
    process.stdin.setRawMode(false);
    process.stdin.resume();
    process.stdin.once('data', () => {
      process.stdin.pause();
      resolve();
    });
  });
}

setupSession().catch(console.error);
