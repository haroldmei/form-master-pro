/**
 * Form filling module
 */
const formFiller = (() => {
  /**
   * Inject the form extraction script and then fill the form
   */
  function injectAndFillForm(message, sendResponse) {
    // First inject the form_extract.js file
    chrome.scripting.executeScript({
      target: { tabId: message.tabId },
      files: ['forms/form_extract.js']
    }).then(() => {
      // Then execute a function that uses the injected form_extract.js
      chrome.scripting.executeScript({
        target: { tabId: message.tabId },
        function: () => {
          // Use the FormExtract object exposed by form_extract.js
          const formData = window.FormExtract.extractFormControls();
          console.log("Extracted form data:", formData);

          // Flatten the structure to match what processForm expects
          const fields = [];
          
          // Process inputs
          if (formData.inputs) {
            fields.push(...formData.inputs);
          }
          
          // Process selects
          if (formData.selects) {
            fields.push(...formData.selects);
          }
          
          // Process textareas
          if (formData.textareas) {
            fields.push(...formData.textareas);
          }
          
          // Process radio groups
          if (formData.radios) {
            fields.push(...formData.radios);
          }
          
          // Process checkboxes
          if (formData.checkboxes) {
            fields.push(...formData.checkboxes);
          }
          
          // Transform fields into simplified format with consistent properties
          const simplifiedFields = fields.map(field => {
            const result = {
              'label': field.label || '',
              'name': field.name || '',
              'type': field.type || 'text',
              'id': field.id || '',
              'value': '',
              'options': field.options || []
            };
            
            // Handle value based on field type
            if (field.type === 'select' || field.type === 'radio') {
              // For select/radio, show selected option
              const selectedOpt = field.options?.find(opt => opt.selected || opt.checked);
              result.value = selectedOpt ? (selectedOpt.value || selectedOpt.text || '') : '';
            } else if (field.type === 'checkbox') {
              result.value = field.checked ? 'Checked' : 'Unchecked';
            } else {
              result.value = field.value || '';
            }
            
            return result;
          });
          
          return {
            originalFields: fields,       // Keep original format for compatibility
            simplifiedFields: simplifiedFields  // New simplified format
          };
        }
      }).then(results => {
        if (!results || !results[0] || !results[0].result) {
          sendResponse({ success: false, error: "Could not extract form fields" });
          return;
        }

        const extractedData = results[0].result;
        const formFields = extractedData.simplifiedFields;
        
        // Store simplified data for potential future use
        chrome.storage.local.set({ 
          lastFormData: extractedData.simplifiedFields 
        });
        
        // Continue with existing process using the original format for compatibility
        formProcessor.processForm(formFields, message.url).then(result => {
          console.log("Processing result:", result);

          if (result.success) {
            // Fill the form with the values
            chrome.scripting.executeScript({
              target: { tabId: message.tabId },
              function: fillFormWithData,
              args: [result.fields]
            }).then(() => {
              sendResponse({ success: true });
            }).catch(error => {
              sendResponse({ success: false, error: error.message });
            });
          } else {
            sendResponse({ success: false, error: result.error });
          }
        });
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    }).catch(error => {
      sendResponse({ success: false, error: "Failed to inject form extraction script: " + error.message });
    });
  }
  
  /**
   * Show a notification on the page
   */
  function showPageNotification(tabId, userName) {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      function: (userName) => {
        // Create a small notification in the page
        const notification = document.createElement('div');
        notification.style.cssText = `
          position: fixed;
          top: 10px;
          right: 10px;
          background: rgba(66, 133, 244, 0.9);
          color: white;
          padding: 10px 15px;
          border-radius: 4px;
          font-family: Arial, sans-serif;
          z-index: 9999;
          box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        `;
        notification.textContent = 'FormMaster data ready! Click extension icon to fill form for: ' + userName;
        document.body.appendChild(notification);
        
        // Remove after a few seconds
        setTimeout(() => {
          notification.style.opacity = '0';
          notification.style.transition = 'opacity 0.5s';
          setTimeout(() => notification.remove(), 500);
        }, 5000);
      },
      args: [userName]
    });
  }
  
  /**
   * Function to scan form fields (injected into page)
   */
  function scanFormFields() {
    const fields = [];
    
    // Get all input elements
    const inputs = document.querySelectorAll('input, select, textarea');
    
    inputs.forEach(input => {
      // Skip hidden, submit, button, and other non-data fields
      if (['submit', 'button', 'image', 'reset', 'file'].includes(input.type)) {
        return;
      }
      
      const fieldInfo = {
        type: input.type || 'text',
        id: input.id || '',
        name: input.name || '',
        placeholder: input.placeholder || '',
        className: input.className || '',
        value: input.value || ''
      };
      
      // Get label text if available
      const labelElement = document.querySelector(`label[for="${input.id}"]`);
      if (labelElement) {
        fieldInfo.label = labelElement.textContent.trim();
      }
      
      fields.push(fieldInfo);
    });
    
    return fields;
  }
  
  /**
   * Function to fill form fields (injected into page)
   */
  function fillFormWithData(fieldValues) {
    for (const key in fieldValues) {
      // Find elements by ID, name, or placeholder
      const elements = [
        ...document.querySelectorAll(`input#${key}, input[name="${key}"], input[placeholder="${key}"]`),
        ...document.querySelectorAll(`select#${key}, select[name="${key}"]`),
        ...document.querySelectorAll(`textarea#${key}, textarea[name="${key}"], textarea[placeholder="${key}"]`)
      ];
      
      console.log("Filling field:", key, "with value:", fieldValues[key]);
  
      elements.forEach(element => {
        if (element.type === 'checkbox' || element.type === 'radio') {
          element.checked = !!fieldValues[key];
        } else {
          element.value = fieldValues[key];
          // Trigger change event to notify the page
          element.dispatchEvent(new Event('change', { bubbles: true }));
          element.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
    }
    
    return true;
  }

  // Return public API
  return {
    injectAndFillForm,
    showPageNotification,
    scanFormFields,
    fillFormWithData
  };
})();
