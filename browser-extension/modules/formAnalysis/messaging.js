/**
 * Form Analysis V2 - Messaging Module
 * Handles communication between content scripts and background.js
 */
const formAnalysisMessaging = (() => {
  // Track callbacks for pending responses
  const pendingCallbacks = new Map();
  let messageId = 0;
  
  /**
   * Initialize the messaging module
   */
  function init() {
    // Listen for messages from background.js
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'FM_ANALYSIS_RESPONSE') {
        const { id, data, error } = message;
        
        // Look up the callback for this message ID
        const callback = pendingCallbacks.get(id);
        if (callback) {
          // Call the callback with the response data
          callback(error, data);
          pendingCallbacks.delete(id);
        }
        
        return true;
      }
    });
    
    // Listen for messages from content scripts via postMessage
    window.addEventListener('message', event => {
      // Only accept messages from the same frame
      if (event.source !== window) return;
      
      const message = event.data;
      
      // Handle form mappings data
      if (message && message.type === 'FM_SAVE_FIELD_MAPPINGS') {
        // Forward to background.js
        chrome.runtime.sendMessage(message);
      }
    });
    
    console.log('Form Analysis Messaging initialized');
  }
  
  /**
   * Send a message to the background script
   * @param {string} type - Message type 
   * @param {Object} data - Message data
   * @param {Function} callback - Callback function for the response
   */
  function sendToBackground(type, data, callback) {
    const id = messageId++;
    
    // Store the callback for later
    if (callback) {
      pendingCallbacks.set(id, callback);
    }
    
    // Send the message to background.js
    chrome.runtime.sendMessage({
      type,
      id,
      data
    });
  }
  
  /**
   * Analyze the current form via background.js
   * @param {Object} params - Analysis parameters
   * @param {Function} callback - Callback for the results
   */
  function analyzeFormViaBackground(params, callback) {
    sendToBackground('FM_ANALYZE_FORM', params, callback);
  }
  
  /**
   * Save field mappings to storage via background.js
   * @param {string} url - URL to use as key
   * @param {Array} controls - Form controls to save
   * @param {Function} callback - Optional callback
   */
  function saveFieldMappings(url, controls, callback) {
    sendToBackground('FM_SAVE_FIELD_MAPPINGS', {
      url,
      controls
    }, callback);
  }
  
  /**
   * Load field mappings for a URL via background.js
   * @param {string} url - URL to get mappings for
   * @param {Function} callback - Callback for the results
   */
  function loadFieldMappings(url, callback) {
    sendToBackground('FM_LOAD_FIELD_MAPPINGS', {
      url
    }, callback);
  }
  
  return {
    init,
    sendToBackground,
    analyzeFormViaBackground,
    saveFieldMappings,
    loadFieldMappings
  };
})();

// Expose the module to the global scope
self.formAnalysisMessaging = formAnalysisMessaging; 