// Import other modules
importScripts(
  'modules/auth.js',
  'modules/userProfile.js',
  'modules/formProcessor.js',
  'modules/aiService.js',
  'modules/formFiller.js',
  'modules/utils.js',
  'modules/formAnalysis/storage.js',
  'libs/pdf.min.js',
  'libs/pdf.worker.min.js'
);

console.log("FormMasterPro extension initializing...");

// Initialize form analysis storage
if (typeof formAnalysisStorage !== 'undefined') {
  formAnalysisStorage.init();
}

// Initialize auth on extension startup
auth0Service.init()
  .then(isAuthenticated => {
    console.log('Auth initialized, authenticated:', isAuthenticated);
  })
  .catch(error => {
    console.error('Auth initialization error:', error);
  });

// Configure PDF.js to use the imported worker
if (typeof pdfjsLib !== 'undefined') {
  // After importing the worker script directly, no need for a separate worker
  pdfjsLib.GlobalWorkerOptions.disableWorker = true;
  console.log('PDF.js configured with direct worker import');
} else {
  console.error('Failed to load PDF.js library');
}

// Consolidated message listener for all extension communications
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab?.id;
  
  // Handle field mappings storage
  if (message.type === 'FM_SAVE_FIELD_MAPPINGS') {
    const { rootUrl, controls } = message.payload;
    
    // First get current mappings
    chrome.storage.local.get(['fieldMappingsV2'], function(result) {
      let fieldMappingsV2 = result.fieldMappingsV2 || {};
      
      // Update with new data
      fieldMappingsV2[rootUrl] = controls;
      
      // Save back to storage
      chrome.storage.local.set({'fieldMappingsV2': fieldMappingsV2}, function() {
        console.log('Field mappings saved to local storage for URL:', rootUrl);
        sendResponse({success: true});
      });
    });
    
    return true; // Indicate async response
  }
  
  // Handle form analysis actions through new message types
  if (message.type === 'FM_ANALYZE_FORM') {
    const { id, data } = message;
    
    // Execute the analysis in the sender tab
    chrome.scripting.executeScript({
      target: { tabId: sender.tab.id },
      files: [
        'modules/formAnalysis/domUtils.js',
        'modules/formAnalysis/highlighting.js',
        'modules/formAnalysis/containerDetection.js',
        'modules/formAnalysis/labelDetection.js',
        'modules/formAnalysis/injected.js'
      ]
    }, () => {
      // After loading dependencies, execute the analysis
      chrome.scripting.executeScript({
        target: { tabId: sender.tab.id },
        function: (params) => {
          return window.formAnalysisInjected.performFormAnalysis(
            params.existingMappings
          );
        },
        args: [data]
      }, results => {
        // Send the response back to the caller
        chrome.tabs.sendMessage(sender.tab.id, {
          type: 'FM_ANALYSIS_RESPONSE',
          id: id,
          data: results && results[0] && results[0].result ? results[0].result : null,
          error: results && results[0] && results[0].error ? results[0].error : null
        });
      });
    });
    
    return true;
  }
  
  if (message.type === 'FM_LOAD_FIELD_MAPPINGS') {
    const { id, data } = message;
    
    if (data && data.url) {
      const rootUrl = new URL(data.url).origin;
      
      chrome.storage.local.get(['fieldMappingsV2'], function(result) {
        const mappings = result.fieldMappingsV2 && result.fieldMappingsV2[rootUrl] 
          ? result.fieldMappingsV2[rootUrl] : [];
        
        // Send the response back to the caller
        chrome.tabs.sendMessage(sender.tab.id, {
          type: 'FM_ANALYSIS_RESPONSE',
          id: id,
          data: mappings,
          error: null
        });
      });
    } else {
      // Send error response if URL is missing
      chrome.tabs.sendMessage(sender.tab.id, {
        type: 'FM_ANALYSIS_RESPONSE',
        id: id,
        data: null,
        error: 'URL is required to load field mappings'
      });
    }
    
    return true;
  }

  if (message.action === 'getUserProfile') {
    userProfileManager.getUserProfile().then(profile => {
      sendResponse({ success: true, profile });
    });
    return true; // Indicate we'll send response asynchronously
  }
  
  if (message.action === 'updateUserProfile') {
    userProfileManager.saveUserProfile(message.profile).then(() => {
      console.log('User profile updated in storage');
      sendResponse({ success: true });
    });
    return true;
  }
  
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
  
  switch (message.action) {
    case 'checkAuth':
      auth0Service.isAuthenticated()
        .then(isAuthenticated => sendResponse({ isAuthenticated }))
        .catch(error => sendResponse({ error: error.message }));
      return true;
      
    case 'getToken':
      auth0Service.getAccessToken()
        .then(token => sendResponse({ token }))
        .catch(error => sendResponse({ error: error.message }));
      return true;
      
    case 'logout':
      auth0Service.logout()
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    case 'checkSubscription':
      // First check if we have recent subscription data in storage
      chrome.storage.local.get(['subscriptionData', 'authState'], async (result) => {
        try {
          // Get current user ID from auth state
          const currentUserId = result.authState?.idToken ? 
            JSON.parse(atob(result.authState.idToken.split('.')[1])).sub : null;
          
          if (result.subscriptionData && 
            result.subscriptionData.data && 
            result.subscriptionData.data.isSubscribed && 
            result.subscriptionData.timestamp && 
            result.subscriptionData.userId === currentUserId && // Verify user ID matches
            (Date.now() - result.subscriptionData.timestamp < 24 * 60 * 60 * 1000)) {
            // Use cached data if less than 24 hours old and belongs to current user
            console.log('Using cached subscription data');
            sendResponse(result.subscriptionData.data);
          } else {
            // Otherwise fetch fresh data from the server
            try {
              const freshData = await checkSubscriptionStatus();
              sendResponse(freshData);
            } catch (error) {
              sendResponse({ success: false, error: error.message, isSubscribed: false });
            }
          }
        } catch (error) {
          console.error('Error in checkSubscription handler:', error);
          sendResponse({ success: false, error: error.message, isSubscribed: false });
        }
      });
      return true;
  }
  
  if (message.action === 'checkEmailVerification') {
    checkEmailVerification()
      .then(isVerified => sendResponse({ success: true, isVerified }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (message.action === 'resendVerificationEmail') {
    resendVerificationEmail()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (message.action === 'analyzeCurrentForm') {
    // This action is called by the content script to analyze form fields for highlighting
    const tabId = sender.tab.id;
    
    // Execute the analysis in the sender tab
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: [
        'modules/formAnalysis/domUtils.js',
        'modules/formAnalysis/highlighting.js',
        'modules/formAnalysis/containerDetection.js',
        'modules/formAnalysis/labelDetection.js',
        'modules/formAnalysis/injected.js'
      ]
    }, () => {
      // First, check if we have existing mappings for this URL
      const url = new URL(sender.tab.url);
      const rootUrl = url.origin;
      
      chrome.storage.local.get(['fieldMappingsV2'], function(result) {
        let existingMappings = [];
        
        // Check if we have mappings for this URL
        if (result && result.fieldMappingsV2 && result.fieldMappingsV2[rootUrl]) {
          existingMappings = result.fieldMappingsV2[rootUrl];
          console.log('Found existing mappings for URL:', rootUrl);
        }
        
        // After loading dependencies, execute the analysis
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          function: (params) => {
            return window.formAnalysisInjected.performFormAnalysis(
              params.existingMappings
            );
          },
          args: [{
            existingMappings: existingMappings
          }]
        }, results => {
          // Send the response back to the content script
          sendResponse({
            success: true,
            data: results && results[0] && results[0].result ? results[0].result : null
          });
        });
      });
    });
    
    return true; // Indicate async response
  }
  
  if (message.action === 'auto-fill') {
    // Use the consolidated function with fillForm=true
    (async () => {
      await processAndFillForm(tabId, message.url, { 
        fillForm: true, 
        sendResponse 
      });
    })();
    return true;
  }
  
  if (message.action === 'processPDF') {
    if (message.isBase64) {
      // Convert back to Uint8Array
      const binaryString = atob(message.pdfData);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Now process with the correct data format
      processPDF(bytes, message.fileName)
        .then(result => sendResponse(result))
        .catch(error => {
          console.error('Error processing PDF:', error);
          sendResponse({
            success: false,
            error: error.message || 'Failed to process PDF file'
          });
        });
    } else {
      processPDF(message.pdfData, message.fileName)
        .then(result => sendResponse(result))
        .catch(error => {
          console.error('Error processing PDF:', error);
          sendResponse({
            success: false,
            error: error.message || 'Failed to process PDF file'
          });
        });
    }
    return true;
  }

  // Add handler for DOCX processing
  if (message.action === 'processDocx') {
    processDocx(message.docxContent, message.fileName)
      .then(result => sendResponse(result))
      .catch(error => {
        console.error('Error processing DOCX:', error);
        sendResponse({
          success: false,
          error: error.message || 'Failed to process DOCX file'
        });
      });
    return true;
  }

  // Add handler for processing multiple files from a folder
  if (message.action === 'processFolderFiles') {
    processFolderFiles(message.folderName, message.files)
      .then(result => sendResponse(result))
      .catch(error => {
        console.error('Error processing folder files:', error);
        sendResponse({
          success: false,
          error: error.message || 'Failed to process files from folder'
        });
      });
    return true;
  }

  if (message.action === 'formatFileSize') {
    if (typeof message.size === 'number') {
      sendResponse({ success: true, formattedSize: formatFileSize(message.size) });
    } else {
      sendResponse({ success: false, error: 'Invalid file size provided' });
    }
    return false;
  }

  if (message.action === 'loadProfileInfo') {
    userProfileManager.getUserProfile().then(profile => {
      sendResponse({ 
        success: true, 
        profile 
      });
    });
    return true;
  }
  
  if (message.action === 'clearSuggestions') {
    formProcessor.clearSuggestions()
      .then(result => {
        // Also clear field mappings when clearing suggestions
        chrome.storage.local.get(['fieldMappingsV2'], function(mappingsResult) {
          // Keep the fieldMappingsV2 structure but clear all mappings
          chrome.storage.local.set({ fieldMappingsV2: {} }, function() {
            console.log('All field mappings cleared');
            sendResponse({
              success: true,
              message: 'All form mappings and suggestions cleared'
            });
          });
        });
      })
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.action === 'getFormValues') {
    console.log('Processing getFormValues request for:', message.url);
    
    // Use the consolidated function with fillForm=false (default)
    (async () => {
      await processAndFillForm(sender.tab?.id, message.url, { 
        sendResponse 
      });
    })();
    
    return true; // Keep the messaging channel open for the async response
  }

  // Also fix the click-fill handler in a similar way
  if (message.action === 'click-fill') {
    console.log('Handling click-fill request');
    
    // Use the consolidated function with fillForm=false
    (async () => {
      await processAndFillForm(sender.tab?.id, message.url, { 
        sendResponse 
      });
    })();
    
    return true;
  }

  // Explora code injection
  if (message.action === 'injectExplora') {
    console.log('Injecting Explora script into tab:', sender.tab?.id);

    try {
      // Prepare the code script - add some safeguards by wrapping in IIFE
      const wrappedCode = `(function() {
        ${message.codeString}
        try {
          setValue('${message.value}');
          return { success: true, message: 'Explora script executed successfully' };
        } catch (error) {
          console.error('Explora execution error:', error);
          return { success: false, error: error.message };
        }
      })();`;

      console.log('wrappedCode', wrappedCode);
      // Execute the script directly in the page context
      chrome.scripting.executeScript({
        target: { tabId: sender.tab?.id },
        world: "MAIN", // This executes in the page's JavaScript context
        func: (code) => {
          // Create a function from string in a way that avoids CSP issues
          const script = document.createElement('script');
          script.textContent = code;
          (document.head || document.documentElement).appendChild(script);
          script.remove();
          return { success: true };
        },
        args: [wrappedCode]
      }).then(results => {
        console.log('Script injection result:', results);
        if (results && results[0] && results[0].result) {
          console.log('Explora script execution complete');
        }
      }).catch(error => {
        console.error('Error executing script via scripting API:', error);
      });

      return true; // Keep the messaging channel open for async response
    } catch (error) {
      console.error('Error preparing Explora injection:', error);
      return true;
    }
  }

  // Add message listener for AI code generation
  if (message.type === 'FM_GENERATE_AI_CODE') {
    // Generate AI code using the aiService
    aiService.generateAiCodeForContainer(message.payload.containerHtml, message.payload.url)
      .then(code => {
        sendResponse({ code });
      })
      .catch(error => {
        console.error('Error generating AI code:', error);
        sendResponse({ error: error.message });
      });
    return true; // Keep the message channel open for async response
  }

  // New handler for analyzeFormInTab
  if (message.action === 'analyzeFormInTab') {
    const tabId = sender.tab.id;
    const url = message.url;
    
    if (!tabId) {
      sendResponse({ success: false, error: 'No tab ID available' });
      return false;
    }
    
    const rootUrl = new URL(url).origin;
    
    // Load any existing mappings
    chrome.storage.local.get(['fieldMappingsV2'], function(result) {
      let existingMappings = [];
      
      // Check if we have mappings for this URL
      if (result && result.fieldMappingsV2 && result.fieldMappingsV2[rootUrl]) {
        existingMappings = result.fieldMappingsV2[rootUrl];
      }
      
      // Execute form analysis scripts in the tab
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: [
          'modules/formAnalysis/domUtils.js',
          'modules/formAnalysis/highlighting.js',
          'modules/formAnalysis/containerDetection.js',
          'modules/formAnalysis/labelDetection.js',
          'modules/formAnalysis/injected.js'
        ]
      }, () => {
        // Execute the analysis
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          function: (params) => {
            return window.formAnalysisInjected ? 
              window.formAnalysisInjected.performFormAnalysis(params.existingMappings) : 
              { error: 'Form analysis module not available' };
          },
          args: [{ existingMappings }]
        }, results => {
          if (chrome.runtime.lastError) {
            sendResponse({ 
              success: false, 
              error: chrome.runtime.lastError.message
            });
            return;
          }
          
          if (!results || !results[0]) {
            sendResponse({ 
              success: false, 
              error: 'No results from form analysis'
            });
            return;
          }
          
          const result = results[0].result;
          if (result && result.controls) {
            // The storage update is already handled by formAnalysisInjected.performFormAnalysis()
            // No need to update storage again here
            sendResponse({
              success: true,
              count: result.count || result.controls.length,
              message: `Analyzed ${result.count || result.controls.length} form controls`
            });
          } else if (results[0].error) {
            sendResponse({ 
              success: false, 
              error: results[0].error
            });
          } else {
            sendResponse({ 
              success: false, 
              error: 'No controls found in form analysis result'
            });
          }
        });
      });
    });
    
    return true; // Indicate async response
  }

  // New handler for fetchAiCode
  if (message.action === 'fetchAiCode') {
    const url = message.url;
    
    if (!url) {
      sendResponse({ success: false, error: 'No URL provided' });
      return false;
    }
    
    // Load field mappings for the URL
    chrome.storage.local.get(['fieldMappingsV2'], async function(result) {
      try {
        if (!result || !result.fieldMappingsV2 || !result.fieldMappingsV2[url]) {
          sendResponse({ 
            success: false, 
            error: 'No form mappings found for this URL. Please analyze the form first.'
          });
          return;
        }
        
        // Check if aiService is available
        if (typeof aiService === 'undefined') {
          sendResponse({ 
            success: false, 
            error: 'AI Service module not available'
          });
          return;
        }
        
        // Use the aiService to generate code for the mappings
        try {
          const updatedMappings = await aiService.getAiCode(result.fieldMappingsV2, url);
          sendResponse({
            success: true,
            message: 'AI code generated successfully',
            count: updatedMappings ? Object.keys(updatedMappings).length : 0
          });
        } catch (error) {
          console.error('Error generating AI code:', error);
          sendResponse({ 
            success: false, 
            error: error.message || 'Error generating AI code'
          });
        }
      } catch (error) {
        console.error('Error in fetchAiCode handler:', error);
        sendResponse({ 
          success: false, 
          error: error.message || 'Unknown error in fetchAiCode'
        });
      }
    });
    
    return true; // Indicate async response
  }
});

// Check email verification status
async function checkEmailVerification() {
  try {
    return await auth0Service.isEmailVerified();
  } catch (error) {
    console.error('Error checking email verification:', error);
    return false;
  }
}

// Resend verification email
async function resendVerificationEmail() {
  try {
    const token = await auth0Service.getAccessToken();
    const userInfo = await auth0Service.getUserInfo();

    // Call Auth0 Management API to resend verification email
    const response = await fetch(`${typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : 'http://localhost:3001'}/api/auth/send-email-verification`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: userInfo.sub
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to send verification email');
    }
    
    return true;
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw error;
  }
}

// Check if user's email is verified
async function isUserVerified() {
  return await checkEmailVerification();
}

// Extract form data from the page
async function extractFormData(tabId) {
  // Inject the form extraction scripts
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['forms/form_radios.js', 'forms/form_checkboxgroup.js', 'forms/form_extract.js']
  });
  
  // Execute the form extraction
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    function: () => {
      return self.FormExtract.extractFormControls();
    }
  });
  
  if (!results || !results[0] || !results[0].result) {
    return null;
  }
  
  return results[0].result;
}

// Flatten form fields from different types into a single array
function flattenFormFields(formData) {
  const allFields = [];
  
  if (formData.inputs) allFields.push(...formData.inputs);
  if (formData.selects) allFields.push(...formData.selects);
  if (formData.textareas) allFields.push(...formData.textareas);
  if (formData.radios) allFields.push(...formData.radios);
  if (formData.checkboxes) allFields.push(...formData.checkboxes);
  
  return allFields;
}

// Process form fields with user profile data
async function processFormFields(url) {
  console.log('Processing form fields with user profile data');
  const userProfile = await userProfileManager.getUserProfile();
  
  // Use the formProcessor module to get field values
  return await formProcessor.processForm(url, userProfile);
}

// Consolidated function to process form fields and optionally fill them
async function processAndFillForm(tabId, url, options = {}) {
  console.log('Processing and filling form in tab context', options);

  const { fillForm = false, sendResponse = null } = options;
  
  try {
    // Check if user is verified before proceeding
    const isVerified = await checkEmailVerification();
    if (!isVerified) {
      const response = { 
        success: false, 
        error: 'Email verification required to use this feature',
        requiresVerification: true
      };
      if (sendResponse) sendResponse(response);
      return response;
    }
    
    // Get user profile data
    const userProfile = await userProfileManager.getUserProfile();
    console.log('Retrieved user profile for form filling:', userProfile ? userProfile.filename || 'available' : 'not available');
    
    if (fillForm) {
      // Perform actual form filling in the tab context where document is available
      console.log('Filling form using formFiller module in tab context');
      
      try {
        // First inject the formFiller.js script into the tab
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['modules/formFiller.js']
        });
        
        // Pass the serialized user profile to the tab context
        const results = await chrome.scripting.executeScript({
          target: { tabId },
          function: (url, profileData) => {
            // This runs in the tab's context where formFiller should now be available
            if (typeof self.formFiller === 'undefined' || !self.formFiller) {
              throw new Error('formFiller module not available in tab context');
            }
            
            // Create a window-level variable for the profile so it's available in the tab
            window.userProfile = profileData;
            
            return self.formFiller.performFormFilling(url, profileData);
          },
          args: [url, userProfile]
        });
        
        // Extract the result from the execution
        const fillResult = results && results[0] && results[0].result ? results[0].result : { filled: 0, failed: 0, skipped: 0 };
        
        const response = { success: true, ...fillResult };
        if (sendResponse) sendResponse(response);
        return response;
      } catch (error) {
        console.error('Error executing form filling in tab:', error);
        const response = { 
          success: false, 
          error: error.message || 'Failed to execute form filling in tab context'
        };
        if (sendResponse) sendResponse(response);
        return response;
      }
    } else {
      const response = { 
        success: true, 
        message: fillForm ? undefined : 'Fields processed successfully'
      };
      if (sendResponse) sendResponse(response);
      return response;
    }
  } catch (error) {
    console.error('Error in form processing:', error);
    const response = { 
      success: false, 
      error: error.message || 'Unknown error in form processing'
    };
    if (sendResponse) sendResponse(response);
    return response;
  }
}

// Check subscription status
async function checkSubscriptionStatus() {
  try {
    // First check if user is authenticated
    const isAuthenticated = await auth0Service.isAuthenticated();
    if (!isAuthenticated) {
      return { success: false, error: 'User not authenticated', isSubscribed: false };
    }
    
    // Get the access token
    const token = await auth0Service.getAccessToken();
    if (!token) {
      return { success: false, error: 'Could not retrieve access token', isSubscribed: false };
    }
    
    // Get current user ID to associate with subscription data
    let currentUserId = null;
    try {
      const userProfile = await auth0Service.getUserProfile();
      currentUserId = userProfile.sub;
    } catch (error) {
      console.error('Error getting user profile:', error);
    }
    
    // Call the subscription status API using the API_BASE_URL constant with fallback
    const response = await fetch(`${typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : 'http://localhost:3001'}/api/auth/subscription-status`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Subscription status API response:', response);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Subscription status API error:', errorData);
      return { 
        success: false, 
        error: errorData.message || `API error: ${response.status}`, 
        isSubscribed: false 
      };
    }
    
    const subscriptionData = await response.json();
    const subscription = subscriptionData.subscription || subscriptionData;
    console.log('Subscription data:', subscription);
    
    // Extract expiry date from response - handle different API response formats
    let expiresAt = null;
    if (subscription.expiresAt) {
      // ISO date string format: "2025-04-15T07:53:59.000Z"
      expiresAt = subscription.expiresAt; // Use directly, no conversion needed
    } else if (subscription.current_period_end) {
      // Handle numeric timestamp if that's what the API returns
      if (typeof subscription.current_period_end === 'number') {
        // If it's a Unix timestamp, convert to ISO string
        expiresAt = new Date(subscription.current_period_end * 1000).toISOString();
      } else {
        // If it's already a string, use as is
        expiresAt = subscription.current_period_end;
      }
    } else if (subscription.trial_end) {
      // Same logic for trial_end
      if (typeof subscription.trial_end === 'number') {
        expiresAt = new Date(subscription.trial_end * 1000).toISOString();
      } else {
        expiresAt = subscription.trial_end;
      }
    }
    
    // Check for cancel_at_period_end flag
    const isCancelled = subscription.cancel_at_period_end === true;
    console.log('Subscription cancelled at period end:', isCancelled);
    
    const result = { 
      success: true, 
      isSubscribed: subscription.status === 'active' || subscription.status === 'trialing',
      plan: subscription.plan_name || subscription.plan || 'free',
      expiresAt: expiresAt,
      cancel_at_period_end: isCancelled, // Include cancellation status
      subscriptionData: subscription
    };
    
    // Store subscription data in local storage with timestamp and user ID
    chrome.storage.local.set({
      subscriptionData: {
        timestamp: Date.now(),
        userId: currentUserId, // Associate with current user ID
        data: result
      }
    });
    
    return result;
  } catch (error) {
    console.error('Error checking subscription status:', error);
    return { success: false, error: error.message, isSubscribed: false };
  }
}

// Process the PDF file
async function processPDF(pdfData, fileName) {
  try {
    console.log(`Processing PDF: ${fileName}`);
    
    // Use PDF.js to load the document and extract text
    console.log('Loading PDF with PDF.js...');
    const loadingTask = pdfjsLib.getDocument({data: pdfData});
    const pdfDocument = await loadingTask.promise;
    console.log(`PDF loaded. Number of pages: ${pdfDocument.numPages}`);
    
    // Extract text from all pages
    const textContent = await extractTextFromPdfDocument(pdfDocument);

    console.log('Text extraction complete. Sample:', textContent.substring(0, 100) + '...');

    // Create a user profile structure from the PDF content
    const userProfile = {
      source: 'pdf',
      filename: fileName,
      extractedContent: textContent,
      size: textContent.length,
      timeLoaded: new Date().toISOString()
    };

    // Save to storage instead of global variable
    await userProfileManager.saveUserProfile(userProfile);
    
    return {
      success: true,
      message: `Processed PDF: ${fileName}`,
      profile: userProfile
    };
  } catch (error) {
    console.error('Error processing PDF:', error);
    return {
      success: false,
      error: error.message || 'Failed to process PDF file'
    };
  }
}

// Process DOCX content - moved from ui-injector.js
async function processDocx(docxContent, fileName) {
  try {
    console.log(`Processing DOCX: ${fileName}`, docxContent);

    // Check if docxContent has the expected structure
    if (!docxContent) {
      throw new Error('DOCX extraction returned empty result');
    }

    // Create a user profile structure from the DOCX content
    const userProfile = {
      source: 'docx',
      filename: fileName,
      extractedContent: docxContent,
      // Create a simple representation for display
      docxData: {
        paragraphs: Array.isArray(docxContent.paragraphs) ? docxContent.paragraphs.map(p => p.text || p) : 
                   Array.isArray(docxContent.strings) ? docxContent.strings : [],
        tables: Array.isArray(docxContent.tables) ? docxContent.tables : []
      },
      size: JSON.stringify(docxContent).length,
      timeLoaded: new Date().toISOString()
    };

    // Save to storage
    await userProfileManager.saveUserProfile(userProfile);
    
    return {
      success: true,
      message: `Processed DOCX: ${fileName}`,
      profile: userProfile
    };
  } catch (error) {
    console.error('Error processing DOCX:', error);
    return {
      success: false,
      error: error.message || 'Failed to process DOCX file'
    };
  }
}

// Process multiple files from a folder
async function processFolderFiles(folderName, files) {
  try {
    console.log(`Processing folder: ${folderName} with ${files.length} files`);
    
    // Arrays to hold extracted content
    let allTextContent = [];
    let allParagraphs = [];
    
    // Process each file and extract content
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      console.log(`Processing ${i+1}/${files.length}: ${file.filename}`);
      
      try {
        if (file.type === 'pdf') {
          let pdfTextContent;
          
          if (file.isBase64) {
            // Process PDF data using the same function as single file uploads
            // This converts base64 back to binary data and extracts text
            console.log('Processing PDF from base64 data');
            const binaryString = atob(file.content);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            
            // Use the standard processPDF function but extract just the text content
            const pdfResult = await pdfjsLib.getDocument({data: bytes}).promise;
            pdfTextContent = await extractTextFromPdfDocument(pdfResult);
          } else {
            // Fallback for any existing code that might provide non-base64 content
            console.log('Processing PDF from binary data');
            pdfTextContent = await extractTextFromPDF(file.content);
          }
          
          // Add the extracted text to our content collection
          allTextContent.push(`--- From ${file.filename} ---\n${pdfTextContent}\n`);
          
          // Split into paragraphs for structured data
          const paragraphs = pdfTextContent.split(/\r?\n\r?\n/)
            .filter(para => para.trim().length > 0)
            .map(para => ({ text: para.trim(), source: file.filename }));
          
          allParagraphs = allParagraphs.concat(paragraphs);
        } else if (file.type === 'docx') {
          if (file.content.strings && Array.isArray(file.content.strings)) {
            allTextContent.push(`--- From ${file.filename} P---\n${file.content.strings.join('\n')}\n`);
            
            // Add all strings as paragraphs
            const paragraphs = file.content.strings
              .filter(text => text.trim().length > 0)
              .map(text => ({ text: text.trim(), source: file.filename }));
            
            allParagraphs = allParagraphs.concat(paragraphs);
          } else if (file.content.paragraphs && Array.isArray(file.content.paragraphs)) {
            // Handle paragraphs directly if available
            const textContent = file.content.paragraphs
              .map(p => typeof p === 'object' ? p.text : p)
              .join('\n');
            
            allTextContent.push(`--- From ${file.filename} ---\n${textContent}\n`);
            
            // Process paragraphs
            const paragraphs = file.content.paragraphs
              .map(p => {
                const text = typeof p === 'object' ? p.text : p;
                return { text: text.trim(), source: file.filename };
              })
              .filter(p => p.text.length > 0);
            
            allParagraphs = allParagraphs.concat(paragraphs);
          }
        }
      } catch (fileError) {
        console.warn(`Error processing file ${file.filename}:`, fileError);
        // Continue with other files
      }
    }
    
    // Create combined user profile
    const combinedTextContent = allTextContent.join('\n\n');
    
    // Create a user profile structure from the combined content
    const userProfile = {
      source: 'folder',
      filename: folderName,
      fileCount: files.length,
      extractedContent: combinedTextContent,
      // For structured access
      folderData: {
        paragraphs: allParagraphs,
        files: files.map(f => ({ name: f.filename, type: f.type }))
      },
      size: combinedTextContent.length,
      timeLoaded: new Date().toISOString()
    };
    
    // Save to storage
    await userProfileManager.saveUserProfile(userProfile);
    
    return {
      success: true,
      message: `Processed ${files.length} files from ${folderName}`,
      profile: userProfile
    };
  } catch (error) {
    console.error('Error processing folder files:', error);
    return {
      success: false,
      error: error.message || 'Failed to process files from folder'
    };
  }
}

// Helper function to extract text from a PDF document
async function extractTextFromPdfDocument(pdfDocument) {
  try {
    // Extract text from all pages
    let textContent = '';
    for (let i = 1; i <= pdfDocument.numPages; i++) {
      const page = await pdfDocument.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map(item => item.str).join(' ');
      textContent += `${pageText}\n\n`;
    }
    
    return textContent;
  } catch (error) {
    console.error('Error extracting text from PDF document:', error);
    throw error;
  }
}

// Helper function to extract text from PDF data
async function extractTextFromPDF(pdfData) {
  try {
    // If the data is an ArrayBuffer, use it directly
    const loadingTask = pdfjsLib.getDocument({ data: pdfData });
    const pdfDocument = await loadingTask.promise;
    
    // Reuse extractTextFromPdfDocument to extract text
    const textContent = await extractTextFromPdfDocument(pdfDocument);
    
    console.log('Text extraction complete. Sample:', textContent.substring(0, 200) + '...');
    return textContent;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw error;
  }
}

// Format file size in a human-readable format
function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}

console.log("Background script loaded in standalone mode");

// Listen for tab updates to automatically show/hide UI injector based on saved preferences
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only run once the tab is fully loaded
  if (changeInfo.status === 'complete' && tab.url) {
    try {
      // Get the base URL
      const tabUrl = new URL(tab.url);
      const baseUrl = tabUrl.origin;
      
      console.log(`Tab updated: ${baseUrl} - checking UI injector state`);
      
      // Get saved UI injector state for this URL
      chrome.storage.local.get('uiInjectorStates', (result) => {
        const uiStates = result.uiInjectorStates || {};
        
        // Check if this URL exists in uiInjectorStates
        if (!(baseUrl in uiStates)) {
          // If not existing, initialize with default value of false
          uiStates[baseUrl] = false;
          chrome.storage.local.set({ uiInjectorStates: uiStates }, () => {
            console.log(`Initialized UI state for ${baseUrl} to default (false)`);
          });
          // Don't inject UI since default is false
          console.log(`UI for ${baseUrl} will not be shown (default state)`);
          return;
        }
        
        const savedState = uiStates[baseUrl];
        console.log(`Saved UI state for ${baseUrl}: ${savedState}`);
        
        // Only inject and show the UI if the saved state is explicitly true
        if (savedState === true) {
          console.log(`Auto-injecting UI for ${baseUrl} based on saved preference (true)`);
          
          // Inject the UI injector script
          chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['ui-injector.js']
          }).then(() => {
            // After injecting, send message to show the UI
            chrome.tabs.sendMessage(tabId, { 
              action: 'toggleUiInjector', 
              visible: true 
            }).catch(err => {
              console.error('Error showing UI injector:', err);
            });
          }).catch(err => {
            console.error('Error injecting UI script:', err);
          });
        } else {
          console.log(`UI for ${baseUrl} will not be shown (saved state is ${savedState})`);
        }
      });
    } catch (err) {
      // Silently handle invalid URLs
      console.warn('Error handling tab update:', err);
    }
  }
});
