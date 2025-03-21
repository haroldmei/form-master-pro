// Connection to native application
let nativePort = null;
let isConnected = false;
let pendingRequests = {};
let requestId = 0;

// Connection settings
const NATIVE_HOST = "com.formmaster.companion";
const CONNECTION_CHECK_INTERVAL = 30000; // 30 seconds

// Initialize connection when extension loads
initializeNativeConnection();
// Set up periodic connection check
setInterval(checkNativeConnection, CONNECTION_CHECK_INTERVAL);

/**
 * Initialize the connection to the native application
 */
function initializeNativeConnection() {
  try {
    nativePort = chrome.runtime.connectNative(NATIVE_HOST);
    
    nativePort.onMessage.addListener((response) => {
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
      }
    });
    
    nativePort.onDisconnect.addListener(() => {
      console.error("Disconnected from native app:", chrome.runtime.lastError);
      isConnected = false;
      nativePort = null;
      
      // Reject all pending requests
      Object.values(pendingRequests).forEach(({ reject }) => {
        reject(new Error("Connection to native application lost"));
      });
      pendingRequests = {};
      
      // Try to reconnect after a short delay
      setTimeout(initializeNativeConnection, 5000);
    });
    
    // Send ping to check connection
    sendNativeMessage({ type: 'ping' })
      .then(() => {
        isConnected = true;
        console.log("Connected to FormMaster companion app");
      })
      .catch(error => {
        console.error("Error connecting to native app:", error);
        isConnected = false;
      });
      
  } catch (error) {
    console.error("Failed to connect to native app:", error);
    isConnected = false;
  }
}

/**
 * Send a message to the native application and return a promise
 */
function sendNativeMessage(message) {
  return new Promise((resolve, reject) => {
    if (!nativePort) {
      reject(new Error("Native application connection not established"));
      return;
    }
    
    // Add request ID to track response
    const id = ++requestId;
    message.id = id;
    
    // Store the promise callbacks
    pendingRequests[id] = { resolve, reject };
    
    // Set timeout to prevent hanging requests
    setTimeout(() => {
      if (pendingRequests[id]) {
        reject(new Error("Request to native application timed out"));
        delete pendingRequests[id];
      }
    }, 30000);
    
    // Send the message
    try {
      nativePort.postMessage(message);
    } catch (error) {
      delete pendingRequests[id];
      reject(error);
    }
  });
}

/**
 * Periodically check if the native app is still connected
 */
function checkNativeConnection() {
  if (nativePort) {
    sendNativeMessage({ type: 'ping' })
      .then(() => {
        isConnected = true;
      })
      .catch(() => {
        isConnected = false;
        // Try to reconnect
        if (!nativePort) {
          initializeNativeConnection();
        }
      });
  } else {
    isConnected = false;
    initializeNativeConnection();
  }
}

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'checkConnection') {
    sendResponse({ connected: isConnected });
  
  } else if (request.action === 'openFilePicker') {
    // Send request to native app to open file picker
    sendNativeMessage({
      type: 'openFilePicker',
      fileTypes: ['.docx', '.xlsx', '.json']
    })
    .then(response => {
      sendResponse({
        success: true,
        filename: response.filename,
        path: response.path
      });
    })
    .catch(error => {
      sendResponse({
        success: false,
        error: error.message
      });
    });
    return true; // Keep the message channel open for async response
  
  } else if (request.action === 'fillForm') {
    // Get current form analysis from the tab
    chrome.tabs.sendMessage(request.tabId, { action: 'analyzeForm' }, (formAnalysis) => {
      if (!formAnalysis || !formAnalysis.fields) {
        sendResponse({ success: false, error: "Failed to analyze form" });
        return;
      }
      
      // Send form filling request to native app
      sendNativeMessage({
        type: 'fillForm',
        formFields: formAnalysis.fields,
        url: request.url
      })
      .then(response => {
        // Send the field values back to the content script
        chrome.tabs.sendMessage(request.tabId, {
          action: 'fillForm',
          data: response.fieldValues
        }, fillResult => {
          sendResponse({
            success: fillResult.success,
            message: fillResult.message,
            error: fillResult.error
          });
        });
      })
      .catch(error => {
        sendResponse({
          success: false,
          error: error.message
        });
      });
    });
    return true; // Keep the message channel open for async response
  }
});
