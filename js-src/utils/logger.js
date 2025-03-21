const fs = require('fs');
const path = require('path');

// Initialize logging system
class Logger {
  constructor(name = null) {
    this._name = name || 'formmaster';
    this._initialized = false;
    this.initialize();
  }

  initialize() {
    if (this._initialized) return;

    // Create timestamp for log filename
    const now = new Date();
    const timestamp = now.toISOString()
      .replace(/[-:]/g, '_')
      .replace(/T/g, '_')
      .split('.')[0];
    
    const logFilename = `formmaster_${timestamp}.log`;
    
    // Determine home directory in a cross-platform way
    const homeDir = process.env.USERPROFILE || process.env.HOME || '';
    const logDir = path.join(homeDir, '.formmaster');
    
    // Create directory if it doesn't exist
    try {
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
    } catch (err) {
      console.error(`Error creating log directory: ${err.message}`);
    }
    
    this._logPath = path.join(logDir, logFilename);
    this._initialized = true;
    
    // Log initialization
    this.info(`Logging initialized. Log file: ${this._logPath}`);
  }
  
  _formatMessage(level, message) {
    const timestamp = new Date().toISOString();
    return `${timestamp} - ${this._name} - ${level} - ${message}\n`;
  }
  
  _log(level, message) {
    const formattedMessage = this._formatMessage(level, message);
    
    // Log to console
    console.log(formattedMessage);
    
    // Log to file
    try {
      fs.appendFileSync(this._logPath, formattedMessage, { encoding: 'utf8' });
    } catch (err) {
      console.error(`Error writing to log file: ${err.message}`);
    }
  }
  
  info(message) {
    this._log('INFO', message);
  }
  
  warning(message) {
    this._log('WARNING', message);
  }
  
  error(message) {
    this._log('ERROR', message);
  }
  
  debug(message) {
    this._log('DEBUG', message);
  }
  
  critical(message) {
    this._log('CRITICAL', message);
  }
}

// Singleton pattern to ensure we reuse loggers
const loggers = {};

function getLogger(name = null) {
  const loggerName = name || 'formmaster';
  if (!loggers[loggerName]) {
    loggers[loggerName] = new Logger(loggerName);
  }
  return loggers[loggerName];
}

module.exports = { getLogger };
