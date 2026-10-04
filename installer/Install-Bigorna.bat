@echo off
rem Abre o instalador do Bigorna (janela com etapas). / Opens the Bigorna installer (a window with steps).
powershell -NoProfile -STA -ExecutionPolicy Bypass -File "%~dp0install-bigorna.ps1" %*
if errorlevel 1 pause
