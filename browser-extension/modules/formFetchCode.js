const formFetchCode = (() => {
  // Check if aiService is available in the global scope
  const checkDependencies = () => {
    if (typeof self.aiService === 'undefined') {
      console.error('Error: aiService module is not loaded or not available');
      return false;
    }
    return true;
  };

  function fetchCode(fetchCodeBtn, showToastCallback) {
    console.log('Fetching code...');
    
    // Check for required dependencies
    if (!checkDependencies()) {
      if (showToastCallback) {
        showToastCallback('error', 'Required dependencies not loaded. Please refresh the page and try again.');
      }
      return;
    }
    
    // Reference to the aiService module from the global scope
    const aiService = self.aiService;
    
    // Disable button while processing
    if (fetchCodeBtn) {
      fetchCodeBtn.disabled = true;
      fetchCodeBtn.innerText = 'Processing...';
    }
    
    // Get the active tab URL using Chrome API
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      try {
        if (!tabs || tabs.length === 0) {
          throw new Error('No active tab found');
        }

        const currentTab = tabs[0];
        const currentUrl = new URL(currentTab.url).origin;
        
        console.log('Current website URL:', currentUrl);
        
        // Load fieldMappingsV2 from local storage
        chrome.storage.local.get('fieldMappingsV2', async (result) => {
          try {
            const fieldMappingsV2 = result.fieldMappingsV2 || {};
            
            if (!fieldMappingsV2[currentUrl]) {
              throw new Error(`No form mappings found for the current URL: ${currentUrl}`);
            }
            
            // Call aiService.getAiCode to get AI-generated code for each container
            const updatedMappings = await aiService.getAiCode(fieldMappingsV2, currentUrl);
            
            // aiService.getAiCode already updates storage, no need to update it again here
            console.log('Field mappings updated with AI-generated code');
            
            // Show success message
            if (showToastCallback) {
              showToastCallback('success', 'AI code generated successfully!');
            }
            
            // Re-enable the button
            if (fetchCodeBtn) {
              fetchCodeBtn.disabled = false;
              fetchCodeBtn.innerText = 'Fetch Code';
            }
          } catch (error) {
            console.error('Error fetching AI code:', error);
            
            // Show error message
            if (showToastCallback) {
              showToastCallback('error', `Error: ${error.message}`);
            }
            
            // Re-enable the button
            if (fetchCodeBtn) {
              fetchCodeBtn.disabled = false;
              fetchCodeBtn.innerText = 'Fetch Code';
            }
          }
        });
      } catch (error) {
        console.error('Error getting current tab:', error);
        
        // Show error message
        if (showToastCallback) {
          showToastCallback('error', `Error: ${error.message}`);
        }
        
        // Re-enable the button
        if (fetchCodeBtn) {
          fetchCodeBtn.disabled = false;
          fetchCodeBtn.innerText = 'Fetch Code';
        }
      }
    });
  }
  
  return { fetchCode };
})();

// Expose the module to the global scope
self.formFetchCode = formFetchCode;

