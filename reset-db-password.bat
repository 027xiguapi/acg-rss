@echo off
REM ============================================================
REM  One-off fix: reset local PostgreSQL 'postgres' password to
REM  'postgres' (matching .env) and create the torrent_hub DB.
REM  Just double-click it - it will ask for admin (UAC) itself.
REM ============================================================
net session >nul 2>&1
if errorlevel 1 (
  echo Requesting administrator privileges ...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
setlocal

set PGBIN=D:\Program Files\PostgreSQL\16\bin
set PGDATA=D:\Program Files\PostgreSQL\16\data
set PGHBA=%PGDATA%\pg_hba.conf

echo [1/8] Stopping service postgresql-x64-16 ...
net stop postgresql-x64-16

echo [2/8] Backing up pg_hba.conf ...
copy /Y "%PGHBA%" "%PGHBA%.bak" >nul

echo [3/8] Temporarily switching localhost auth to trust ...
powershell -NoProfile -Command "(Get-Content '%PGHBA%') -replace '(?m)^(host\s+all\s+all\s+127\.0\.0\.1/32\s+)scram-sha-256', '${1}trust' -replace '(?m)^(host\s+all\s+all\s+::1/128\s+)scram-sha-256', '${1}trust' | Set-Content '%PGHBA%'"

echo [4/8] Starting service ...
net start postgresql-x64-16
if errorlevel 1 goto :failed

echo [5/8] Resetting password for user 'postgres' ...
"%PGBIN%\psql" -w -U postgres -h localhost -d postgres -c "ALTER USER postgres WITH PASSWORD 'postgres';"
if errorlevel 1 goto :failed

echo [6/8] Creating database torrent_hub if missing ...
"%PGBIN%\psql" -w -U postgres -h localhost -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='torrent_hub'" | find "1" >nul
if errorlevel 1 "%PGBIN%\psql" -w -U postgres -h localhost -d postgres -c "CREATE DATABASE torrent_hub;"

echo [7/8] Restoring pg_hba.conf and restarting service ...
move /Y "%PGHBA%.bak" "%PGHBA%" >nul
net stop postgresql-x64-16
net start postgresql-x64-16
if errorlevel 1 goto :failed_norestart

echo [8/8] Verifying new password ...
set PGPASSWORD=postgres
"%PGBIN%\psql" -w -U postgres -h localhost -d postgres -tAc "SELECT 'auth-ok'"
if errorlevel 1 goto :verify_failed

echo.
echo SUCCESS: password for 'postgres' is now 'postgres'.
pause
exit /b 0

:failed
echo FAILED: see the psql/net error above. Restoring pg_hba.conf ...
move /Y "%PGHBA%.bak" "%PGHBA%" >nul
net stop postgresql-x64-16
net start postgresql-x64-16
pause
exit /b 1

:failed_norestart
echo WARNING: password reset OK but service restart failed.
echo Start it manually: net start postgresql-x64-16
pause
exit /b 1

:verify_failed
echo WARNING: password was reset but verification failed.
echo The postgres service may still be starting up - wait a few seconds and retry login.
pause
exit /b 1
