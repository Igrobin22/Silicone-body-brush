@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "START_SCRIPT=%SCRIPT_DIR%start-website-hidden.vbs"
set "STARTUP_LINK=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\PureForm Website Preview.lnk"

if not exist "%START_SCRIPT%" (
  echo Could not find:
  echo %START_SCRIPT%
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "$shell = New-Object -ComObject WScript.Shell; $shortcut = $shell.CreateShortcut('%STARTUP_LINK%'); $shortcut.TargetPath = '%START_SCRIPT%'; $shortcut.WorkingDirectory = '%SCRIPT_DIR%'; $shortcut.Save()"

echo PureForm preview will now start automatically when you sign in to Windows.
echo.
echo It will open http://127.0.0.1:8000/ in your browser.
pause
