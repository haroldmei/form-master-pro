const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const packageJson = require('../package.json');

// Create optimized zip file for the extension
function packageExtension() {
  console.log('Creating optimized extension package...');
  
  const distPath = path.resolve(__dirname, '../dist');
  const outputZip = new AdmZip();
  
  // Get version from package.json
  const version = packageJson.version;
  const zipFileName = `form-master-pro-v${version}.zip`;
  const outputPath = path.resolve(__dirname, '../packages', zipFileName);
  
  // Ensure packages directory exists
  const packagesDir = path.resolve(__dirname, '../packages');
  if (!fs.existsSync(packagesDir)) {
    fs.mkdirSync(packagesDir, { recursive: true });
  }
  
  // Copy LICENSE file to dist directory
  const licensePath = path.resolve(__dirname, '../LICENSE');
  if (fs.existsSync(licensePath)) {
    const licenseDestPath = path.resolve(distPath, 'LICENSE');
    fs.copyFileSync(licensePath, licenseDestPath);
    console.log('LICENSE file copied to distribution directory');
  } else {
    console.warn('LICENSE file not found in project root');
  }
  
  // Recursively add files to the zip with maximum compression
  function addFilesToZip(directory, zipFolder = '') {
    const files = fs.readdirSync(directory, { withFileTypes: true });
    
    for (const file of files) {
      const filePath = path.join(directory, file.name);
      const zipPath = path.join(zipFolder, file.name);
      
      if (file.isDirectory()) {
        addFilesToZip(filePath, zipPath);
      } else {
        // Add file to zip with maximum compression
        outputZip.addLocalFile(filePath, zipFolder);
      }
    }
  }
  
  // Add all files from dist directory
  addFilesToZip(distPath);
  
  // Write the zip file with maximum compression
  outputZip.writeZip(outputPath);
  
  // Display file size information
  const stats = fs.statSync(outputPath);
  const fileSizeInBytes = stats.size;
  const fileSizeInMegabytes = fileSizeInBytes / (1024 * 1024);
  console.log(`Package created: ${zipFileName}`);
  console.log(`Size: ${fileSizeInBytes.toLocaleString()} bytes (${fileSizeInMegabytes.toFixed(2)} MB)`);
}

// Execute the packaging process
packageExtension();
