// FormMaster content script for form analysis and filling
(function() {
  // Get reference to the global FormMaster object
  const FM = window.FormMaster = window.FormMaster || {};
  
  // Store form analysis results
  FM.formAnalysis = null;
  
  // Store field values for click-to-fill
  FM.clickToFillValues = null;
  
  // Initialize global state
  if (FM.initUIState) {
    FM.initUIState();
  }
  
  // Automatically get field values and enable click-to-fill when page loads
  document.addEventListener('DOMContentLoaded', function() {
    // Wait a bit for forms to fully initialize
    setTimeout(() => {
      console.log("Requesting form values from background script...");
      chrome.runtime.sendMessage({ action: "getFormValues", url: window.location.href }, function(response) {
        console.log("Received response:", response);
        if (response && response.success && response.fields && response.fields.length > 0) {
          FM.clickToFillValues = response.fields;
          
          // Set up event listeners if they exist
          if (typeof FM.setupEventListeners === 'function') {
            FM.setupEventListeners();
          }
          
          // Enable click-to-fill if it exists
          if (typeof FM.enableClickToFill === 'function') {
            FM.enableClickToFill(FM.clickToFillValues);
          }
        } else {
          console.warn("No form values available for click-to-fill");
        }
      });
    }, 1000);
  });
})(); 