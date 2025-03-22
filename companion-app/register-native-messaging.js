/**
 * Script to register the companion app for native messaging
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

// Native messaging host manifest
const manifest = {
  name: "com.formmaster.companion",
  description: "FormMaster Companion App",
  path: "", // Will be filled based on OS
  type: "stdio",
  allowed_origins: [
    "chrome-extension://lpijjeiglanjpnpenimfpdnfenjcgkkf/",  // Chrome extension ID placeholder
    "mozilla-extension://<EXTENSION_ID>/"  // Firefox extension ID placeholder
  ]
};

function registerChromeNativeMessaging() {
  try {
    const isWindows = os.platform() === 'win32';
    let targetDir;
    
    if (isWindows) {
      // For Windows, native messaging hosts are registered in the registry
      manifest.path = path.join(process.cwd(), 'native-messaging-host.bat').replace(/\\/g, '\\\\');
      
      // Create batch file wrapper
      const batchContent = `@echo off\r\n"${process.execPath}" "${path.join(process.cwd(), 'native-messaging-host.js')}"\r\n`;
      fs.writeFileSync(path.join(process.cwd(), 'native-messaging-host.bat'), batchContent);
      
      // Save manifest
      const manifestPath = path.join(process.cwd(), 'com.formmaster.companion.json');
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      
      // Register in Windows Registry
      const regCommand = `REG ADD "HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\com.formmaster.companion" /ve /t REG_SZ /d "${manifestPath.replace(/\\/g, '\\\\')}" /f`;
      execSync(regCommand);
      console.log('Registered Chrome native messaging host in Windows Registry');
      
      // Also register for Firefox (uses different registry key)
      try {
        const ffRegCommand = `REG ADD "HKCU\\Software\\Mozilla\\NativeMessagingHosts\\com.formmaster.companion" /ve /t REG_SZ /d "${manifestPath.replace(/\\/g, '\\\\')}" /f`;
        execSync(ffRegCommand);
        console.log('Registered Firefox native messaging host in Windows Registry');
      } catch (error) {
        console.log('Failed to register Firefox native messaging host:', error.message);
      }
      
    } else {
      // For Linux/macOS, native messaging hosts are registered in specific directories
      manifest.path = path.join(process.cwd(), 'native-messaging-host.js');
      
      if (os.platform() === 'darwin') {
        // macOS
        targetDir = path.join(os.homedir(), 'Library', 'Application Support', 'Google', 'Chrome', 'NativeMessagingHosts');
      } else {
        // Linux
        targetDir = path.join(os.homedir(), '.config', 'google-chrome', 'NativeMessagingHosts');
      }
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      
      // Save manifest
      fs.writeFileSync(path.join(targetDir, 'com.formmaster.companion.json'), JSON.stringify(manifest, null, 2));
      console.log(`Registered Chrome native messaging host in ${targetDir}`);
      
      // Make host script executable
      fs.chmodSync(path.join(process.cwd(), 'native-messaging-host.js'), 0o755);
      
      // Register for Firefox as well
      try {
        let firefoxDir;
        if (os.platform() === 'darwin') {
          firefoxDir = path.join(os.homedir(), 'Library', 'Application Support', 'Mozilla', 'NativeMessagingHosts');
        } else {
          firefoxDir = path.join(os.homedir(), '.mozilla', 'native-messaging-hosts');
        }
        
        if (!fs.existsSync(firefoxDir)) {
          fs.mkdirSync(firefoxDir, { recursive: true });
        }
        
        fs.writeFileSync(path.join(firefoxDir, 'com.formmaster.companion.json'), JSON.stringify(manifest, null, 2));
        console.log(`Registered Firefox native messaging host in ${firefoxDir}`);
      } catch (error) {
        console.log('Failed to register Firefox native messaging host:', error.message);
      }
    }
    
    console.log('Native messaging registration completed successfully');
  } catch (error) {
    console.error('Failed to register native messaging host:', error);
  }
}

// Create native messaging host script
const hostScript = `#!/usr/bin/env node
const path = require('path');
process.chdir(path.dirname(__dirname));
require('./native-messaging/handler').start();
`;

fs.writeFileSync(path.join(process.cwd(), 'native-messaging-host.js'), hostScript);

// Register the native messaging host
registerChromeNativeMessaging();
