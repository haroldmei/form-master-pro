/**
 * Version bumping script for FormMasterPro
 * Usage: node scripts/bump-version.js [major|minor|patch|<specific-version>]
 * Example: 
 *   - node scripts/bump-version.js patch (bumps 1.0.0 to 1.0.1)
 *   - node scripts/bump-version.js minor (bumps 1.0.0 to 1.1.0)
 *   - node scripts/bump-version.js major (bumps 1.0.0 to 2.0.0)
 *   - node scripts/bump-version.js 1.5.2 (sets version to 1.5.2)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const chalk = require('chalk');

// File paths
const MAIN_PACKAGE_JSON = path.resolve(__dirname, '../package.json');
const EXTENSION_PACKAGE_JSON = path.resolve(__dirname, '../browser-extension/package.json');
const UI_INJECTOR_JS = path.resolve(__dirname, '../browser-extension/scripts/ui-injector.js');

// Read command-line arguments
const args = process.argv.slice(2);
const bumpType = args[0] || 'patch';

// Function to read current version from package.json
function getCurrentVersion() {
  try {
    const packageJson = JSON.parse(fs.readFileSync(MAIN_PACKAGE_JSON, 'utf8'));
    return packageJson.version || '0.1.0';
  } catch (error) {
    console.error(chalk.red('Error reading version from package.json:'), error.message);
    return '0.1.0';
  }
}

// Function to calculate new version
function getNewVersion(currentVersion, bumpType) {
  // If a specific version is provided, use it
  if (/^\d+\.\d+\.\d+$/.test(bumpType)) {
    return bumpType;
  }

  const [major, minor, patch] = currentVersion.split('.').map(Number);

  switch (bumpType) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
    default:
      return `${major}.${minor}.${patch + 1}`;
  }
}

// Function to update version in package.json files
function updatePackageJson(filePath, newVersion) {
  try {
    const packageJson = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    packageJson.version = newVersion;
    fs.writeFileSync(filePath, JSON.stringify(packageJson, null, 2) + '\n');
    console.log(chalk.green(`✅ Updated version in ${path.basename(filePath)} to ${newVersion}`));
    return true;
  } catch (error) {
    console.error(chalk.red(`❌ Error updating version in ${path.basename(filePath)}:`), error.message);
    return false;
  }
}

// Function to update version in ui-injector.js
function updateUiInjector(newVersion) {
  try {
    let content = fs.readFileSync(UI_INJECTOR_JS, 'utf8');
    const versionPattern = /(const\s+VERSION\s*=\s*["|'])([^"']+)(["|'])/;
    
    if (versionPattern.test(content)) {
      content = content.replace(versionPattern, `$1${newVersion}$3`);
      fs.writeFileSync(UI_INJECTOR_JS, content);
      console.log(chalk.green(`✅ Updated version in ui-injector.js to ${newVersion}`));
      return true;
    } else {
      console.error(chalk.red('❌ Could not find version constant in ui-injector.js'));
      return false;
    }
  } catch (error) {
    console.error(chalk.red('❌ Error updating version in ui-injector.js:'), error.message);
    return false;
  }
}

// Main execution
async function main() {
  try {
    console.log(chalk.cyan('🔄 FormMasterPro Version Bumper'));
    
    const currentVersion = getCurrentVersion();
    const newVersion = getNewVersion(currentVersion, bumpType);
    
    console.log(chalk.blue(`Current version: ${currentVersion}`));
    console.log(chalk.blue(`New version: ${newVersion}`));
    
    // Update versions in different files
    let success = true;
    
    // Update main package.json
    success &= updatePackageJson(MAIN_PACKAGE_JSON, newVersion);
    
    // Update extension package.json if it exists
    if (fs.existsSync(EXTENSION_PACKAGE_JSON)) {
      success &= updatePackageJson(EXTENSION_PACKAGE_JSON, newVersion);
    } else {
      console.log(chalk.yellow('⚠️ Extension package.json not found, skipping.'));
    }
    
    // Update UI injector script if it exists
    if (fs.existsSync(UI_INJECTOR_JS)) {
      success &= updateUiInjector(newVersion);
    } else {
      console.log(chalk.yellow('⚠️ UI injector script not found, skipping.'));
    }
    
    // Attempt to commit changes if everything succeeded
    if (success) {
      try {
        // Check if git is available and we're in a git repository
        execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
        
        // Stage the changed files
        console.log(chalk.blue('📝 Staging version changes in git...'));
        execSync('git add package.json browser-extension/package.json browser-extension/scripts/ui-injector.js', { stdio: 'ignore' });
        
        // Commit the changes
        console.log(chalk.blue(`📝 Committing version bump to ${newVersion}...`));
        execSync(`git commit -m "Bump version to ${newVersion}"`, { stdio: 'ignore' });
        
        console.log(chalk.green('✅ Version bump committed to git.'));
        console.log(chalk.yellow('ℹ️ To create a version tag, run:'));
        console.log(chalk.yellow(`   git tag v${newVersion} && git push origin v${newVersion}`));
      } catch (error) {
        // Git commands failed, but version bumping succeeded
        console.log(chalk.yellow('⚠️ Git operations failed, but version files were updated successfully.'));
        console.log(chalk.yellow('ℹ️ You may want to commit these changes manually.'));
      }
      
      console.log(chalk.green(`🎉 Successfully bumped version to ${newVersion}!`));
    } else {
      console.error(chalk.red('❌ Some version updates failed. Please check the errors above.'));
      process.exit(1);
    }
  } catch (error) {
    console.error(chalk.red('❌ Version bump failed:'), error);
    process.exit(1);
  }
}

main();
