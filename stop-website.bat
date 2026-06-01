@echo off
setlocal

for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:"127.0.0.1:8000 .*LISTENING"') do (
  echo Stopping PureForm preview server on port 8000...
  taskkill /PID %%P /F >nul 2>nul
)

echo Done.
pause
