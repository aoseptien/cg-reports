const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

const SESSION_DIR = path.join(__dirname, '../../sessions');
if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });

let browserInstance = null;

/**
 * Lanza o reutiliza el browser Puppeteer
 */
async function getBrowser(headless = true) {
  if (browserInstance && browserInstance.isConnected()) {
    return browserInstance;
  }

  logger.info('Iniciando browser Puppeteer...');

  browserInstance = await puppeteer.launch({
    headless: headless ? 'new' : false,
    userDataDir: SESSION_DIR, // Guarda sesión/cookies entre ejecuciones
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--window-size=1920,1080',
    ],
    defaultViewport: { width: 1920, height: 1080 },
    ignoreDefaultArgs: ['--enable-automation'],
  });

  browserInstance.on('disconnected', () => {
    browserInstance = null;
    logger.warn('Browser desconectado.');
  });

  logger.info('Browser iniciado correctamente.');
  return browserInstance;
}

/**
 * Cierra el browser si está abierto
 */
async function closeBrowser() {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
    logger.info('Browser cerrado.');
  }
}

/**
 * Abre una nueva página con configuración anti-detección
 */
async function newPage(browser) {
  const page = await browser.newPage();

  // Anti-detección básica
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  );

  return page;
}

/**
 * Espera a que la página cargue completamente (network idle)
 */
async function waitForLoad(page, timeout = 30000) {
  await page.waitForNetworkIdle({ timeout, idleTime: 1500 });
}

module.exports = { getBrowser, closeBrowser, newPage, waitForLoad };
