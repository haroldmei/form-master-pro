; FormMaster Pro Extension Installer
; NSIS Script for creating a Windows installer

; Include Modern UI
!include "MUI2.nsh"
!include "FileFunc.nsh"
!include "LogicLib.nsh"
!include "InstallOptions.nsh" ; Include InstallOptions

; General Configuration
!define PRODUCT_NAME "FormMaster Pro"
; Version is now expected to be defined via command line: /DPRODUCT_VERSION=x.x.x
!ifndef PRODUCT_VERSION
  !define PRODUCT_VERSION "0.1.0"  ; Fallback version if not provided
!endif
!define PRODUCT_PUBLISHER "FormMaster Team"
!define PRODUCT_WEB_SITE "https://formmaster.pro"
!define PRODUCT_DIR_REGKEY "Software\Microsoft\Windows\CurrentVersion\App Paths\FormMaster-Pro"
!define PRODUCT_UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}"
!define PRODUCT_UNINST_ROOT_KEY "HKLM"

; Extension ID (Update this with your Chrome extension ID)
!define EXTENSION_ID "formmaster-pro-extension"

; Modern UI Configuration
!define MUI_ABORTWARNING
!define MUI_ICON "${NSISDIR}\Contrib\Graphics\Icons\modern-install.ico"
!define MUI_UNICON "${NSISDIR}\Contrib\Graphics\Icons\modern-uninstall.ico"
!define MUI_WELCOMEFINISHPAGE_BITMAP "${NSISDIR}\Contrib\Graphics\Wizard\win.bmp"
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_BITMAP "${NSISDIR}\Contrib\Graphics\Header\win.bmp"

; Define license file paths
!define LICENSE_FILE "..\installer\LICENSE"
!define LICENSE_FILE_DEFAULT "${NSISDIR}\Docs\Modern UI\License.txt"

; Pages
!insertmacro MUI_PAGE_WELCOME
; License page without pre-function
!insertmacro MUI_PAGE_LICENSE "${LICENSE_FILE}"  ; Use installer LICENSE directly
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; Languages
!insertmacro MUI_LANGUAGE "English"

; Installer Information
Name "${PRODUCT_NAME} ${PRODUCT_VERSION}"
OutFile "..\FormMaster-Setup.exe"
InstallDir "$PROGRAMFILES\FormMaster Pro"
InstallDirRegKey HKLM "${PRODUCT_DIR_REGKEY}" ""
ShowInstDetails show
ShowUnInstDetails show

Section "MainSection" SEC01
  SetOutPath "$INSTDIR"
  SetOverwrite ifnewer
  
  ; Create program directories
  CreateDirectory "$INSTDIR\extension"
  
  ; Copy the CRX package directly (no need to extract)
  File /oname=extension.crx "..\packages\form-master-pro.crx"
  
  ; Also copy the extension to the extension directory for registry path
  CopyFiles "$INSTDIR\extension.crx" "$INSTDIR\extension\extension.crx"
  
  ; Create chrome_extension.reg file
  FileOpen $0 "$INSTDIR\chrome_extension.reg" w
  FileWrite $0 'Windows Registry Editor Version 5.00$\r$\n$\r$\n'
  FileWrite $0 '[HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist]$\r$\n'
  FileWrite $0 '"1"="${EXTENSION_ID};file:///$INSTDIR\extension\extension.crx"$\r$\n'
  FileClose $0
  
  ; Create edge_extension.reg file for Microsoft Edge
  FileOpen $0 "$INSTDIR\edge_extension.reg" w
  FileWrite $0 'Windows Registry Editor Version 5.00$\r$\n$\r$\n'
  FileWrite $0 '[HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Edge\ExtensionInstallForcelist]$\r$\n'
  FileWrite $0 '"1"="${EXTENSION_ID};file:///$INSTDIR\extension\extension.crx"$\r$\n'
  FileClose $0
  
  ; Create batch file for installation
  FileOpen $0 "$INSTDIR\install_extension.bat" w
  FileWrite $0 '@echo off$\r$\n'
  FileWrite $0 'echo Installing FormMaster Pro Browser Extension...$\r$\n'
  FileWrite $0 'echo.$\r$\n'
  FileWrite $0 'echo 1. Installing for Google Chrome...$\r$\n'
  FileWrite $0 'regedit /s "%~dp0chrome_extension.reg"$\r$\n'
  FileWrite $0 'echo 2. Installing for Microsoft Edge...$\r$\n'
  FileWrite $0 'regedit /s "%~dp0edge_extension.reg"$\r$\n'
  FileWrite $0 'echo.$\r$\n'
  FileWrite $0 'echo Installation completed. Please restart your browsers.$\r$\n'
  FileWrite $0 'echo If extension does not appear, please enable it in the extensions page.$\r$\n'
  FileWrite $0 'echo   - Chrome: chrome://extensions$\r$\n'
  FileWrite $0 'echo   - Edge: edge://extensions$\r$\n'
  FileWrite $0 'pause$\r$\n'
  FileClose $0
  
  ; Create uninstall batch file
  FileOpen $0 "$INSTDIR\uninstall_extension.bat" w
  FileWrite $0 '@echo off$\r$\n'
  FileWrite $0 'echo Uninstalling FormMaster Pro Browser Extension...$\r$\n'
  FileWrite $0 'echo 1. Removing from Google Chrome...$\r$\n'
  FileWrite $0 'reg delete "HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist" /v 1 /f$\r$\n'
  FileWrite $0 'echo 2. Removing from Microsoft Edge...$\r$\n'
  FileWrite $0 'reg delete "HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Edge\ExtensionInstallForcelist" /v 1 /f$\r$\n'
  FileWrite $0 'echo.$\r$\n'
  FileWrite $0 'echo Uninstallation completed. Please restart your browsers.$\r$\n'
  FileWrite $0 'pause$\r$\n'
  FileClose $0
  
  ; Create shortcuts
  CreateDirectory "$SMPROGRAMS\FormMaster Pro"
  CreateShortCut "$SMPROGRAMS\FormMaster Pro\FormMaster Pro.lnk" "$INSTDIR\install_extension.bat" "" "$INSTDIR\extension\extension.crx" 0
  CreateShortCut "$SMPROGRAMS\FormMaster Pro\Uninstall.lnk" "$INSTDIR\uninst.exe"
  CreateShortCut "$DESKTOP\FormMaster Pro.lnk" "$INSTDIR\install_extension.bat" "" "$INSTDIR\extension\extension.crx" 0
  
  ; Run the install batch file (optional - uncomment if you want installer to run it automatically)
  ; ExecWait '"$INSTDIR\install_extension.bat"'
  
  ; Create uninstaller
  WriteUninstaller "$INSTDIR\uninst.exe"
  
  ; Set registry keys for uninstall
  WriteRegStr HKLM "${PRODUCT_DIR_REGKEY}" "" "$INSTDIR\install_extension.bat"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayName" "$(^Name)"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "UninstallString" "$INSTDIR\uninst.exe"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayIcon" "$INSTDIR\extension\extension.crx"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayVersion" "${PRODUCT_VERSION}"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "URLInfoAbout" "${PRODUCT_WEB_SITE}"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "Publisher" "${PRODUCT_PUBLISHER}"
  
  ; Calculate and add size information
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "EstimatedSize" "$0"
SectionEnd

Section Uninstall
  ; Run uninstall batch file first
  ExecWait '"$INSTDIR\uninstall_extension.bat"'
  
  ; Delete installed files
  Delete "$INSTDIR\uninst.exe"
  Delete "$INSTDIR\install_extension.bat"
  Delete "$INSTDIR\uninstall_extension.bat"
  Delete "$INSTDIR\chrome_extension.reg"
  Delete "$INSTDIR\edge_extension.reg"
  Delete "$INSTDIR\extension.crx"
  
  ; Remove extension directory recursively
  RMDir /r "$INSTDIR\extension"
  
  ; Remove shortcuts and directories
  Delete "$SMPROGRAMS\FormMaster Pro\FormMaster Pro.lnk"
  Delete "$SMPROGRAMS\FormMaster Pro\Uninstall.lnk"
  RMDir "$SMPROGRAMS\FormMaster Pro"
  Delete "$DESKTOP\FormMaster Pro.lnk"
  RMDir "$INSTDIR"
  
  ; Remove registry keys
  DeleteRegKey ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}"
  DeleteRegKey HKLM "${PRODUCT_DIR_REGKEY}"
SectionEnd

Function .onInit
  ; Check for admin rights
  UserInfo::GetAccountType
  Pop $0
  ${If} $0 != "admin"
    MessageBox MB_ICONSTOP "Administrator rights required to install FormMaster Pro.$\r$\nPlease run the setup as administrator."
    Abort
  ${EndIf}
  
  ; Initialize default installation directory
  ${If} ${RunningX64} == 1
    StrCpy $INSTDIR "$PROGRAMFILES64\FormMaster Pro"
  ${Else}
    StrCpy $INSTDIR "$PROGRAMFILES\FormMaster Pro"
  ${EndIf}
FunctionEnd

Function un.onUninstSuccess
  HideWindow
  MessageBox MB_ICONINFORMATION|MB_OK "$(^Name) was successfully removed from your computer."
FunctionEnd

Function un.onInit
  MessageBox MB_ICONQUESTION|MB_YESNO|MB_DEFBUTTON2 "Are you sure you want to completely remove $(^Name) and all of its components?" IDYES +2
  Abort
FunctionEnd
