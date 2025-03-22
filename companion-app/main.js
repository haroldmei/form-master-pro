const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const Store = require('electron-store');
const { getLogger } = require('./utils/logger');
const os = require('os');

// Initialize logger
const logger = getLogger('main');

// Log app startup
logger.info('----------------------------------------------------');
logger.info(`FormMaster Companion starting at: ${new Date().toISOString()}`);
logger.info(`Electron version: ${process.versions.electron}`);
logger.info(`Node.js version: ${process.versions.node}`);
logger.info(`Platform: ${process.platform}, ${os.release()}`);
logger.info(`Architecture: ${process.arch}`);
logger.info(`App path: ${app.getAppPath()}`);
logger.info('----------------------------------------------------');

// Configuration store
const store = new Store();

// Keep a global reference of the window object
let mainWindow;
let tray = null;

// Native messaging port
let nativeMessagingProcess = null;
let shouldQuit = false;

// Track if shutdown is in progress
let isShuttingDown = false;

// Check and create required directories and files
function ensureRequiredFiles() {
  logger.info('Checking required directories and files');
  
  // Create resources directory if it doesn't exist
  const resourcesDir = path.join(__dirname, 'resources');
  if (!fs.existsSync(resourcesDir)) {
    logger.info('Creating resources directory');
    fs.mkdirSync(resourcesDir, { recursive: true });
  }
  
  // Check if icon file exists, create a basic one if not
  const iconPath = path.join(resourcesDir, 'icon.png');
  if (!fs.existsSync(iconPath)) {
    logger.warning(`Icon file not found at ${iconPath}, creating default icon`);
    
    // Copy default Electron icon or create a simple one
    try {
      // Create a simple transparent 16x16 PNG icon
      const defaultIconContent = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyJpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNiAoV2luZG93cykiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6QzVCODI3NzQ5RTI2MTFFQTg3QURGQ0NFNTA4RjE1M0QiIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6QzVCODI3NzU5RTI2MTFFQTg3QURGQ0NFNTA4RjE1M0QiPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY9aW5zdGFuY2VJRD0ieG1wLmlpZDpDNUI4Mjc3MjlFMjYxMUVBODdBREZDQ0U1MDhGMTUzRCIgc3RSZWY9ZG9jdW1lbnRJRD0ieG1wLmRpZDpDNUI4Mjc3MzlFMjYxMUVBODdBREZDQ0U1MDhGMTUzRCIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/PuDU97gAAACAElEQVR42mL8//8/AyWAiYFCQLEBLMicX/+/y375x8hADDjyhoUFm8Alf/8zNOQY/tmKTw0jTgMO/mViyLNi+ZeILPfvPwZGXOoYcRpw7C8TQ6Yly7/5SHKQDcGlh4VQ3Gz7y8SQZcnybwyS3M9/uPWw4DPg+F8mhgwLln/jkeR+4TEANRV+Y2BgOMzAwKAEVNPIhFMFFgOO/2FiyLFg+TcTSe4TPj0wA47+ZmLIt2T5txhJ7gMeA5hxZaMjv5kYcixZ/q1Fkns/kQ2/AXv+MDHkm7P82wIU5kYWY8IXBrv/MjEUmbH8244k9xafAUzY8sHGP0wMRcYs/3Yjyb0moIcFmyE7/jAxVBmw/DuEJPcKjwFM+ExY94eJoVqX5d9JJLmneAz4j88Vcww/HNz2l4kh2Zzl31mkMD2F1wB8LlnAyHhn+V8mhjRTln9XkOQe4DUAlyvmMDJ+ONPIyJCSb8zy7yaS3C28BuDLSJcYGRmyLVn+PUCi7+E1AF9euIXUSoEg5wJeA/DlpQeQVOsm1gCGKxIMDCIM1AAGB4aMCgGGqAsGDP+xKmAkphgJsgEMDNqnGBi8gfgnAwPDayqYLsjAwLALiHcD8VMGBoZvlBrAzMDAoADEXEDMBcRcQMwBxMxAzIOkRhCIRYGYH4j5gJgHiDmREicAAgwA8pW+lJfyA78AAAAASUVORK5CYII=', 'base64');
      fs.writeFileSync(iconPath, defaultIconContent);
      logger.info('Created default icon file');
    } catch (error) {
      logger.error('Could not create default icon:', error);
    }
  }
  
  // Check if index.html exists, create a basic one if not
  const htmlPath = path.join(__dirname, 'index.html');
  if (!fs.existsSync(htmlPath)) {
    logger.warning(`HTML file not found at ${htmlPath}, creating default HTML`);
    
    try {
      const defaultHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>FormMaster Companion</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 20px;
      background-color: #f4f4f4;
      color: #333;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      padding: 20px;
      border-radius: 5px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    h1 {
      color: #0066cc;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>FormMaster Companion</h1>
    <p>Welcome to the FormMaster Companion application.</p>
    <p>Status: <span id="status">Initializing...</span></p>
  </div>
  <script>
    // Basic initialization script
    document.addEventListener('DOMContentLoaded', () => {
      document.getElementById('status').textContent = 'Running';
    });
  </script>
</body>
</html>`;
      
      fs.writeFileSync(htmlPath, defaultHtml);
      logger.info('Created default HTML file');
    } catch (error) {
      logger.error('Could not create default HTML:', error);
    }
  }
}

// Create the browser window
function createWindow() {
  logger.info('Creating main application window');
  
  try {
    const windowConfig = store.get('windowBounds', { 
      width: 800, 
      height: 600, 
      x: undefined, 
      y: undefined 
    });
    
    // Make sure required files exist before creating the window
    ensureRequiredFiles();
    
    mainWindow = new BrowserWindow({
      width: windowConfig.width,
      height: windowConfig.height,
      x: windowConfig.x,
      y: windowConfig.y,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        preload: path.join(__dirname, 'preload.js')
      },
      icon: path.join(__dirname, 'resources/icon.png'),
      show: false // Don't show until ready
    });

    // Load the index.html file with error handling
    const htmlPath = path.join(__dirname, 'index.html');
    logger.info(`Loading HTML file: ${htmlPath}`);
    
    if (fs.existsSync(htmlPath)) {
      mainWindow.loadFile(htmlPath);
    } else {
      logger.error(`HTML file not found at: ${htmlPath}`);
      // Show error in window
      mainWindow.loadURL(`data:text/html,<html><body><h2>Error</h2><p>Could not load index.html</p></body></html>`);
    }

    // Show window when ready
    mainWindow.once('ready-to-show', () => {
      mainWindow.show();
    });
    
    // Save window position and size when closing
    mainWindow.on('close', (e) => {
      // Store window position and size
      const { width, height } = mainWindow.getBounds();
      store.set('windowBounds', { 
        width, 
        height,
        x: mainWindow.getPosition()[0],
        y: mainWindow.getPosition()[1]
      });
      
      // Handle system tray minimize behavior
      if (!shouldQuit && store.get('minimizeToTray', true)) {
        e.preventDefault();
        mainWindow.hide();
        return;
      }
    });

    // Clear the reference when window is closed
    mainWindow.on('closed', () => {
      logger.info('Main window closed event triggered');
      mainWindow = null;
    });
    
    // Initialize the WebDriver manager
    logger.info('Initializing WebDriver');
    initializeWebDriver();
    
    // Initialize native messaging handler
    logger.info('Initializing native messaging');
    initializeNativeMessaging();
  } catch (error) {
    logger.error('Error creating window:', error);
  }
}

// Initialize the app
app.whenReady().then(() => {
  logger.info('Electron app ready');
  
  // Ensure required files exist
  ensureRequiredFiles();
  
  createWindow();
  
  try {
    setupTray();
  } catch (error) {
    logger.error('Error setting up tray:', error);
  }
  
  // On macOS, recreate window when dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow) {
      mainWindow.show();
    }
  });
});

// Ensure clean shutdown of the app
function ensureCleanShutdown() {
  if (isShuttingDown) {
    logger.info('Shutdown already in progress, skipping duplicated shutdown');
    return;
  }
  
  isShuttingDown = true;
  logger.info('Beginning application shutdown sequence');
  
  // Close the native messaging process if it exists
  if (nativeMessagingProcess) {
    try {
      logger.info('Terminating native messaging process');
      nativeMessagingProcess.kill();
      nativeMessagingProcess = null;
    } catch (error) {
      logger.error('Error killing native messaging process:', error);
    }
  }
  
  // Release any other resources that might cause file locks
  try {
    logger.info('Releasing WebDriver resources');
    const webdriverManager = require('./webdriver/manager');
    if (webdriverManager && typeof webdriverManager.cleanup === 'function') {
      webdriverManager.cleanup();
    }
  } catch (error) {
    logger.error('Error cleaning up WebDriver:', error);
  }
  
  // Release system tray
  if (tray) {
    logger.info('Destroying system tray');
    tray.destroy();
    tray = null;
  }
  
  // Close the window explicitly if it exists
  if (mainWindow) {
    logger.info('Closing main window');
    mainWindow.destroy();
    mainWindow = null;
  }
  
  logger.info('Shutdown sequence completed');
}

// Handle quit events
app.on('before-quit', () => {
  logger.info('Application before-quit event triggered');
  shouldQuit = true;
  ensureCleanShutdown();
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  logger.info('All windows closed');
  if (process.platform !== 'darwin') {
    logger.info('Not on macOS, quitting application');
    app.quit();
  }
});

// Ensure we fully release resources on exit
process.on('exit', () => {
  logger.info('Process exit event detected');
  ensureCleanShutdown();
});

// Handle SIGINT (Ctrl+C) for graceful shutdown
process.on('SIGINT', () => {
  logger.info('SIGINT received, exiting');
  ensureCleanShutdown();
  process.exit(0);
});

// Handle uncaught exceptions to prevent silent crash
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  ensureCleanShutdown();
});

// Set up system tray
function setupTray() {
  logger.info('Setting up system tray');
  const { Tray, Menu } = require('electron');
  
  try {
    const iconPath = path.join(__dirname, 'resources/icon.png');
    
    // Check if icon exists
    if (!fs.existsSync(iconPath)) {
      logger.error(`Tray icon not found at: ${iconPath}`);
      // Try to create icon file again
      ensureRequiredFiles();
      
      // If still fails, show error and return
      if (!fs.existsSync(iconPath)) {
        logger.error('Could not create tray icon, tray will not be available');
        return;
      }
    }
    
    logger.info(`Loading tray icon from: ${iconPath}`);
    tray = new Tray(iconPath);
    
    const contextMenu = Menu.buildFromTemplate([
      { 
        label: 'Open FormMaster', 
        click: () => {
          if (mainWindow) {
            mainWindow.show();
          } else {
            createWindow();
          }
        }
      },
      { type: 'separator' },
      { 
        label: 'Exit', 
        click: () => {
          shouldQuit = true;
          app.quit();
        }
      }
    ]);
    
    tray.setToolTip('FormMaster Companion');
    tray.setContextMenu(contextMenu);
    
    // Show window on tray icon click
    tray.on('click', () => {
      if (mainWindow) {
        mainWindow.show();
      } else {
        createWindow();
      }
    });
  } catch (error) {
    logger.error('Error setting up system tray:', error);
  }
}

// Initialize WebDriver
function initializeWebDriver() {
  const webdriverManager = require('./webdriver/manager');
  
  webdriverManager.initialize()
    .then(() => {
      logger.info('WebDriver initialized successfully');
      if (mainWindow) {
        mainWindow.webContents.send('webdriver-status', { status: 'ready' });
      }
    })
    .catch(error => {
      logger.error('WebDriver initialization failed:', error);
      if (mainWindow) {
        mainWindow.webContents.send('webdriver-status', { 
          status: 'error', 
          message: error.message 
        });
      }
    });
}

// Initialize native messaging
function initializeNativeMessaging() {
  const nativeMessagingHandler = require('./native-messaging/handler');
  
  logger.info('Setting up native messaging handlers');
  // Set up message handlers
  nativeMessagingHandler.on('ping', (sender, data) => {
    return { type: 'pong' };
  });
  
  nativeMessagingHandler.on('openFilePicker', async (sender, data) => {
    // Display file picker dialog
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Documents', extensions: ['docx', 'xlsx', 'json'] }
      ]
    });
    
    if (result.canceled) {
      return { 
        success: false, 
        error: 'File selection was canceled' 
      };
    }
    
    const filePath = result.filePaths[0];
    logger.info(`Selected file: ${filePath}`);
    
    return {
      success: true,
      filename: path.basename(filePath),
      path: filePath
    };
  });
  
  nativeMessagingHandler.on('fillForm', async (sender, data) => {
    const formDataService = require('./services/form-data-service');
    const formFillerService = require('./services/form-filler-service');
    
    try {
      // Get the form fields from the message
      const { formFields, url } = data;
      
      // Get mappings and retrieve data for the fields
      const mappings = store.get('fieldMappings', {});
      const fieldValues = await formDataService.getFormData(formFields, mappings, url);
      
      return {
        success: true,
        fieldValues: {
          fields: fieldValues
        }
      };
    } catch (error) {
      logger.error('Error processing form fill request:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });
  
  // Start the native messaging listener
  logger.info('Starting native messaging listener');
  nativeMessagingHandler.start();
  logger.info('Native messaging listener started');
}

// IPC Handlers
ipcMain.handle('open-file-dialog', async (event) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Documents', extensions: ['docx', 'xlsx', 'json'] }
    ]
  });
  
  if (result.canceled) {
    return { success: false };
  }
  
  return {
    success: true,
    filePath: result.filePaths[0]
  };
});

ipcMain.handle('get-settings', async (event) => {
  return {
    minimizeToTray: store.get('minimizeToTray', true),
    autoStartup: store.get('autoStartup', false),
    fieldMappings: store.get('fieldMappings', {})
  };
});

ipcMain.handle('save-settings', async (event, settings) => {
  store.set('minimizeToTray', settings.minimizeToTray);
  store.set('autoStartup', settings.autoStartup);
  
  // Handle auto-startup setting
  app.setLoginItemSettings({
    openAtLogin: settings.autoStartup
  });
  
  return { success: true };
});

ipcMain.handle('save-mappings', async (event, mappings) => {
  store.set('fieldMappings', mappings);
  return { success: true };
});
