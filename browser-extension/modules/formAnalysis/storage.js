/**
 * Form Analysis V2 - Storage Module
 * Handles storage operations for form analysis data
 */
const formAnalysisStorage = (() => {
  // Field mappings dictionary to store in local storage
  let fieldMappingsV2 = {};
  
  /**
   * Initialize the storage module
   */
  function init() {
    // Load any existing mappings at startup
    loadFieldMappingsFromStorage();
    console.log('Form Analysis Storage initialized');
  }
  
  /**
   * Save field mappings to local storage using the page URL as the key
   * @param {Array} serializableControls - Array of form controls to save
   * @param {string} [url] - Optional URL to use (will query current tab if not provided)
   */
  function saveFieldMappingsToStorage(serializableControls, url = null) {
    if (!serializableControls || !serializableControls.length) return;
    
    if (url) {
      // Use the provided URL
      const rootUrl = new URL(url).origin;
      updateStorage(rootUrl, serializableControls);
    } else {
      // Query the active tab to get current URL
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs && tabs[0] && tabs[0].url) {
          // Get the root URL (domain) as the key
          const url = new URL(tabs[0].url);
          const rootUrl = url.origin;
          updateStorage(rootUrl, serializableControls);
        }
      });
    }
  }
  
  /**
   * Update storage with the new controls
   * @param {string} rootUrl - The URL to use as key
   * @param {Array} serializableControls - Controls to save
   */
  function updateStorage(rootUrl, serializableControls) {
    // Update the mappings dictionary
    fieldMappingsV2[rootUrl] = serializableControls;
    
    // Save to local storage
    chrome.storage.local.set({'fieldMappingsV2': fieldMappingsV2}, function() {
      console.log('Field mappings saved to local storage:', rootUrl);
    });
  }
  
  /**
   * Load field mappings from local storage
   * @param {Function} callback - Optional callback function to handle the loaded mappings
   */
  function loadFieldMappingsFromStorage(callback) {
    return new Promise((resolve) => {
      chrome.storage.local.get('fieldMappingsV2', function(result) {
        if (result && result.fieldMappingsV2) {
          fieldMappingsV2 = result.fieldMappingsV2;
          
          if (callback && typeof callback === 'function') {
            callback(fieldMappingsV2);
          }
          
          resolve(fieldMappingsV2);
        } else {
          resolve({});
        }
      });
    });
  }
  
  /**
   * Get field mappings for a specific URL
   * @param {string} url - The URL to get mappings for
   * @returns {Promise<Array>} - Promise that resolves to the mappings array
   */
  function getFieldMappingsForUrl(url) {
    return new Promise((resolve) => {
      const rootUrl = new URL(url).origin;
      
      chrome.storage.local.get('fieldMappingsV2', function(result) {
        if (result && result.fieldMappingsV2 && result.fieldMappingsV2[rootUrl]) {
          resolve(result.fieldMappingsV2[rootUrl]);
        } else {
          resolve([]);
        }
      });
    });
  }
  
  /**
   * Get all stored field mappings
   * @returns {Promise<Object>} - Promise that resolves to all mappings
   */
  function getAllFieldMappings() {
    return new Promise((resolve) => {
      chrome.storage.local.get('fieldMappingsV2', function(result) {
        if (result && result.fieldMappingsV2) {
          resolve(result.fieldMappingsV2);
        } else {
          resolve({});
        }
      });
    });
  }
  
  /**
   * Clear all field mappings from storage
   * @returns {Promise<boolean>} - Promise that resolves when data is cleared
   */
  function clearAll() {
    return new Promise((resolve, reject) => {
      // Clear in-memory cache
      fieldMappingsV2 = {};
      
      // Remove from storage
      chrome.storage.local.remove('fieldMappingsV2', function() {
        if (chrome.runtime.lastError) {
          console.error('Error clearing field mappings:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else {
          console.log('All field mappings cleared from storage');
          resolve(true);
        }
      });
    });
  }
  
  return {
    init,
    saveFieldMappingsToStorage,
    loadFieldMappingsFromStorage,
    getFieldMappingsForUrl,
    getAllFieldMappings,
    clearAll
  };
})();

// Expose the module to the global scope
self.formAnalysisStorage = formAnalysisStorage; 