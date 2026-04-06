/**
 * 3CX Scraper
 * ─────────────────────────────────────────────────────────────────────
 * Navega a https://3cx.cg-suite.com (Admin Console)
 * → Reports → Extension Statistics
 * → Dept 200 - Sales Coordinators
 * → Range: Today
 * → Export CSV
 *
 * Retorna el contenido del CSV descargado como string.
 * ─────────────────────────────────────────────────────────────────────
 */

const path = require('path');
const fs = require('fs');
const { getBrowser, newPage, waitForLoad } = require('./browserManager');
const logger = require('../utils/logger');

const THREECX_URL = process.env.THREECX_URL || 'https://3cx.cg-suite.com';
const WAIT_TIMEOUT = 60000;
const DEPT_TARGET = 'Dept 200';
const OUTPUT_DIR = path.join(__dirname, '../../output');

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

/**
 * Extrae el reporte de Extension Statistics de 3CX
 * @returns {Promise<string>} Ruta del archivo CSV descargado
 */
async function scrape3CX(outputFileName) {
  const headless = process.env.PUPPETEER_HEADLESS !== 'false';
  const browser = await getBrowser(headless);

  logger.info('3CX Scraper iniciado...');

  // Configurar carpeta de descarga de Puppeteer
  const downloadPath = path.resolve(OUTPUT_DIR);

  // Buscar pestaña 3CX ya abierta o abrir una nueva
  const page = await findOrOpen3CXPage(browser);

  try {
    // Configurar directorio de descarga
    const client = await page.createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath,
    });

    // Navegar a Reports → Extension Statistics
    await navigateToExtensionStats(page);

    // Configurar filtros: Dept 200 + Today
    await configureFilters(page);

    // Exportar CSV y obtener ruta
    const csvPath = await exportCSV(page, client, outputFileName, downloadPath);

    logger.info(`✅ 3CX CSV exportado: ${csvPath}`);
    return csvPath;

  } catch (err) {
    logger.error(`Error en 3CX Scraper: ${err.message}`);
    throw err;
  }
}

/**
 * Busca la pestaña 3CX abierta o abre una nueva
 */
async function findOrOpen3CXPage(browser) {
  const pages = await browser.pages();

  for (const p of pages) {
    try {
      const url = p.url();
      if (url.includes('3cx.cg-suite.com')) {
        logger.info('Pestaña 3CX existente encontrada.');
        return p;
      }
    } catch (_) {}
  }

  logger.info('Abriendo nueva pestaña para 3CX...');
  const page = await newPage(browser);
  await page.goto(THREECX_URL, { waitUntil: 'networkidle2', timeout: WAIT_TIMEOUT });
  return page;
}

/**
 * Navega al menú Reports → Extension Statistics
 */
async function navigateToExtensionStats(page) {
  logger.info('Navegando a Reports → Extension Statistics...');

  const currentUrl = page.url();

  // Si ya estamos en Extension Statistics, solo refrescar
  if (currentUrl.includes('/reports') || currentUrl.includes('ExtensionStats')) {
    await page.reload({ waitUntil: 'networkidle2', timeout: WAIT_TIMEOUT });
    logger.info('Página de reportes recargada.');
    return;
  }

  // Buscar y hacer click en "Reports" en el menú lateral
  try {
    await page.waitForSelector('[data-testid="reports"], a[href*="report"], .reports-menu, #Reports', {
      timeout: 15000,
    });

    // Click en Reports
    await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a, button, [class*="menu-item"]'));
      const reportsLink = links.find(el =>
        el.textContent?.trim().toLowerCase() === 'reports' ||
        el.getAttribute('href')?.includes('report')
      );
      if (reportsLink) reportsLink.click();
    });

    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: WAIT_TIMEOUT }).catch(() => {});

  } catch (_) {
    // Intentar URL directa
    logger.info('Intentando URL directa de Extension Statistics...');
    await page.goto(`${THREECX_URL}/#/app/reports/extension-statistics`, {
      waitUntil: 'networkidle2',
      timeout: WAIT_TIMEOUT,
    });
  }

  // Buscar "Extension Statistics" en el submenú
  try {
    await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a, button, li, [class*="submenu"]'));
      const extStats = links.find(el =>
        el.textContent?.toLowerCase().includes('extension stat')
      );
      if (extStats) extStats.click();
    });

    await sleep(2000);
    await waitForLoad(page, 15000).catch(() => {});

  } catch (_) {
    logger.warn('No se pudo hacer click en Extension Statistics. Continuando...');
  }

  logger.info('En página de Extension Statistics.');
}

/**
 * Configura los filtros: Range = Today, Dept = 200 Sales Coordinators
 */
async function configureFilters(page) {
  logger.info('Configurando filtros: Range=Today, Dept=200...');

  await sleep(2000);

  // Esperar que los filtros estén disponibles
  await page.waitForSelector(
    'select, [class*="select"], [class*="dropdown"], mat-select',
    { timeout: 15000 }
  ).catch(() => {});

  // Configurar Range = Today
  await setRangeToday(page);

  // Configurar Department = Dept 200
  await setDepartment200(page);

  // Click en Search/Apply
  await clickSearch(page);

  // Esperar resultados
  await sleep(3000);
  await waitForLoad(page, 20000).catch(() => {});

  logger.info('Filtros aplicados.');
}

/**
 * Selecciona "Today" en el dropdown de Range
 */
async function setRangeToday(page) {
  try {
    await page.evaluate(() => {
      // Buscar el select/dropdown de Range
      const allSelects = document.querySelectorAll('select');
      for (const sel of allSelects) {
        const options = Array.from(sel.options || []);
        const todayOpt = options.find(o =>
          o.text.toLowerCase().includes('today') ||
          o.value.toLowerCase().includes('today')
        );
        if (todayOpt) {
          sel.value = todayOpt.value;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
          return;
        }
      }

      // Para frameworks como Angular Material / ng-select
      const dropdowns = document.querySelectorAll('[class*="select"], mat-select, ng-select');
      for (const dd of dropdowns) {
        if (dd.textContent?.toLowerCase().includes('range') ||
            dd.getAttribute('placeholder')?.toLowerCase().includes('range')) {
          dd.click();
          setTimeout(() => {
            const options = document.querySelectorAll('mat-option, .ng-option, option');
            const today = Array.from(options).find(o =>
              o.textContent?.toLowerCase().trim() === 'today'
            );
            if (today) today.click();
          }, 500);
          break;
        }
      }
    });

    await sleep(1000);
    logger.info('Range configurado: Today');
  } catch (err) {
    logger.warn(`No se pudo configurar Range: ${err.message}`);
  }
}

/**
 * Selecciona Dept 200 - Sales Coordinators
 */
async function setDepartment200(page) {
  try {
    await page.evaluate((deptTarget) => {
      // Limpiar departamento actual y seleccionar Dept 200
      const deptInputs = document.querySelectorAll(
        '[class*="department"], [placeholder*="epartment"], [class*="dept"]'
      );

      for (const input of deptInputs) {
        input.click();
        break;
      }

      // Esperar un momento y buscar en el dropdown abierto
      setTimeout(() => {
        // Cerrar/quitar el dept actual (si hay una X para cerrarlo)
        const clearBtns = document.querySelectorAll(
          '[class*="clear"], [class*="remove"], [class*="close-tag"]'
        );
        clearBtns.forEach(b => b.click());

        // Buscar la opción Dept 200
        const options = document.querySelectorAll(
          '[class*="option"], mat-option, li[role="option"]'
        );
        const dept200 = Array.from(options).find(o =>
          o.textContent?.includes(deptTarget)
        );
        if (dept200) dept200.click();
      }, 1000);

    }, DEPT_TARGET);

    await sleep(2000);
    logger.info('Departamento configurado: Dept 200 - Sales Coordinators');

  } catch (err) {
    logger.warn(`No se pudo configurar Department: ${err.message}`);
  }
}

/**
 * Click en el botón Search para aplicar filtros
 */
async function clickSearch(page) {
  try {
    await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      const searchBtn = Array.from(buttons).find(b =>
        b.textContent?.toLowerCase().trim() === 'search' ||
        b.textContent?.toLowerCase().includes('apply') ||
        b.type === 'submit'
      );
      if (searchBtn) searchBtn.click();
    });

    await sleep(1000);
    logger.info('Search ejecutado.');

  } catch (err) {
    logger.warn(`No se pudo hacer click en Search: ${err.message}`);
  }
}

/**
 * Hace click en "Export CSV" y espera la descarga
 */
async function exportCSV(page, client, outputFileName, downloadPath) {
  logger.info('Haciendo click en Export CSV...');

  // Escuchar el evento de descarga
  const downloadPromise = waitForDownload(client, downloadPath, outputFileName);

  // Click en Export CSV
  await page.evaluate(() => {
    const buttons = document.querySelectorAll('button, a');
    const exportBtn = Array.from(buttons).find(b =>
      b.textContent?.toLowerCase().includes('export csv') ||
      b.textContent?.toLowerCase().includes('export') ||
      b.getAttribute('title')?.toLowerCase().includes('csv')
    );
    if (exportBtn) {
      exportBtn.click();
    } else {
      throw new Error('Botón Export CSV no encontrado');
    }
  });

  // Esperar descarga (máximo 30 segundos)
  const downloadedPath = await Promise.race([
    downloadPromise,
    sleep(30000).then(() => null),
  ]);

  if (!downloadedPath) {
    throw new Error('Timeout esperando la descarga del CSV de 3CX.');
  }

  // Renombrar archivo al nombre deseado
  const finalPath = path.join(downloadPath, outputFileName);
  if (downloadedPath !== finalPath && fs.existsSync(downloadedPath)) {
    fs.renameSync(downloadedPath, finalPath);
  }

  return finalPath;
}

/**
 * Espera a que se complete una descarga en el directorio dado
 */
function waitForDownload(client, downloadDir, expectedName) {
  return new Promise((resolve) => {
    // Usar el evento de CDP para detectar descarga completada
    client.on('Page.downloadProgress', (event) => {
      if (event.state === 'completed') {
        // Buscar el archivo más reciente en el directorio
        const files = fs.readdirSync(downloadDir)
          .filter(f => f.endsWith('.csv'))
          .map(f => ({
            name: f,
            time: fs.statSync(path.join(downloadDir, f)).mtime.getTime(),
          }))
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
