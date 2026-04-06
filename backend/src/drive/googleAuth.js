/**
 * Google OAuth2 Auth Client
 * Maneja autenticación para Drive API y Sheets API
 * Guarda tokens en disco para no pedir login cada vez
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const http = require('http');
const logger = require('../utils/logger');

const TOKENS_PATH = path.join(__dirname, '../../sessions/google_tokens.json');
const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/script.external_request',
];

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/callback'
  );
}

/**
 * Retorna client autenticado.
 * Si ya hay tokens guardados, los usa.
 * Si no, lanza error indicando que hay que autenticarse.
 */
async function getAuthClient() {
  const client = getOAuth2Client();

  if (fs.existsSync(TOKENS_PATH)) {
    const tokens = JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf8'));
    client.setCredentials(tokens);

    // Auto-refresh si el token está por expirar
    client.on('tokens', (newTokens) => {
      const merged = { ...tokens, ...newTokens };
      fs.writeFileSync(TOKENS_PATH, JSON.stringify(merged, null, 2));
      logger.info('Google tokens actualizados automáticamente.');
    });

    return client;
  }

  throw new Error(
    'Google no está autenticado. ' +
    'Ve a http://localhost:3000/auth/google para autenticarte.'
  );
}

/**
 * Genera URL de autorización para el flujo OAuth2
 */
function getAuthUrl() {
  const client = getOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });
}

/**
 * Intercambia el código de autorización por tokens y los guarda
 */
async function exchangeCodeForTokens(code) {
  const client = getOAuth2Client();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);
  fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));
  logger.info('Tokens de Google guardados en ' + TOKENS_PATH);
  return tokens;
}

/**
 * Verifica si Google está autenticado
 */
function isAuthenticated() {
  return fs.existsSync(TOKENS_PATH);
}

module.exports = {
  getAuthClient,
  getAuthUrl,
  exchangeCodeForTokens,
  isAuthenticated,
};
