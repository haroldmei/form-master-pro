// Import auth service
importScripts('auth.js');

// Import other modules
importScripts(
  'modules/userProfile.js',
  'modules/formProcessor.js',
  'modules/aiService.js',
  'modules/formFiller.js',
  'modules/utils.js',
  'libs/pdf.min.js',
  'libs/pdf.worker.min.js'
);

console.log("FormMasterPro extension initializing...");

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
      
    case 'login':
      auth0Service.login()
        .then(result => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    case 'logout':
      auth0Service.logout()
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    case 'checkSubscription':
      // First check if we have recent subscription data in storage
      chrome.storage.local.get(['subscriptionData'], async (result) => {
        if (result.subscriptionData && 
          result.subscriptionData.data && result.subscriptionData.data.isSubscribed && // by default any new subscription should be active
          result.subscriptionData.timestamp && 
          (Date.now() - result.subscriptionData.timestamp < 24 * 60 * 60 * 1000)) {
          // Use cached data if less than 24 hours old
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
  
  if (message.action === 'checkCompanionConnection') {
    // We're now in standalone mode, always "connected"
    sendResponse({ connected: true, standalone: true });
    return false;
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
  
  if (message.action === 'analyze-form') {
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
    return true;
  }
  
  if (message.action === 'data-mappings') {
    // Open the mappings page in a new tab
    chrome.tabs.create({ url: 'mappings.html' });
    sendResponse({ success: true, message: 'Opening field mappings' });
    return false;
  }
  
  if (message.action === 'auto-fill') {
    fillFormInTab(tabId, message.url)
      .then(result => sendResponse({ success: true, ...result }))
      .catch(err => sendResponse({ success: false, error: err.message }));
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
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  // Add this to your background.js message listener
  if (message.type === 'defaults-dialog-response') {
    console.log('Received dialog response:', message);
    // This message should be processed by defaultsDialog
    // Implement handling here or ensure defaultsDialog is properly listening
    return true;
  }

  if (message.action === 'get-defaults-dialog-data') {
    console.log('Received get-defaults-dialog-data:', message);
    return true;
  }

  if (message.action === 'defaults-dialog-submit') { 
    console.log('Received defaults-dialog-submit');
    // Open the defaults dialog
    return true;
  }

  // If we reach here, the message wasn't handled
  console.warn('Unhandled message:', message);
  sendResponse({ success: false, error: 'Unhandled message type or action' });
  return false;
});

// Check email verification status
async function checkEmailVerification() {
  try {
    // First check if user is authenticated
    const isAuthenticated = await auth0Service.isAuthenticated();
    if (!isAuthenticated) {
      return false;
    }
    
    // Use the auth0Service to check email verification status
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

// Analyze form in the current tab
async function analyzeFormInTab(tabId, url) {
  try {
    // First check if email is verified
    const isVerified = await checkEmailVerification();
    if (!isVerified) {
      return { message: 'Email verification required to use this feature', requiresVerification: true };
    }
    
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

// Fill form in the current tab - Main orchestration function
async function fillFormInTab(tabId, url) {
  try {
    // Check if user is verified before proceeding
    if (!(await isUserVerified())) {
      return { message: 'Email verification required to use this feature', requiresVerification: true };
    }
    
    console.log(`Filling form in tab ${tabId} for URL: ${url}`);
    
    // Extract form data from the page
    const formData = await extractFormData(tabId);
    if (!formData) {
      return { message: 'No form detected on page' };
    }
    
    // Flatten form fields into a single array
    const allFields = flattenFormFields(formData);    
    console.log(`Found ${allFields.length} form fields to process`);
    
    if (allFields.length === 0) {
      return { message: 'No fillable form fields detected' };
    }
    
    // Process form fields with user profile data
    const processedForm = await processFormFields(allFields, url);
    if (!processedForm.success) {
      return { message: processedForm.error || 'Error processing form' };
    }
    
    if (!processedForm.fields || Object.keys(processedForm.fields).length === 0) {
      return { message: 'No fields could be mapped for filling' };
    }
    
    // Fill the form with the processed data
    return await executeFormFilling(tabId, processedForm.fields);
  } catch (error) {
    console.error('Error in fillFormInTab:', error);
    return { message: `Error: ${error.message}` };
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
async function processFormFields(allFields, url) {
  console.log('Processing form fields with user profile data');
  const userProfile = await userProfileManager.getUserProfile();
  
  // Use the formProcessor module to get field values
  return await formProcessor.processForm(allFields, url, userProfile);
}

// Execute the form filling on the page
async function executeFormFilling(tabId, fieldValues) {
  // Execute form filling script in the page context
  const fillResult = await chrome.scripting.executeScript({
    target: { tabId },
    function: formFiller.performFormFilling, // Using formFiller module's function
    args: [fieldValues]
  });
  
  // Process and return results
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
    
    // Call the subscription status API using the API_BASE_URL constant with fallback
    const response = await fetch(`${typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : 'http://localhost:3001'}/api/auth/subscription-status`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
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
    
    const result = { 
      success: true, 
      isSubscribed: subscription.status === 'active' || subscription.status === 'trialing',
      plan: subscription.plan_name || subscription.plan || 'free',
      expiresAt: expiresAt,
      subscriptionData: subscription
    };
    
    // Store subscription data in local storage with timestamp
    chrome.storage.local.set({
      subscriptionData: {
        timestamp: Date.now(),
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
    let textContent = '';
    for (let i = 1; i <= pdfDocument.numPages; i++) {
      console.log(`Processing page ${i}/${pdfDocument.numPages}`);
      const page = await pdfDocument.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map(item => item.str).join(' ');
      textContent += `Page ${i}:\n${pageText}\n\n`;
    }
    
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

// Format file size in a human-readable format
function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}

console.log("Background script loaded in standalone mode");
