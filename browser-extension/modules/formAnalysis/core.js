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
   * Analyze the current form and return the main container content
   * @returns {Promise<Object>} Analysis results with main container info
   */
  function analyzeCurrentForm() {
    return new Promise((resolve, reject) => {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (!tabs || !tabs[0]) {
          reject(new Error('No active tab found'));
          return;
        }

        // Get the current URL for retrieving existing mappings
        const url = new URL(tabs[0].url);
        const rootUrl = url.origin;
        
        // Load any existing mappings for this URL
        chrome.storage.local.get('allSuggestions', function(result) {
          let existingMappings = [];
          
          // Check if we have mappings for this URL
          if (result && result.allSuggestions && result.allSuggestions[rootUrl]) {
            existingMappings = result.allSuggestions[rootUrl];
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
              if (results && results[0] && results[0].result) {
                const analysis = results[0].result;
                formControls = analysis.controls;
                
                // Return the main container info
                resolve({
                  success: true,
                  mainContainer: analysis.mainContainer,
                  controlCount: analysis.count
                });
              } else {
                reject(new Error('No form controls detected or error analyzing form.'));
              }
            });
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