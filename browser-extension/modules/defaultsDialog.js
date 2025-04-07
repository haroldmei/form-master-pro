/**
 * Default values dialog module
 * Handles UI for collecting default field values from users
 */

const defaultsDialog = (() => {

  // Function to save default field values for a URL
  async function saveDefaultFieldValues(url, values) {
    return new Promise((resolve) => {
      chrome.storage.local.get(['defaultFieldValues'], function(result) {
        const defaultFieldValues = result.defaultFieldValues || {};
        
        // Merge new values with existing ones instead of complete replacement
        const existingValues = defaultFieldValues[url] || {};
        defaultFieldValues[url] = {
          ...existingValues,  // Keep existing default values
          ...values           // Add or update with new values
        };
        
        chrome.storage.local.set({ defaultFieldValues }, function() {
          console.log(`Updated default values for ${url}, now have ${Object.keys(defaultFieldValues[url]).length} fields`);
          resolve();
        });
      });
    });
  }

  // Function to get default field values for a URL
  async function getDefaultFieldValues(url) {
    return new Promise((resolve) => {
      chrome.storage.local.get(['defaultFieldValues'], function(result) {
        const defaultFieldValues = result.defaultFieldValues || {};
        resolve(defaultFieldValues[url] || {});
      });
    });
  }

  // Return public API
  return {
    saveDefaultFieldValues,
    getDefaultFieldValues
  };
})();

// Attach to the global scope
self.defaultsDialog = defaultsDialog;
