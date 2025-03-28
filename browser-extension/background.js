// Import auth service
importScripts('auth.js');

// Import other modules
importScripts(
  'modules/userProfile.js',
  'modules/formProcessor.js',
  'modules/aiService.js',
  'modules/formFiller.js',
  'modules/utils.js'
);

// User profile is now directly accessible via self.globalUserProfile

console.log("FormMasterPro extension initializing...");

// Initialize auth on extension startup
auth0Service.init()
  .then(isAuthenticated => {
    console.log('Auth initialized, authenticated:', isAuthenticated);
  })
  .catch(error => {
    console.error('Auth initialization error:', error);
  });

// Handle messages from content scripts or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // User profile related messages
  if (message.action === 'getUserProfile') {
    sendResponse({ success: true, profile: self.globalUserProfile });
    return false;
  }
  
  if (message.action === 'updateUserProfile') {
    // Update global memory only
    self.globalUserProfile = message.profile;
    console.log('User profile updated in global memory');
    sendResponse({ success: true });
    return false;
  }
  
  // Auth-related message handling
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
  
  // Extension functionality messages
  if (message.action === 'checkCompanionConnection') {
    // We're now in standalone mode, always "connected"
    sendResponse({ connected: true, standalone: true });
    return false;
  }
  
  if (message.action === 'fillForm') {
    formFiller.injectAndFillForm(message, sendResponse);
    return true; // Keep the message channel open for async response
  }
  
  if (message.action === 'openFilePicker') {
    // Using a placeholder for file picking, as browser extensions have limited file access
    sendResponse({ 
      success: true, 
      filename: "user_profile.json",
      message: "Profile data loaded from browser storage" 
    });
    return false;
  }
  
  if (message.action === 'settingsUpdated') {
    // Nothing to do - profile is already in global memory
    return false;
  }
});

// Handle messages from the injected UI
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab?.id;
  console.log("Received message from injected UI:", message, "from tab:", tabId);

  //if (!tabId) {
  //  sendResponse({ success: false, error: 'Invalid tab' });
  //  return;
  //}
  
  switch (message.action) {
    case 'analyze-form':
      analyzeFormInTab(tabId, message.url)
        .then(result => {
          // Save the form analysis data temporarily
          chrome.storage.local.set({
            formAnalysisData: {
              url: message.url,
              timestamp: new Date().toISOString(),
              data: result.data
            }
          }, () => {
            // Open the form analysis page in a new tab
            chrome.tabs.create({ url: 'formAnalysis.html' });
            
            // Send response to the original message
            sendResponse({ 
              success: true, 
              message: 'Opening form analysis in new tab'
            });
          });
        })
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true; // Keep the message channel open for async response
      
    case 'data-mappings':
      // Open the mappings page in a new tab
      chrome.tabs.create({ url: 'mappings.html' });
      sendResponse({ success: true, message: 'Opening field mappings' });
      break;
      
    case 'auto-fill':
      fillFormInTab(tabId, message.url)
        .then(result => sendResponse({ success: true, ...result }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true; // Keep the message channel open for async response
  }
});

// Analyze form in the current tab
async function analyzeFormInTab(tabId, url) {
  try {
    // Inject the form extraction scripts
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['forms/form_radios.js', 'forms/form_extract.js']
    });
    
    // Execute the form extraction
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      function: () => {
        return self.FormExtract.extractFormControls();
      }
    });
    
    if (!results || !results[0] || !results[0].result) {
      return { message: 'No form detected' };
    }
    
    const formData = results[0].result;
    return { 
      message: `Found ${countFormFields(formData)} fields`,
      data: formData
    };
  } catch (error) {
    console.error('Error analyzing form:', error);
    throw new Error('Failed to analyze form');
  }
}

// Count the total number of form fields
function countFormFields(formData) {
  let count = 0;
  if (formData.inputs) count += formData.inputs.length;
  if (formData.selects) count += formData.selects.length;
  if (formData.textareas) count += formData.textareas.length;
  if (formData.radios) count += formData.radios.length;
  if (formData.checkboxes) count += formData.checkboxes.length;
  return count;
}

// Fill form in the current tab
async function fillFormInTab(tabId, url) {
  try {
    console.log(`Filling form in tab ${tabId} for URL: ${url}`);
    
    // Step 1: First inject the form extraction scripts to analyze the form
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['forms/form_radios.js', 'forms/form_extract.js']
    });
    
    // Step 2: Extract all form fields from the page
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      function: () => {
        return self.FormExtract.extractFormControls();
      }
    });
    
    if (!results || !results[0] || !results[0].result) {
      return { message: 'No form detected on page' };
    }
    
    const formData = results[0].result;
    
    // Step 3: Create a flattened array of all form fields
    const allFields = [];
    
    if (formData.inputs) allFields.push(...formData.inputs);
    if (formData.selects) allFields.push(...formData.selects);
    if (formData.textareas) allFields.push(...formData.textareas);
    if (formData.radios) allFields.push(...formData.radios);
    if (formData.checkboxes) allFields.push(...formData.checkboxes);
    
    console.log(`Found ${allFields.length} form fields to process`);
    
    if (allFields.length === 0) {
      return { message: 'No fillable form fields detected' };
    }
    
    // Step 4: Process the form fields to get values using global user profile
    const processedForm = await formProcessor.processForm(allFields, url, self.globalUserProfile);
    
    // Check for auth errors
    if (!processedForm.success) {
      return { message: processedForm.error || 'Error processing form' };
    }
    
    if (!processedForm.fields || Object.keys(processedForm.fields).length === 0) {
      return { message: 'No fields could be mapped for filling' };
    }
    
    // Step 5: Inject form filling script and fill the form
    const fillResult = await chrome.scripting.executeScript({
      target: { tabId },
      function: (fieldValues) => {
        // This function runs in the context of the web page
        
        // Helper function to locate fillable elements
        function findFillableElement(identifier) {
          // Try by ID first
          let element = document.getElementById(identifier);
          if (element) return element;
          
          // Try by name
          element = document.querySelector(`[name="${identifier}"]`);
          if (element) return element;
          
          // Try by other common selectors
          return null;
        }
        
        // Track stats
        const stats = {
          filled: 0,
          failed: 0,
          total: Object.keys(fieldValues).length
        };
        
        // Fill each field
        for (const [identifier, value] of Object.entries(fieldValues)) {
          try {
            const element = findFillableElement(identifier);
            
            if (!element) {
              console.warn(`Could not find element with identifier: ${identifier}`);
              stats.failed++;
              continue;
            }
            
            const tagName = element.tagName.toLowerCase();
            const inputType = element.type ? element.type.toLowerCase() : '';
            
            // Handle different element types
            if (tagName === 'select') {
              // For select elements
              const options = Array.from(element.options);
              const option = options.find(opt => 
                opt.value === value || 
                opt.text === value || 
                opt.textContent.trim() === value
              );
              
              if (option) {
                element.value = option.value;
                element.dispatchEvent(new Event('change', { bubbles: true }));
                stats.filled++;
              } else {
                stats.failed++;
              }
            } else if (tagName === 'input' && (inputType === 'checkbox' || inputType === 'radio')) {
              // For checkboxes and radios
              if (typeof value === 'boolean') {
                element.checked = value;
              } else if (typeof value === 'string') {
                element.checked = value.toLowerCase() === 'true' || 
                                 value === '1' || 
                                 value.toLowerCase() === 'yes' ||
                                 value.toLowerCase() === 'checked';
              }
              element.dispatchEvent(new Event('change', { bubbles: true }));
              stats.filled++;
            } else {
              // For text inputs and textareas
              element.value = value;
              element.dispatchEvent(new Event('input', { bubbles: true }));
              element.dispatchEvent(new Event('change', { bubbles: true }));
              stats.filled++;
              
              // Add a visual indicator that the field was filled
              element.style.borderLeft = '3px solid #4285f4';
            }
          } catch (error) {
            console.error(`Error filling field ${identifier}:`, error);
            stats.failed++;
          }
        }
        
        return stats;
      },
      args: [processedForm.fields]
    });
    
    // Step 6: Return results
    if (!fillResult || !fillResult[0] || !fillResult[0].result) {
      return { message: 'Error filling form' };
    }
    
    const stats = fillResult[0].result;
    return {
      message: `Filled ${stats.filled} of ${stats.total} fields`,
      filledCount: stats.filled,
      failedCount: stats.failed,
      totalFields: stats.total
    };
  } catch (error) {
    console.error('Error in fillFormInTab:', error);
    return { message: `Error: ${error.message}` };
  }
}

// Add page load event listener
chrome.webNavigation.onCompleted.addListener(function(details) {
  // Only handle the main frame navigation (not iframes)
  if (details.frameId !== 0) return;
  
  // Use global profile directly
  if (self.globalUserProfile && self.globalUserProfile.personal && self.globalUserProfile.personal.firstName) {
    const firstName = self.globalUserProfile.personal.firstName;

    // Wait a short moment for the page to stabilize
    setTimeout(() => {
      // Show overlay with the loaded data or prepare for form filling
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs[0]) {
          formFiller.showPageNotification(tabs[0].id, firstName);
        }
      });
    }, 1000);
  }
});

console.log("Background script loaded in standalone mode");
