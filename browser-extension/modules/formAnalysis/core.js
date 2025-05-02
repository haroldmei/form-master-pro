/**
 * Form Analysis V2 - Core Module
 * The main entry point for form analysis functionality
 */
const formAnalysisCore = (() => {
  
  // Form control analysis data
  let formControls = [];
  
  /**
   * Initialize the module
   */
  function init() {    
    // Load dependencies
    if (typeof formAnalysisStorage === 'undefined') {
      console.error('Required dependency missing: formAnalysisStorage');
    }
    
    if (typeof formAnalysisHighlighting === 'undefined') {
      console.error('Required dependency missing: formAnalysisHighlighting');
    }
  }
  
  /**
   * Analyze the current form with form controls, labels, and containers
   * @param {HTMLElement} analyzeFormBtn - The button that was clicked to trigger analysis
   * @param {Function} showToastCallback - Callback to show toast messages in the UI
   */
  function analyzeCurrentForm(analyzeFormBtn, showToastCallback) {
    // Set button to loading state
    if (analyzeFormBtn) {
      analyzeFormBtn.disabled = true;
      analyzeFormBtn.textContent = 'Analyzing...';
    }
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      // Get the current URL for retrieving existing mappings
      const url = new URL(tabs[0].url);
      const rootUrl = url.origin;
      
      // First, load any existing field mappings for this URL
      chrome.storage.local.get('fieldMappingsV2', function(result) {
        let existingMappings = [];
        
        // Check if we have mappings for this URL
        if (result && result.fieldMappingsV2 && result.fieldMappingsV2[rootUrl]) {
          existingMappings = result.fieldMappingsV2[rootUrl];
        }
        
        // Execute script to analyze the form in the active tab
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          files: [
            'modules/formAnalysis/domUtils.js',
            'modules/formAnalysis/highlighting.js',
            'modules/formAnalysis/containerDetection.js',
            'modules/formAnalysis/labelDetection.js',
            'modules/formAnalysis/injected.js'
          ]
        }, () => {
          // After loading dependencies, execute the analysis
          chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            function: (params) => {
              return window.formAnalysisInjected.performFormAnalysis(
                params.existingMappings
              );
            },
            args: [{
              existingMappings
            }]
          }, results => {
            // Reset button state
            if (analyzeFormBtn) {
              analyzeFormBtn.disabled = false;
              analyzeFormBtn.textContent = 'Analyze Current Form';
            }
            
            console.log('Results:', results);
            if (results && results[0] && results[0].result) {
              const controlCount = results[0].result.count || 0;
              showToastCallback(`Analyzed ${controlCount} form controls`, 'success');
            } else {
              showToastCallback('No form controls detected or error analyzing form.', 'error');
            }
          });
        });
      });
    });
  }
  
  return {
    init,
    analyzeCurrentForm,
    getFormControls: () => formControls
  };
})();

// Expose the module to the global scope
self.formAnalysisCore = formAnalysisCore; 