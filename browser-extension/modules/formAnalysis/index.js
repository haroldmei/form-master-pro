/**
 * Form Analysis V2 - Main Module
 * Entry point for form analysis functionality
 */
const formAnalysis = (() => {
  // Form control analysis data
  let formControls = [];
  
  /**
   * Initialize the form analysis module
   */
  function init() {
    // Load any existing data
    loadFromStorage();
    console.log('Form Analysis initialized');
  }
  
  /**
   * Save form analysis data to storage
   */
  function saveToStorage() {
    if (formControls && formControls.length > 0) {
      chrome.storage.local.set({
        'formAnalysis': {
          controls: formControls,
          lastUpdated: new Date().toISOString()
        }
      }, function() {
        console.log('Form analysis data saved to storage');
      });
    }
  }
  
  /**
   * Load form analysis data from storage
   */
  function loadFromStorage() {
    chrome.storage.local.get(['formAnalysis'], function(result) {
      if (result && result.formAnalysis) {
        formControls = result.formAnalysis.controls || [];
        console.log('Form analysis data loaded from storage');
      }
    });
  }
  
  return {
    init,
    saveToStorage,
    loadFromStorage
  };
})();

// Expose the module to the global scope
self.formAnalysis = formAnalysis; 