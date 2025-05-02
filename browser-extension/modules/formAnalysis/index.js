/**
 * Form Analysis V2 - Main Module
 * Entry point for form analysis functionality
 */
const formAnalysis = (() => {
  // Form control analysis data
  let formControls = [];
  let devMode = true;
  
  /**
   * Initialize the form analysis module
   * @param {Object} options - Configuration options
   */
  function init(options = {}) {
    devMode = options.devMode !== undefined ? options.devMode : true;
    
    // Initialize messaging
    if (formAnalysisMessaging) {
      formAnalysisMessaging.init();
    } else {
      console.error('Messaging module not available');
    }
    
    console.log('Form Analysis initialized with devMode:', devMode);
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
    
    // Use the core module's analyzeCurrentForm if available
    if (formAnalysisCore && formAnalysisCore.analyzeCurrentForm) {
      return formAnalysisCore.analyzeCurrentForm(analyzeFormBtn, showToastCallback);
    }
    
    // Otherwise, perform analysis via messaging and background
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
          if (devMode) {
            console.log('Found existing mappings for URL:', rootUrl, existingMappings);
          }
        }
        
        // Prepare analysis parameters
        const params = {
          existingMappings
        };
        
        // Perform analysis via background script
        if (formAnalysisMessaging) {
          formAnalysisMessaging.analyzeFormViaBackground(params, (error, result) => {
            // Reset button state
            if (analyzeFormBtn) {
              analyzeFormBtn.disabled = false;
              analyzeFormBtn.textContent = 'Analyze Current Form';
            }
            
            if (error) {
              console.error('Error analyzing form:', error);
              showToastCallback('Error analyzing form', 'error');
              return;
            }
            
            if (result && result.count) {
              showToastCallback(`Analyzed ${result.count} form controls`, 'success');
            } else {
              showToastCallback('No form controls detected or error analyzing form.', 'error');
            }
          });
        } else {
          // Fall back to direct execution if messaging is not available
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
            chrome.scripting.executeScript({
              target: { tabId: tabs[0].id },
              function: (params) => {
                if (window.formAnalysisInjected) {
                  return window.formAnalysisInjected.performFormAnalysis(
                    params.existingMappings
                  );
                }
                return { count: 0, error: 'Form analysis module not available in page context' };
              },
              args: [params]
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
        }
      });
    });
  }
  
  /**
   * Save field mappings to storage
   * @param {Array} serializableControls - Controls to save
   * @param {Function} callback - Optional callback
   */
  function saveFieldMappingsToStorage(serializableControls, callback) {
    if (formAnalysisStorage) {
      formAnalysisStorage.saveFieldMappingsToStorage(serializableControls);
      if (callback) callback();
      return;
    }
    
    if (!serializableControls || !serializableControls.length) {
      if (callback) callback(new Error('No controls to save'));
      return;
    }
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs && tabs[0] && tabs[0].url) {
        // Get the root URL (domain) as the key
        const url = new URL(tabs[0].url);
        const rootUrl = url.origin;
        
        // Save to storage via messaging if available
        if (formAnalysisMessaging) {
          formAnalysisMessaging.saveFieldMappings(rootUrl, serializableControls, callback);
        } else {
          // Otherwise use direct storage access
          chrome.storage.local.get('fieldMappingsV2', function(result) {
            let fieldMappingsV2 = result.fieldMappingsV2 || {};
            fieldMappingsV2[rootUrl] = serializableControls;
            
            chrome.storage.local.set({fieldMappingsV2}, function() {
              console.log('Field mappings saved to local storage:', rootUrl);
              if (callback) callback();
            });
          });
        }
      } else if (callback) {
        callback(new Error('No active tab found'));
      }
    });
  }
  
  return {
    init,
    analyzeCurrentForm,
    saveFieldMappingsToStorage
  };
})();

// Expose the module to the global scope
self.formAnalysis = formAnalysis; 