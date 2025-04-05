/**
 * Default values dialog module
 * Handles UI for collecting default field values from users
 */

const defaultsDialog = (() => {
  // Add function to display a dialog for collecting default field values
  async function showDefaultValueDialog(missingFields, rootUrl) {
    return new Promise((resolve, reject) => {      
      // Get the active tab in a way that works in both contexts
      function getActiveTab() {
        return new Promise((resolve, reject) => {
          // Try to get the active tab
          chrome.tabs.query({active: true, currentWindow: true}, tabs => {
            if (!tabs || tabs.length === 0) {
              // If no active tab in current window, try all windows
              chrome.tabs.query({active: true}, allTabs => {
                if (!allTabs || allTabs.length === 0) {
                  reject(new Error('No active tab found in any window'));
                } else {
                  // Use the first active tab from any window
                  resolve(allTabs[0]);
                }
              });
            } else {
              resolve(tabs[0]);
            }
          });
        });
      }
      
      // Start by getting the active tab
      getActiveTab()
        .then(tab => {
          const tabId = tab.id;
          
          // Create a unique message channel ID for this dialog
          const channelId = `defaults-dialog-${Date.now()}`;
          
          // First inject CSS for the dialog
          chrome.scripting.insertCSS({
            target: { tabId },
            css: `
              .formmaster-defaults-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: rgba(0, 0, 0, 0.5);
                z-index: 9999;
                display: flex;
                justify-content: center;
                align-items: center;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              }
              
              .formmaster-defaults-dialog {
                background-color: #ffffff;
                border-radius: 8px;
                box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
                width: 600px;
                max-width: 90%;
                max-height: 90vh;
                overflow: hidden;
                display: flex;
                flex-direction: column;
              }
              
              .formmaster-defaults-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 16px;
                border-bottom: 1px solid #e0e0e0;
                background-color: #f5f5f5;
              }
              
              .formmaster-defaults-title {
                font-size: 18px;
                font-weight: 600;
                color: #4285f4;
                margin: 0;
              }
              
              .formmaster-defaults-body {
                padding: 16px;
                overflow-y: auto;
                max-height: 60vh;
              }
              
              .formmaster-defaults-message {
                margin-bottom: 16px;
                padding: 12px;
                background-color: #f8f9fa;
                border-left: 4px solid #4285f4;
                border-radius: 4px;
                font-size: 14px;
                line-height: 1.5;
              }
              
              .formmaster-defaults-row {
                margin-bottom: 16px;
                display: flex;
                flex-direction: column;
              }
              
              .formmaster-defaults-label {
                font-weight: 500;
                margin-bottom: 6px;
              }
              
              .formmaster-mandatory-field {
                color: #d94235;
                font-weight: bold;
              }
              
              .formmaster-mandatory-indicator {
                color: #d94235;
                margin-left: 4px;
                font-weight: bold;
              }
              
              .formmaster-defaults-value {
                padding: 8px;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-size: 14px;
              }
              
              .formmaster-mandatory-input {
                border: 1px solid #d94235;
                background-color: #fff8f8;
              }
              
              .formmaster-defaults-footer {
                padding: 12px 16px;
                background-color: #f5f5f5;
                border-top: 1px solid #e0e0e0;
                display: flex;
                justify-content: flex-end;
                gap: 8px;
              }
              
              .formmaster-defaults-button {
                padding: 8px 16px;
                border-radius: 4px;
                border: none;
                cursor: pointer;
                font-weight: 500;
              }
              
              .formmaster-defaults-save {
                background-color: #4285f4;
                color: white;
              }
              
              .formmaster-defaults-cancel {
                background-color: #f2f2f2;
                color: #333;
              }
            `
          }).then(() => {
            // Set up a message listener for this specific dialog
            const messageListener = (message, sender, sendResponse) => {
              if (sender.tab && sender.tab.id === tabId && 
                  message.type === 'defaults-dialog-response' && 
                  message.channelId === channelId) {
                
                // Remove this listener once we get a response
                chrome.runtime.onMessage.removeListener(messageListener);
                
                if (message.action === 'save') {
                  // Successfully got values
                  resolve(message.values || {});
                } else {
                  // User cancelled - return empty object (no values saved)
                  resolve({});
                }
                
                // Send acknowledgment
                sendResponse({ received: true });
                return true;
              }
            };
            
            // Add the listener
            chrome.runtime.onMessage.addListener(messageListener);
            
            // Identify mandatory fields
            const mandatoryFields = missingFields.map(field => {
              return {
                ...field,
                // Fields that must be filled (you may want to customize this logic)
                mandatory: field.id?.includes('required') || 
                           field.name?.includes('required') || 
                           field.label?.includes('*') ||
                           false
              };
            });
            
            // Count mandatory fields
            const mandatoryCount = mandatoryFields.filter(f => f.mandatory).length;
            
            // Then inject and execute the script to create the dialog
            chrome.scripting.executeScript({
              target: { tabId },
              function: (dialogParams) => {
                // Extract params
                const { missingFields, channelId, rootUrl, mandatoryCount } = dialogParams;
                
                // Create dialog elements
                const overlay = document.createElement('div');
                overlay.className = 'formmaster-defaults-overlay';
                
                const dialog = document.createElement('div');
                dialog.className = 'formmaster-defaults-dialog';
                
                // Dialog header
                const header = document.createElement('div');
                header.className = 'formmaster-defaults-header';
                
                const title = document.createElement('h2');
                title.className = 'formmaster-defaults-title';
                title.textContent = `Missing Field Values (${missingFields.length})`;
                header.appendChild(title);
                
                // Dialog body
                const body = document.createElement('div');
                body.className = 'formmaster-defaults-body';
                
                // Comprehensive description message
                const message = document.createElement('div');
                message.className = 'formmaster-defaults-message';
                message.innerHTML = `
                  <p><strong>FormMasterPro needs your help!</strong></p>
                  <p>We couldn't automatically determine values for ${missingFields.length} fields on this form on <strong>${rootUrl}</strong>.</p>
                  <p>${mandatoryCount > 0 ? `<span class="formmaster-mandatory-field">${mandatoryCount} fields marked with * are mandatory</span> and must be filled to submit the form.` : 'None of these fields are mandatory, but providing values will help complete the form.'}</p>
                  <p>You can:</p>
                  <ul>
                    <li><strong>Enter values</strong> and click <strong>Save & Remember</strong> to use these values now and in future forms</li>
                    <li>Click <strong>Skip</strong> to continue without saving default values (you may need to fill these fields manually)</li>
                  </ul>
                `;
                body.appendChild(message);
                
                // Create form elements for each missing field
                const inputElements = {};
                
                missingFields.forEach(field => {
                  // Create dialog field UI
                  const isMandatory = field.mandatory;
                  
                  const row = document.createElement('div');
                  row.className = 'formmaster-defaults-row';
                  
                  const label = document.createElement('label');
                  label.className = 'formmaster-defaults-label';
                  if (isMandatory) {
                    label.classList.add('formmaster-mandatory-field');
                  }
                  
                  // Display field label with mandatory indicator if required
                  label.textContent = field.label + ' ' + field.name || field.id;
                  if (isMandatory) {
                    const mandatoryIndicator = document.createElement('span');
                    mandatoryIndicator.className = 'formmaster-mandatory-indicator';
                    mandatoryIndicator.textContent = ' *';
                    label.appendChild(mandatoryIndicator);
                  }
                  
                  // Create appropriate input based on field type
                  let inputElement;
                  if (field.type === 'select') {
                    inputElement = document.createElement('select');
                    inputElement.className = 'formmaster-defaults-value';
                    if (isMandatory) inputElement.classList.add('formmaster-mandatory-input');
                    
                    // Add blank option
                    const blankOption = document.createElement('option');
                    blankOption.value = '';
                    blankOption.textContent = '-- Select --';
                    inputElement.appendChild(blankOption);
                    
                    // Add options from field
                    if (field.options && Array.isArray(field.options)) {
                      field.options.forEach(option => {
                        const optElement = document.createElement('option');
                        optElement.value = option.value || '';
                        optElement.textContent = option.text || option.label || option.value || '';
                        inputElement.appendChild(optElement);
                      });
                    }
                  } else if (field.type === 'checkbox') {
                    inputElement = document.createElement('input');
                    inputElement.type = 'checkbox';
                    inputElement.className = 'formmaster-defaults-value';
                    if (isMandatory) inputElement.classList.add('formmaster-mandatory-input');
                  } else if (field.type === 'radio') {
                    // For radio buttons, create a select with the radio options
                    inputElement = document.createElement('select');
                    inputElement.className = 'formmaster-defaults-value';
                    if (isMandatory) inputElement.classList.add('formmaster-mandatory-input');
                    
                    // Add blank option
                    const blankOption = document.createElement('option');
                    blankOption.value = '';
                    blankOption.textContent = '-- Select --';
                    inputElement.appendChild(blankOption);
                    
                    // Add options from field
                    if (field.options && Array.isArray(field.options)) {
                      field.options.forEach(option => {
                        const optElement = document.createElement('option');
                        optElement.value = option.value || '';
                        optElement.textContent = option.label || option.value || '';
                        inputElement.appendChild(optElement);
                      });
                    }
                  } else if (field.type === 'date') {
                    inputElement = document.createElement('input');
                    inputElement.type = 'date';
                    inputElement.className = 'formmaster-defaults-value';
                    if (isMandatory) inputElement.classList.add('formmaster-mandatory-input');
                    
                    // Default to today
                    const today = new Date();
                    const yyyy = today.getFullYear();
                    const mm = String(today.getMonth() + 1).padStart(2, '0');
                    const dd = String(today.getDate()).padStart(2, '0');
                    inputElement.value = `${yyyy}-${mm}-${dd}`;
                  } else {
                    // Default to text input
                    inputElement = document.createElement('input');
                    inputElement.type = field.type || 'text';
                    inputElement.className = 'formmaster-defaults-value';
                    if (isMandatory) inputElement.classList.add('formmaster-mandatory-input');
                    inputElement.placeholder = `Enter value for ${field.label || field.name || field.id}`;
                  }
                  
                  // Store reference to the input element
                  inputElements[field.id || field.name] = inputElement;
                  
                  row.appendChild(label);
                  row.appendChild(inputElement);
                  body.appendChild(row);
                });
                
                // Dialog footer
                const footer = document.createElement('div');
                footer.className = 'formmaster-defaults-footer';
                
                const cancelButton = document.createElement('button');
                cancelButton.className = 'formmaster-defaults-button formmaster-defaults-cancel';
                cancelButton.textContent = 'Skip';
                cancelButton.onclick = () => {
                  document.body.removeChild(overlay);
                  // Use Chrome messaging API instead of window.postMessage
                  chrome.runtime.sendMessage({
                    type: 'defaults-dialog-response',
                    channelId: channelId,
                    action: 'cancel'
                  });
                };
                
                const saveButton = document.createElement('button');
                saveButton.className = 'formmaster-defaults-button formmaster-defaults-save';
                saveButton.textContent = 'Save & Remember';
                saveButton.onclick = () => {
                  // Collect values from all inputs
                  const values = {};
                  missingFields.forEach(field => {
                    const element = inputElements[field.id || field.name];
                    if (!element) return;
                    
                    if (field.type === 'checkbox') {
                      values[field.id || field.name] = element.checked;
                    } else {
                      values[field.id || field.name] = element.value;
                    }
                  });
                  
                  document.body.removeChild(overlay);
                  // Use Chrome messaging API instead of window.postMessage
                  chrome.runtime.sendMessage({
                    type: 'defaults-dialog-response',
                    channelId: channelId,
                    action: 'save',
                    values: values
                  });
                };
                
                footer.appendChild(cancelButton);
                footer.appendChild(saveButton);
                
                // Assemble dialog
                dialog.appendChild(header);
                dialog.appendChild(body);
                dialog.appendChild(footer);
                overlay.appendChild(dialog);
                
                // Add dialog to page
                document.body.appendChild(overlay);
                
                // Handle close message from extension
                chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
                  if (message.type === `${channelId}-close`) {
                    if (document.body.contains(overlay)) {
                      document.body.removeChild(overlay);
                    }
                    sendResponse({ closed: true });
                    return true;
                  }
                });
              },
              args: [{ 
                missingFields: mandatoryFields, 
                channelId, 
                rootUrl,
                mandatoryCount 
              }]
            }).catch(error => {
              chrome.runtime.onMessage.removeListener(messageListener);
              reject(error);
            });
          }).catch(error => {
            reject(error);
          });
        })
        .catch(error => {
          console.error('Tab query error:', error);
          
          // Fallback: If we can't show the dialog, return empty values
          // so the form filling can still continue with default values
          resolve({});
        });
    });
  }

  // Function to save default field values for a URL
  async function saveDefaultFieldValues(url, values) {
    return new Promise((resolve) => {
      chrome.storage.local.get(['defaultFieldValues'], function(result) {
        const defaultFieldValues = result.defaultFieldValues || {};
        defaultFieldValues[url] = values;
        
        chrome.storage.local.set({ defaultFieldValues }, function() {
          resolve();
        });
      });
    });
  }

  // Function to get default field values for a URL
  async function getDefaultFieldValues(url) {
    return new Promise((resolve) => {
      chrome.storage.local.get(['defaultFieldValues'], function(result) {
        const defaultFieldValues = result.defaultFieldValues || {};
        resolve(defaultFieldValues[url] || {});
      });
    });
  }

  // Return public API
  return {
    showDefaultValueDialog,
    saveDefaultFieldValues,
    getDefaultFieldValues
  };
})();

// Attach to the global scope
self.defaultsDialog = defaultsDialog;
