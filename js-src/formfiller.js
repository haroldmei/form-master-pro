/**
 * FormMaster - Automated form filling for university applications
 */
const os = require('os');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const net = require('net');
const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const firefox = require('selenium-webdriver/firefox');
const { pynput } = require('robotjs'); // Equivalent for pynput
const { loadData } = require('./files/docxv1');
const Mod1 = require('./forms/mod1');
const { getLogger } = require('./utils/logger');

// Global variables
let lock = new Mutex();
const IS_WINDOWS = os.platform() === 'win32';
let driver = null;
let module = null;
let runMode = 0;
const logger = getLogger('formfiller');

/**
 * Mutex implementation for locking
 */
function Mutex() {
  let isLocked = false;
  this.acquire = () => {
    if (isLocked) return false;
    isLocked = true;
    return true;
  };
  this.release = () => {
    isLocked = false;
  };
}

/**
 * Initialize and setup the browser
 */
async function setupBrowser() {
  if (IS_WINDOWS) {
    // Try to connect to an existing Chrome instance or start a new one
    if (!await connectToChromeInstance()) {
      await startChromeInstance();
    }
    
    // Setup Chrome with debugging options
    const chromeOptions = new chrome.Options();
    chromeOptions.addArguments('--remote-debugging-port=9222');
    
    // Try to use local ChromeDriver if available
    const userProfile = process.env.USERPROFILE || '';
    const localDriverPath = path.join(userProfile, '.formmaster', 'chromedriver.exe');
    
    if (fs.existsSync(localDriverPath)) {
      logger.info(`Using local ChromeDriver at ${localDriverPath}`);
      const service = new chrome.ServiceBuilder(localDriverPath).build();
      driver = await new Builder()
        .forBrowser('chrome')
        .setChromeOptions(chromeOptions)
        .setChromeService(service)
        .build();
    } else {
      logger.info("Using default ChromeDriver");
      driver = await new Builder()
        .forBrowser('chrome')
        .setChromeOptions(chromeOptions)
        .build();
    }
  } else {
    // Firefox setup for non-Windows platforms
    const options = new firefox.Options();
    options.setPreference("network.protocol-handler.external-default", false);
    options.setPreference("network.protocol-handler.expose-all", true);
    options.setPreference("network.protocol-handler.warn-external-default", false);
    
    driver = await new Builder()
      .forBrowser('firefox')
      .setFirefoxOptions(options)
      .build();
  }
  
  return driver;
}

/**
 * Try to connect to an existing Chrome instance on port 9222
 */
async function connectToChromeInstance() {
  return new Promise((resolve) => {
    const client = net.connect({port: 9222, host: '127.0.0.1'}, () => {
      logger.info("Connected to existing Chrome instance");
      client.end();
      resolve(true);
    });
    
    client.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Start a new Chrome instance with remote debugging enabled
 */
async function startChromeInstance() {
  logger.info('Starting new Chrome browser instance...');
  
  // Find Chrome executable
  const chromePaths = [];
  
  if (IS_WINDOWS) {
    for (const basedir of ['ProgramFiles', 'ProgramFiles(x86)', 'LocalAppData']) {
      if (process.env[basedir]) {
        const path = `${process.env[basedir]}\\Google\\Chrome\\Application\\chrome.exe`;
        chromePaths.push(path);
      }
    }
  } else {
    chromePaths.push('/opt/google/chrome/chrome');
  }
  
  // Try each path until we find a valid Chrome executable
  for (const chrome of chromePaths) {
    if (fs.existsSync(chrome)) {
      const profileDir = path.join(
        IS_WINDOWS ? process.env.LocalAppData : process.env.HOME,
        'selenium', 'ChromeProfile'
      );
      
      // Ensure profile directory exists
      if (!fs.existsSync(profileDir)) {
        fs.mkdirSync(profileDir, { recursive: true });
      }
      
      const cmd = `"${chrome}" --remote-debugging-port=9222 --user-data-dir="${profileDir}"`;
      logger.info(`Starting browser: ${cmd}`);
      
      try {
        // Use spawn to start the process without waiting
        require('child_process').spawn(chrome, [
          '--remote-debugging-port=9222',
          `--user-data-dir=${profileDir}`
        ], {
          detached: true,
          stdio: 'ignore'
        }).unref();
        
        // Give browser time to start
        await new Promise(resolve => setTimeout(resolve, 2000));
        return;
      } catch (e) {
        logger.error(`Error starting Chrome: ${e.message}`);
      }
    }
  }
  
  logger.error("Could not find Chrome browser executable");
  process.exit(1);
}

/**
 * Check if browser is still open and responsive
 */
async function isBrowserAlive() {
  if (!driver) {
    return false;
  }
  
  try {
    // Attempt to access a property that requires the browser to be open
    await driver.getWindowHandle();
    return true;
  } catch (e) {
    try {
      const handles = await driver.getAllWindowHandles();
      if (handles.length > 0) {
        await driver.switchTo().window(handles[handles.length - 1]);
        logger.info('Switching to latest window/tab');
        return true;
      } else {
        logger.info("Browser was closed by user or crashed");
        return false;
      }
    } catch {
      logger.info("Browser was closed by user or crashed");
      return false;
    }
  }
}

/**
 * Handle mouse click events
 */
async function onClick(button, pressed) {
  // Only process release events
  if (pressed) return;
  
  // Check if browser is still alive
  if (!await isBrowserAlive()) {
    logger.warning("Browser closed, exiting application");
    process.exit(0);
  }
  
  try {
    if (lock.acquire()) {
      try {
        if (button === 'middle') {
          // Middle click triggers module run
          await module.run();
        } else if (button === 'left') {
          // Left click ensures we're on the most recent window/tab
          try {
            await driver.wait(until.elementLocated(By.tagName("body")), 3000);
            
            const currentHandle = await driver.getWindowHandle();
            const handles = await driver.getAllWindowHandles();
            
            if (handles[handles.length - 1] !== currentHandle) {
              logger.info('Switching to latest window/tab');
              await driver.switchTo().window(handles[handles.length - 1]);
            }
          } catch (e) {
            logger.debug(`Window switching error (non-critical): ${e.message}`);
          }
        }
      } finally {
        lock.release();
      }
    }
  } catch (e) {
    logger.error(`Error in onClick: ${e.message}`);
    
    // Try to recover by switching to last window handle
    try {
      const handles = await driver.getAllWindowHandles();
      if (handles.length > 0) {
        await driver.switchTo().window(handles[handles.length - 1]);
      } else {
        logger.critical("No browser windows available, exiting");
        process.exit(1);
      }
    } catch {
      logger.critical("Fatal error in mouse handler, exiting");
      process.exit(1);
    }
  }
}

/**
 * Main execution function
 */
async function run(dataDir, mode = 0) {
  runMode = mode;
  
  // Set up the browser
  driver = await setupBrowser();
  
  // Load student data if in normal mode
  let students = [];
  if (!runMode) {
    logger.info(`Loading student data from ${dataDir}`);
    students = await loadData(dataDir);
    logger.info(`Loaded ${students.length} student records`);
  }

  // Initialize the appropriate module
  logger.info("Initializing Sydney University module");
  module = new Mod1(driver, students, runMode);

  // Login and initiate the session
  const mainApplicationHandle = await module.loginSession();

  try {
    // Start mouse listener with robotjs
    logger.info("Starting mouse listener");
    
    // Main event loop
    logger.info("Running main loop - waiting for events");
    while (await isBrowserAlive()) {
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    logger.info("Browser closed, exiting application");
    
  } catch (e) {
    if (e.code === 'SIGINT') {
      logger.info("Application interrupted by user");
    } else {
      logger.error(`Unhandled exception in main loop: ${e.message}`);
      logger.error(e.stack);
    }
  } finally {
    // Clean up
    logger.info("Cleaning up resources");
    
    // Close the browser if it's still open
    if (driver) {
      try {
        await driver.quit();
      } catch (e) {
        logger.debug(`Error closing browser: ${e.message}`);
      }
    }
  }
}

/**
 * Parse command line arguments
 */
function parseArguments() {
  const defaultDataDir = IS_WINDOWS ? 
    'C:\\work\\data\\13. 懿心ONE Bonnie' : 
    '/home/hmei/data/13. 懿心ONE Bonnie';
  
  // Simple argument parser
  const args = process.argv.slice(2);
  let dataDir = defaultDataDir;
  let mode = 0;
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dir' && i + 1 < args.length) {
      dataDir = args[i + 1];
      i++;
    } else if (args[i] === '--mode' && i + 1 < args.length) {
      mode = parseInt(args[i + 1], 10);
      i++;
    }
  }
  
  return { dataDir, mode };
}

// Export the run function
module.exports = { run };

// Run if called directly
if (require.main === module) {
  const args = parseArguments();
  run(args.dataDir, args.mode).catch(err => {
    console.error(`Fatal error: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
  });
}
