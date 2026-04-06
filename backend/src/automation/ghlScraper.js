/**
 * GoHighLevel Scraper
 * ─────────────────────────────────────────────────────────────────────
 * Abre las 3 pestañas "CG CRM" en GoHighLevel, las refresca,
 * espera datos válidos y extrae:
 *
 *  Daily:  Coordinator, MDHX, New Leads, Calls, Call Duration
 *  Hourly: Coordinator, Unread, Hot, MDHX, Calls, Call Duration
 *
 * Los datos de las 3 pestañas se combinan por coordinadora.
 * ─────────────────────────────────────────────────────────────────────
 */

const { getBrowser, newPage } = require('./browserManager');
const logger = require('../utils/logger');

const GHL_URL = process.env.GHL_URL || 'https://app.gohighlevel.com';

// Tiempo máximo esperando que una pestaña cargue datos (ms)
const WAIT_TIMEOUT = 60000;
// Intervalo de polling para verificar que los datos cargaron (ms)
const POLL_INTERVAL = 1500;

// ─── Selectores CSS de GoHighLevel ──────────────────────────────────
const SELECTORS = {
  // Tarjetas de métricas en el dashboard de reporte
  metricCard: '.metric-card, [class*="metric"], [class*="stat-card"], [class*="report-card"]',
  // Valor numérico dentro de una tarjeta
  metricValue: '[class*="value"], [class*="count"], h2, h3',
  // Indicador de carga / spinner
  loadingSpinner: '[class*="loading"], [class*="spinner"], [class*="skeleton"]',
  // Mensaje de error
  errorMessage: '[class*="error"], [class*="alert-danger"]',
};

/**
 * Extrae datos de GHL de las 3 pestañas CG CRM
 *
 * @param {'daily'|'hourly'} reportType
 * @param {string[]} coordinators - Lista de coordinadoras del Sheet
 * @returns {Promise<Object[]>} Array de objetos con datos por coordinadora
 */
async function scrapeGHL(reportType, coordinators) {
  const headless = process.env.PUPPETEER_HEADLESS !== 'false';
  const browser = await getBrowser(headless);

  logger.info(`GHL Scraper iniciado — tipo: ${reportType}`);

  try {
    // 1. Buscar las 3 pestañas CG CRM ya abiertas o navegarlas
    const tabs = await findOrOpenCGCRMTabs(browser);

    if (tabs.length === 0) {
      throw new Error('No se encontraron pestañas CG CRM. Verifica que GHL esté abierto.');
    }

    logger.info(`Pestañas CG CRM encontradas: ${tabs.length}`);

    // 2. Refrescar todas las pestañas y esperar datos válidos
    const tabData = [];
    for (let i = 0; i < tabs.length; i++) {
      logger.info(`Procesando pestaña ${i + 1}/${tabs.length}...`);
      const data = await refreshAndExtract(tabs[i], reportType, i + 1);
      if (data) tabData.push(data);
    }

    if (tabData.length === 0) {
      throw new Error('No se pudo extraer datos de ninguna pestaña CG CRM.');
    }

    // 3. Combinar datos de las 3 pestañas por coordinadora
    const combined = combineTabData(tabData, coordinators, reportType);

    logger.info(`✅ GHL: datos combinados para ${combined.length} coordinadoras.`);
    return combined;

  } catch (err) {
    logger.error(`Error en GHL Scraper: ${err.message}`);
    throw err;
  }
}

/**
 * Busca páginas ya abiertas con título "CG CRM" o navega a las URLs conocidas
 */
async function findOrOpenCGCRMTabs(browser) {
  const pages = await browser.pages();
  const cgcrmPages = [];

  for (const page of pages) {
    try {
      const title = await page.title();
      const url = page.url();
      if (
        title.includes('CG CRM') ||
        url.includes('gohighlevel.com') && url.includes('reporting')
      ) {
        cgcrmPages.push(page);
      }
    } catch (_) {}
  }

  // Si no hay pestañas abiertas, abrir la URL base de GHL
  if (cgcrmPages.length === 0) {
    logger.warn('No hay pestañas CG CRM abiertas. Abriendo GHL...');
    const page = await newPage(browser);
    await page.goto(GHL_URL, { waitUntil: 'networkidle2', timeout: WAIT_TIMEOUT });
    cgcrmPages.push(page);
  }

  return cgcrmPages;
}

/**
 * Refresca una pestaña y espera a que tenga datos válidos
 */
async function refreshAndExtract(page, reportType, tabIndex) {
  try {
    logger.info(`Tab ${tabIndex}: refrescando con Ctrl+Shift+R...`);

    // Hard refresh (Ctrl+Shift+R = ignora caché)
    await page.keyboard.down('Control');
    await page.keyboard.down('Shift');
    await page.keyboard.press('r');
    await page.keyboard.up('Shift');
    await page.keyboard.up('Control');

    // Esperar navegación
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: WAIT_TIMEOUT })
      .catch(() => {}); // ignorar timeout si no hubo navegación

    // Esperar que los datos carguen (sin spinner, sin error, con valores)
    const loaded = await waitForValidData(page, tabIndex);
    if (!loaded) {
      logger.warn(`Tab ${tabIndex}: timeout esperando datos. Continuando con lo disponible.`);
    }

    // Extraer datos de la página
    const data = await extractPageData(page, reportType, tabIndex);
    return data;

  } catch (err) {
    logger.error(`Tab ${tabIndex}: error al procesar — ${err.message}`);
    return null;
  }
}

/**
 * Espera a que la página tenga datos válidos (sin loading, sin error)
 */
async function waitForValidData(page, tabIndex) {
  const startTime = Date.now();

  while (Date.now() - startTime < WAIT_TIMEOUT) {
    try {
      const state = await page.evaluate(() => {
        // Verificar si hay spinners/skeletons activos
        const loadingEls = document.querySelectorAll(
          '[class*="loading"]:not([class*="loaded"]), [class*="skeleton"], [class*="spinner"]'
        );
        const hasLoading = Array.from(loadingEls).some(
          el => el.offsetParent !== null && getComputedStyle(el).display !== 'none'
        );

        // Verificar errores
        const errorEls = document.querySelectorAll('[class*="error"]:not([class*="no-error"])');
        const hasError = Array.from(errorEls).some(
          el => el.offsetParent !== null && el.textContent.trim().length > 0
        );

        // Verificar que hay números en la página (datos cargados)
        const bodyText = document.body.innerText;
        const hasNumbers = /\d+/.test(bodyText);

        return { hasLoading, hasError, hasNumbers };
      });

      if (!state.hasLoading && !state.hasError && state.hasNumbers) {
        logger.info(`Tab ${tabIndex}: datos válidos detectados.`);
        return true;
      }

      if (state.hasError) {
        logger.warn(`Tab ${tabIndex}: error detectado en página.`);
        return false;
      }

    } catch (_) {}

    await sleep(POLL_INTERVAL);
  }

  return false;
}

/**
 * Extrae los datos de la página usando el texto visible
 * GHL muestra tarjetas con "Nombre MDHX", "Nombre New Lead", etc.
 */
async function extractPageData(page, reportType, tabIndex) {
  logger.info(`Tab ${tabIndex}: extrayendo datos...`);

  const rawData = await page.evaluate((type) => {
    const result = { cards: [], pageTitle: document.title, url: window.location.href };

    // Buscar todos los textos con patrones de coordinadora + métrica
    // Formato en GHL: "Alejandra Vega MDHX" con valor abajo
    const allElements = document.querySelectorAll(
      '[class*="card"], [class*="widget"], [class*="metric"], ' +
      '[class*="stat"], [class*="report"], [class*="coordinator"]'
    );

    allElements.forEach(el => {
      const text = el.innerText?.trim();
      const value = el.querySelector('[class*="value"], [class*="count"], h2, h3, .text-4xl, .text-3xl, .text-2xl');
      if (text && value) {
        result.cards.push({
          label: text.split('\n')[0].trim(),
          value: value.innerText?.trim() || '0',
        });
      }
    });

    // También intentar leer el texto completo de la página para parsing alternativo
    result.bodyText = document.body.innerText;

    return result;
  }, reportType);

  // Parsear los datos según el tipo de reporte
  const parsed = parseGHLPageData(rawData, reportType, tabIndex);
  logger.info(`Tab ${tabIndex}: ${Object.keys(parsed).length} coordinadoras extraídas.`);
  return parsed;
}

/**
 * Parsea el texto de la página de GHL para extraer métricas por coordinadora
 * Formato: "Alejandra Vega MDHX\n6\n(Till Date)\n..."
 */
function parseGHLPageData(rawData, reportType, tabIndex) {
  const coordinatorData = {};

  try {
    // Parsear del texto del body (más confiable que el DOM)
    const lines = rawData.bodyText
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    // Patrones de métricas que buscamos
    const METRICS = {
      daily: ['MDHX', 'New Lead', 'Call', 'Call Duration'],
      hourly: ['Unread', 'Hot Lead', 'MDHX', 'Call', 'Call Duration'],
    };

    const metricsToFind = METRICS[reportType] || METRICS.daily;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Buscar líneas que contengan nombre de coordinadora + métrica
      // Ej: "Alejandra Vega MDHX", "Annie Cruz New Lead"
      for (const metric of metricsToFind) {
        const metricUpper = metric.toUpperCase();
        if (line.toUpperCase().includes(metricUpper) && !isJustMetric(line, metric)) {
          // Extraer nombre de coordinadora (todo antes del nombre de la métrica)
          const metricIdx = line.toUpperCase().indexOf(metricUpper);
          const coordName = line.substring(0, metricIdx).trim();

          if (coordName.length < 2) continue;

          // El valor viene en las líneas siguientes (puede ser número o tiempo)
          const value = findNextNumericValue(lines, i + 1);

          if (!coordinatorData[coordName]) {
            coordinatorData[coordName] = {};
          }

          coordinatorData[coordName][normalizeMetricKey(metric)] = value;
        }
      }
    }

    // Si el parsing de texto falló, intentar con las tarjetas del DOM
    if (Object.keys(coordinatorData).length === 0 && rawData.cards.length > 0) {
      logger.info(`Tab ${tabIndex}: usando parsing de tarjetas DOM...`);
      return parseFromCards(rawData.cards, reportType);
    }

  } catch (err) {
    logger.error(`Error parseando datos GHL tab ${tabIndex}: ${err.message}`);
  }

  return coordinatorData;
}

function isJustMetric(line, metric) {
  return line.trim().toUpperCase() === metric.toUpperCase();
}

function normalizeMetricKey(metric) {
  const map = {
    'MDHX': 'mdhx',
    'New Lead': 'newLeads',
    'Call Duration': 'callDuration',
    'Call': 'calls',
    'Unread': 'unread',
    'Hot Lead': 'hot',
  };
  return map[metric] || metric.toLowerCase().replace(/\s+/g, '_');
}

function findNextNumericValue(lines, startIdx) {
  for (let i = startIdx; i < Math.min(startIdx + 5, lines.length); i++) {
    const line = lines[i].trim();
    // Número entero
    if (/^\d+$/.test(line)) return parseInt(line, 10);
    // Tiempo: Xh Ym Zs o H:MM:SS
    if (/\d+h|\d+m|\d+:\d+/.test(line)) return line;
  }
  return 0;
}

function parseFromCards(cards, reportType) {
  const data = {};
  for (const card of cards) {
    const label = card.label || '';
    const value = card.value || '0';
    const metrics = reportType === 'hourly'
      ? ['MDHX', 'New Lead', 'Unread', 'Hot Lead', 'Call Duration', 'Call']
      : ['MDHX', 'New Lead', 'Call Duration', 'Call'];

    for (const m of metrics) {
      if (label.toUpperCase().includes(m.toUpperCase())) {
        const coordName = label.toUpperCase().replace(m.toUpperCase(), '').trim();
        if (!data[coordName]) data[coordName] = {};
        data[coordName][normalizeMetricKey(m)] = value;
        break;
      }
    }
  }
  return data;
}

/**
 * Combina datos de múltiples pestañas en un array por coordinadora
 */
function combineTabData(tabDataArray, coordinators, reportType) {
  // Merge: si una métrica ya existe en un tab, no sobreescribir con vacío
  const merged = {};

  for (const tabData of tabDataArray) {
    for (const [name, metrics] of Object.entries(tabData)) {
      const normalName = normalizeName(name);
      if (!merged[normalName]) merged[normalName] = { name: normalName };
      Object.assign(merged[normalName], filterEmptyValues(metrics));
    }
  }

  // Construir array final usando la lista canónica del Sheet
  return coordinators.map(coordName => {
    const normalCoord = normalizeName(coordName);

    // Buscar match por nombre normalizado
    const found = Object.values(merged).find(d =>
      normalizeName(d.name) === normalCoord ||
      normalizeName(d.name).includes(normalCoord) ||
      normalCoord.includes(normalizeName(d.name))
    );

    if (reportType === 'hourly') {
      return {
        coordinator: coordName,
        unread: found?.unread ?? 0,
        hot: found?.hot ?? 0,
        mdhx: found?.mdhx ?? 0,
        calls: found?.calls ?? 0,
        callDuration: found?.callDuration ?? '0h 0m 0s',
      };
    }

    return {
      coordinator: coordName,
      mdhx: found?.mdhx ?? 0,
      newLeads: found?.newLeads ?? 0,
      calls: found?.calls ?? 0,
      callDuration: found?.callDuration ?? '0h 0m 0s',
    };
  });
}

function normalizeName(name) {
  return String(name || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

function filterEmptyValues(obj) {
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== null && v !== undefined && v !== '' && v !== 0) {
      result[k] = v;
    }
  }
  return result;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { scrapeGHL };
