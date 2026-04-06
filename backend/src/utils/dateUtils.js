/**
 * Utilidades de fecha para nombres de archivos y logs
 */

/**
 * Retorna fecha en formato MM-DD-YYYY
 */
function getDailyDateString() {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const yyyy = now.getFullYear();
  return `${mm}-${dd}-${yyyy}`;
}

/**
 * Retorna fecha+hora en formato MM-DD-YYYY-HH-MM-SS (12h)
 */
function getHourlyDateTimeString() {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const yyyy = now.getFullYear();

  let hh = now.getHours();
  const min = String(now.getMinutes()).padStart(2, '0');
  const sec = String(now.getSeconds()).padStart(2, '0');
  const ampm = hh >= 12 ? 'PM' : 'AM';
  hh = hh % 12 || 12;
  const hhStr = String(hh).padStart(2, '0');

  return `${mm}-${dd}-${yyyy}-${hhStr}-${min}-${sec}-${ampm}`;
}

/**
 * Nombre del archivo Daily CSV de GHL
 */
function getDailyFileName() {
  return `Daily_${getDailyDateString()}.csv`;
}

/**
 * Nombre del archivo Hourly CSV de GHL
 */
function getHourlyFileName() {
  return `Hourly_${getHourlyDateTimeString()}.csv`;
}

/**
 * Nombre del archivo 3CX CSV
 */
function get3CXFileName(type = 'daily') {
  const date = getDailyDateString();
  return `3CX_${type === 'hourly' ? 'Hourly' : 'Daily'}_${date}.csv`;
}

module.exports = {
  getDailyDateString,
  getHourlyDateTimeString,
  getDailyFileName,
  getHourlyFileName,
  get3CXFileName,
};
