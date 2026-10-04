@echo off
rem Tira o Bigorna do jogo. / Takes Bigorna out of the game.
powershell -NoProfile -STA -ExecutionPolicy Bypass -File "%~dp0install-bigorna.ps1" -Uninstall %*
if errorlevel 1 pause
