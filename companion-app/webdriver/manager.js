const { Builder } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const fs = require('fs');
const path = require('path');
const { getLogger } = require('../utils/logger');

const logger = getLogger('webdriver-manager');

class WebDriverManager {
  constructor() {
    this.driver = null;
    this.isInitialized = false;
    this.pendingTasks = [];
  }
  
  /**
   * Initialize the WebDriver instance
   */
  async initialize() {
    if (this.isInitialized) {
      logger.info('WebDriver is already initialized');
      return;
    }
    
    try {
      logger.info('Initializing WebDriver...');
      
      // Setup Chrome options
      const options = new chrome.Options();
      options.addArguments('--disable-dev-shm-usage');
      options.addArguments('--no-sandbox');
      options.addArguments('--remote-debugging-port=9222');
      
      // Get user data directory for Chrome profile
      const userDataDir = path.join(process.env.APPDATA || process.env.HOME, 'FormMasterChromeProfile');
      if (!fs.existsSync(userDataDir)) {
        fs.mkdirSync(userDataDir, { recursive: true });
      }
      options.addArguments(`--user-data-dir=${userDataDir}`);
      
      // For development, keep Chrome window visible
      if (process.env.NODE_ENV === 'development') {
        logger.debug('Running in development mode, Chrome will be visible');
      } else {
        options.addArguments('--headless');
      }
      
      // Create driver with configured options
      this.driver = await new Builder()
        .forBrowser('chrome')
        .setChromeOptions(options)
        .build();
        
      // Set a default timeout for operations
      await this.driver.manage().setTimeouts({
        implicit: 10000,  // wait up to 10 seconds for elements to be found
        pageLoad: 30000,  // wait up to 30 seconds for page to load
        script: 30000     // wait up to 30 seconds for scripts to execute
      });
      
      this.isInitialized = true;
      logger.info('WebDriver initialized successfully');
      
      // Process any pending tasks
      while (this.pendingTasks.length > 0) {
        const task = this.pendingTasks.shift();
        try {
          const result = await task.fn(...task.args);
          task.resolve(result);
        } catch (error) {
          task.reject(error);
        }
      }
      
      return true;
    } catch (error) {
      logger.error('Failed to initialize WebDriver:', error);
      this.isInitialized = false;
      throw error;
    }
  }
  
  /**
   * Execute a WebDriver task, initializing if needed
   */
  async executeTask(fn, ...args) {
    if (!this.isInitialized) {
      // Queue the task for execution after initialization
      return new Promise((resolve, reject) => {
        this.pendingTasks.push({
          fn, args, resolve, reject
        });
        
        // Try to initialize
        this.initialize().catch(error => {
          // Find and reject the task if initialization fails
          const index = this.pendingTasks.findIndex(task => 
            task.fn === fn && task.args === args
          );
          if (index >= 0) {
            const task = this.pendingTasks.splice(index, 1)[0];
            task.reject(error);
          }
        });
      });
    }
    
    // Execute the task directly
    return fn.apply(this, args);
  }
  
  /**
   * Get the WebDriver instance, initializing if needed
   */
  async getDriver() {
    if (!this.isInitialized) {
      await this.initialize();
    }
    return this.driver;
  }
  
  /**
   * Open a URL in the browser
   */
  async navigateTo(url) {
    return this.executeTask(async (url) => {
      logger.debug(`Navigating to URL: ${url}`);
      await this.driver.get(url);
      return true;
    }, url);
  }
  
  /**
   * Clean up resources
   */
  async cleanup() {
    if (this.driver) {
      try {
        await this.driver.quit();
        this.driver = null;
        this.isInitialized = false;
        logger.info('WebDriver resources cleaned up');
      } catch (error) {
        logger.error('Error cleaning up WebDriver:', error);
      }
    }
  }
}

// Export a singleton instance
module.exports = new WebDriverManager();
