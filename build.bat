@echo off
setlocal enabledelayedexpansion
title SnapPDF - Build ^& Installer
color 0B

echo.
echo ============================================================
echo   SnapPDF - Costruzione automatica installer
echo ============================================================
echo.

REM ---- 1. Verifica Node.js ----
echo [1/4] Verifica Node.js...
where node >nul 2>&1
if errorlevel 1 (
    echo.
    echo [ERRORE] Node.js non trovato.
    echo Scaricalo da https://nodejs.org/ e riprova.
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
echo       Node.js !NODE_VER! trovato.
echo.

REM ---- 2. Installazione dipendenze ----
echo [2/4] Installazione dipendenze npm (puo' richiedere qualche minuto)...
call npm install --no-fund --no-audit
if errorlevel 1 (
    echo [ERRORE] npm install fallito.
    pause
    exit /b 1
)
echo       Dipendenze installate.
echo.

REM ---- 3. Compilazione CSS Tailwind ----
echo [3/5] Compilazione CSS (Tailwind)...
call npx tailwindcss -i src\renderer\input.css -o src\renderer\styles.css --minify
if errorlevel 1 (
    echo [ERRORE] Compilazione Tailwind CSS fallita.
    pause
    exit /b 1
)
echo       CSS compilato.
echo.

REM ---- 4. Copia librerie vendor nel renderer ----
echo [4/5] Preparazione librerie vendor...
if not exist "src\renderer\vendor" mkdir "src\renderer\vendor"

REM --- pdf.js (UMD build, serve la versione classica per <script src>) ---
set "PDFJS_SRC="
if exist "node_modules\pdfjs-dist\legacy\build\pdf.js"      set "PDFJS_SRC=node_modules\pdfjs-dist\legacy\build\pdf.js"
if "!PDFJS_SRC!"=="" if exist "node_modules\pdfjs-dist\build\pdf.js" set "PDFJS_SRC=node_modules\pdfjs-dist\build\pdf.js"
if "!PDFJS_SRC!"=="" (
    echo [ERRORE] pdf.js UMD non trovato. La versione installata di pdfjs-dist
    echo          non e' compatibile. Usa pdfjs-dist 3.x o la build legacy.
    pause
    exit /b 1
)
copy /Y "!PDFJS_SRC!" "src\renderer\vendor\pdf.js" >nul

set "PDFJS_WORKER="
if exist "node_modules\pdfjs-dist\legacy\build\pdf.worker.js"      set "PDFJS_WORKER=node_modules\pdfjs-dist\legacy\build\pdf.worker.js"
if "!PDFJS_WORKER!"=="" if exist "node_modules\pdfjs-dist\build\pdf.worker.js" set "PDFJS_WORKER=node_modules\pdfjs-dist\build\pdf.worker.js"
if "!PDFJS_WORKER!"=="" (
    echo [ERRORE] pdf.worker.js non trovato.
    pause
    exit /b 1
)
copy /Y "!PDFJS_WORKER!" "src\renderer\vendor\pdf.worker.js" >nul

REM --- UTIF (puo' avere nome maiuscolo o minuscolo) ---
set "UTIF_SRC="
if exist "node_modules\utif\UTIF.js" set "UTIF_SRC=node_modules\utif\UTIF.js"
if "!UTIF_SRC!"=="" if exist "node_modules\utif\utif.js" set "UTIF_SRC=node_modules\utif\utif.js"
if "!UTIF_SRC!"=="" (
    echo [ERRORE] UTIF.js non trovato in node_modules\utif
    pause
    exit /b 1
)
copy /Y "!UTIF_SRC!" "src\renderer\vendor\utif.js" >nul

REM --- Icona accessibile dal renderer ---
if exist "assets\icon.png" copy /Y "assets\icon.png" "src\renderer\vendor\icon.png" >nul

echo       Librerie copiate.
echo.

REM ---- 5. Build NSIS Installer + metadati update ----
echo [5/5] Compilazione applicazione e installer NSIS...
call npx electron-builder --win nsis --publish never
if errorlevel 1 (
    echo [ERRORE] Build Electron fallita.
    pause
    exit /b 1
)
echo.

echo ============================================================
echo   FATTO!
echo.
echo   Installer:    .\dist\SnapPDF-Setup-1.0.0.exe
echo   Metadati:     .\dist\latest.yml  (per electron-updater)
echo.
echo   Per pubblicare un aggiornamento:
echo   1) Aumenta version in package.json
echo   2) Rilancia build.bat
echo   3) Carica SnapPDF-Setup-X.X.X.exe + latest.yml
echo      sull'URL configurato in package.json (build.publish.url)
echo ============================================================
echo.
explorer "dist"
pause
endlocal
exit /b 0
