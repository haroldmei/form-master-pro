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

console.log("FormMaster Pro extension initializing...");

// Initialize auth on extension startup
auth0Service.init()
  .then(isAuthenticated => {
    console.log('Auth initialized, authenticated:', isAuthenticated);
  })
  .catch(error => {
    console.error('Auth initialization error:', error);
  });

// Initialize when extension loads
userProfileManager.loadUserProfile();

// Handle messages from content scripts or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // console.log("Received message:", message, "from:", sender);
  
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
    // Reload settings
    userProfileManager.loadUserProfile();
    return false;
  }
});

// Add page load event listener
chrome.webNavigation.onCompleted.addListener(function(details) {
  // Only handle the main frame navigation (not iframes)
  if (details.frameId !== 0) return;
  
  // Check if we have data to display in an overlay
  chrome.storage.sync.get(['userProfile'], function(result) {
    if (result.userProfile && result.userProfile.personal && result.userProfile.personal.firstName) {
      const firstName = result.userProfile.personal.firstName;

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
});

console.log("Background script loaded in standalone mode");
