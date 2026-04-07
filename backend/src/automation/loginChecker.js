/**
 * Login Checker
 * ─────────────────────────────────────────────────────────────────────
 * Verifica si la sesión está activa en GHL y 3CX.
 * Si no está logueado, intenta usar la sesión guardada (userDataDir).
 * Si la sesión también expiró, lanza error con instrucciones claras.
 * ─────────────────────────────────────────────────────────────────────
 */

const { newPage } = require('./browserManager');
const logger = require('../utils/logger');

const WAIT_TIMEOUT = 30000;

// ── GHL ────────────────────────────────────────────────────────────────

const GHL_BASE = process.env.GHL_URL || 'https://app.gohighlevel.com';

// URLs que indican que NO estamos logueados en GHL
const GHL_LOGIN_PATTERNS = ['/login', '/auth', 'accounts.google.com', 'sso'];

function isGHLLoggedOut(url) {
  return GHL_LOGIN_PATTERNS.some(p => url.includes(p));
}

/**
 * Verifica que la página GHL dada tiene sesión activa.
 * Si detecta login page, intenta navegar con la sesión guardada.
 */
async function ensureGHLLogin(page, browser) {
  const url = page.url();

  if (!url.includes('gohighlevel.com') && !url.includes('highlevel')) {
    // Page not even on GHL yet — that's ok, will be navigated by scraper
    return;
  }

  if (isGHLLoggedOut(url)) {
    logger.warn('GHL session expired. Attempting to restore saved session...');
    await tryRestoreGHLSession(browser);
  } else {
    logger.info('GHL session active ✅');
  }
}

async function tryRestoreGHLSession(browser) {
  // userDataDir already loaded — just navigate to GHL and see if it auto-logs in
  const page = await newPage(browser);
  try {
    await page.goto(GHL_BASE, { waitUntil: 'networkidle2', timeout: WAIT_TIMEOUT });
    await sleep(2000);
    const url = page.url();
    if (isGHLLoggedOut(url)) {
      await page.close();
      throw new Error(
        'GHL session expired and saved session could not restore it. ' +
        'Run "npm run setup-session" to re-authenticate.'
      );
    }
    logger.info('GHL session restored from saved data ✅');
    await page.close();
  } catch (err) {
    await page.close().catch(() => {});
    throw err;
  }
}

// ── 3CX ───────────────────────────────────────────────────────────────

const THREECX_BASE = process.env.THREECX_URL || 'https://3cx.cg-suite.com';

// URLs that indicate we are NOT logged in to 3CX
const THREECX_LOGIN_PATTERNS = ['/login', '/auth', 'accounts.google.com', '#/login', 'signin'];

function is3CXLoggedOut(url) {
  return THREECX_LOGIN_PATTERNS.some(p => url.includes(p)) ||
         url === THREECX_BASE ||
         url === THREECX_BASE + '/';
}

/**
 * Verifica que la página 3CX tiene sesión activa.
 * Si detecta login, intenta restaurar sesión guardada.
 */
async function ensure3CXLogin(page, browser) {
  const url = page.url();

  if (!url.includes('3cx.cg-suite.com')) {
    return; // Not on 3CX yet
  }

  if (is3CXLoggedOut(url)) {
    logger.warn('3CX session expired. Attempting to restore saved session...');
    await tryRestore3CXSession(browser);
  } else {
    logger.info('3CX session active ✅');
  }
}

async function tryRestore3CXSession(browser) {
  const page = await newPage(browser);
  try {
    await page.goto(THREECX_BASE, { waitUntil: 'networkidle2', timeout: WAIT_TIMEOUT });
    await sleep(3000);
    const url = page.url();
    if (is3CXLoggedOut(url)) {
      await page.close();
      throw new Error(
        '3CX session expired and saved session could not restore it. ' +
        'Run "npm run setup-session" to re-authenticate.'
      );
    }
    logger.info('3CX session restored from saved data ✅');
    await page.close();
  } catch (err) {
    await page.close().catch(() => {});
    throw err;
  }
}

// ── Check both at once ─────────────────────────────────────────────────

/**
 * Quick check: navigates to GHL and 3CX in new tabs to verify sessions.
 * Used at startup or before running a report.
 */
async function checkAllSessions(browser) {
  logger.info('Checking GHL and 3CX sessions...');
  const results = { ghl: false, threecx: false };

  // Check GHL
  const ghlPage = await newPage(browser);
  try {
    await ghlPage.goto(GHL_BASE, { waitUntil: 'networkidle2', timeout: WAIT_TIMEOUT });
    await sleep(1500);
    results.ghl = !isGHLLoggedOut(ghlPage.url());
    logger.info(`GHL: ${results.ghl ? '✅ logged in' : '❌ not logged in'}`);
  } catch (_) {
    logger.warn('Could not reach GHL to check session.');
  } finally {
    await ghlPage.close().catch(() => {});
  }

  // Check 3CX
  const threecxPage = await newPage(browser);
  try {
    await threecxPage.goto(THREECX_BASE, { waitUntil: 'networkidle2', timeout: WAIT_TIMEOUT });
    await sleep(1500);
    results.threecx = !is3CXLoggedOut(threecxPage.url());
    logger.info(`3CX: ${results.threecx ? '✅ logged in' : '❌ not logged in'}`);
  } catch (_) {
    logger.warn('Could not reach 3CX to check session.');
  } finally {
    await threecxPage.close().catch(() => {});
  }

  return results;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { ensureGHLLogin, ensure3CXLogin, checkAllSessions };
