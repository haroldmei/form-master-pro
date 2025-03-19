@echo off
echo Building FormMaster Installer...

rem Create build directory if it doesn't exist
if not exist build mkdir build
if not exist build\packages mkdir build\packages

rem Find NSIS
set NSIS_PATH="C:\Program Files (x86)\NSIS\makensis.exe"
if not exist %NSIS_PATH% (
    set NSIS_PATH="C:\Program Files\NSIS\makensis.exe"
)

if not exist %NSIS_PATH% (
    echo ERROR: NSIS not found. Please install NSIS first.
    echo Download from: https://nsis.sourceforge.io/Download
    exit /b 1
)

rem Download Python installer if needed
set PYTHON_VERSION=3.11.4
set PYTHON_INSTALLER=python-%PYTHON_VERSION%-amd64.exe
if not exist "build\%PYTHON_INSTALLER%" (
    echo Downloading Python %PYTHON_VERSION% installer...
    powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/%PYTHON_VERSION%/%PYTHON_INSTALLER%' -OutFile 'build\%PYTHON_INSTALLER%'}"
    if %ERRORLEVEL% neq 0 (
        echo Failed to download Python installer.
        exit /b 1
    )
)

rem Download required Python packages
echo Downloading required Python packages...
python -m pip install --upgrade pip wheel

rem Read requirements from requirements.txt
echo Downloading packages from requirements.txt...
for /f "delims=" %%i in (src\requirements.txt) do (
    echo Downloading package: %%i
    python -m pip download --dest build\packages %%i
)

rem Download setuptools and pip
echo Downloading pip, setuptools and wheel...
python -m pip download --dest build\packages setuptools pip wheel

rem Build the Python package
echo Building Python package...
python -m pip install --upgrade build
python -m build
if %ERRORLEVEL% neq 0 (
    echo WARNING: Python package build failed. The installer will use local files or build from source.
) else (
    echo Python package build successful.
    copy dist\*.whl build\packages\
)

rem Make sure the icon file is copied to the build directory
copy FormMaster.ico dist\FormMaster.ico

rem Create installer using NSIS
echo Building installer with NSIS...
%NSIS_PATH% formmaster_installer.nsi
if %ERRORLEVEL% neq 0 (
    echo ERROR: Failed to build installer. Check NSIS output for details.
    exit /b 1
)

echo Installer created successfully!
echo Installer location: dist\FormMaster-Setup.exe

pause
