@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js no esta instalado o no esta disponible en PATH.
  pause
  exit /b 1
)
echo Iniciando JM Cruz L. Digital WhatsApp Bot V1.0.0...
start "" http://127.0.0.1:3000
node server\server.js
pause
