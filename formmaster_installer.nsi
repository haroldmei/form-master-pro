; FormMaster Compact Installer
Unicode true

!define APPNAME "FormMaster"
!define VERSION "0.1.27"
!define PUBLISHER "FormMaster Team"
!define WEBSITE "https://your-website.com"
!define SUPPORT_EMAIL "support@your-website.com"
!define PYTHON_VERSION "3.11.4"
!define PYTHON_INSTALLER "python-${PYTHON_VERSION}-amd64.exe"

Name "${APPNAME} ${VERSION}"
OutFile "dist\FormMaster-Setup.exe"
InstallDir "$PROGRAMFILES64\FormMaster"
RequestExecutionLevel admin

; Set application icon for the installer
Icon "FormMaster.ico"

!include "MUI2.nsh"
!include "LogicLib.nsh"

; Function to escape backslashes for registry
Function EscapeBackslashes
  Exch $0 ; input string
  Push $1 ; position
  Push $2 ; character
  Push $3 ; output string
  
  StrCpy $1 0
  StrCpy $3 ""
  
  loop:
    StrCpy $2 $0 1 $1
    StrCmp $2 "" done
    StrCmp $2 "\" replace_backslash
    Goto append_char
    
  replace_backslash:
    StrCpy $3 "$3\\"
    Goto next
    
  append_char:
    StrCpy $3 "$3$2"
    
  next:
    IntOp $1 $1 + 1
    Goto loop
    
  done:
    StrCpy $0 $3
    
    Pop $3
    Pop $2
    Pop $1
    Exch $0
FunctionEnd

; Modern UI settings
!define MUI_ICON "FormMaster.ico"
!define MUI_UNICON "FormMaster.ico"

; Pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "LICENSE"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

Section "Install"
    SetOutPath "$TEMP"
    
    ; Check if Google Chrome is installed
    DetailPrint "Checking for Google Chrome installation..."
    ReadRegStr $0 HKLM "SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe" ""
    ReadRegStr $1 HKCU "SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe" ""
    
    ${If} $0 == ""
    ${AndIf} $1 == ""
        DetailPrint "Google Chrome not found. Installing Chrome..."
        SetOutPath "$TEMP"
        File /oname=$TEMP\ChromeSetup.exe "build\ChromeSetup.exe"
        DetailPrint "Running Chrome installer..."
        ExecWait '"$TEMP\ChromeSetup.exe" /silent /install' $0
        Delete "$TEMP\ChromeSetup.exe"
        
        ${If} $0 != 0
            MessageBox MB_ICONEXCLAMATION|MB_OK "Chrome installation may not have completed successfully. FormMaster requires Chrome to operate correctly."
        ${EndIf}
    ${Else}
        DetailPrint "Google Chrome is already installed."
    ${EndIf}
    
    ; Check if Python is installed
    DetailPrint "Checking for Python installation..."
    ReadRegStr $0 HKLM "Software\Python\PythonCore\3.11\InstallPath" ""
    ReadRegStr $1 HKCU "Software\Python\PythonCore\3.11\InstallPath" ""
    
    ; Initialize Python path variable
    StrCpy $9 ""
    
    ${If} $0 != ""
        DetailPrint "Python 3.11 is already installed in system registry."
        StrCpy $9 "$0python.exe"
    ${ElseIf} $1 != ""
        DetailPrint "Python 3.11 is already installed in user registry."
        StrCpy $9 "$1python.exe"
    ${Else}
        DetailPrint "Installing Python ${PYTHON_VERSION}..."
        ; Include Python installer in the package
        File /oname=$TEMP\${PYTHON_INSTALLER} "build\${PYTHON_INSTALLER}"
        
        ; Install Python
        DetailPrint "Running Python installer..."
        ExecWait '"$TEMP\${PYTHON_INSTALLER}" /quiet InstallAllUsers=1 PrependPath=1 Include_test=0' $0
        Delete "$TEMP\${PYTHON_INSTALLER}"
        
        ${If} $0 != 0
            MessageBox MB_OK|MB_ICONEXCLAMATION "Python installation failed. Please install Python 3.11 manually."
            Abort
        ${EndIf}
        
        ; Get the Python path after installation
        ReadRegStr $0 HKLM "Software\Python\PythonCore\3.11\InstallPath" ""
        ${If} $0 != ""
            StrCpy $9 "$0python.exe"
        ${Else}
            ; If we still can't find it, try alternate method
            nsExec::ExecToStack 'where python'
            Pop $0
            Pop $1
            ${If} $0 == 0
                ; Extract the first line
                StrCpy $2 0
                ${Do}
                    StrCpy $3 $1 1 $2
                    ${If} $3 == "$\r"
                    ${OrIf} $3 == "$\n"
                    ${OrIf} $3 == ""
                        ${Break}
                    ${EndIf}
                    IntOp $2 $2 + 1
                ${Loop}
                StrCpy $9 $1 $2 ; First line only
            ${Else}
                ; Fallback to default Python path
                StrCpy $9 "python.exe"
            ${EndIf}
        ${EndIf}
    ${EndIf}
    
    DetailPrint "Using Python executable: $9"
    
    ; Get and prepare Python path with escaped backslashes for registry
    StrCpy $R9 $9 ; Copy original Python path to R9
    Push $R9     ; Prepare for EscapeBackslashes function
    Call EscapeBackslashes
    Pop $R9      ; R9 now has backslashes escaped
    
    DetailPrint "Python executable for registry: $R9"
    
    ; Create installation directory
    SetOutPath "$INSTDIR"
    File "LICENSE"
    File "README.md"
    
    ; Create packages directory and copy Python package files
    CreateDirectory "$INSTDIR\packages"
    SetOutPath "$INSTDIR\packages"
    File /r "build\packages\*.*"
    
    ; Create drivers directory in user profile and copy drivers
    DetailPrint "Setting up drivers in user profile..."
    ; Get user profile directory
    System::Call 'kernel32::GetEnvironmentVariable(t "USERPROFILE", t .r1, i ${NSIS_MAX_STRLEN})'
    ; Create the .formmaster directory in user profile
    CreateDirectory "$1\.formmaster"
    SetOutPath "$1\.formmaster"
    File /r "build\drivers\*.*"
    
    ; Install formmaster from local packages
    DetailPrint "Installing FormMaster package from local files..."
    SetOutPath "$INSTDIR"
    
    ; First install pip, setuptools and wheel from local files
    DetailPrint "Installing base packages..."
    nsExec::ExecToStack '"$9" -m pip install --no-index --find-links="$INSTDIR\packages" pip setuptools wheel'
    Pop $0
    Pop $1
    DetailPrint "Base package install output: $1"
    
    ; Install all required packages from local files
    DetailPrint "Installing required packages from local files..."
    nsExec::ExecToStack '"$9" -m pip install --no-index --find-links="$INSTDIR\packages" -r "src\requirements.txt"'
    Pop $0
    Pop $1
    DetailPrint "Requirements install output: $1"
    
    ; Install formmaster from local wheel or source
    FindFirst $2 $3 "$INSTDIR\packages\formmaster-*.whl"
    ${If} $2 != ""
        DetailPrint "Installing formmaster from local wheel: $3"
        nsExec::ExecToStack '"$9" -m pip install --no-deps --no-index --find-links="$INSTDIR\packages" "$INSTDIR\packages\$3"'
        Pop $0
        Pop $1
        DetailPrint "Wheel installation result: $0 - $1"
        FindClose $2
    ${Else}
        FindClose $2
        DetailPrint "No wheel found. Installing from source..."
        ; Create a temporary directory with just setup.py and the src directory
        CreateDirectory "$TEMP\formmaster-install"
        CopyFiles "$INSTDIR\setup.py" "$TEMP\formmaster-install"
        CreateDirectory "$TEMP\formmaster-install\src"
        CopyFiles /SILENT "$INSTDIR\src\*.*" "$TEMP\formmaster-install\src"
        
        ; Install from the temporary directory
        SetOutPath "$TEMP\formmaster-install"
        nsExec::ExecToStack '"$9" -m pip install -e .'
        Pop $0
        Pop $1
        DetailPrint "Source installation result: $0 - $1"
    ${EndIf}
    
    ; Verify installation 
    DetailPrint "Verifying formmaster installation..."
    nsExec::ExecToStack '"$9" -c "import formmaster; print(\"Formmaster successfully imported\")"'
    Pop $0
    Pop $1
    DetailPrint "Formmaster import check: $0 - $1"
    
    ; If import fails, try to install using pip directly from PyPI as a fallback
    ${If} $0 != 0
        DetailPrint "WARNING: Formmaster not installed correctly. Trying direct install..."
        nsExec::ExecToStack '"$9" -m pip install formmaster'
        Pop $0
        Pop $1
        DetailPrint "Direct install result: $0 - $1"
        
        ; Check again
        nsExec::ExecToStack '"$9" -c "import formmaster; print(\"Formmaster successfully imported\")"'
        Pop $0
        Pop $1
        DetailPrint "Formmaster import check (second attempt): $0 - $1"
    ${EndIf}
    
    ; Configure environment for drivers
    DetailPrint "Configuring drivers path..."
    ${If} ${FileExists} "$1\.formmaster\chromedriver\chromedriver.exe"
        System::Call 'Kernel32::SetEnvironmentVariableA(t, t) i("PATH", "$1\.formmaster\chromedriver;$PATH").r0'
        ReadEnvStr $R0 "PATH"
        WriteRegExpandStr HKLM "SYSTEM\CurrentControlSet\Control\Session Manager\Environment" "PATH" "$1\.formmaster\chromedriver;$R0"
    ${EndIf}
    
    ; Create context menu entries
    DetailPrint "Creating context menu entries..."
    SetOutPath "$INSTDIR"
    
    ; Create context.reg
    FileOpen $0 "$INSTDIR\context.reg" w
    FileWrite $0 "Windows Registry Editor Version 5.00$\r$\n$\r$\n"
    
    ; USydney entries
    FileWrite $0 "[HKEY_CLASSES_ROOT\Directory\Background\shell\USydney]$\r$\n"
    FileWrite $0 '@="Sydney University"$\r$\n$\r$\n'
    
    FileWrite $0 "[HKEY_CLASSES_ROOT\Directory\Background\shell\USydney\command]$\r$\n"
    FileWrite $0 '@="\"$R9\" -m formfiller --uni=usyd --dir=\"%V\""$\r$\n$\r$\n'
    
    FileWrite $0 "[HKEY_CLASSES_ROOT\Directory\shell\USydney]$\r$\n"
    FileWrite $0 '@="Sydney University"$\r$\n$\r$\n'
    
    FileWrite $0 "[HKEY_CLASSES_ROOT\Directory\shell\USydney\command]$\r$\n"
    FileWrite $0 '@="\"$R9\" -m formfiller --uni=usyd --dir=\"%1\""$\r$\n$\r$\n'
    
    ; UNSW entries
    FileWrite $0 "[HKEY_CLASSES_ROOT\Directory\Background\shell\UNSW]$\r$\n"
    FileWrite $0 '@="New South Wales University"$\r$\n$\r$\n'
    
    FileWrite $0 "[HKEY_CLASSES_ROOT\Directory\Background\shell\UNSW\command]$\r$\n"
    FileWrite $0 '@="\"$R9\" -m formfiller --uni=unsw --dir=\"%V\""$\r$\n$\r$\n'
    
    FileWrite $0 "[HKEY_CLASSES_ROOT\Directory\shell\UNSW]$\r$\n"
    FileWrite $0 '@="New South Wales University"$\r$\n$\r$\n'
    
    FileWrite $0 "[HKEY_CLASSES_ROOT\Directory\shell\UNSW\command]$\r$\n"
    FileWrite $0 '@="\"$R9\" -m formfiller --uni=unsw --dir=\"%1\""$\r$\n'
    
    FileClose $0
    
    ; Import the registry file
    DetailPrint "Importing registry entries..."
    ExecWait 'regedit /s "$INSTDIR\context.reg"'
    
    ; Create shortcuts with absolute Python path
    CreateDirectory "$SMPROGRAMS\FormMaster"
    CreateShortcut "$SMPROGRAMS\FormMaster\FormMaster.lnk" "cmd.exe" '/k "$9" -m formfiller' "$INSTDIR\FormMaster.ico"
    CreateShortcut "$SMPROGRAMS\FormMaster\Uninstall.lnk" "$INSTDIR\uninstall.exe"
    CreateShortcut "$DESKTOP\FormMaster.lnk" "cmd.exe" '/k "$9" -m formfiller' "$INSTDIR\FormMaster.ico"
    
    ; Install the icon file
    File "FormMaster.ico"
    
    ; Create uninstaller
    WriteUninstaller "$INSTDIR\uninstall.exe"
    
    ; Add uninstall information to Add/Remove Programs
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\FormMaster" "DisplayName" "FormMaster"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\FormMaster" "UninstallString" '"$INSTDIR\uninstall.exe"'
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\FormMaster" "DisplayVersion" "${VERSION}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\FormMaster" "Publisher" "${PUBLISHER}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\FormMaster" "URLInfoAbout" "${WEBSITE}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\FormMaster" "HelpLink" "${WEBSITE}/support"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\FormMaster" "DisplayIcon" "$INSTDIR\FormMaster.ico"
SectionEnd

Section "Uninstall"
    ; Remove registry entries
    DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\FormMaster"
    DeleteRegKey HKCR "Directory\Background\shell\USydney"
    DeleteRegKey HKCR "Directory\shell\USydney"
    DeleteRegKey HKCR "Directory\Background\shell\UNSW"
    DeleteRegKey HKCR "Directory\shell\UNSW"
    
    ; Uninstall the Python package
    DetailPrint "Uninstalling FormMaster package..."
    nsExec::ExecToStack 'python -m pip uninstall -y formmaster'
    
    ; Remove drivers from user profile
    System::Call 'kernel32::GetEnvironmentVariable(t "USERPROFILE", t .r1, i ${NSIS_MAX_STRLEN})'
    DetailPrint "Removing drivers from $1\.formmaster"
    RMDir /r "$1\.formmaster"
    
    ; Remove program files
    Delete "$INSTDIR\uninstall.exe"
    Delete "$INSTDIR\LICENSE"
    Delete "$INSTDIR\README.md"
    Delete "$INSTDIR\context.reg"
    RMDir /r "$INSTDIR\packages"
    
    ; Remove start menu shortcuts
    Delete "$SMPROGRAMS\FormMaster\FormMaster.lnk"
    Delete "$SMPROGRAMS\FormMaster\Uninstall.lnk"
    RMDir "$SMPROGRAMS\FormMaster"
    Delete "$DESKTOP\FormMaster.lnk"
    
    ; Remove installation directory if empty
    RMDir "$INSTDIR"
SectionEnd
