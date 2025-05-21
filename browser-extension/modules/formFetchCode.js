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
    
    // Disable the button while fetching
    if (fetchCodeBtn) {
      fetchCodeBtn.disabled = true;
      fetchCodeBtn.innerText = 'Fetching...';
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
        
        // Get current form fields
        const formFields = await getCurrentFormFields(currentTab.id);
        if (!formFields || formFields.length === 0) {
          throw new Error('No form fields found on the current page');
        }
        
        // Generate code for the form fields
        const code = await generateFormCode(formFields, currentUrl);
        
        // Show success message
        if (showToastCallback) {
          showToastCallback('success', 'Form code generated successfully!');
        }
        
        // Re-enable the button
        if (fetchCodeBtn) {
          fetchCodeBtn.disabled = false;
          fetchCodeBtn.innerText = 'Fetch Code';
        }
        
        return code;
      } catch (error) {
        console.error('Error fetching form code:', error);
        
        // Show error message
        if (showToastCallback) {
          showToastCallback('error', `Error: ${error.message}`);
        }
        
        // Re-enable the button
        if (fetchCodeBtn) {
          fetchCodeBtn.disabled = false;
          fetchCodeBtn.innerText = 'Fetch Code';
        }
        
        throw error;
      }
    });
  }
  
  // Helper function to get current form fields
  async function getCurrentFormFields(tabId) {
    return new Promise((resolve) => {
      chrome.scripting.executeScript({
        target: { tabId },
        function: () => {
          const fields = [];
          document.querySelectorAll('input, select, textarea').forEach(element => {
            if (element.offsetParent !== null) { // Only visible elements
              fields.push({
                id: element.id,
                name: element.name,
                type: element.type,
                tagName: element.tagName,
                className: element.className,
                placeholder: element.placeholder,
                options: element.options ? Array.from(element.options).map(opt => ({
                  value: opt.value,
                  text: opt.text
                })) : []
              });
            }
          });
          return fields;
        }
      }, (results) => {
        resolve(results && results[0] ? results[0].result : []);
      });
    });
  }

  // Helper function to generate form code
  async function generateFormCode(fields, url) {
    // Generate code based on the form fields
    const code = {
      url,
      fields: fields.map(field => ({
        id: field.id,
        name: field.name,
        type: field.type,
        tagName: field.tagName,
        className: field.className,
        placeholder: field.placeholder,
        options: field.options
      }))
    };
    
    return code;
  }
  
  return { fetchCode };
})();

// Expose the module to the global scope
self.formFetchCode = formFetchCode;

