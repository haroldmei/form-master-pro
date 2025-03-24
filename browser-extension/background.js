importScripts('auth.js');

// Initialize the Auth0 client

// Listen for auth-related messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'auth-callback') {
    // Handle successful authentication callback
    const expiresAt = Date.now() + (parseInt(message.expiresIn) * 1000);
    const authState = {
      accessToken: message.accessToken,
      idToken: message.idToken,
      expiresAt
    };
    
    // Store auth state
    chrome.storage.local.set({ authState }, () => {
      console.log('Auth state stored after successful login');
      
      // Broadcast auth state change to any open extension pages
      chrome.runtime.sendMessage({ type: 'auth-state-changed', isAuthenticated: true });
    });
    
    sendResponse({ success: true });
    return true;
  }
  
  if (message.type === 'auth-error') {
    console.error('Auth error:', message.error, message.errorDescription);
    sendResponse({ success: false, error: message.error });
    return true;
  }
  
  if (message.action === 'checkAuth') {
    auth0Service.isAuthenticated()
      .then(isAuthenticated => sendResponse({ isAuthenticated }))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }
  
  if (message.action === 'getToken') {
    auth0Service.getAccessToken()
      .then(token => sendResponse({ token }))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }
  
  if (message.action === 'login') {
    auth0Service.login()
      .then(result => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (message.action === 'logout') {
    auth0Service.logout()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

// Initialize auth on extension startup
auth0Service.init()
  .then(isAuthenticated => {
    console.log('Auth initialized, authenticated:', isAuthenticated);
  })
  .catch(error => {
    console.error('Auth initialization error:', error);
  });


// User profile data - will be loaded from storage
let userProfileData = {};

// Initialize when extension loads
loadUserProfile();

// Load user profile from storage
function loadUserProfile() {
  chrome.storage.sync.get(['userProfile'], function(result) {
    userProfileData = result.userProfile || {};
    console.log("User profile loaded:", userProfileData);
  });
}

// Save changes to user profile
function saveUserProfile() {
  chrome.storage.sync.set({ userProfile: userProfileData }, function() {
    console.log("User profile saved");
  });
}

// Process a form with field mappings
async function processForm(formFields, url) {
  try {

    console.log("Processing form for URL:", url);
    
    // Extract the root URL (domain + path up to first directory)
    const urlObj = new URL(url);
    const rootUrl = urlObj.hostname; //urlObj.origin + urlObj.pathname.split('/').slice(0, 2).join('/');
    console.log("Using root URL for mappings:", rootUrl);
    
    // Get existing field mappings from storage
    const result = await chrome.storage.sync.get(['fieldMappings']);
    let siteFieldMappings = result.fieldMappings || {};
    
    // Initialize site mappings if not present
    if (!siteFieldMappings[rootUrl]) {
      siteFieldMappings[rootUrl] = [];
    }
    
    // Collect field labels and names for AI analysis
    const fieldKeywords = formFields.map(field => {
      // Prefer label if available, otherwise use name
      return field.label || field.name || field.id || '';
    }).filter(keyword => keyword.trim() !== ''); // Filter out empty values
    
    // If we have field keywords and user profile data, make an API call
    let aiSuggestions = {};
    if (fieldKeywords.length > 0 && Object.keys(userProfileData).length > 0) {
      try {
        aiSuggestions = await getAiSuggestions(fieldKeywords, userProfileData, url);
        console.log("AI suggestions:", aiSuggestions);
        
        // Store the AI suggestions for later reference
        chrome.storage.local.set({ lastAiSuggestions: aiSuggestions });
      } catch (apiError) {
        console.error("Error getting AI suggestions:", apiError);
      }
    }
    
    // Match form fields with mappings and retrieve values
    const fieldValues = {};
    const updatedSiteMapping = [...siteFieldMappings[rootUrl]]; // Clone existing mappings
    let mappingsUpdated = false;
    
    formFields.forEach(field => {
      const fieldId = field.id || '';
      const fieldName = field.name || '';
      const fieldLabel = field.label || '';
      const fieldType = field.type || 'text';
      
      // First check if AI provided a suggestion for this field
      // Try multiple identifiers to find a match
      let suggestionValue = null;
      
      // Look for AI suggestions using various field identifiers
      if (fieldId && aiSuggestions[fieldId]) {
        suggestionValue = aiSuggestions[fieldId];
      } else if (fieldName && aiSuggestions[fieldName]) {
        suggestionValue = aiSuggestions[fieldName];
      } else if (fieldLabel && aiSuggestions[fieldLabel]) {
        suggestionValue = aiSuggestions[fieldLabel];
      } else {
        // Try to find any matching key in suggestions that contains our field identifiers
        const suggestionKeys = Object.keys(aiSuggestions);
        
        for (const key of suggestionKeys) {
          // Case-insensitive matching for better results
          const keyLower = key.toLowerCase();
          
          if ((fieldId && keyLower.includes(fieldId.toLowerCase())) || 
              (fieldName && keyLower.includes(fieldName.toLowerCase())) || 
              (fieldLabel && keyLower.includes(fieldLabel.toLowerCase()))) {
            suggestionValue = aiSuggestions[key];
            break;
          }
        }
      }
      
      // If we found a suggestion, process it according to field type
      if (suggestionValue !== null) {
        // Format the value based on field type
        let formattedValue = formatValueForFieldType(suggestionValue, fieldType, field);
        fieldValues[fieldId || fieldName] = formattedValue;
        
        // Store this successful AI mapping for future use
        const existingIndex = updatedSiteMapping.findIndex(mapping => 
          (mapping.id === fieldId) || (mapping.name === fieldName)
        );
        
        const newMapping = {
          id: fieldId,
          label: fieldLabel,
          name: fieldName,
          type: fieldType,
          value: formattedValue,
          aiGenerated: true,
          lastUsed: new Date().toISOString()
        };
        
        if (existingIndex >= 0) {
          updatedSiteMapping[existingIndex] = newMapping;
        } else {
          updatedSiteMapping.push(newMapping);
        }
        
        mappingsUpdated = true;
        return; // Skip further processing for this field
      }
      
      // Check if the field exists in our site-specific mappings
      const existingMapping = siteFieldMappings[rootUrl].find(mapping => 
        (mapping.id && mapping.id === fieldId) || (mapping.name && mapping.name === fieldName)
      );
      
      if (existingMapping) {
        // Use the existing mapping
        const formattedValue = formatValueForFieldType(existingMapping.value, fieldType, field);
        fieldValues[fieldId || fieldName] = formattedValue;
        
        // Update the lastUsed timestamp
        const mappingIndex = updatedSiteMapping.findIndex(m => 
          (m.id === existingMapping.id) || (m.name === existingMapping.name)
        );
        
        if (mappingIndex >= 0) {
          updatedSiteMapping[mappingIndex].lastUsed = new Date().toISOString();
          mappingsUpdated = true;
        }
      } else {
        // If no existing mapping found, fall back to general field mappings
        const result = getValueFromGeneralMappings(field, fieldId, fieldName, fieldLabel, fieldType);
        
        if (result.value) {
          fieldValues[fieldId || fieldName] = result.value;
          
          // Add this mapping to the site-specific mappings for future use
          updatedSiteMapping.push({
            id: fieldId,
            label: fieldLabel,
            name: fieldName,
            type: fieldType,
            value: result.value,
            source: result.source,
            lastUsed: new Date().toISOString()
          });
          
          mappingsUpdated = true;
        }
      }
    });
    
    // If we made updates to the mappings, save them back to storage
    if (mappingsUpdated) {
      siteFieldMappings[rootUrl] = updatedSiteMapping;
      console.log("Saving updated field mappings for site:", rootUrl);
      
      // Limit storage size by keeping only the last 100 mappings per site
      if (updatedSiteMapping.length > 100) {
        // Sort by lastUsed and keep only the most recent 100
        siteFieldMappings[rootUrl] = updatedSiteMapping
          .sort((a, b) => new Date(b.lastUsed) - new Date(a.lastUsed))
          .slice(0, 100);
      }
      
      // Save the updated mappings
      chrome.storage.sync.set({ fieldMappings: siteFieldMappings }, function() {
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
 * This is a helper function for processForm
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
        const value = getUserProfileField(mapping.path);
        if (value) {
          return { 
            value: formatValueForFieldType(value, fieldType, field),
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
 * Format a value based on the field type
 * @param {*} value - The raw value to format
 * @param {string} fieldType - The type of the form field (e.g., 'text', 'radio', 'checkbox')
 * @param {Object} fieldInfo - Additional field info like options for selects
 * @returns {*} - Formatted value appropriate for the field type
 */
function formatValueForFieldType(value, fieldType, fieldInfo) {
  // Return null or undefined values as empty string to avoid errors
  if (value === null || value === undefined) {
    return '';
  }
  
  // Convert value to string if it's not already
  const strValue = typeof value === 'string' ? value : String(value);
  
  // Trim leading/trailing whitespace
  const trimmedValue = strValue.trim();
  
  switch (fieldType.toLowerCase()) {
    case 'checkbox':
      // Normalize various truthy/falsy values for checkboxes
      if (typeof value === 'boolean') {
        return value;
      }
      
      // Handle string representations of boolean values
      const lowercaseValue = trimmedValue.toLowerCase();
      const truthy = ['true', 'yes', 'on', '1', 'checked', 'selected', 'enabled'];
      const falsy = ['false', 'no', 'off', '0', 'unchecked', 'unselected', 'disabled'];
      
      if (truthy.includes(lowercaseValue)) {
        return true;
      }
      if (falsy.includes(lowercaseValue)) {
        return false;
      }
      
      // Default to truthy for other strings
      return !!trimmedValue;
      
    case 'radio':
      return trimmedValue; // Radio value - will be checked if it matches
      
    case 'select':
    case 'select-one':
    case 'select-multiple':
      // For select fields, try to find the option that matches
      if (fieldInfo.options && Array.isArray(fieldInfo.options)) {
        // Look for exact matches in option values or text
        for (const option of fieldInfo.options) {
          if (option.value?.toLowerCase() === trimmedValue.toLowerCase() || 
              option.text?.toLowerCase() === trimmedValue.toLowerCase()) {
            return option.value || option.text; // Prefer value over text
          }
        }
        
        // If no exact match, try fuzzy matching
        for (const option of fieldInfo.options) {
          const optValue = option.value?.toLowerCase() || '';
          const optText = option.text?.toLowerCase() || '';
          
          if (optValue.includes(trimmedValue.toLowerCase()) || 
              trimmedValue.toLowerCase().includes(optValue) ||
              optText.includes(trimmedValue.toLowerCase()) ||
              trimmedValue.toLowerCase().includes(optText)) {
            return option.value || option.text;
          }
        }
      }
      
      // If no match found among options, return the original value
      return trimmedValue;
      
    case 'number':
    case 'range':
      // Try to convert to a number, but fallback to string if not a valid number
      const num = parseFloat(trimmedValue);
      return isNaN(num) ? trimmedValue : num;
      
    case 'date':
      // Try to format as a valid date string if possible
      try {
        if (trimmedValue) {
          const date = new Date(trimmedValue);
          if (!isNaN(date.getTime())) {
            // Format as YYYY-MM-DD for date inputs
            return date.toISOString().split('T')[0];
          }
        }
      } catch (e) {
        console.log('Error formatting date:', e);
      }
      return trimmedValue;
      
    case 'time':
      // Try to format as a valid time string
      try {
        if (trimmedValue) {
          const date = new Date(`1970-01-01T${trimmedValue}`);
          if (!isNaN(date.getTime())) {
            // Format as HH:MM for time inputs
            return date.toTimeString().split(' ')[0].substring(0, 5);
          }
        }
      } catch (e) {
        console.log('Error formatting time:', e);
      }
      return trimmedValue;
      
    case 'email':
      // Ensure email format
      if (trimmedValue && !trimmedValue.includes('@')) {
        // If it doesn't look like an email, try to extract from user profile
        const emailFromProfile = getUserProfileField('personal.email') || '';
        return emailFromProfile || trimmedValue;
      }
      return trimmedValue;
      
    case 'tel':
    case 'phone':
      // Try to format phone numbers consistently
      // Remove non-digit characters for consistency
      const digitsOnly = trimmedValue.replace(/\D/g, '');
      
      // Apply basic formatting based on length
      if (digitsOnly.length === 10) {
        return `(${digitsOnly.substring(0,3)}) ${digitsOnly.substring(3,6)}-${digitsOnly.substring(6)}`;
      }
      return trimmedValue;
      
    case 'url':
      // Ensure URLs have a protocol
      if (trimmedValue && !trimmedValue.match(/^https?:\/\//i)) {
        return `https://${trimmedValue}`;
      }
      return trimmedValue;
      
    case 'password':
      // For security, don't autofill passwords unless explicitly allowed
      return ''; // You can change this policy if needed
      
    case 'textarea':
      // For textareas, preserve newlines
      return trimmedValue;
      
    case 'text':
    default:
      // For generic text fields, just return the trimmed value
      return trimmedValue;
  }
}

/**
 * Make an API call to bargain4me.com API to get suggestions for form fields
 * 
 * @param {Array} fieldKeywords - List of field labels/names
 * @param {Object} userProfile - User profile data
 * @param {string} url - URL of the page containing the form
 * @returns {Object} Mapping of field IDs/names to suggested values
 */
async function getAiSuggestions(fieldKeywords, userProfile, url) {
  try {
    // Get the access token from the auth service
    const accessToken = await auth0Service.getAccessToken();
    if (!accessToken) {
      throw new Error("Authentication required to use AI suggestions");
    }
    
    // Format user profile data for the prompt
    const profileJson = JSON.stringify(userProfile, null, 2);

    // Make the API call to bargain4me.com
    const response = await fetch("http://localhost:3001/api/formmaster", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        profileJson: profileJson,
        fieldKeywords: fieldKeywords,
        url: url
      })
    });
    
    if (!response.ok) {
      throw new Error(`Bargain4me API error: ${response.status} ${response.statusText}`);
    }
    
    const responseData = await response.json();
    console.log("Bargain4me API response:", responseData);
    
    // Extract the content from the response
    // Adjust based on the actual response structure from bargain4me.com API
    const content = responseData.reply;
    if (!content) {
      throw new Error("Invalid response format from Bargain4me API");
    }
    
    // Parse the JSON content
    // First, we need to extract JSON from the response which might contain markdown formatting
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || 
                     content.match(/```([\s\S]*?)```/) || 
                     [null, content];
    
    const jsonContent = jsonMatch[1] || content;
    
    try {
      return JSON.parse(jsonContent);
    } catch (parseError) {
      console.error("Error parsing Bargain4me response as JSON:", parseError);
      console.log("Response content:", content);
      return {};
    }
  } catch (error) {
    console.error("Error calling Bargain4me API:", error);
    throw error;
  }
}

// Check if a field identifier matches the pattern
function isPatternMatch(identifier, pattern) {
  if (!identifier || !pattern) return false;
  
  // Simple wildcard matching
  if (pattern.includes('*')) {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'), 'i');
    return regex.test(identifier);
  }
  
  // Direct match
  return identifier.includes(pattern);
}

// Get a value from the user profile
function getUserProfileField(field) {
  const parts = field.split('.');
  let value = userProfileData;
  
  for (const part of parts) {
    if (!value || typeof value !== 'object') return '';
    value = value[part];
  }
  
  return value || '';
}

// Handle messages from content scripts or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Received message:", message, "from:", sender);
  
  if (message.action === 'checkCompanionConnection') {
    // We're now in standalone mode, always "connected"
    sendResponse({ connected: true, standalone: true });
    return false;
  }
  
  
  // - **Form analysis**: analyse the forms, extract key words
  // - **Load content**: load a file into memory
  // - **Extract content from AI**: make api calls to AI
  // - **Fill out the form**: automatically fill out forms
  if (message.action === 'fillForm') {
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
              'value': ''
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
        //const formFields = extractedData.originalFields;s;
        const formFields = extractedData.simplifiedFields;
        
        // Store simplified data for potential future use
        chrome.storage.local.set({ 
          lastFormData: extractedData.simplifiedFields 
        });
        
        // Continue with existing process using the original format for compatibility
        processForm(formFields, message.url).then(result => {
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
    
    return true; // Keep the message channel open for async response
  }
  
  if (message.action === 'openFilePicker') {
    // Using a placeholder for file picking, as browser extensions have limited file access
    // In a real implementation, we would use chrome.downloads or html5 file apis
    sendResponse({ 
      success: true, 
      filename: "user_profile.json",
      message: "Profile data loaded from browser storage" 
    });
    return false;
  }
  
  if (message.action === 'settingsUpdated') {
    // Reload settings
    loadUserProfile();
    return false;
  }
});

// Add page load event listener
chrome.webNavigation.onCompleted.addListener(function(details) {
  // Only handle the main frame navigation (not iframes)
  if (details.frameId !== 0) return;
  
  // console.log("Page loaded:", details.url);

  // Check if we have data to display in an overlay
  chrome.storage.sync.get(['userProfile'], function(result) {

    if (result.userProfile && result.userProfile.personal && result.userProfile.personal.firstName) {
      // Reset the flag so it doesn't show on every page load
      
      const firstName = result.userProfile.personal.firstName;

      // Wait a short moment for the page to stabilize
      setTimeout(() => {
        // Show overlay with the loaded data or prepare for form filling
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
          if (tabs[0]) {
            // Pass the firstName as an argument to the executed script
            chrome.scripting.executeScript({
              target: { tabId: tabs[0].id },
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
              args: [firstName]
            });
          }
        });
      }, 1000);
    }
  });
});

// Function to scan form fields (injected into page)
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

// Function to fill form fields (injected into page)
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

console.log("Background script loaded in standalone mode");
