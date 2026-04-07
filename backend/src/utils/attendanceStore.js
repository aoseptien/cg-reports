/**
 * Attendance Store
 * ─────────────────────────────────────────────────────────────────────
 * Guarda el estado de asistencia de las coordinadoras por día.
 *
 * Dos estados posibles para excluir:
 *   absentAllDay  → faltó todo el día → se excluye de hourly Y de daily
 *   leftEarly     → se fue a mitad del día → se excluye de hourly,
 *                   pero SÍ aparece en el daily (trabajó parte del día)
 *
 * Se resetea automáticamente al día siguiente.
 * ─────────────────────────────────────────────────────────────────────
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const ATTENDANCE_FILE = path.join(DATA_DIR, 'attendance.json');

function getToday() {
  return new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
}

function load() {
  try {
    const data = JSON.parse(fs.readFileSync(ATTENDANCE_FILE, 'utf8'));
    if (data.date !== getToday()) {
      return { date: getToday(), absentAllDay: [], leftEarly: [] };
    }
    return data;
  } catch {
    return { date: getToday(), absentAllDay: [], leftEarly: [] };
  }
}

/** Para el Hourly: excluye las que faltaron todo el día + las que se fueron */
function getExcludedForHourly() {
  const d = load();
  return [...new Set([...d.absentAllDay, ...d.leftEarly])];
}

/** Para el Daily: solo excluye las que faltaron todo el día */
function getExcludedForDaily() {
  return load().absentAllDay;
}

/** Guarda el estado completo de asistencia */
function setAttendance({ absentAllDay = [], leftEarly = [] }) {
  const data = {
    date: getToday(),
    absentAllDay: Array.isArray(absentAllDay) ? absentAllDay : [],
    leftEarly: Array.isArray(leftEarly) ? leftEarly : [],
  };
  fs.writeFileSync(ATTENDANCE_FILE, JSON.stringify(data, null, 2), 'utf8');
}

/** Devuelve el estado completo para la API */
function getAttendance() {
  return load();
}

module.exports = { getExcludedForHourly, getExcludedForDaily, setAttendance, getAttendance };
