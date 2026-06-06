@echo off
chcp 65001 >nul
title Tournament Stream - Launcher

echo.
echo ====================================================
echo     TOURNAMENT STREAM  -  AUTO SETUP + START
echo ====================================================
echo.

:: --------------------------------------------------
:: 1. Check / Install Node.js
:: --------------------------------------------------
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [1/3] Node.js not found. Installing...
    echo.

    rem Try winget first (built-in on Windows 10 1709+ and Windows 11)
    where winget >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo       Using winget...
        winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
        call :refresh_path
    ) else (
        rem Fallback: download MSI directly from nodejs.org
        echo       winget not found. Downloading Node.js installer...
        echo       Please wait - this may take a minute...
        powershell -Command "$url='https://nodejs.org/dist/v22.14.0/node-v22.14.0-x64.msi'; Invoke-WebRequest -Uri $url -OutFile '%TEMP%\node_setup.msi' -UseBasicParsing"
        if %ERRORLEVEL% NEQ 0 (
            echo.
            echo [ERROR] Download failed. Please check your internet connection.
            echo         Download Node.js manually from: https://nodejs.org/en/download
            echo         Then re-run this script.
            pause
            exit /b 1
        )
        echo       Running installer silently...
        msiexec /i "%TEMP%\node_setup.msi" /qn /norestart ADDLOCAL=ALL
        call :refresh_path
        del /q "%TEMP%\node_setup.msi" >nul 2>&1
    )

    rem Verify installation succeeded
    where node >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo [ERROR] Node.js could not be installed automatically.
        echo         Please install manually: https://nodejs.org/en/download
        echo         Then re-run this script.
        pause
        exit /b 1
    )
    echo [OK] Node.js installed successfully!
) else (
    for /f "tokens=*" %%v in ('node -v 2^>nul') do set "NODE_VER=%%v"
    echo [1/3] Node.js already installed  ^(%NODE_VER%^)  [OK]
)
echo.

:: --------------------------------------------------
:: 2. Install npm dependencies (skip if node_modules exists)
:: --------------------------------------------------
if not exist "node_modules\" (
    echo [2/3] Installing dependencies ^(npm install^)...
    call npm install --loglevel=error
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo [ERROR] npm install failed. Check your internet connection.
        pause
        exit /b 1
    )
    echo [OK] Dependencies installed!
) else (
    echo [2/3] Dependencies already installed  [OK]
)
echo.

:: --------------------------------------------------
:: 3. Launch the server
:: --------------------------------------------------
echo [3/3] Starting server...
echo.
echo  Press Ctrl+C to stop.
echo ====================================================
echo.

set PORT=3456
node server.js

:: If node exits (crash or Ctrl+C), pause so user can read the output
echo.
echo Server stopped. Press any key to exit.
pause >nul
exit /b 0


:: --------------------------------------------------
:: Helper subroutine: reload PATH from registry
:: (so node is visible immediately after install
::  without restarting the terminal)
:: --------------------------------------------------
:refresh_path
for /f "tokens=2*" %%a in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul') do set "SYS_PATH=%%b"
for /f "tokens=2*" %%a in ('reg query "HKCU\Environment" /v Path 2^>nul') do set "USR_PATH=%%b"
if defined USR_PATH (
    set "PATH=%SYS_PATH%;%USR_PATH%"
) else (
    set "PATH=%SYS_PATH%"
)
exit /b 0
