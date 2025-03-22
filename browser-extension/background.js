// Connection to native application
let nativePort = null;
let isConnected = false;
let pendingRequests = {};
let requestId = 0;
let connectionAttempts = 0;
let maxConnectionAttempts = 5;

// Connection settings
const NATIVE_HOST = "com.formmaster.companion";
const CONNECTION_CHECK_INTERVAL = 30000; // 30 seconds
const RECONNECT_TIMEOUT_BASE = 2000; // Start with 2 seconds, will increase with backoff

// Initialize connection when extension loads
console.log("FormMaster Pro extension initializing...");
initializeNativeConnection();

// Set up periodic connection check
setInterval(checkNativeConnection, CONNECTION_CHECK_INTERVAL);

/**
 * Initialize the connection to the native application
 */
function initializeNativeConnection() {
  if (nativePort) {
    console.log("Connection already exists, disconnecting first");
    try {
      nativePort.disconnect();
    } catch (e) {
      console.warn("Error disconnecting existing port:", e);
    }
    nativePort = null;
  }

  connectionAttempts++;
  console.log(`Attempting to connect to native host (${connectionAttempts}/${maxConnectionAttempts})`);
  
  try {
    nativePort = chrome.runtime.connectNative(NATIVE_HOST);
    console.log("Native connection initialized");
    
    nativePort.onMessage.addListener((response) => {
      console.log("Received message from native app:", response);
      // Handle response from native app
      if (response.id && pendingRequests[response.id]) {
        // Resolve the pending promise with the response
        const { resolve, reject } = pendingRequests[response.id];
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
        delete pendingRequests[response.id];
      }
      
      // Update connection status if this is a response to a ping
      if (response.type === 'pong') {
        isConnected = true;
        connectionAttempts = 0; // Reset attempts counter on successful connection
        console.log("Received pong response from companion app");
      }
    });
    
    nativePort.onDisconnect.addListener(() => {
      const error = chrome.runtime.lastError;
      console.error("Disconnected from native app:", error ? error.message : "Unknown error");
      isConnected = false;
      nativePort = null;
      
      // Reject all pending requests
      Object.values(pendingRequests).forEach(({ reject }) => {
        reject(new Error("Connection to native application lost"));
      });
      pendingRequests = {};
      
      // Try to reconnect with exponential backoff
      if (connectionAttempts < maxConnectionAttempts) {
        const delay = Math.min(RECONNECT_TIMEOUT_BASE * Math.pow(2, connectionAttempts - 1), 60000);
        console.log(`Will attempt to reconnect in ${delay}ms`);
        setTimeout(initializeNativeConnection, delay);
      } else {
        console.error(`Failed to connect after ${maxConnectionAttempts} attempts. Please check if the companion app is installed and running.`);
        // Notify user about connection issues
        chrome.action.setBadgeText({ text: "!" });
        chrome.action.setBadgeBackgroundColor({ color: "#F44336" });
      }
    });
    
    // Send ping to check connection
    sendNativeMessage({ type: 'ping' })
      .then(() => {
        isConnected = true;
        connectionAttempts = 0;
        console.log("Connected to FormMaster companion app");
        chrome.action.setBadgeText({ text: "" });
      })
      .catch(error => {
        console.error("Error connecting to native app:", error);
        isConnected = false;
        
        // Don't attempt reconnection here since onDisconnect will handle it
        // Just update UI to show disconnected state
        chrome.action.setBadgeText({ text: "!" });
        chrome.action.setBadgeBackgroundColor({ color: "#F44336" });
      });
  } catch (error) {
    console.error("Error establishing native connection:", error);
    isConnected = false;
    nativePort = null;
    
    // Try to reconnect with exponential backoff
    if (connectionAttempts < maxConnectionAttempts) {
      const delay = Math.min(RECONNECT_TIMEOUT_BASE * Math.pow(2, connectionAttempts - 1), 60000);
      console.log(`Will attempt to reconnect in ${delay}ms`);
      setTimeout(initializeNativeConnection, delay);
    }
  }
}

/**
 * Check if we're connected to the native application and reconnect if needed
 */
function checkNativeConnection() {
  console.log("Checking native connection status");
  if (!nativePort || !isConnected) {
    console.log("Not connected to native app, attempting to reconnect");
    initializeNativeConnection();
    return;
  }
  
  // If we have a connection, ping to make sure it's still alive
  sendNativeMessage({ type: 'ping' })
    .then(() => {
      console.log("Connection is active");
      isConnected = true;
      connectionAttempts = 0;
    })
    .catch(error => {
      console.error("Connection check failed:", error);
      isConnected = false;
      nativePort = null;
      initializeNativeConnection();
    });
}

/**
 * Send a message to the native application and return a promise
 * @param {object} message - The message to send
 * @returns {Promise} - Promise that resolves with the response
 */
function sendNativeMessage(message) {
  return new Promise((resolve, reject) => {
    if (!nativePort) {
      reject(new Error("No connection to native application"));
      return;
    }
    
    const id = ++requestId;
    const messageWithId = { ...message, id };
    
    pendingRequests[id] = { resolve, reject };
    
    try {
      nativePort.postMessage(messageWithId);
      console.log("Sent message to native app:", messageWithId);
    } catch (error) {
      console.error("Error sending message:", error);
      delete pendingRequests[id];
      reject(error);
      
      // Connection might be broken, try to reconnect
      isConnected = false;
      nativePort = null;
      initializeNativeConnection();
    }
  });
}

// Handle messages from content scripts or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Received message:", message, "from:", sender);
  
  if (message.action === 'checkCompanionConnection') {
    if (isConnected) {
      sendNativeMessage({ type: 'ping' })
        .then(() => {
          sendResponse({ connected: true });
        })
        .catch(error => {
          console.error("Connection check failed:", error);
          sendResponse({ connected: false, error: error.message });
        });
    } else {
      sendResponse({ connected: false });
      // Try to reconnect
      if (!nativePort) {
        initializeNativeConnection();
      }
    }
    return true; // Keep the message channel open for async response
  }
  
  if (message.action === 'sendToCompanion') {
    sendNativeMessage(message.data)
      .then(response => {
        sendResponse({ success: true, data: response });
      })
      .catch(error => {
        console.error("Error in sendToCompanion:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep the message channel open for async response
  }
});

// Create required native host manifest file for Windows
function getNativeHostManifestPath() {
  if (navigator.platform.includes('Win')) {
    return 'C:\\Users\\' + (process.env.USERNAME || 'harol') + 
           '\\AppData\\Local\\FormMasterPro\\native-messaging-hosts\\com.formmaster.companion.json';
  }
  return null; // For other platforms, handle separately
}

console.log("Background script loaded");
