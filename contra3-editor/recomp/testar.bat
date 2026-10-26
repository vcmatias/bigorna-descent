@echo off
rem Roda no Contra3Recomp uma ROM exportada pelo editor.
rem   testar.bat <rom-editada.sfc> [fase 1-6]
rem O contra3.exe deve estar nesta pasta ou no PATH (ou em CONTRA3_EXE).
setlocal
if "%~1"=="" ( echo uso: testar.bat rom-editada.sfc [fase] & exit /b 1 )
set FASE=%~2
if "%FASE%"=="" set FASE=1
set EXE=%CONTRA3_EXE%
if "%EXE%"=="" set EXE=contra3.exe
"%EXE%" --rom "%~1" --start-stage %FASE%
