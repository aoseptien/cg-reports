# 📊 CG Reports — Contexto del Proyecto

> **Para Claude:** Este archivo contiene TODO el contexto del proyecto.
> Léelo completo antes de responder o continuar trabajando.

---

## 🎯 ¿Qué es este proyecto?

Una aplicación web que **automatiza la generación de reportes** para un equipo de Sales Coordinators.
Corre en background (sin necesidad de abrir el browser) en hasta 3 PCs simultáneamente.

---

## 👤 Perfil del usuario

- **No tiene experiencia en programación** — explicar todo paso a paso, en español
- Usa **VSCode** como editor
- Tiene **GitHub** para sincronizar entre 3 PCs (personal, trabajo, laptop del trabajo)
- Sus 3 PCs tienen Chrome siempre abierto con las tabs necesarias

---

## 🏗️ Arquitectura del Sistema

```
[Angular App - GitHub Pages]
         ↕ HTTP localhost:3000
[Node.js Service - corre en cada PC]
         ↕ Puppeteer (Chrome headless)
[GoHighLevel CRM] + [3CX PWA]
         ↓
    CSVs generados
         ↓
[Google Drive - Daily_Source / Hourly_Source]
         ↓
[Google Sheets - Daily + Hourly]
  (Scripts Apps Script los procesan)
```

---

## ⏰ Schedule

| Reporte | Hora | Días |
|---------|------|------|
| **Daily** | 9:00 AM | Configurables desde dashboard (no fijos) |
| **Hourly** | 1pm, 2pm, 3pm, 4pm, 5pm | Configurables desde dashboard |

- Los días pueden ser cualquier día (feriados, días no laborables se configuran desde el dashboard)
- Todas las coordinadoras aparecen siempre en el reporte, aunque no hayan venido (valor 0)

---

## 📦 Fuentes de Datos

### GoHighLevel CRM (`app.gohighlevel.com`)
- 3 pestañas llamadas "CG CRM" abiertas en Chrome
- Login: **Google SSO** (Sign in with Google)
- La pestaña de Calls puede cambiar de URL (filtro de fechas)
- Se buscan por **título** "CG CRM", no por URL

### 3CX PWA (`https://3cx.cg-suite.com`)
- Admin Console → Reports → Extension Statistics
- Departamento: **Dept 200 - Sales Coordinators**
- Range: **Today**
- Login: **Google SSO** (misma cuenta que GHL)
- Exportar con botón "Export CSV"

---

## 📊 Reportes

### Daily Report
**Datos de GHL:**
| Header CSV | Descripción |
|------------|-------------|
| Coordinator | Nombre coordinadora |
| MDHX | Métrica MDHX |
| New Leads | Nuevos leads |
| Calls | Llamadas |
| Call Duration | Duración llamadas |

**Datos de 3CX:**
| Header CSV | Descripción |
|------------|-------------|
| Agent Extension | Nombre + extensión del agente |
| Total Talking Time | Tiempo total hablado |

**Carpeta Drive:** `Daily_Source`
**Nombre archivo GHL:** `Daily_MM-DD-YYYY.csv`
**Nombre archivo 3CX:** `3CX_Daily_MM-DD-YYYY.csv`
**Script Sheet:** `fillFromDailySource()`

---

### Hourly Report
**Datos de GHL:**
| Header CSV | Descripción |
|------------|-------------|
| Coordinator | Nombre coordinadora |
| Unread | Mensajes no leídos |
| Hot | Hot leads |
| MDHX | Métrica MDHX |
| Calls | Llamadas |
| Call Duration | Duración llamadas |

**Datos de 3CX:** (igual que Daily)

**Carpeta Drive:** `Hourly_Source`
**Nombre archivo GHL:** `Hourly_MM-DD-YYYY-HH-MM-SS-AM/PM.csv`
**Nombre archivo 3CX:** `3CX_Hourly_MM-DD-YYYY.csv`
**Script Sheet:** `fillFromHourlySource()`

---

## 📋 Google Sheets

### Daily Sheet
- Tiene una **pestaña por día** (04/01/26, 04/02/26, etc.)
- Columnas: USER | MDHX | NEW LEADS | LLAMADAS [fecha] | TIEMPO LLAMADAS [fecha] | CRM | X-TIME | 3CX
- Sección inferior: CG Leads por asignar, CG MDHX por asignar, CG Leads de Hoy
- El script identifica CSVs por sus headers: "coordinator" → GHL, "agent extension" → 3CX

### Hourly Sheet
- Tiene una **pestaña por día**
- Columnas: USER | UNREAD MESSAGES | HOT | MDHX | CALL | SUM CALL | CRM | X-TIME | 3CX
- Celda verde "28s" = FACTOR (tiempo por llamada para calcular SUM CALL)
- SUM CALL = (CALL × FACTOR) + CRM + X-TIME + 3CX

### Lista de Coordinadoras (fuente de verdad = el Sheet)
Se lee dinámicamente de la última pestaña del Sheet vía Google Sheets API.
Coordinadoras actuales: Alejandra Vega, Annie Cruz, Barbara Ruiz, Camila Alfaro,
Cassandra Sarmiento, Dayana Ramirez, Diomela Trapaga, Johanna Arzola, Karla Perez,
Maria Bejerano, Martha Alvarado, Norgis Esquivel, Raquel Portillo, Tatiana Marin,
Victoria Excaliber, Yeimy Cosio, Zadisley Portal
*(Livia Gomez = jefa, se excluye del reporte)*

---

## 🛠️ Stack Tecnológico

| Componente | Tecnología |
|------------|------------|
| Frontend | Angular (GitHub Pages) |
| Backend | Node.js + Express |
| Scraping | Puppeteer (Chrome headless) |
| Scheduler | node-cron |
| Drive/Sheets | Google APIs (googleapis) |
| Windows Service | node-windows |
| Logs | Winston |

---

## 📁 Estructura del Proyecto

```
Web Reports/
├── backend/
│   ├── src/
│   │   ├── api/           server.js        ← API REST Express
│   │   ├── automation/
│   │   │   ├── browserManager.js           ← Puppeteer config
│   │   │   ├── ghlScraper.js              ← Scraping GoHighLevel
│   │   │   ├── threecxScraper.js          ← Scraping 3CX
│   │   │   ├── csvGenerator.js            ← Generar CSVs
│   │   │   ├── reportRunner.js            ← Orquestador principal
│   │   │   └── setupSession.js            ← Login inicial (1 vez)
│   │   ├── drive/
│   │   │   ├── googleAuth.js              ← OAuth2 Google
│   │   │   └── driveUploader.js           ← Subir a Drive
│   │   ├── scheduler/
│   │   │   └── cronScheduler.js           ← Cron jobs configurables
│   │   ├── sheets/
│   │   │   ├── sheetsReader.js            ← Leer coordinadoras
│   │   │   └── scriptTrigger.js           ← Disparar Apps Script
│   │   └── utils/
│   │       ├── logger.js                  ← Logs con Winston
│   │       ├── dateUtils.js               ← Fechas para nombres
│   │       └── historyStore.js            ← Historial en JSON
│   ├── sessions/          (gitignored) ← Cookies/sesión Chrome
│   ├── data/              (gitignored) ← Historial + config
│   ├── output/            (gitignored) ← CSVs temporales
│   ├── logs/              (gitignored) ← Logs del sistema
│   ├── .env               (gitignored) ← Credenciales
│   ├── .env.example                    ← Template de credenciales
│   └── package.json
├── frontend/
│   └── src/app/
│       ├── dashboard/     ← Panel principal + botones Run
│       ├── schedule/      ← Configurar días y horas
│       ├── history/       ← Historial de ejecuciones
│       └── services/      ← Comunicación con backend
├── scripts/
│   └── install-win-service.js
├── install-service.bat
├── CONTEXT.md             ← Este archivo
├── SETUP.md               ← Guía de instalación paso a paso
└── .gitignore
```

---

## 🔑 Variables de Entorno Necesarias

```env
GOOGLE_CLIENT_ID=          # Google Cloud Console
GOOGLE_CLIENT_SECRET=      # Google Cloud Console
SHEETS_DAILY_ID=           # ID del Google Sheet Daily
SHEETS_HOURLY_ID=          # ID del Google Sheet Hourly
APPS_SCRIPT_DAILY_ID=      # ID del Apps Script Daily
APPS_SCRIPT_HOURLY_ID=     # ID del Apps Script Hourly
DRIVE_FOLDER_DAILY=Daily_Source
DRIVE_FOLDER_HOURLY=Hourly_Source
GHL_URL=https://app.gohighlevel.com
THREECX_URL=https://3cx.cg-suite.com
PUPPETEER_HEADLESS=true
TZ=America/New_York
```

---

## ✅ Estado del Proyecto

- [x] Estructura del proyecto creada
- [x] Scraper de GoHighLevel (Puppeteer)
- [x] Scraper de 3CX (Puppeteer)
- [x] Generador de CSVs (Daily + Hourly)
- [x] Google Drive uploader
- [x] Google OAuth2 auth
- [x] Apps Script trigger
- [x] Scheduler con días configurables (Daily 9AM, Hourly 1-5PM)
- [x] API REST Express en localhost:3000
- [x] Angular Dashboard (Dashboard, Schedule, History)
- [x] Windows Service installer
- [x] GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET completados en .env
- [x] SHEETS_DAILY_ID, SHEETS_HOURLY_ID, APPS_SCRIPT_DAILY_ID, APPS_SCRIPT_HOURLY_ID completados en .env
- [x] Google OAuth2 autorizado — tokens en backend/sessions/google_tokens.json
- [x] node_modules del backend instalados (npm install completado)
- [x] Login de Puppeteer en GHL y 3CX — sesión guardada en backend/sessions/
- [x] **Frontend servido desde el backend** en http://localhost:3000 (se abandonó GitHub Pages)
- [x] baseHref `/` en angular.json (production) — ya no es `/cg-reports/`
- [x] server.js sirve `frontend/dist/frontend/browser/` como archivos estáticos
- [x] Dashboard: Backend Online, Google Auth OK ✅
- [x] Scheduler deshabilitado — no corre nada automático hasta que se haga test exitoso
- [ ] **Prueba end-to-end:** click "Run Daily Report" con GHL y 3CX abiertos → verificar que llena el Sheet
- [ ] Publicar Apps Script como API Executable (ver SETUP.md PASO 8)
- [ ] Habilitar Scheduler desde el dashboard (cuando todo funcione)
- [ ] Instalar como Windows Service (install-service.bat como Administrador)
- [ ] Replicar en laptop y PC de casa

---

## 📌 Próximos pasos (en orden)

1. **Test end-to-end:** abrir las 3 pestañas de GHL + la de 3CX → click "Run Daily Report" en http://localhost:3000
2. **Verificar Sheet:** que el Google Sheet Daily se haya llenado con los datos
3. **Publicar Apps Script:** en script editor → Deploy → New deployment → API Executable
4. **Habilitar Scheduler:** desde el dashboard → Schedule → activar
5. **Windows Service:** correr `install-service.bat` como Administrador para que inicie automáticamente
6. **Otras PCs:** git pull + npm install + copiar .env y sessions/ manualmente

---

## 🐛 Problemas resueltos

- **"Access blocked: Missing required parameter: client_id"** → .env no estaba guardado. Fix: Ctrl+S
- **GitHub Pages requería repo público** → cambiado de privado a público
- **Deploy fallaba (404)** → GitHub Pages no estaba activado cuando corrió el primer workflow
- **Dashboard mostraba Offline** → Chrome bloquea HTTPS→HTTP (Private Network Access). Solución final: servir Angular desde el backend en http://localhost:3000 en vez de GitHub Pages
- **Banner "Running" permanente** → `getRunning()` devolvía array, se cambió a `getRunning().length > 0`
- **"NaNd ago"** → fecha inválida del historial, se agregó validación `isNaN(d.getTime())`

---

## 🔗 URLs importantes

- **Dashboard:** http://localhost:3000 (ya no es GitHub Pages)
- **Backend health:** http://localhost:3000/health
- **Backend auth Google:** http://localhost:3000/auth/google
- **GitHub repo:** https://github.com/aoseptien/cg-reports
- **Google Sheet Daily:** https://docs.google.com/spreadsheets/d/1o76IEG2D6GX6uS3Bk-cU_HsBfWzPJjNFArMODbJ9GWk
- **Google Sheet Hourly:** https://docs.google.com/spreadsheets/d/1hSj367KM857Rx4-9CLkMa5Sdj1fo8GQltJzpNyoZrdQ

---

## ⚠️ Archivos que NO están en git (copiar manualmente entre PCs)

- `backend/.env` — todas las credenciales
- `backend/sessions/` — tokens de Google OAuth y sesiones de Puppeteer (GHL + 3CX)

---

## 🚀 Cómo iniciar el backend (hasta instalar el servicio)

```bash
# En terminal, desde la carpeta backend/
node src/api/server.js
```
Luego abrir **http://localhost:3000** en Chrome.

---

*Última actualización: 06 Abril 2026 — Dashboard funcionando en localhost:3000, pendiente test end-to-end*
