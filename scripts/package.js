/**
 * Script to package the browser extension for Chrome Web Store submission
 * This runs after webpack build and obfuscation
 */
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const chalk = require('chalk');
const { execSync } = require('child_process');

// Configuration
const DIST_DIR = path.resolve(__dirname, '../dist');
const PACKAGES_DIR = path.resolve(__dirname, '../packages');
const MANIFEST_PATH = path.join(DIST_DIR, 'manifest.json');

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
    const packagePath = createZipPackage();
    
    console.log(chalk.green(`\n✅ Extension packaged successfully and ready for submission!`));
    console.log(chalk.green(`📦 Package location: ${packagePath}`));
    
  } catch (error) {
    console.error(chalk.red('❌ Packaging failed:'), error);
    process.exit(1);
  }
}

main();
