@echo off
:: ============================================================
:: CG Reports — Instalar como Windows Service
:: Ejecutar como Administrador
:: ============================================================

echo.
echo  CG Reports - Instalador de Windows Service
echo  ============================================
echo.

:: Verificar que Node.js está instalado
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js no está instalado.
    echo Descárgalo desde: https://nodejs.org
    pause
    exit /b 1
)

:: Instalar node-windows globalmente si no está
echo [1/4] Instalando node-windows...
npm install -g node-windows >nul 2>&1

:: Instalar dependencias del backend
echo [2/4] Instalando dependencias del backend...
cd /d "%~dp0backend"
call npm install

:: Verificar que existe .env
if not exist ".env" (
    echo.
    echo [AVISO] No se encontró el archivo .env
    echo Copiando .env.example como .env...
    copy .env.example .env
    echo.
    echo [IMPORTANTE] Edita el archivo backend\.env con tus credenciales
    echo              antes de iniciar el servicio.
    echo.
)

:: Instalar y registrar el servicio Windows
echo [3/4] Registrando Windows Service...
node "%~dp0scripts\install-win-service.js"

echo.
echo [4/4] Listo!
echo.
echo  El servicio "CG Reports" está instalado.
echo  Se iniciará automáticamente con Windows.
echo.
echo  Comandos útiles:
echo    Iniciar:  net start "CG Reports"
echo    Detener:  net stop  "CG Reports"
echo    Estado:   sc query  "CG Reports"
echo.
pause
