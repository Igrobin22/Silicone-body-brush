@echo off
setlocal

set "SITE_DIR=%~dp0"
set "PYTHON_EXE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
set "SITE_URL=http://127.0.0.1:8000/"

if not exist "%PYTHON_EXE%" (
  echo Could not find the bundled Python runtime:
  echo %PYTHON_EXE%
  echo.
  echo Open this folder in VS Code and use the Live Server extension instead.
  pause
  exit /b 1
)

cd /d "%SITE_DIR%"

echo PureForm preview is starting...
echo.
echo Keep this window open while checking the website.
echo If the browser says the site cannot be reached, this window was closed.
echo.
echo Website: %SITE_URL%
echo.

start "" "%SITE_URL%"
"%PYTHON_EXE%" -m http.server 8000 --bind 127.0.0.1

echo.
echo Website server stopped.
pause
