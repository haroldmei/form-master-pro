# FormMasterPro Installer

This directory contains the NSIS script files used to build the Windows installer for FormMasterPro.

## Prerequisites

To build the installer, you need:

1. NSIS (Nullsoft Scriptable Install System) - [Download here](https://nsis.sourceforge.io/Download)
2. nsisunz plugin (included in NSIS)

## Building the Installer

1. First build the extension package:
   ```
   npm run package
   ```

2. Then build the installer:
   ```
   npm run build:installer
   ```

This will create `FormMaster-Setup.exe` in the root directory.

## How the Installer Works

The installer performs the following actions:

1. Extracts the extension files to `%ProgramFiles%\FormMasterPro\extension`
2. Creates a registry entry that tells Chrome to load the extension from this location
3. Creates batch files for installing/uninstalling the registry modifications
4. Creates shortcuts in the Start Menu and Desktop

## Manual Installation

If the automatic installation doesn't work:

1. Open the installation directory (default: `%ProgramFiles%\FormMasterPro`)
2. Run `install_extension.bat` as administrator
3. Restart Chrome

## Troubleshooting

- The extension requires administrative privileges to install because it modifies registry entries
- Some antivirus software may flag the installer due to the registry modifications
- Make sure Chrome's policies allow loading extensions from local files
