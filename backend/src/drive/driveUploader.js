/**
 * Google Drive Uploader
 * Sube CSVs a las carpetas Daily_Source / Hourly_Source
 * Limpia archivos viejos antes de subir (solo deja el más reciente)
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const { getAuthClient } = require('./googleAuth');
const logger = require('../utils/logger');

/**
 * Sube un archivo CSV a una carpeta de Drive por nombre
 * Elimina archivos anteriores del mismo tipo antes de subir
 *
 * @param {string} localFilePath - Ruta local del CSV
 * @param {string} folderName    - Nombre de la carpeta en Drive (Daily_Source / Hourly_Source)
 * @param {string} remoteName    - Nombre del archivo en Drive
 */
async function uploadCsvToDrive(localFilePath, folderName, remoteName) {
  const auth = await getAuthClient();
  const drive = google.drive({ version: 'v3', auth });

  // 1. Buscar la carpeta por nombre
  const folderId = await getFolderIdByName(drive, folderName);
  if (!folderId) {
    throw new Error(`Carpeta "${folderName}" no encontrada en Google Drive.`);
  }

  logger.info(`Drive: subiendo "${remoteName}" a carpeta "${folderName}"...`);

  // 2. Eliminar archivos viejos del mismo prefijo en esa carpeta
  const prefix = remoteName.startsWith('Daily_') ? 'Daily_'
    : remoteName.startsWith('Hourly_') ? 'Hourly_'
    : remoteName.startsWith('3CX_Daily') ? '3CX_Daily'
    : remoteName.startsWith('3CX_Hourly') ? '3CX_Hourly'
    : null;

  if (prefix) {
    await deleteOldFiles(drive, folderId, prefix);
  }

  // 3. Subir el nuevo archivo
  const fileMetadata = {
    name: remoteName,
    parents: [folderId],
  };

  const media = {
    mimeType: 'text/csv',
    body: fs.createReadStream(localFilePath),
  };

  const uploaded = await drive.files.create({
    resource: fileMetadata,
    media,
    fields: 'id, name, size',
  });

  logger.info(`✅ Subido: "${uploaded.data.name}" (id: ${uploaded.data.id})`);
  return uploaded.data;
}

/**
 * Busca una carpeta en Drive por nombre (raíz del usuario)
 */
async function getFolderIdByName(drive, folderName) {
  const res = await drive.files.list({
    q: `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
    spaces: 'drive',
  });

  const files = res.data.files;
  if (!files || files.length === 0) return null;
  return files[0].id;
}

/**
 * Elimina archivos cuyo nombre empieza con el prefijo dado dentro de una carpeta
 */
async function deleteOldFiles(drive, folderId, prefix) {
  const res = await drive.files.list({
    q: `'${folderId}' in parents and name contains '${prefix}' and trashed = false`,
    fields: 'files(id, name)',
  });

  const files = res.data.files || [];
  for (const file of files) {
    await drive.files.delete({ fileId: file.id });
    logger.info(`Drive: eliminado archivo viejo "${file.name}"`);
  }
}

/**
 * Sube los 2 CSVs de un reporte (GHL + 3CX) a la carpeta correspondiente
 */
async function uploadReportFiles({ ghlPath, ghlName, threecxPath, threecxName, folderName }) {
  const results = [];

  if (ghlPath && fs.existsSync(ghlPath)) {
    const r = await uploadCsvToDrive(ghlPath, folderName, ghlName);
    results.push(r);
  } else {
    logger.warn(`Archivo GHL no encontrado: ${ghlPath}`);
  }

  if (threecxPath && fs.existsSync(threecxPath)) {
    const r = await uploadCsvToDrive(threecxPath, folderName, threecxName);
    results.push(r);
  } else {
    logger.warn(`Archivo 3CX no encontrado: ${threecxPath}`);
  }

  return results;
}

module.exports = { uploadCsvToDrive, uploadReportFiles };
