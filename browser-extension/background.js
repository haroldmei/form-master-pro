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


// FormMaster Pro extension - Standalone version
console.log("FormMaster Pro extension initializing...");

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
  console.log("Processing form fields:", formFields);
  
  try {
    // Collect field labels and names for AI analysis
    const fieldKeywords = formFields.map(field => {
      // Prefer label if available, otherwise use name
      return field.label || field.name || field.id || '';
    }).filter(keyword => keyword.trim() !== ''); // Filter out empty values
    
    console.log("Field keywords for AI:", fieldKeywords);
    
    // Get field mappings from storage
    const result = await chrome.storage.sync.get(['fieldMappings']);
    const mappings = result.fieldMappings || [];

    console.log("field mapping:", mappings);
    
    // If we have field keywords and user profile data, make a DeepSeek API call
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
    
    formFields.forEach(field => {
      const fieldId = field.id || '';
      const fieldName = field.name || '';
      
      // First check if AI provided a suggestion for this field
      if (aiSuggestions[fieldId] || aiSuggestions[fieldName]) {
        fieldValues[fieldId || fieldName] = aiSuggestions[fieldId] || aiSuggestions[fieldName];
        return; // Skip further processing for this field
      }
      
      // If no AI suggestion, fall back to mappings
      for (const mapping of mappings) {
        const pattern = mapping.fieldPattern.toLowerCase();
        let fieldIdentifier = '';
        
        // Check various field properties for a match
        if (field.id) fieldIdentifier = field.id.toLowerCase();
        if (!isPatternMatch(fieldIdentifier, pattern) && field.name) 
          fieldIdentifier = field.name.toLowerCase();
        if (!isPatternMatch(fieldIdentifier, pattern) && field.label) 
          fieldIdentifier = field.label.toLowerCase();
        
        // If we have a match, get the value from the appropriate source
        if (isPatternMatch(fieldIdentifier, pattern)) {
          if (mapping.dataSource === 'profile') {
            fieldValues[field.id || field.name] = getUserProfileField(mapping.dataField);
          } else if (mapping.dataSource === 'custom') {
            // For custom fields, the dataField is the direct value
            fieldValues[field.id || field.name] = mapping.dataField;
          }
          break;
        }
      }
    });
    
    console.log("Processed field values:", fieldValues);
    return { success: true, fields: fieldValues };
  } catch (error) {
    console.error("Error processing form:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Make an API call to DeepSeek AI to get suggestions for form fields
 * 
 * @param {Array} fieldKeywords - List of field labels/names
 * @param {Object} userProfile - User profile data
 * @param {string} url - URL of the page containing the form
 * @returns {Object} Mapping of field IDs/names to suggested values
 */
async function getAiSuggestions(fieldKeywords, userProfile, url) {
  // Your DeepSeek API key - this should be stored securely
  // For production, consider using environment variables or secure storage
  const apiKey = "sk-xxxxxxxx"; // Replace with your actual API key
  
  // Format user profile data for the prompt
  const profileJson = JSON.stringify(userProfile, null, 2);
  
  // Create a prompt for the DeepSeek API
  const prompt = `
You are a form filling assistant. Given a user's profile data and a list of form field names/labels, 
extract relevant information from the profile to fill in the form fields.

User's profile data:
${profileJson}

Form fields:
${fieldKeywords.join(", ")}

Form URL: ${url}

Analyze the field names and match them with appropriate values from the user profile. 
Return a JSON object where keys are the field names and values are the suggested values from the profile. 
If you don't have a good match for a field, don't include it in the response.
Format your response as a valid JSON object only.
`;

  console.log("DeepSeek API prompt:", prompt);

  try {
    // Make the API call to DeepSeek
    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.2, // Low temperature for more deterministic responses
        max_tokens: 1000
      })
    });
    
    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.status} ${response.statusText}`);
    }
    
    const responseData = await response.json();
    console.log("DeepSeek API response:", responseData);
    
    // Extract the content from the response
    const content = responseData.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Invalid response format from DeepSeek API");
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
      console.error("Error parsing DeepSeek response as JSON:", parseError);
      console.log("Response content:", content);
      return {};
    }
  } catch (error) {
    console.error("Error calling DeepSeek API:", error);
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
