@echo off
setlocal

set "STARTUP_LINK=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\PureForm Website Preview.lnk"

if exist "%STARTUP_LINK%" (
  del "%STARTUP_LINK%"
  echo Removed PureForm preview from Windows startup.
) else (
  echo PureForm preview was not in Windows startup.
)

pause
