const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const Store = require('electron-store');
const { getLogger } = require('./utils/logger');

// Initialize logger
const logger = getLogger('main');

// Configuration store
const store = new Store();

// Keep a global reference of the window object
let mainWindow;
let tray = null;

// Native messaging port
let nativeMessagingProcess = null;
let shouldQuit = false;

// Create the browser window
function createWindow() {
  const windowConfig = store.get('windowBounds', { 
    width: 800, 
    height: 600, 
    x: undefined, 
    y: undefined 
  });
  
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
    icon: path.join(__dirname, 'resources/icon.png')
  });

  // Load the index.html file
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Open DevTools in development mode
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

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
    mainWindow = null;
  });
  
  // Initialize the WebDriver manager
  initializeWebDriver();
  
  // Initialize native messaging handler
  initializeNativeMessaging();
}

// Initialize the app
app.whenReady().then(() => {
  createWindow();
  setupTray();
  
  // On macOS, recreate window when dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow) {
      mainWindow.show();
    }
  });
});

// Handle quit events
app.on('before-quit', () => {
  shouldQuit = true;
  
  // Close the native messaging process if it exists
  if (nativeMessagingProcess) {
    try {
      nativeMessagingProcess.kill();
    } catch (error) {
      logger.error('Error killing native messaging process:', error);
    }
  }
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Set up system tray
function setupTray() {
  const { Tray, Menu } = require('electron');
  
  tray = new Tray(path.join(__dirname, 'resources/icon.png'));
  
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
  nativeMessagingHandler.start();
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
