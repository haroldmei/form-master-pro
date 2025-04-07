document.addEventListener('DOMContentLoaded', function() {
  // Wait for the DOM to be fully loaded before accessing elements
  
  // Helper function to safely add event listeners
  function addSafeEventListener(id, event, handler) {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener(event, handler);
    } else {
      console.warn(`Element with ID "${id}" not found in the DOM`);
    }
  }
  
  // Connection status elements
  const statusIndicator = document.getElementById('status-indicator');
  const statusText = document.getElementById('status-text');
  
  
  // Auth-related elements
  const loginButton = document.getElementById('login-button');
  const logoutButton = document.getElementById('logout-button');
  const authContainer = document.getElementById('auth-container');
  const loggedOutView = document.getElementById('logged-out-view');
  const loggedInView = document.getElementById('logged-in-view');
  const userName = document.getElementById('user-name');
  const userPicture = document.getElementById('user-picture');

  // Button elements
  const analyzeFormBtn = document.getElementById('analyze-form');
  
  // Form analysis panel
  const fieldCount = document.getElementById('field-count');
  const fieldsContainer = document.getElementById('fields-container');
  
  // Email verification elements
  const verificationAlert = document.getElementById('verification-alert');
  const resendVerificationBtn = document.getElementById('resend-verification');
  const checkVerificationBtn = document.getElementById('check-verification');
  const verificationBadge = document.getElementById('verification-badge');
  
  // Subscription elements
  const subscriptionStatus = document.getElementById('subscription-status');
  const subscriptionLink = document.getElementById('subscription-link');
  
  // Check authentication state on popup open
  checkAuthState();
  
  // Check subscription status on popup open
  checkSubscriptionStatus();
  
  // Add auth button listeners
  if (loginButton) loginButton.addEventListener('click', login);
  if (logoutButton) logoutButton.addEventListener('click', logout);

  // Set up event listeners
  addSafeEventListener('analyze-form', 'click', analyzeCurrentForm);
  addSafeEventListener('clear-data', 'click', clearSavedData);

  // Add verification-related event listeners
  if (resendVerificationBtn) resendVerificationBtn.addEventListener('click', resendVerificationEmail);
  if (checkVerificationBtn) checkVerificationBtn.addEventListener('click', relogin); // Check verification status on button click

  // Listen for auth state changes from background script
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'auth-state-changed') {
      checkAuthState();
    }
  });
  
  // Login function
  async function login() {
    if (loginButton) {
      loginButton.disabled = true;
      loginButton.textContent = 'Logging in...';
    }
    
    try {
      const response = await chrome.runtime.sendMessage({ action: 'login' });
      
      if (response && response.success) {
        checkAuthState();
      } else if (response && response.error) {
        console.error('Login error:', response.error);
        showError(`Login failed: ${response.error}`);
      }
    } catch (error) {
      console.error('Error during login:', error);
      showError('Login process failed');
    }
    
    if (loginButton) {
      loginButton.disabled = false;
      loginButton.textContent = 'Log In';
    }
  }
  
  // Logout function
  async function logout() {
    if (logoutButton) {
      logoutButton.disabled = true;
    }
    
    try {
      await chrome.runtime.sendMessage({ action: 'logout' });
      checkAuthState();
    } catch (error) {
      console.error('Error during logout:', error);
    }
    
    if (logoutButton) {
      logoutButton.disabled = false;
    }
  }
  

  async function relogin(){
    logout();
    login();
  }

  // Check authentication state
  async function checkAuthState() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'checkAuth' });
      
      if (response && response.isAuthenticated) {
        // User is authenticated, but we need to check email verification
        const isVerified = await checkEmailVerification(false); // false means don't show messages
        console.log('User is authenticated:', response.isAuthenticated, 'Verified:', isVerified);

        
        if (isVerified) {
          // Fully authenticated and verified
          showAuthenticatedUI(true);
          loadUserProfile();
          checkSubscriptionStatus(); // Check subscription when user is authenticated
        } else {
          // Authenticated but not verified
          showAuthenticatedUI(false);
          loadUserProfile();
          showVerificationAlert();
          checkSubscriptionStatus(); // Check subscription when user is authenticated but not verified
        }
      } else {
        showUnauthenticatedUI();
        // Hide subscription information when not logged in
        if (subscriptionStatus) subscriptionStatus.parentElement.parentElement.classList.add('hidden');
      }
    } catch (error) {
      console.error('Error checking auth state:', error);
      showUnauthenticatedUI();
      // Hide subscription information on error
      if (subscriptionStatus) subscriptionStatus.parentElement.parentElement.classList.add('hidden');
    }
  }
  
  // Load user profile
  async function loadUserProfile() {
    try {
      // Use the background script to get user info
      const userInfo = await getUserInfo();
      
      if (userInfo) {
        if (userName) userName.textContent = userInfo.name || userInfo.email || 'User';
        if (userPicture && userInfo.picture) userPicture.src = userInfo.picture;
        
        // Update subscription link with email parameter if available
        const subscriptionLink = document.getElementById('subscription-link');
        if (subscriptionLink && userInfo.email) {
          const baseUrl = 'https://subscribe.formmasterpro.com/';
          subscriptionLink.href = `${baseUrl}?email=${encodeURIComponent(userInfo.email)}`;
        }
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  }
  
  // Get user info from ID token
  async function getUserInfo() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(['authState'], (result) => {
        if (!result.authState || !result.authState.idToken) {
          return reject(new Error('No ID token available'));
        }
        
        try {
          // Parse the ID token payload
          const payloadBase64 = result.authState.idToken.split('.')[1];
          const payload = JSON.parse(atob(payloadBase64));
          resolve(payload);
        } catch (error) {
          reject(error);
        }
      });
    });
  }
  
  // Show authenticated UI
  function showAuthenticatedUI(verified = true) {
    if (loggedOutView) loggedOutView.classList.add('hidden');
    if (loggedInView) loggedInView.classList.remove('hidden');
    
    // Only enable form features if the user is verified
    const ENABLE_FORM_FEATURES = true; // Set this based on your environment variable
    enableFormFeatures(verified && ENABLE_FORM_FEATURES);
    
    // Set verification badge
    if (verificationBadge) {
      if (verified) {
        verificationBadge.textContent = 'Verified';
        verificationBadge.className = 'user-badge badge-verified';
      } else {
        verificationBadge.textContent = 'Unverified';
        verificationBadge.className = 'user-badge badge-unverified';
      }
    }
    
    // Only show verification alert if the user is logged in but not verified
    if (verificationAlert) {
      verificationAlert.style.display = verified ? 'none' : 'block';
    }

    // Show subscription container ONLY for verified users
    const subscriptionContainer = document.getElementById('subscription-container');
    if (subscriptionContainer) {
      if (verified) {
        subscriptionContainer.classList.remove('hidden');
      } else {
        subscriptionContainer.classList.add('hidden');
      }
    }
  }
  
  // Show unauthenticated UI
  function showUnauthenticatedUI() {
    if (loggedOutView) loggedOutView.classList.remove('hidden');
    if (loggedInView) loggedInView.classList.add('hidden');
    
    // Always hide verification alert for logged out users
    if (verificationAlert) {
      verificationAlert.style.display = 'none';
    }
    
    // Disable buttons that require authentication
    enableFormFeatures(false);

    // Hide subscription container for unauthenticated users
    const subscriptionContainer = document.getElementById('subscription-container');
    if (subscriptionContainer) {
      subscriptionContainer.classList.add('hidden');
    }
  }
  
  // Check email verification status
  async function checkEmailVerification(showMessages = true) {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'checkEmailVerification' });
      
      if (response && response.success) {
        const isVerified = response.isVerified === true;
        
        if (isVerified && showMessages) {
          showToast('Email verified successfully!', 'success');
          showAuthenticatedUI(true);
        } else if (showMessages) {
          showToast('Email is not verified yet', 'warning');
        }
        
        return isVerified;
      }
      
      return false;
    } catch (error) {
      console.error('Error checking verification status:', error);
      if (showMessages) {
        showToast('Error checking verification status', 'error');
      }
      return false;
    }
  }
  
  // Resend verification email
  async function resendVerificationEmail() {
    try {
      resendVerificationBtn.disabled = true;
      resendVerificationBtn.textContent = 'Sending...';
      
      const response = await chrome.runtime.sendMessage({ action: 'resendVerificationEmail' });
      
      if (response && response.success) {
        showToast('Verification email sent!', 'success');
      } else {
        showToast(response?.error || 'Error sending verification email', 'error');
      }
    } catch (error) {
      console.error('Error sending verification email:', error);
      showToast('Error sending verification email', 'error');
    } finally {
      resendVerificationBtn.disabled = false;
      resendVerificationBtn.textContent = 'Resend Email';
    }
  }
  
  // Show verification alert (only for authenticated but unverified users)
  function showVerificationAlert() {
    // This function is now redundant as the alert visibility is managed in showAuthenticatedUI
    // Keeping it for compatibility with existing code
    if (verificationAlert) {
      verificationAlert.style.display = 'block';
    }
  }

  // Enable/disable form features based on auth state and verification
  function enableFormFeatures(enabled) {
    // Update to handle all form-related buttons
    if (analyzeFormBtn) analyzeFormBtn.disabled = !enabled;
    
    // Add any other buttons that require authentication
    const buttons = [analyzeFormBtn]; // Add other form buttons here
    
    buttons.forEach(button => {
      if (button) {
        button.disabled = !enabled;
        if (!enabled && button.title) {
          button.title = 'Email verification required';
        }
      }
    });
  }
  

  // Function to analyze the current form
  function analyzeCurrentForm() {
    analyzeFormBtn.disabled = true;
    analyzeFormBtn.textContent = 'Analyzing...';
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      // First inject both script files in the correct order
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        files: ['forms/form_radios.js', 'forms/form_checkboxgroup.js', 'forms/form_extract.js']
      }, () => {
        // Then execute a function that uses the injected scripts
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          function: () => {
            // Use the FormExtract object exposed by form_extract.js
            const formData = self.FormExtract.extractFormControls();

            // Flatten the structure to match what displayFormFields expects
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
            if (formData.checkboxGroups) {
              fields.push(...formData.checkboxGroups);
            }
            
            // Process checkboxes
            if (formData.checkboxes) {
              fields.push(...formData.checkboxes);
            }
            
            return fields;
          }
        }, results => {
          if (results && results[0] && results[0].result) {
            // Instead of displaying in popup, send to dialog in the page
            displayFormFieldsInPageDialog(results[0].result, tabs[0].id);
            
            if (typeof autoFillBtn !== 'undefined' && autoFillBtn) {
              autoFillBtn.disabled = false;
            }
          } else {
            showToast('No form detected or error analyzing form.', 'error');
          }
          
          analyzeFormBtn.disabled = false;
          analyzeFormBtn.textContent = 'Analyze Current Form';
        });
      });
    });
  }

  // New function to display form fields in a dialog on the page
  function displayFormFieldsInPageDialog(fields, tabId) {
    // First inject the CSS for the dialog if it doesn't exist
    chrome.scripting.insertCSS({
      target: { tabId: tabId },
      css: `
        .formmaster-overlay {
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
        }
        
        .formmaster-dialog {
          background-color: #ffffff;
          border-radius: 8px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
          width: 80%;
          max-width: 900px;
          max-height: 80vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        
        .formmaster-dialog-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          border-bottom: 1px solid #e0e0e0;
          background-color: #f5f5f5;
        }
        
        .formmaster-dialog-title {
          font-size: 18px;
          font-weight: 600;
          color: #4285f4;
          margin: 0;
        }
        
        .formmaster-dialog-close {
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
          color: #5f6368;
          padding: 0;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .formmaster-dialog-close:hover {
          background-color: #e8eaed;
        }
        
        .formmaster-dialog-body {
          padding: 16px;
          overflow-y: auto;
        }
        
        .formmaster-fields-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 12px;
        }
        
        .formmaster-fields-table th, 
        .formmaster-fields-table td {
          padding: 10px 12px;
          text-align: left;
          border-bottom: 1px solid #e0e0e0;
        }
        
        .formmaster-fields-table th {
          background-color: #f8f9fa;
          position: sticky;
          top: 0;
          font-weight: 600;
          color: #202124;
        }
        
        .formmaster-fields-table tr:hover td {
          background-color: #f0f7ff;
        }
        
        .formmaster-field-count {
          background-color: #4285f4;
          color: white;
          border-radius: 16px;
          padding: 2px 8px;
          font-size: 14px;
          margin-left: 8px;
        }
        
        .formmaster-options-list {
          margin: 0;
          padding: 0;
          list-style: none;
        }
        
        .formmaster-option-item {
          padding: 3px 5px;
          margin-bottom: 2px;
          border-radius: 3px;
        }
        
        .formmaster-selected-option {
          background-color: #e6f2ff;
          font-weight: bold;
          border-left: 3px solid #4285f4;
        }
      `
    });

    // Then inject and execute the script to create the dialog
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      function: (fieldsData) => {
        // Remove any existing dialog first
        const existingDialog = document.querySelector('.formmaster-overlay');
        if (existingDialog) {
          document.body.removeChild(existingDialog);
        }
        
        // Create the dialog
        const overlay = document.createElement('div');
        overlay.className = 'formmaster-overlay';
        
        const dialog = document.createElement('div');
        dialog.className = 'formmaster-dialog';
        
        // Create dialog header
        const header = document.createElement('div');
        header.className = 'formmaster-dialog-header';
        
        const title = document.createElement('h2');
        title.className = 'formmaster-dialog-title';
        title.textContent = 'FormMasterPro Analysis';
        
        const fieldCount = document.createElement('span');
        fieldCount.className = 'formmaster-field-count';
        fieldCount.textContent = fieldsData.length;
        title.appendChild(fieldCount);
        
        const closeButton = document.createElement('button');
        closeButton.className = 'formmaster-dialog-close';
        closeButton.innerHTML = '&times;';
        closeButton.onclick = () => {
          document.body.removeChild(overlay);
        };
        
        header.appendChild(title);
        header.appendChild(closeButton);
        
        // Create dialog body
        const body = document.createElement('div');
        body.className = 'formmaster-dialog-body';
        
        // Create the table
        const table = document.createElement('table');
        table.className = 'formmaster-fields-table';
        
        // Create table header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        
        ['Label/Name', 'Type', 'ID', 'Value', 'Options'].forEach(headerText => {
          const th = document.createElement('th');
          th.textContent = headerText;
          headerRow.appendChild(th);
        });
        
        thead.appendChild(headerRow);
        table.appendChild(thead);
        
        // Create table body
        const tbody = document.createElement('tbody');
        
        fieldsData.forEach(field => {
          const row = document.createElement('tr');
          
          // Label/Name cell
          const labelCell = document.createElement('td');
          labelCell.textContent = field.label || field.name || field.id || 'Unnamed Field';
          row.appendChild(labelCell);
          
          // Type cell
          const typeCell = document.createElement('td');
          typeCell.textContent = field.type;
          row.appendChild(typeCell);
          
          // ID cell
          const idCell = document.createElement('td');
          idCell.textContent = field.id || '-';
          row.appendChild(idCell);
          
          // Value cell
          const valueCell = document.createElement('td');
          
          if (field.type === 'select' || field.type === 'radio') {
            // For select/radio, show selected option
            const selectedOpt = field.options?.find(opt => opt.selected || opt.checked);
            valueCell.textContent = selectedOpt ? selectedOpt.value || selectedOpt.text : '-';
          } else if (field.type === 'checkbox') {
            valueCell.textContent = field.checked ? 'Checked' : 'Unchecked';
          } else {
            valueCell.textContent = field.value || '-';
          }
          
          row.appendChild(valueCell);
          
          // Options cell
          const optionsCell = document.createElement('td');
          
          if (field.options && field.options.length > 0) {
            const optionsList = document.createElement('ul');
            optionsList.className = 'formmaster-options-list';
            
            // Limit to first 5 options
            const displayLimit = 5;
            const displayOptions = field.options.slice(0, displayLimit);
            
            displayOptions.forEach(option => {
              const optItem = document.createElement('li');
              optItem.className = 'formmaster-option-item';
              if (option.selected || option.checked) {
                optItem.className += ' formmaster-selected-option';
              }
              
              const optionText = option.text || option.value || option.label || '-';
              optItem.textContent = optionText;
              optionsList.appendChild(optItem);
            });
            
            // If there are more options than the display limit, add an indicator
            if (field.options.length > displayLimit) {
              const moreItem = document.createElement('li');
              moreItem.className = 'formmaster-option-item';
              moreItem.style.fontStyle = 'italic';
              moreItem.style.color = '#5f6368';
              moreItem.textContent = `...and ${field.options.length - displayLimit} more`;
              optionsList.appendChild(moreItem);
            }
            
            optionsCell.appendChild(optionsList);
          } else {
            optionsCell.textContent = '-';
          }
          
          row.appendChild(optionsCell);
          tbody.appendChild(row);
        });
        
        table.appendChild(tbody);
        body.appendChild(table);
        
        // Assemble the dialog
        dialog.appendChild(header);
        dialog.appendChild(body);
        overlay.appendChild(dialog);
        
        // Add to the page
        document.body.appendChild(overlay);
        
        // Add event listener to close dialog when clicking outside
        overlay.addEventListener('click', (event) => {
          if (event.target === overlay) {
            document.body.removeChild(overlay);
          }
        });
        
        // Prevent scrolling of the background content
        document.body.style.overflow = 'hidden';
        
        // Restore scrolling when dialog is closed
        closeButton.addEventListener('click', () => {
          document.body.style.overflow = '';
        });
        
        overlay.addEventListener('click', (event) => {
          if (event.target === overlay) {
            document.body.style.overflow = '';
          }
        });
      },
      args: [fields]
    });
    
    // Show success message in the popup
    showToast(`Analyzed ${fields.length} form fields`, 'success');
  }

  // Old displayFormFields function can be removed as we're replacing it with the dialog version
  /* The original displayFormFields function is removed since we now use the dialog version */

// Helper function to show toast messages
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('show');
      
      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    }, 10);
  }
  
  
  // Initialize your popup interface
  function initializePopup() {
    // Your initialization code
  }
  
  initializePopup();

  // Helper function to show error messages
  function showError(message) {
    const errorContainer = document.createElement('div');
    errorContainer.className = 'error-message';
    errorContainer.textContent = message;

    // Append the error message to the body or a specific container
    document.body.appendChild(errorContainer);

    // Automatically remove the error message after 3 seconds
    setTimeout(() => {
      errorContainer.remove();
    }, 3000);
  }

  // Check subscription status
  async function checkSubscriptionStatus() {
    try {
      // First check if we have recent subscription data in local storage
      const storageData = await new Promise(resolve => {
        chrome.storage.local.get(['subscriptionData'], result => {
          resolve(result.subscriptionData);
        });
      });
      
      // Use cached data if it exists and is less than 24 hours old
      let response;
      if (storageData && 
          storageData.data && storageData.data.isSubscribed && // by default any new subscription should be active
          storageData.timestamp && 
          (Date.now() - storageData.timestamp < 24 * 60 * 60 * 1000)) {
        console.log('Cached subscription status', storageData.data.isSubscribed, storageData.data.success);
        response = storageData.data;
      } else {
        // Otherwise request fresh data
        console.log('Fetch subscription data from server');
        response = await chrome.runtime.sendMessage({ action: 'checkSubscription' });
      }
      
      if (response && response.isSubscribed) {
        // User has an active subscription
        subscriptionStatus.textContent = 'Active';
        subscriptionStatus.className = 'subscription-badge subscription-active';
        
        // Display expiry date if available
        const expiryElem = document.getElementById('subscription-expiry');
        if (expiryElem && response.expiresAt) {
          try {
            // Parse ISO date string directly
            const expiryDate = new Date(response.expiresAt);
            
            // Format the date in a user-friendly way
            const options = { year: 'numeric', month: 'short', day: 'numeric' };
            const formattedDate = expiryDate.toLocaleDateString(undefined, options);
            
            expiryElem.textContent = `Expires: ${formattedDate}`;
            expiryElem.classList.remove('hidden');
            
            // Check if subscription expires soon (within 7 days)
            const daysUntilExpiry = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));
            
            if (daysUntilExpiry <= 7) {
              // Change expiry text to red and show renewal link
              expiryElem.style.color = '#dc3545';
              subscriptionLink.textContent = 'Renew Now';
              subscriptionLink.classList.remove('hidden');
              
              // If very close to expiry (3 days), make it more noticeable
              if (daysUntilExpiry <= 3) {
                expiryElem.innerHTML = `<strong>Expires in ${daysUntilExpiry} days!</strong>`;
              }
            } else {
              // Not expiring soon, hide renewal link
              subscriptionLink.classList.add('hidden');
            }
          } catch (e) {
            console.error('Error formatting expiry date:', e, response.expiresAt);
            expiryElem.classList.add('hidden');
          }
        }
      } else {
        // User does not have an active subscription
        subscriptionStatus.textContent = 'Free';
        subscriptionStatus.className = 'subscription-badge subscription-inactive';
        subscriptionLink.textContent = 'Upgrade';
        subscriptionLink.classList.remove('hidden');
        
        // Hide expiry element for free users
        const expiryElem = document.getElementById('subscription-expiry');
        if (expiryElem) {
          expiryElem.classList.add('hidden');
        }
      }
    } catch (error) {
      console.error('Error checking subscription status:', error);
      subscriptionStatus.textContent = 'Unknown';
      subscriptionStatus.className = 'subscription-badge subscription-inactive';
      subscriptionLink.classList.remove('hidden');
      
      // Hide expiry element on error
      const expiryElem = document.getElementById('subscription-expiry');
      if (expiryElem) {
        expiryElem.classList.add('hidden');
      }
    }
  }

  // Function to clear saved data
  function clearSavedData() {
    const clearDataBtn = document.getElementById('clear-data');
    if (!clearDataBtn) return;

    // Store original text
    const originalText = clearDataBtn.textContent;
    
    // Show loading state
    clearDataBtn.textContent = 'Clearing...';
    clearDataBtn.disabled = true;
    
    // Send message to clear suggestions data
    chrome.runtime.sendMessage({ action: 'clearSuggestions' }, function(response) {
      // Reset button state
      clearDataBtn.disabled = false;
      clearDataBtn.textContent = originalText;
      
      if (response && response.success) {
        showToast('Form data cleared successfully', 'success');
      } else {
        showToast(response?.error || 'Error clearing form data', 'error');
      }
    });
  }
});
