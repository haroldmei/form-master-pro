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
    // Get field mappings from storage
    const result = await chrome.storage.sync.get(['fieldMappings']);
    const mappings = result.fieldMappings || [];
    
    // Match form fields with mappings and retrieve values
    const fieldValues = {};
    
    formFields.forEach(field => {
      // Look for a mapping that matches this field
      for (const mapping of mappings) {
        const pattern = mapping.fieldPattern.toLowerCase();
        let fieldIdentifier = '';
        
        // Check various field properties for a match
        if (field.id) fieldIdentifier = field.id.toLowerCase();
        if (!isPatternMatch(fieldIdentifier, pattern) && field.name) 
          fieldIdentifier = field.name.toLowerCase();
        if (!isPatternMatch(fieldIdentifier, pattern) && field.label) 
          fieldIdentifier = field.label.toLowerCase();
        if (!isPatternMatch(fieldIdentifier, pattern) && field.placeholder) 
          fieldIdentifier = field.placeholder.toLowerCase();
        
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
  
  if (message.action === 'fillForm') {
    // Get the form fields from the active tab
    chrome.scripting.executeScript({
      target: { tabId: message.tabId },
      function: scanFormFields
    }).then(results => {
      if (!results || !results[0]) {
        sendResponse({ success: false, error: "Could not scan form fields" });
        return;
      }
      
      const formFields = results[0].result;
      
      // Process the form fields and retrieve values
      processForm(formFields, message.url).then(result => {
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
  
  console.log("Page loaded:", details.url);

  // Check if we have data to display in an overlay
  chrome.storage.sync.get(['userProfile'], function(result) {

    console.log("Data loaded:", result.userProfile);
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
