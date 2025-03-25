/**
 * Script to build the Windows installer using NSIS
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const chalk = require('chalk');

// Configuration
const INSTALLER_DIR = path.resolve(__dirname, '../installer');
const INSTALLER_SCRIPT = path.join(INSTALLER_DIR, 'setup.nsi');
const PACKAGE_JSON = path.resolve(__dirname, '../package.json');
const OUTPUT_FILE = path.resolve(__dirname, '../FormMaster-Setup.exe');

// Get version from package.json
function getVersion() {
  try {
    const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));
    return packageJson.version;
  } catch (error) {
    console.error(chalk.red('❌ Error reading package.json:'), error);
    return '0.1.0'; // Default version
  }
}

// Check if the latest package exists
function checkExtensionPackage() {
  const packageDir = path.resolve(__dirname, '../packages');
  if (!fs.existsSync(packageDir)) {
    console.error(chalk.red('❌ Package directory not found. Run package script first.'));
    process.exit(1);
  }
  
  // Look for the latest zip package
  const files = fs.readdirSync(packageDir)
    .filter(file => file.endsWith('.zip'))
    .sort();
  
  if (files.length === 0) {
    console.error(chalk.red('❌ No extension package found. Run package script first.'));
    process.exit(1);
  }
  
  // Get the latest package
  const latestPackage = path.join(packageDir, files[files.length - 1]);
  
  // Create a copy with standard name for the installer
  const standardPackageName = path.join(packageDir, 'form-master-pro.zip');
  fs.copyFileSync(latestPackage, standardPackageName);
  
  return standardPackageName;
}

// Find NSIS executable
function findNSIS() {
  try {
    // Try common installation paths
    let nsisPath = '';
    const possiblePaths = [
      'C:\\Program Files\\NSIS\\makensis.exe',
      'C:\\Program Files (x86)\\NSIS\\makensis.exe'
    ];
    
    for (const path of possiblePaths) {
      if (fs.existsSync(path)) {
        nsisPath = path;
        break;
      }
    }
    
    // If not found in common paths, try in PATH
    if (!nsisPath) {
      try {
        execSync('makensis -version');
        nsisPath = 'makensis';
      } catch (error) {
        console.error(chalk.red('❌ NSIS not found in PATH.'));
        console.error(chalk.yellow('Please install NSIS from: https://nsis.sourceforge.io/Download'));
        process.exit(1);
      }
    }
    
    return nsisPath;
  } catch (error) {
    console.error(chalk.red('❌ Error finding NSIS:'), error);
    console.error(chalk.yellow('Please install NSIS from: https://nsis.sourceforge.io/Download'));
    process.exit(1);
  }
}

// Check if LICENSE file exists, generate if not
function checkLicenseFile() {
  const rootLicensePath = path.resolve(__dirname, '../LICENSE');
  const installerLicensePath = path.resolve(__dirname, '../installer/LICENSE');
  
  // If neither license file exists, notify user
  if (!fs.existsSync(rootLicensePath) && !fs.existsSync(installerLicensePath)) {
    console.log(chalk.yellow('⚠️ No LICENSE file found at project root or installer directory.'));
    console.log(chalk.blue('ℹ️ Using the installer-specific LICENSE file.'));
  } else if (fs.existsSync(rootLicensePath)) {
    console.log(chalk.blue(`📄 Using LICENSE file from project root.`));
  } else {
    console.log(chalk.blue(`📄 Using LICENSE file from installer directory.`));
  }
}

// Main execution
async function main() {
  try {
    console.log(chalk.green('🚀 Starting installer build process...'));
    
    // Check for NSIS
    const nsisPath = findNSIS();
    console.log(chalk.blue(`📦 Found NSIS: ${nsisPath}`));
    
    // Check for extension package
    const packagePath = checkExtensionPackage();
    console.log(chalk.blue(`📦 Using extension package: ${packagePath}`));
    
    // Check license file
    checkLicenseFile();
    
    // Update version in the NSIS script
    const version = getVersion();
    console.log(chalk.blue(`📌 Using version: ${version}`));
    
    // Check if the installer script exists
    if (!fs.existsSync(INSTALLER_SCRIPT)) {
      console.error(chalk.red(`❌ Installer script not found: ${INSTALLER_SCRIPT}`));
      process.exit(1);
    }
    
    // Build the installer - Pass version as define
    console.log(chalk.blue('🔨 Building installer...'));
    execSync(`"${nsisPath}" /DPRODUCT_VERSION="${version}" "${INSTALLER_SCRIPT}"`, {
      stdio: 'inherit'
    });
    
    // Check if the installer was created
    if (fs.existsSync(OUTPUT_FILE)) {
      const stats = fs.statSync(OUTPUT_FILE);
      const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
      console.log(chalk.green(`✅ Installer created successfully: ${OUTPUT_FILE} (${fileSizeInMB} MB)`));
    } else {
      console.error(chalk.red('❌ Installer build failed. No output file created.'));
      process.exit(1);
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Installer build failed:'), error);
    process.exit(1);
  }
}

main();
