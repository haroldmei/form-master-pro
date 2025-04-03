/**
 * Script to package the browser extension for Chrome Web Store submission
 * This runs after webpack build and obfuscation
 */
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const chalk = require('chalk');
const { execSync } = require('child_process');
const ChromeExtension = require('crx');
const crypto = require('crypto'); // Add crypto module

// Configuration
const DIST_DIR = path.resolve(__dirname, '../dist');
const PACKAGES_DIR = path.resolve(__dirname, '../packages');
const MANIFEST_PATH = path.join(DIST_DIR, 'manifest.json');
const KEY_PATH = path.resolve(__dirname, '../private.pem');

// Create output directory if it doesn't exist
if (!fs.existsSync(PACKAGES_DIR)) {
  fs.mkdirSync(PACKAGES_DIR, { recursive: true });
}

// Function to generate a unique build identifier
function generateBuildId() {
  const date = new Date();
  const timestamp = date.toISOString()
    .replace(/[-:]/g, '')
    .replace(/\..+/, '')
    .replace('T', '-');
  
  // Try to get git commit hash
  let gitHash = '';
  try {
    gitHash = execSync('git rev-parse --short HEAD').toString().trim();
  } catch (error) {
    console.log(chalk.yellow('⚠️ Git not available, skipping commit hash'));
  }

  return gitHash ? `${timestamp}-${gitHash}` : timestamp;
}

// Function to get version from manifest.json
function getExtensionVersion() {
  try {
    if (!fs.existsSync(MANIFEST_PATH)) {
      console.error(chalk.red('❌ Manifest file not found in dist directory'));
      return 'unknown';
    }
    
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    return manifest.version;
  } catch (error) {
    console.error(chalk.red('❌ Error reading manifest file:'), error);
    return 'unknown';
  }
}

// Function to create ZIP package
function createZipPackage() {
  const version = getExtensionVersion();
  const buildId = generateBuildId();
  const zipFileName = `form-master-pro-v${version}-${buildId}.zip`;
  const zipFilePath = path.join(PACKAGES_DIR, zipFileName);
  
  console.log(chalk.blue(`📦 Creating package: ${zipFileName}`));
  
  const zip = new AdmZip();
  
  // Add all files from dist directory
  const distFiles = getAllFiles(DIST_DIR);
  distFiles.forEach(file => {
    const relativePath = path.relative(DIST_DIR, file);
    console.log(chalk.gray(`  Adding: ${relativePath}`));
    zip.addLocalFile(file, path.dirname(relativePath));
  });
  
  // Write the zip file
  try {
    zip.writeZip(zipFilePath);
    console.log(chalk.green(`✅ Package created successfully: ${zipFilePath}`));
    
    // Get file size
    const stats = fs.statSync(zipFilePath);
    const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(chalk.blue(`   Package size: ${fileSizeInMB} MB`));
    
    return zipFilePath;
  } catch (error) {
    console.error(chalk.red('❌ Error creating zip file:'), error);
    throw error;
  }
}

// Helper function to get all files in a directory (recursive)
function getAllFiles(dir, arrayOfFiles = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    
    if (fs.statSync(filePath).isDirectory()) {
      arrayOfFiles = getAllFiles(filePath, arrayOfFiles);
    } else {
      arrayOfFiles.push(filePath);
    }
  });
  
  return arrayOfFiles;
}

// Function to get or create private key
async function getPrivateKey() {
  try {
    // Check if key already exists
    if (fs.existsSync(KEY_PATH)) {
      console.log(chalk.blue('🔑 Using existing private key'));
      return fs.readFileSync(KEY_PATH);
    }

    // Generate a new private key using Node.js crypto
    console.log(chalk.blue('🔑 Generating new private key'));
    
    const { privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });
    
    // Save the key for future use
    fs.writeFileSync(KEY_PATH, privateKey);
    console.log(chalk.blue(`🔑 Private key saved to ${KEY_PATH}`));
    return privateKey;
  } catch (error) {
    console.error(chalk.red('❌ Error managing private key:'), error);
    throw error;
  }
}

// Function to create CRX package
async function createCrxPackage() {
  try {
    const version = getExtensionVersion();
    const buildId = generateBuildId();
    const crxFileName = `form-master-pro-v${version}-${buildId}.crx`;
    const crxFilePath = path.join(PACKAGES_DIR, crxFileName);
    
    console.log(chalk.blue(`📦 Creating CRX package: ${crxFileName}`));
    
    // Get private key
    const privateKey = await getPrivateKey();
    
    // Create a new ChromeExtension instance
    const crx = new ChromeExtension({
      privateKey: privateKey,
      codebase: false // Don't add codebase URL for local installation
    });
    
    console.log(chalk.blue(`🔨 Loading extension from: ${DIST_DIR}`));
    await crx.load(DIST_DIR);
    
    console.log(chalk.blue('🔐 Signing extension...'));
    const buffer = await crx.pack();
    
    // Write the crx file
    fs.writeFileSync(crxFilePath, buffer);
    
    console.log(chalk.green(`✅ CRX package created successfully: ${crxFilePath}`));
    
    // Get file size
    const stats = fs.statSync(crxFilePath);
    const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(chalk.blue(`   Package size: ${fileSizeInMB} MB`));
    
    return crxFilePath;
  } catch (error) {
    console.error(chalk.red('❌ Error creating CRX file:'), error);
    throw error;
  }
}

// Main execution
async function main() {
  try {
    console.log(chalk.green('🚀 Starting packaging process...'));
    
    // Check if dist directory exists
    if (!fs.existsSync(DIST_DIR)) {
      console.error(chalk.red('❌ Dist directory not found. Run build first.'));
      process.exit(1);
    }
    
    // Create the ZIP package
    const zipPackagePath = createZipPackage();
    
    // Create the CRX package
    try {
      const crxPackagePath = await createCrxPackage();
      console.log(chalk.green(`\n✅ Extension packaged successfully in both ZIP and CRX formats!`));
      console.log(chalk.green(`📦 ZIP package: ${zipPackagePath}`));
      console.log(chalk.green(`📦 CRX package: ${crxPackagePath}`));
    } catch (error) {
      console.log(chalk.yellow(`⚠️ CRX packaging failed, but ZIP package was created successfully.`));
      console.log(chalk.green(`📦 ZIP package location: ${zipPackagePath}`));
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Packaging failed:'), error);
    process.exit(1);
  }
}

main();
