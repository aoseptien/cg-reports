/**
 * 3CX Scraper
 * ─────────────────────────────────────────────────────────────────────
 * Navigates directly to the Extension Statistics URL with the correct
 * periodType and group filter, then clicks Export CSV.
 *
 * URL format:
 *   https://3cx.cg-suite.com/#/office/reports/extension-statistic
 *     ?filter={"periodType":<N>,"pbxGroup":"GRP0009"}
 *
 * periodType mapping:
 *   6 = Today
 *   7 = Yesterday
 *   0 = Custom (uses fromDate/toDate)
 * ─────────────────────────────────────────────────────────────────────
 */

const path = require('path');
const fs = require('fs');
const { getBrowser, newPage } = require('./browserManager');
const logger = require('../utils/logger');

const THREECX_URL = process.env.THREECX_URL || 'https://3cx.cg-suite.com';
const PBX_GROUP  = 'GRP0009';
const WAIT_TIMEOUT = 60000;
const OUTPUT_DIR = path.join(__dirname, '../../output');

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// ── Helpers ────────────────────────────────────────────────────────────

function getToday() {
  return new Date().toISOString().split('T')[0];
}

function getYesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

/**
 * Builds the filter object based on the requested date (YYYY-MM-DD).
 *  today     → periodType 6
 *  yesterday → periodType 7
 *  other     → periodType 3 with periodFromTo: [dateT00:00, (date+1)T00:00]
 */
function buildFilter(dateStr) {
  const today     = getToday();
  const yesterday = getYesterday();

  if (!dateStr || dateStr === today) {
    return { periodType: 6, pbxGroup: PBX_GROUP };
  }
  if (dateStr === yesterday) {
    return { periodType: 7, pbxGroup: PBX_GROUP };
  }
  // Custom date: from midnight that day to midnight next day
  const nextDay = new Date(dateStr);
  nextDay.setDate(nextDay.getDate() + 1);
  const nextDayStr = nextDay.toISOString().split('T')[0];
  return {
    periodType: 3,
    periodFromTo: [`${dateStr}T00:00`, `${nextDayStr}T00:00`],
    pbxGroup: PBX_GROUP,
  };
}

/**
 * Builds the full URL for the Extension Statistics report.
 */
function buildReportUrl(dateStr) {
  const filter = buildFilter(dateStr);
  const encoded = encodeURIComponent(JSON.stringify(filter));
  return `${THREECX_URL}/#/office/reports/extension-statistic?filter=${encoded}`;
}

// ── Main ───────────────────────────────────────────────────────────────

/**
 * Scrapes 3CX Extension Statistics for a given date.
 * @param {string} outputFileName - Desired CSV filename
 * @param {string} dateStr - Date to report on (YYYY-MM-DD). Defaults to today.
 * @returns {Promise<string>} Path to the downloaded CSV
 */
async function scrape3CX(outputFileName, dateStr) {
  const headless = process.env.PUPPETEER_HEADLESS !== 'false';
  const browser = await getBrowser(headless);
  const downloadPath = path.resolve(OUTPUT_DIR);
  const reportUrl = buildReportUrl(dateStr);

  logger.info(`3CX Scraper started — date: ${dateStr || 'today'}`);
  logger.info(`Navigating to: ${reportUrl}`);

  const page = await findOrOpen3CXPage(browser);

  try {
    // Set download directory
    const client = await page.createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath,
    });

    // Navigate directly to the filtered report URL
    await page.goto(reportUrl, { waitUntil: 'networkidle2', timeout: WAIT_TIMEOUT });
    logger.info('Page loaded. Waiting for data table...');

    // Wait for the data table to appear (extension rows)
    await waitForTable(page);
    logger.info('Data table ready. Clicking Export CSV...');

    // Set up download listener before clicking
    const downloadPromise = waitForDownload(client, downloadPath);

    // Click Export CSV
    const clicked = await clickExportCSV(page);
    if (!clicked) {
      throw new Error('Export CSV button not found');
    }

    // Wait for download (max 30s)
    const downloadedPath = await Promise.race([
      downloadPromise,
      sleep(30000).then(() => null),
    ]);

    if (!downloadedPath) {
      throw new Error('Timeout waiting for 3CX CSV download.');
    }

    // Rename to desired output name
    const finalPath = path.join(downloadPath, outputFileName);
    if (downloadedPath !== finalPath && fs.existsSync(downloadedPath)) {
      fs.renameSync(downloadedPath, finalPath);
    }

    logger.info(`✅ 3CX CSV exported: ${finalPath}`);
    return finalPath;

  } catch (err) {
    logger.error(`3CX Scraper error: ${err.message}`);
    throw err;
  }
}

// ── Page helpers ───────────────────────────────────────────────────────

/**
 * Reuses an existing 3CX tab or opens a new one.
 */
async function findOrOpen3CXPage(browser) {
  const pages = await browser.pages();
  for (const p of pages) {
    try {
      if (p.url().includes('3cx.cg-suite.com')) {
        logger.info('Reusing existing 3CX tab.');
        return p;
      }
    } catch (_) {}
  }
  logger.info('Opening new 3CX tab...');
  const page = await newPage(browser);
  await page.goto(THREECX_URL, { waitUntil: 'networkidle2', timeout: WAIT_TIMEOUT });
  return page;
}

/**
 * Waits for the report table to have at least one data row.
 * Tries multiple selectors used by the 3CX Angular app.
 */
async function waitForTable(page) {
  const tableSelectors = [
    'table tbody tr',
    '.ag-row',
    '.report-table tr',
    '[class*="grid-row"]',
    '[class*="table-row"]',
    'tr[class*="data"]',
  ];

  for (const sel of tableSelectors) {
    try {
      await page.waitForSelector(sel, { timeout: 15000 });
      logger.info(`Table found with selector: ${sel}`);
      return;
    } catch (_) {}
  }

  // Fallback: wait for network to settle after load
  logger.warn('Table selector not matched — waiting extra 5s for data to render...');
  await sleep(5000);
}

/**
 * Finds and clicks the Export CSV button.
 * Returns true if clicked, false if not found.
 */
async function clickExportCSV(page) {
  // Extra wait for the button to become active after data loads
  await sleep(1500);

  const clicked = await page.evaluate(() => {
    // Try buttons and links with various text/attribute patterns
    const candidates = Array.from(document.querySelectorAll('button, a, [role="button"]'));

    const exportBtn = candidates.find(el => {
      const text = (el.textContent || '').trim().toLowerCase();
      const title = (el.getAttribute('title') || '').toLowerCase();
      const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
      return (
        text.includes('export csv') ||
        text === 'export' ||
        title.includes('export csv') ||
        title.includes('csv') ||
        ariaLabel.includes('export csv') ||
        ariaLabel.includes('csv') ||
        el.className?.includes?.('export')
      );
    });

    if (exportBtn) {
      exportBtn.click();
      return true;
    }
    return false;
  });

  if (!clicked) {
    // Log what buttons are visible to help debug
    const buttonTexts = await page.evaluate(() =>
      Array.from(document.querySelectorAll('button, a[class*="btn"]'))
        .map(b => b.textContent?.trim())
        .filter(Boolean)
        .slice(0, 20)
    );
    logger.warn(`Visible buttons: ${buttonTexts.join(' | ')}`);
  }

  return clicked;
}

/**
 * Waits for a new CSV file to appear in the download directory.
 */
function waitForDownload(client, downloadDir) {
  return new Promise((resolve) => {
    client.on('Page.downloadProgress', (event) => {
      if (event.state === 'completed') {
        const files = fs.readdirSync(downloadDir)
          .filter(f => f.endsWith('.csv'))
          .map(f => ({ name: f, time: fs.statSync(path.join(downloadDir, f)).mtime.getTime() }))
          .sort((a, b) => b.time - a.time);
        if (files.length > 0) {
          resolve(path.join(downloadDir, files[0].name));
        }
      }
    });
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { scrape3CX };
