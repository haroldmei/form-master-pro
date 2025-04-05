/**
 * Form processing module
 */
const formProcessor = (() => {
  // Cache for ALL suggestions (both AI and rule-based) to minimize API calls
  const allSuggestionsCache = {};
  
  function generateProfileHash(userProfile) {
    if (!userProfile.filename) return 'default';
    return 'profile_' + userProfile.filename;
  }
  
  // Add function to display a dialog for collecting default field values
  async function showDefaultValueDialog(missingFields, rootUrl) {
    return new Promise((resolve, reject) => {
      // Check if we're in a background script context
      const isBackgroundContext = (typeof chrome !== 'undefined' && 
                                  chrome.extension &&
                                  chrome.extension.getBackgroundPage &&
                                  chrome.extension.getBackgroundPage() === window);
      
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
            
            // Identify mandatory fields (You would need to identify these based on your form analysis)
            // For this example, I'm marking fields with no alternatives as mandatory
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
                  const isMandatory = field.mandatory;
                  
                  const row = document.createElement('div');
                  row.className = 'formmaster-defaults-row';
                  
                  const label = document.createElement('label');
                  label.className = 'formmaster-defaults-label';
                  if (isMandatory) {
                    label.classList.add('formmaster-mandatory-field');
                  }
                  
                  // Display field label with mandatory indicator if required
                  label.textContent = field.label || field.name || field.id;
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
  
  async function processForm(formFields, url) {
    try {
      console.log("Processing form for URL:", url);
      
      // Extract the root URL (domain + path up to first directory)
      const urlObj = new URL(url);
      const rootUrl = urlObj.hostname;
      
      // Get user profile and generate hash
      const userProfile = userProfileManager.getUserProfileSync();
      console.log("User profile:", userProfile);
      if (!userProfile.filename) {
        throw new Error('Please load data first.');
      }

      const profileHash = generateProfileHash(userProfile);
      const cacheKey = `${rootUrl}_${profileHash}`;
      
      // Get existing field mappings and ALL suggestions from storage
      const result = await chrome.storage.local.get(['fieldMappings', 'allSuggestions']);
      let siteFieldMappings = result.fieldMappings || {};
      
      // Initialize site mappings if not present
      if (!siteFieldMappings[rootUrl]) {
        siteFieldMappings[rootUrl] = [];
      }
      
      // Initialize or load ALL suggestions cache
      const storedSuggestions = result.allSuggestions || {};
      if (!allSuggestionsCache[cacheKey] && storedSuggestions[cacheKey]) {
        allSuggestionsCache[cacheKey] = storedSuggestions[cacheKey];
      } else if (!allSuggestionsCache[cacheKey]) {
        allSuggestionsCache[cacheKey] = {};
      }
      
      // Create fieldKeywords for current form
      const currentFormFields = {};
      formFields.forEach(field => {
        const keyName = field.label || field.name || field.id || '';
        if (keyName.trim() === '') return;
        
        if (field.options && Array.isArray(field.options) && field.options.length > 0) {
          currentFormFields[keyName] = field.options.map(option => 
            option.text || option.label || option.value || ''
          ).filter(Boolean);
        } else {
          currentFormFields[keyName] = [];
        }
      });
      
      // Check if we need to make an API call
      let needApiCall = false;
      let allSuggestions = { ...allSuggestionsCache[cacheKey] };
      
      console.log("Current form fields:", currentFormFields);
      console.log("Cached suggestions:", allSuggestions);
      
      // Check if all current form fields have suggestions in our cache
      for (const fieldKey of Object.keys(currentFormFields)) {
        if (!allSuggestions[fieldKey]) {
          needApiCall = true;
          console.log("Need API call for field:", fieldKey);
          break;
        }
      }
      
      // Step 1: First check with AI for missing fields if needed
      if (needApiCall && Object.keys(userProfile).length > 0) {
        console.log("API call needed for new fields");
        
        // Gather all known fields for this site (current form + historical mappings)
        const allSiteFields = {...currentFormFields};
        
        // Add fields from historical site mappings
        siteFieldMappings[rootUrl].forEach(mapping => {
          const keyName = mapping.label || mapping.name || mapping.id || '';
          if (keyName.trim() !== '' && !allSiteFields[keyName]) {
            // Check if this is a select or radio field with options
            if ((mapping.type === 'select' || mapping.type === 'radio') && mapping.options) {
              allSiteFields[keyName] = mapping.options.map(option => 
                option.text || option.label || option.value || ''
              ).filter(Boolean);
            } else {
              allSiteFields[keyName] = [];
            }
          }
        });
        
        console.log("Making API call with ALL site fields:", Object.keys(allSiteFields));
        
        try {
          // Make ONE comprehensive API call for all fields
          const aiSuggestions = await aiService.getAiSuggestions(allSiteFields, userProfile, url);
          console.log("Received AI suggestions");
          
          // Merge AI suggestions into our combined suggestions
          allSuggestions = {
            ...allSuggestions,
            ...aiSuggestions
          };
        } catch (apiError) {
          console.error("Error getting AI suggestions:", apiError);
          // Continue with processing - we'll use rule-based suggestions as fallback
        }
      } else {
        console.log("Using cached suggestions - no API call needed");
      }
      
      // Load any saved default field values for this URL
      const savedDefaultValues = await getDefaultFieldValues(rootUrl);
      
      // Step 2: Apply rule-based matches for any remaining fields without answers
      const missingFields = []; // Track fields that need default values
      
      formFields.forEach(field => {
        const fieldId = field.id || '';
        const fieldName = field.name || '';
        const fieldLabel = field.label || '';
        
        // Skip if we already have a suggestion for this field
        const keyName = fieldLabel || fieldName || fieldId;
        const fieldIdentifier = fieldId || fieldName;
        
        if (!keyName || allSuggestions[keyName]) return;
        
        // Check if we have a saved default value for this field
        if (savedDefaultValues[fieldIdentifier]) {
          allSuggestions[keyName] = savedDefaultValues[fieldIdentifier];
          console.log("Using saved default value for field:", keyName, savedDefaultValues[fieldIdentifier]);
          return;
        }
        
        // Apply rule-based mapping for this field
        const fieldType = field.type || 'text';
        const result = getValueFromGeneralMappings(field, fieldId, fieldName, fieldLabel, fieldType);
        
        if (result.value) {
          // Add rule-based suggestion to our collection
          allSuggestions[keyName] = result.value;
        } else {
          // If no rule-based value, add to missing fields list
          missingFields.push({
            id: fieldId,
            name: fieldName,
            label: fieldLabel || keyName,
            type: fieldType,
            options: field.options,
            // Try to determine if field is mandatory based on various signals
            mandatory: field.required === true || 
                      fieldLabel?.includes('*') ||
                      fieldId?.toLowerCase().includes('required') ||
                      fieldName?.toLowerCase().includes('required')
          });
          
          // Still set a temporary default value (will be overridden if user provides one)
          if (field.options && Array.isArray(field.options) && field.options.length > 0) {
            allSuggestions[keyName] = field.options[0].value || field.options[0].text || field.options[0].label;
            console.log("default option for field:", keyName, allSuggestions[keyName]);
          } else if (fieldType === 'date') {
            // For date fields, use today's date in YYYY-MM-DD format
            const today = new Date();
            const yyyy = today.getFullYear();
            const mm = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-based
            const dd = String(today.getDate()).padStart(2, '0');
            allSuggestions[keyName] = `${yyyy}-${mm}-${dd}`;
            console.log("default date for field:", keyName, allSuggestions[keyName]);
          } else if (fieldType === 'text') {
            allSuggestions[keyName] = '-';
            console.log("default value for field:", keyName, allSuggestions[keyName]);
          } else if (fieldType === 'checkbox' || fieldType === 'radio') {
            allSuggestions[keyName] = 'on';
            console.log("default value for check/radio field:", keyName, allSuggestions[keyName]);
          } else {
            allSuggestions[keyName] = 'na';
            console.log("empty default for field:", keyName);
          }
        }
      });
      
      // If we have missing fields, show dialog to get default values from the user
      if (missingFields.length > 0) {
        console.log("Showing dialog for missing fields:", missingFields);
        
        try {
          // Wrap in timeout to ensure Chrome API is ready
          const userDefaultValues = await Promise.race([
            showDefaultValueDialog(missingFields, rootUrl),
            new Promise(resolve => setTimeout(() => {
              console.log("Dialog timeout - continuing with defaults");
              resolve({});
            }, 1000)) // Short timeout as fallback
          ]);

          console.log("User provided default values:", userDefaultValues);
          
          if (Object.keys(userDefaultValues).length > 0) {
            // Save these values for future form filling
            await saveDefaultFieldValues(rootUrl, userDefaultValues);
            
            // Update our current suggestions with the user-provided values
            missingFields.forEach(field => {
              const fieldIdentifier = field.id || field.name;
              if (userDefaultValues[fieldIdentifier]) {
                const keyName = field.label || field.name || field.id;
                allSuggestions[keyName] = userDefaultValues[fieldIdentifier];
              }
            });
          }
        } catch (dialogError) {
          console.error("Error showing default values dialog:", dialogError);
          // Continue with temporary default values we already set
        }
      }
      
      // Save all suggestions to cache
      allSuggestionsCache[cacheKey] = {...allSuggestions};
      
      // Step 3: Save everything to 'allSuggestions' storage
      storedSuggestions[cacheKey] = allSuggestionsCache[cacheKey];
      chrome.storage.local.set({ allSuggestions: storedSuggestions }, function() {
        console.log("Saved all suggestions for URL + profile");
      });
      
      // Match form fields with mappings and retrieve values
      const fieldValues = {};
      const updatedSiteMapping = [...siteFieldMappings[rootUrl]]; // Clone existing mappings
      let mappingsUpdated = false;
      
      console.log("Current page:", formFields.map(f => f.label || f.id || f.name));
      formFields.forEach(field => {
        const fieldId = field.id || '';
        const fieldName = field.name || '';
        const fieldLabel = field.label || '';
        const fieldType = field.type || 'text';
        
        // Check if we have a suggestion for this field from any source
        let suggestionValue = null;
        let isAiGenerated = false;
        
        // Look for suggestions using various field identifiers
        if (fieldId && allSuggestions[fieldId]) {
          suggestionValue = allSuggestions[fieldId];
          isAiGenerated = true; // Assume AI-generated by default, we can't easily distinguish the source
        } else if (fieldName && allSuggestions[fieldName]) {
          suggestionValue = allSuggestions[fieldName];
          isAiGenerated = true;
        } else if (fieldLabel && allSuggestions[fieldLabel]) {
          suggestionValue = allSuggestions[fieldLabel];
          isAiGenerated = true;
        } else {
          // Try to find any matching key in suggestions
          const suggestionKeys = Object.keys(allSuggestions);
          
          for (const key of suggestionKeys) {
            const keyLower = key.toLowerCase();
            
            if ((fieldId && keyLower.includes(fieldId.toLowerCase())) || 
                (fieldName && keyLower.includes(fieldName.toLowerCase())) || 
                (fieldLabel && keyLower.includes(fieldLabel.toLowerCase()))) {
              suggestionValue = allSuggestions[key];
              isAiGenerated = true;
              break;
            }
          }
        }
        
        // Store this mapping for future use
        const existingIndex = updatedSiteMapping.findIndex(mapping => 
          (fieldId && mapping.id === fieldId) || (mapping.name && mapping.name === fieldName)
          );

        // If we found a suggestion, process it according to field type
        if (suggestionValue !== null) {
          // Format the value based on field type
          let formattedValue = utils.formatValueForFieldType(suggestionValue, fieldType, field);
          fieldValues[fieldId || fieldName] = formattedValue;
          
          if (existingIndex < 0) {
            const newMapping = {
              id: fieldId, 
              label: fieldLabel, 
              name: fieldName, 
              type: fieldType, 
              value: formattedValue, 
              aiGenerated: isAiGenerated,
              lastUsed: new Date().toISOString()
            };
            updatedSiteMapping.push(newMapping);
            mappingsUpdated = true;
          } else {
            // Update the existing mapping with the new value
            updatedSiteMapping[existingIndex].value = formattedValue;
            updatedSiteMapping[existingIndex].lastUsed = new Date().toISOString();
          }
        }
      });
      
      // If we made updates to the mappings, save them back to storage
      if (mappingsUpdated) {
        siteFieldMappings[rootUrl] = updatedSiteMapping;
        console.log("Saving updated field mappings for site:", rootUrl);
        
        // Limit storage size by keeping only the last 200 mappings per site
        if (updatedSiteMapping.length > 200) {
          // Sort by lastUsed and keep only the most recent 200
          siteFieldMappings[rootUrl] = updatedSiteMapping
            .sort((a, b) => new Date(b.lastUsed) - new Date(a.lastUsed))
            .slice(0, 200);
        }
        
        // Save the updated mappings
        chrome.storage.local.set({ fieldMappings: siteFieldMappings }, function() {
          console.log("Field mappings updated successfully");
        });
      }
      
      console.log("Processed field values:", fieldValues);
      return { success: true, fields: fieldValues };
    } catch (error) {
      console.error("Error processing form:", error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Get value from general mappings (non-site-specific)
   */
  function getValueFromGeneralMappings(field, fieldId, fieldName, fieldLabel, fieldType) {
    // Check if we have a user profile value that matches
    // Common field patterns and their corresponding user profile paths
    const commonMappings = [
      // Personal information
      { pattern: /first.?name|fname|given.?name/i, path: "personal.firstName", source: "profile" },
      { pattern: /last.?name|lname|surname|family.?name/i, path: "personal.lastName", source: "profile" },
      { pattern: /full.?name|name/i, path: "personal.fullName", source: "profile" },
      { pattern: /email|e.?mail|mail/i, path: "personal.email", source: "profile" },
      { pattern: /phone|mobile|cell/i, path: "personal.phone", source: "profile" },
      { pattern: /birth|dob|birthday/i, path: "personal.dateOfBirth", source: "profile" },
      { pattern: /gender|sex/i, path: "personal.gender", source: "profile" },
      
      // Address information
      { pattern: /address|street/i, path: "address.street", source: "profile" },
      { pattern: /city|town|locality/i, path: "address.city", source: "profile" },
      { pattern: /state|province|region/i, path: "address.state", source: "profile" },
      { pattern: /zip|postal|post.?code/i, path: "address.postalCode", source: "profile" },
      { pattern: /country/i, path: "address.country", source: "profile" },
      
      // Payment information (handle with care)
      { pattern: /cc.?name|card.?name|name.?on.?card/i, path: "payment.cardholderName", source: "profile" },
      
      // Credential information (don't auto-fill by default)
      { pattern: /username|user|login/i, path: "credentials.username", source: "profile" }
    ];
    
    // Field identifiers to check against patterns
    const identifiers = [
      fieldId, 
      fieldName,
      fieldLabel,
      field.placeholder
    ].filter(Boolean).map(id => id.toLowerCase());
    
    // Check each identifier against our common mappings
    for (const identifier of identifiers) {
      for (const mapping of commonMappings) {
        if (mapping.pattern.test(identifier)) {
          // Use the synchronous version to avoid Promise issues
          const value = userProfileManager.getUserProfileFieldSync(mapping.path);
          if (value) {
            return { 
              value: utils.formatValueForFieldType(value, fieldType, field),
              source: mapping.source
            };
          }
        }
      }
    }
    
    // No matching value found
    return { value: null, source: null };
  }
  
  /**
   * Clear all suggestions data from cache and storage
   */
  async function clearSuggestions() {
    try {
      // Clear in-memory cache
      Object.keys(allSuggestionsCache).forEach(key => {
        delete allSuggestionsCache[key];
      });
      
      // Clear storage
      await new Promise((resolve, reject) => {
        chrome.storage.local.remove('allSuggestions', () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });
      
      console.log("All form suggestions data cleared");
      return { success: true };
    } catch (error) {
      console.error("Error clearing suggestions:", error);
      return { success: false, error: error.message || "Unknown error clearing data" };
    }
  }
  
  // Initialize by loading ALL suggestions from storage
  chrome.storage.local.get(['allSuggestions'], function(result) {
    if (result.allSuggestions) {
      Object.assign(allSuggestionsCache, result.allSuggestions);
      console.log("Loaded all suggestions from storage");
    }
  });
  
  // Return public API
  return {
    processForm,
    clearSuggestions,
    saveDefaultFieldValues,
    getDefaultFieldValues
  };
})();

self.formProcessor = formProcessor;