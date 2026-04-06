# 🚀 SETUP.md — Guía de Instalación Paso a Paso

> **Para alguien que nunca ha programado.**
> Sigue cada paso EN ORDEN. No saltes ninguno.

---

## 📋 Antes de Empezar — Lo que necesitas

- ✅ Una PC con Windows
- ✅ Acceso a internet
- ✅ Tu cuenta de Google (la misma que usas en GHL y 3CX)
- ✅ Acceso a GitHub (para subir/descargar el código)

---

## PASO 1 — Instalar Node.js

**¿Qué es Node.js?**
Es un programa que permite que tu PC ejecute código JavaScript fuera del browser.
El backend de CG Reports está hecho con Node.js.

1. Ve a 👉 https://nodejs.org
2. Descarga la versión que dice **"LTS"** (la recomendada, más estable)
3. Instálala con todas las opciones por defecto (solo dar "Next" en todo)
4. Para verificar que se instaló: abre **CMD** (Símbolo del sistema) y escribe:
   ```
   node --version
   ```
   Debe mostrar algo como: `v20.x.x`

---

## PASO 2 — Instalar Git

**¿Qué es Git?**
Es la herramienta que sincroniza el código entre tu GitHub y tus PCs.

1. Ve a 👉 https://git-scm.com/download/win
2. Descarga el instalador
3. Instala con todas las opciones por defecto
4. Para verificar: en CMD escribe:
   ```
   git --version
   ```

---

## PASO 3 — Descargar el Proyecto desde GitHub

**¿Qué es esto?**
"Clonar" significa descargar una copia del proyecto a tu PC.

1. Abre **CMD**
2. Ve a la carpeta donde quieres guardar el proyecto, por ejemplo:
   ```
   cd C:\Users\TuNombre\Documents
   ```
3. Descarga el proyecto:
   ```
   git clone https://github.com/TU-USUARIO/cg-reports.git
   ```
   *(Reemplaza `TU-USUARIO` con tu usuario de GitHub)*
4. Entra a la carpeta:
   ```
   cd cg-reports
   ```

---

## PASO 4 — Instalar dependencias del Backend

**¿Qué son "dependencias"?**
Son librerías (código de terceros) que el proyecto necesita para funcionar.
`npm install` las descarga automáticamente.

1. En CMD, ve a la carpeta backend:
   ```
   cd backend
   ```
2. Instala las dependencias:
   ```
   npm install
   ```
   Esto puede tardar 1-2 minutos. Verás muchos textos pasar — es normal.

---

## PASO 5 — Configurar las Credenciales de Google

Esta es la parte más importante. Necesitas que el sistema pueda acceder a tu Google Drive y Google Sheets.

### 5.1 — Crear un proyecto en Google Cloud

1. Ve a 👉 https://console.cloud.google.com
2. Inicia sesión con tu cuenta de Google
3. Arriba a la izquierda, haz click en el selector de proyectos → **"Nuevo Proyecto"**
4. Ponle nombre: `CG Reports`
5. Click en **Crear**

### 5.2 — Activar las APIs necesarias

1. En el menú izquierdo: **APIs y servicios** → **Biblioteca**
2. Busca y activa cada una de estas 3 APIs (click en cada una → "Habilitar"):
   - `Google Drive API`
   - `Google Sheets API`
   - `Apps Script API`

### 5.3 — Crear credenciales OAuth2

1. En el menú: **APIs y servicios** → **Credenciales**
2. Click en **+ Crear credenciales** → **ID de cliente OAuth**
3. Tipo de aplicación: **Aplicación web**
4. Nombre: `CG Reports Local`
5. En **"URIs de redireccionamiento autorizados"** agrega:
   ```
   http://localhost:3000/auth/callback
   ```
6. Click en **Crear**
7. Se abre un popup con tu **Client ID** y **Client Secret** — cópialos, los necesitarás en el siguiente paso

### 5.4 — Crear el archivo .env

1. En la carpeta `backend/`, busca el archivo `.env.example`
2. Crea una COPIA y llámala `.env` (sin el ".example")
3. Ábrelo con VSCode o Notepad
4. Llena los valores:

```env
PORT=3000
GOOGLE_CLIENT_ID=PEGA_AQUI_TU_CLIENT_ID
GOOGLE_CLIENT_SECRET=PEGA_AQUI_TU_CLIENT_SECRET
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback

SHEETS_DAILY_ID=PEGA_AQUI_EL_ID_DEL_SHEET_DAILY
SHEETS_HOURLY_ID=PEGA_AQUI_EL_ID_DEL_SHEET_HOURLY

APPS_SCRIPT_DAILY_ID=PEGA_AQUI_EL_ID_DEL_SCRIPT_DAILY
APPS_SCRIPT_HOURLY_ID=PEGA_AQUI_EL_ID_DEL_SCRIPT_HOURLY

DRIVE_FOLDER_DAILY=Daily_Source
DRIVE_FOLDER_HOURLY=Hourly_Source
GHL_URL=https://app.gohighlevel.com
THREECX_URL=https://3cx.cg-suite.com
PUPPETEER_HEADLESS=true
TZ=America/New_York
```

**¿Dónde encuentro el ID del Google Sheet?**
Abre tu Google Sheet. En la URL verás algo como:
`https://docs.google.com/spreadsheets/d/`**`1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms`**`/edit`
El código largo en negrita es el ID.

**¿Dónde encuentro el ID del Apps Script?**
1. Abre el Google Sheet → Extensiones → Apps Script
2. En el editor: Configuración del proyecto (ícono de engranaje ⚙️)
3. Copia el **"ID del script"**

---

## PASO 6 — Autorizar Google (una sola vez)

1. Asegúrate de que el backend esté corriendo:
   ```
   cd backend
   node src/api/server.js
   ```
2. Abre tu browser y ve a:
   ```
   http://localhost:3000/auth/google
   ```
3. Aparecerá una pantalla de Google pidiéndote permisos
4. Acepta todos los permisos
5. Verás el mensaje: **"✅ Autenticación exitosa"**

Esto solo lo tienes que hacer **una vez por PC**.

---

## PASO 7 — Hacer el Login de Puppeteer (una sola vez)

Puppeteer necesita iniciar sesión en GHL y 3CX la primera vez.

1. En CMD (dentro de la carpeta `backend`):
   ```
   npm run setup-session
   ```
2. Se abrirá Chrome de forma **visible** (con ventana)
3. Verás 2 pestañas abiertas: GoHighLevel y 3CX
4. Haz login con Google SSO en **AMBAS** pestañas
5. Cuando hayas terminado, regresa al CMD y presiona **Enter**
6. El sistema guarda la sesión — la próxima vez no necesita login

---

## PASO 8 — Publicar Apps Script como API Executable

Para que el sistema pueda disparar los scripts automáticamente:

1. Abre el Google Sheet Daily → Extensiones → Apps Script
2. En el editor: click en **Implementar** → **Nueva implementación**
3. Tipo: **API ejecutable**
4. Acceso: **Cualquier persona**
5. Click en **Implementar**
6. Copia el **ID de implementación** y ponlo en `.env` como `APPS_SCRIPT_DAILY_ID`
7. Repite para el Sheet Hourly → `APPS_SCRIPT_HOURLY_ID`

---

## PASO 9 — Instalar como Windows Service

Esto hace que el backend se inicie automáticamente con Windows, sin que tengas que hacer nada.

1. **Cierra VSCode y cualquier CMD abierto**
2. Busca en Inicio: **"Símbolo del sistema"**
3. Click derecho → **"Ejecutar como administrador"**
4. Ve a la carpeta del proyecto:
   ```
   cd C:\Users\TuNombre\Documents\cg-reports
   ```
5. Ejecuta:
   ```
   install-service.bat
   ```
6. Verás mensajes de instalación — espera que termine
7. ✅ El servicio está instalado

Para verificar que está corriendo:
- Abre el browser y ve a: `http://localhost:3000/health`
- Debe responder: `{"status":"ok"}`

---

## PASO 10 — Acceder al Dashboard

El dashboard Angular está en GitHub Pages y es accesible desde cualquier PC.

1. Abre tu browser
2. Ve a: `https://TU-USUARIO.github.io/cg-reports`

Desde ahí puedes:
- 📊 Ver el estado del sistema
- ▶️ Ejecutar reportes manualmente
- 📅 Configurar días y horas
- 📋 Ver el historial de ejecuciones

---

## 🔄 En cada PC nueva (después de la inicial)

Cuando configurás una segunda o tercera PC, los pasos son más cortos:

1. Instala Node.js y Git (PASO 1 y 2)
2. Clona el repo (PASO 3)
3. `cd backend && npm install` (PASO 4)
4. Crea el archivo `.env` con las mismas credenciales (PASO 5.4)
5. Haz el login de Google: `http://localhost:3000/auth/google` (PASO 6)
6. Haz el login de Puppeteer: `npm run setup-session` (PASO 7)
7. Instala el servicio Windows (PASO 9)

---

## 🔄 Actualizar el código en tus PCs

Cuando hay cambios en el código:

1. Abre CMD en la carpeta del proyecto
2. Descarga los cambios:
   ```
   git pull
   ```
3. Si hay nuevas dependencias:
   ```
   cd backend && npm install
   ```
4. Reinicia el servicio:
   ```
   net stop "CG Reports"
   net start "CG Reports"
   ```

---

## ❓ Solución de Problemas Comunes

### "El servicio no inicia"
→ Verifica que el archivo `.env` existe y tiene todas las credenciales

### "Error de autenticación Google"
→ Ve a `http://localhost:3000/auth/google` y autoriza de nuevo

### "No encuentra las pestañas CG CRM"
→ Asegúrate de que Chrome está abierto con las 3 tabs de GHL
→ Corre `npm run setup-session` para renovar la sesión

### "El script del Sheet no se ejecuta"
→ Verifica que publicaste el Apps Script como "API ejecutable"
→ Verifica el ID en el archivo `.env`

### Ver los logs (para debug)
Los logs están en: `backend/logs/combined.log`
Puedes abrirlos con Notepad o VSCode

---

## 📞 Para continuar trabajando con Claude

1. Abre este repositorio en GitHub
2. Abre VSCode con la carpeta del proyecto
3. Inicia Claude Code en VSCode
4. Dile: **"Lee el archivo CONTEXT.md y continúa el proyecto"**

Claude leerá el contexto completo y podrá continuar exactamente donde quedamos.
