@echo off
setlocal

echo Checking for Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Python is not installed or not in your PATH.
    echo Please install Python 3.10+ from python.org and try again.
    pause
    exit /b 1
)

echo Building FCS_Renamer for Windows...

rem Check if virtual environment exists
if not exist "venv" (
    echo Creating virtual environment 'venv'...
    python -m venv venv
    if %errorlevel% neq 0 (
        echo Failed to create virtual environment.
        pause
        exit /b 1
    )
) else (
    echo Virtual environment 'venv' already exists.
)

rem Activate virtual environment
echo Activating virtual environment...
call venv\Scripts\activate.bat
if %errorlevel% neq 0 (
    echo Failed to activate virtual environment.
    pause
    exit /b 1
)

rem Upgrade pip
echo Upgrading pip...
python -m pip install --upgrade pip

rem Install dependencies
echo Installing dependencies from requirements.txt...
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo Failed to install dependencies.
    pause
    exit /b 1
)

rem Run PyInstaller
echo Running PyInstaller...
pyinstaller --noconfirm FCS_Renamer.spec
if %errorlevel% neq 0 (
    echo Build failed.
    pause
    exit /b 1
)

echo.
echo ========================================================
echo Build complete!
echo The executable is located in the 'dist' folder.
echo ========================================================
echo.
pause