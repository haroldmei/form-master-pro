/**
 * Form filling module
 */
const formFiller = (() => {

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
          const formData = self.FormExtract.extractFormControls();
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
  
function fillFormWithData(fieldValues) {
    console.log("Filling form with data:", fieldValues);
    
    // First, process all non-radio controls
    for (const key in fieldValues) {
      const value = fieldValues[key];
      
      // Skip if no value to fill
      if (value === null || value === undefined) continue;
      
      // Find elements by ID or name (ID takes precedence)
      const elementsByIdOrName = document.querySelectorAll(
        `#${CSS.escape(key)}, [name="${CSS.escape(key)}"]`
      );
      
      if (elementsByIdOrName.length === 0) {
        console.log(`No element found for key: ${key}`);
        continue;
      }
      
      elementsByIdOrName.forEach(element => {
        // Handle different input types
        switch(element.type) {
          case 'checkbox':
            // Convert various truthy/falsy values for checkboxes
            if (typeof value === 'boolean') {
              element.checked = value;
            } else if (typeof value === 'string') {
              const lowercaseValue = value.toLowerCase();
              element.checked = ['true', 'yes', 'on', '1', 'checked'].includes(lowercaseValue);
            } else {
              element.checked = !!value;
            }
            break;
            
          case 'radio':
            // For radio buttons, only check it if the value matches
            if (element.value === String(value)) {
              element.checked = true;
            }
            break;
            
          case 'select-one':
          case 'select-multiple':
            // For select elements, find the matching option
            const options = Array.from(element.options);
            const matchingOption = options.find(option => 
              option.value === String(value) || 
              option.text === String(value)
            );
            
            if (matchingOption) {
              matchingOption.selected = true;
            } else {
              // If no exact match, try case-insensitive or partial matching
              const lcValue = String(value).toLowerCase();
              const altOption = options.find(option => 
                option.value.toLowerCase() === lcValue || 
                option.text.toLowerCase() === lcValue ||
                option.text.toLowerCase().includes(lcValue) ||
                lcValue.includes(option.value.toLowerCase())
              );
              
              if (altOption) {
                altOption.selected = true;
              } else {
                console.log(`No matching option found for select ${key} with value ${value}`);
              }
            }
            break;
            
          default:
            // For text inputs, textareas, etc.
            element.value = value;
        }
        
        // Trigger change event to notify the page
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.dispatchEvent(new Event('input', { bubbles: true }));
      });
    }
    
    // Special handling for radio groups by name
    // This finds all radio groups and then sets the right one based on value
    const processedRadioGroups = new Set();
    
    for (const key in fieldValues) {
      // Skip already processed items
      if (processedRadioGroups.has(key)) continue;
      
      const value = fieldValues[key];
      if (value === null || value === undefined) continue;
      
      // Look for radio buttons with this name
      const radioGroup = document.querySelectorAll(`input[type="radio"][name="${CSS.escape(key)}"]`);
      
      if (radioGroup.length > 1) {
        console.log(`Processing radio group: ${key} with value: ${value}`);
        processedRadioGroups.add(key);
        
        // Try to find the radio with matching value
        let foundMatch = false;
        
        // First try exact match
        for (const radio of radioGroup) {
          if (radio.value === String(value)) {
            radio.checked = true;
            foundMatch = true;
            radio.dispatchEvent(new Event('change', { bubbles: true }));
            break;
          }
        }
        
        // If no exact match, try case-insensitive
        if (!foundMatch) {
          const lcValue = String(value).toLowerCase();
          for (const radio of radioGroup) {
            if (radio.value.toLowerCase() === lcValue) {
              radio.checked = true;
              foundMatch = true;
              radio.dispatchEvent(new Event('change', { bubbles: true }));
              break;
            }
          }
        }
        
        // If still no match, try matching against labels
        if (!foundMatch) {
          for (const radio of radioGroup) {
            // Try to get the label text
            let labelText = '';
            
            // By "for" attribute
            if (radio.id) {
              const labelElement = document.querySelector(`label[for="${radio.id}"]`);
              if (labelElement) labelText = labelElement.textContent.trim();
            }
            
            // By parent label
            if (!labelText) {
              let parent = radio.parentElement;
              while (parent && parent.tagName !== 'FORM') {
                if (parent.tagName === 'LABEL') {
                  labelText = parent.textContent.trim();
                  break;
                }
                parent = parent.parentElement;
              }
            }
            
            // By next sibling text node
            if (!labelText) {
              let nextSibling = radio.nextSibling;
              while (nextSibling && !labelText) {
                if (nextSibling.nodeType === 3) { // Text node
                  labelText = nextSibling.textContent.trim();
                  if (labelText) break;
                } else if (nextSibling.nodeType === 1) { // Element node
                  labelText = nextSibling.textContent.trim();
                  if (labelText) break;
                }
                nextSibling = nextSibling.nextSibling;
              }
            }
            
            // Compare if we found any label text
            if (labelText && 
               (labelText.toLowerCase() === String(value).toLowerCase() ||
                labelText.toLowerCase().includes(String(value).toLowerCase()))) {
              radio.checked = true;
              foundMatch = true;
              radio.dispatchEvent(new Event('change', { bubbles: true }));
              break;
            }
          }
        }
        
        if (!foundMatch) {
          console.log(`Could not find matching radio button for ${key} with value ${value}`);
        }
      }
    }
    
    // Process radio groups passed as objects with name and options
    for (const key in fieldValues) {
      const value = fieldValues[key];
      
      // Check if this is a radio group object from our extraction
      if (value && typeof value === 'object' && value.type === 'radio' && 
          value.name && Array.isArray(value.options)) {
        
        const groupName = value.name;
        const selectedValue = value.selectedValue || '';
        
        if (!selectedValue) continue;
        
        const radioButtons = document.querySelectorAll(`input[type="radio"][name="${CSS.escape(groupName)}"]`);
        for (const radio of radioButtons) {
          if (radio.value === selectedValue) {
            radio.checked = true;
            radio.dispatchEvent(new Event('change', { bubbles: true }));
            break;
          }
        }
      }
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

self.formFiller = formFiller;