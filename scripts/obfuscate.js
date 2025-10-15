/**
 * Script to obfuscate the JavaScript files in the dist folder
 * to protect intellectual property from reverse engineering
 */
const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');
const chalk = require('chalk');

// Configuration
const DIST_DIR = path.resolve(__dirname, '../dist');
const EXCLUSIONS = ['libs']; // Folders to exclude from obfuscation

// Obfuscation options - balance between security and functionality
const obfuscationOptions = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.5,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.3,
  debugProtection: false, // Set to true for more protection, but might cause issues
  disableConsoleOutput: true,
  identifierNamesGenerator: 'hexadecimal',
  log: false,
  numbersToExpressions: true,
  renameGlobals: false,
  selfDefending: false,
  simplify: true,
  splitStrings: true,
  splitStringsChunkLength: 5,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.8,
  transformObjectKeys: true,
  unicodeEscapeSequence: false // Better false for unicode compatibility
};

// Process all JS files in a directory (recursive)
function obfuscateDirectory(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    
    // Skip excluded directories
    if (entry.isDirectory() && EXCLUSIONS.includes(entry.name)) {
      console.log(chalk.yellow(`⚠️ Skipping excluded directory: ${entry.name}`));
      continue;
    }
    
    if (entry.isDirectory()) {
      obfuscateDirectory(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      
      // Skip background.js to avoid service worker issues
      if (entry.name === 'background.js' || entry.name === 'auth.js' 
        || entry.name === 'userProfile.js' || entry.name === 'formProcessor.js'
        || entry.name === 'aiService.js' || entry.name === 'formFiller.js'
        || entry.name === 'utils.js' || entry.name === 'popup.js'
        || entry.name === 'options.js') {
        console.log(chalk.yellow(`⚠️ Skipping service worker file: ${entry.name}`));
        continue;
      }
      obfuscateFile(fullPath);
    }
  }
}

// Obfuscate a single JS file
function obfuscateFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Skip tiny files or already obfuscated files (simple heuristic)
    if (content.length < 100 || (content.includes('_0x') && content.includes('decode'))) {
      console.log(chalk.yellow(`⚠️ Skipping probable already obfuscated file: ${path.basename(filePath)}`));
      return;
    }
    
    console.log(chalk.blue(`🔒 Obfuscating: ${path.basename(filePath)}`));
    
    const obfuscatedCode = JavaScriptObfuscator.obfuscate(
      content, 
      obfuscationOptions
    ).getObfuscatedCode();
    
    fs.writeFileSync(filePath, obfuscatedCode);
    
    // File size comparison
    const originalSize = content.length;
    const obfuscatedSize = obfuscatedCode.length;
    const changePercent = Math.round(((obfuscatedSize - originalSize) / originalSize) * 100);
    
    console.log(chalk.green(`✓ Obfuscated: ${path.basename(filePath)} (${changePercent >= 0 ? '+' : ''}${changePercent}% size change)`));
  } catch (error) {
    console.error(chalk.red(`❌ Error obfuscating ${filePath}:`), error);
  }
}

// Main execution
console.log(chalk.green('🔐 Starting code obfuscation process...'));

if (!fs.existsSync(DIST_DIR)) {
  console.error(chalk.red('❌ Dist directory not found. Run webpack build first.'));
  process.exit(1);
}

try {
  obfuscateDirectory(DIST_DIR);
  console.log(chalk.green('✅ Code obfuscation completed successfully!'));
} catch (error) {
  console.error(chalk.red('❌ Obfuscation failed:'), error);
  process.exit(1);
}
