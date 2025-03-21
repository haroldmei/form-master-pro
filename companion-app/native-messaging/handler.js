const { spawn } = require('child_process');
const EventEmitter = require('events');
const { getLogger } = require('../utils/logger');

const logger = getLogger('native-messaging');

class NativeMessagingHandler extends EventEmitter {
  constructor() {
    super();
    this.handlers = {};
    this.connected = false;
    this.stdin = process.stdin;
    this.stdout = process.stdout;
    this.buffer = Buffer.alloc(0);
    this.messageLength = null;
  }

  /**
   * Register a message handler
   */
  on(messageType, handler) {
    this.handlers[messageType] = handler;
    return this;
  }

  /**
   * Start listening for native messages
   */
  start() {
    // Set up stdin for reading messages
    this.stdin.on('readable', () => {
      this._readMessage();
    });

    // Handle errors
    this.stdin.on('error', (error) => {
      logger.error('Native messaging stdin error:', error);
    });

    // Handle end of stdin
    this.stdin.on('end', () => {
      logger.info('Native messaging connection closed');
      this.connected = false;
    });

    // Mark as connected
    this.connected = true;
    logger.info('Native messaging handler started');
  }

  /**
   * Read messages from stdin
   */
  _readMessage() {
    let chunk;
    
    // Read all available data
    while ((chunk = this.stdin.read()) !== null) {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      
      // Process all complete messages in the buffer
      this._processBuffer();
    }
  }

  /**
   * Process buffer to extract complete messages
   */
  _processBuffer() {
    // Keep processing messages until buffer is depleted
    while (this.buffer.length > 0) {
      // If we don't know the message length yet, try to read it
      if (this.messageLength === null) {
        // Need 4 bytes for the length header
        if (this.buffer.length < 4) {
          return; // Not enough data yet
        }
        
        // The first 4 bytes are the length header (little-endian UInt32)
        this.messageLength = this.buffer.readUInt32LE(0);
        this.buffer = this.buffer.slice(4); // Remove the header
      }
      
      // Check if we have the complete message
      if (this.buffer.length < this.messageLength) {
        return; // Not enough data yet
      }
      
      // Extract the message
      const messageBytes = this.buffer.slice(0, this.messageLength);
      this.buffer = this.buffer.slice(this.messageLength);
      
      try {
        // Parse the JSON message
        const message = JSON.parse(messageBytes.toString());
        logger.debug('Received message:', message);
        
        // Process the message
        this._handleMessage(message);
      } catch (error) {
        logger.error('Error processing message:', error);
      }
      
      // Reset for next message
      this.messageLength = null;
    }
  }

  /**
   * Handle incoming messages
   */
  async _handleMessage(message) {
    try {
      // Check if we have a handler for this message type
      if (message.type && this.handlers[message.type]) {
        const handler = this.handlers[message.type];
        
        // Call the handler and get response
        const response = await handler(this, message);
        
        // Send response back
        if (message.id) {
          this._sendResponse({
            id: message.id,
            ...response
          });
        }
      } else {
        // Unknown message type
        logger.warn('Unknown message type:', message.type);
        if (message.id) {
          this._sendResponse({
            id: message.id,
            error: `Unknown message type: ${message.type}`
          });
        }
      }
    } catch (error) {
      logger.error('Error handling message:', error);
      if (message.id) {
        this._sendResponse({
          id: message.id,
          error: error.message
        });
      }
    }
  }

  /**
   * Send a response to the extension
   */
  _sendResponse(response) {
    try {
      // Convert response to JSON string
      const responseJson = JSON.stringify(response);
      const responseBuffer = Buffer.from(responseJson);
      
      // Create length header (UInt32 little-endian)
      const header = Buffer.alloc(4);
      header.writeUInt32LE(responseBuffer.length, 0);
      
      // Write the message with its length prefix
      this.stdout.write(header);
      this.stdout.write(responseBuffer);
      
      logger.debug('Sent response:', response);
    } catch (error) {
      logger.error('Error sending response:', error);
    }
  }
}

// Export a singleton instance
module.exports = new NativeMessagingHandler();
