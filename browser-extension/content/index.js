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
  
  // Function to briefly highlight form controls based on analysis results
  FM.showInitialFieldHighlights = function() {
    console.log("Analyzing form fields for initial highlighting...");
    
    // Request form analysis from the background script
    chrome.runtime.sendMessage({ action: "analyzeCurrentForm" }, function(response) {
      console.log("Form analysis response:", response);
      
      // Create UI elements if not already created
      if (FM.createUIElements) {
        FM.createUIElements();
      }
      
      // Add pulse animation style
      const styleEl = document.createElement('style');
      styleEl.id = 'formmaster-pulse-style';
      styleEl.textContent = `
        @keyframes formmaster-pulse {
          0% { box-shadow: 0 0 0 0 rgba(66, 133, 244, 0.4); }
          70% { box-shadow: 0 0 0 6px rgba(66, 133, 244, 0); }
          100% { box-shadow: 0 0 0 0 rgba(66, 133, 244, 0); }
        }
      `;
      document.head.appendChild(styleEl);
      
      // Get form elements from the analysis results if available
      let formElements = [];
      
      if (response && response.success && FM.formControls && FM.formControls.length > 0) {
        console.log(`Using ${FM.formControls.length} analyzed form controls for highlighting`);
        // Use the elements from form analysis
        formElements = FM.formControls.map(control => control.element).filter(el => el);
      } else {
        // Fallback to direct DOM query if form analysis isn't available
        formElements = Array.from(document.querySelectorAll('input:not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="hidden"]), select, textarea'));
        console.log(`Using ${formElements.length} directly queried form elements for highlighting`);
      }
      
      // Apply highlight to each element
      formElements.forEach(element => {
        // Store original styles
        const originalBoxShadow = element.style.boxShadow;
        const originalTransition = element.style.transition;
        
        // Apply highlight
        element.style.transition = 'all 0.5s ease-in-out';
        element.style.boxShadow = '0 0 0 2px rgba(66, 133, 244, 0.6)';
        element.style.animation = 'formmaster-pulse 1.5s 2';
        
        // Remove highlight after delay
        setTimeout(() => {
          element.style.boxShadow = originalBoxShadow;
          element.style.animation = 'none';
          
          // Restore original transition after animation completes
          setTimeout(() => {
            element.style.transition = originalTransition;
          }, 500);
        }, 3000);
      });
      
      // Remove style element after animation
      setTimeout(() => {
        if (styleEl.parentNode) {
          styleEl.parentNode.removeChild(styleEl);
        }
      }, 4000);
    });
  };
  
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
            //FM.setupEventListeners();
          }
          
          // Enable click-to-fill if it exists
          if (typeof FM.enableClickToFill === 'function') {
            //FM.enableClickToFill(FM.clickToFillValues);
          }
          
          // Show initial field highlights
          //FM.showInitialFieldHighlights();
        } else {
          console.warn("No form values available for click-to-fill");
          
          // Still set up event listeners
          if (typeof FM.setupEventListeners === 'function') {
            //FM.setupEventListeners();
          }
          
          // Still show initial field highlights
          //FM.showInitialFieldHighlights();
        }
      });
    }, 1000);
  });
})(); 