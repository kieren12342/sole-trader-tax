@echo off
echo Building Android App with Bubblewrap...

REM Check if bubblewrap is installed
where bubblewrap >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Installing Bubblewrap CLI...
    call npm install -g @bubblewrap/cli
)

REM Initialize project (only needed first time)
if not exist "twa-manifest.json" (
    echo Initializing Bubblewrap project...
    call bubblewrap init --manifest https://YOUR-USERNAME.github.io/sole-trader-tax/manifest.json
)

REM Build the Android app
echo Building Android package...
call bubblewrap build

echo Build complete! Check the app-release-signed.apk file
echo Upload this to Google Play Console
pause
