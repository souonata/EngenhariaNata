@echo off
setlocal
cd /d "%~dp0"

echo Iniciando API de controle em nova janela...
start "Controle Local EngenhariaNata" cmd /k "npm run control"

echo Aguardando controlador iniciar...
timeout /t 2 /nobreak >nul

echo Abrindo dashboard local...
start "Dashboard Local" "dashboard-local-servidor.html"

echo Pronto. Use os botoes no dashboard para controlar o servidor de testes.
