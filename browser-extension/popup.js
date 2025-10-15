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
  
  // Claude API key elements
  const claudeApiKeyInput = document.getElementById('claude-api-key');
  const saveClaudeKeyBtn = document.getElementById('save-claude-key');
  const testClaudeKeyBtn = document.getElementById('test-claude-key');
  
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
  // Check subscription status on popup open
  checkAuthState();
  
  // Load Claude API key on popup open
  loadClaudeApiKey();
  
  // Add auth button listeners
  if (loginButton) loginButton.addEventListener('click', login);
  if (logoutButton) logoutButton.addEventListener('click', logout);

  // Set up event listeners
  addSafeEventListener('analyze-form', 'click', analyzeCurrentForm);
  addSafeEventListener('clear-data', 'click', clearSavedData);
  addSafeEventListener('save-claude-key', 'click', saveClaudeApiKey);
  addSafeEventListener('test-claude-key', 'click', testClaudeApiKey);

  // Add verification-related event listeners
  if (resendVerificationBtn) resendVerificationBtn.addEventListener('click', resendVerificationEmail);
  if (checkVerificationBtn) checkVerificationBtn.addEventListener('click', relogin); // Check verification status on button click

  // Listen for auth state changes from background script
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'auth-state-changed') {
      console.log('Auth state changed:', message.isAuthenticated);
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
      const response = await auth0Service.login();

      console.log('Login successful');
      checkAuthState();
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
      console.log('Logout successful');
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
        const DEV_MODE = typeof API_BASE_URL === 'undefined' || API_BASE_URL.includes('localhost');
        const subscriptionLink = document.getElementById('subscription-link');
        if (subscriptionLink && userInfo.email) {
          const baseUrl = (DEV_MODE ? 'http://localhost:3002' : 'https://subscribe.formmasterpro.com/');
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
            
            console.log('Extracted form data:', fields);
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

  // New function to display form fields in a side panel on the page
  function displayFormFieldsInPageDialog(fields, tabId) {
    // First inject the CSS for the panel
    chrome.scripting.insertCSS({
      target: { tabId: tabId },
      css: `
        .formmaster-side-panel {
          position: fixed;
          top: 0;
          right: 0;
          width: 450px;
          max-width: 90vw;
          height: 100vh;
          background-color: #ffffff;
          box-shadow: -5px 0 15px rgba(0, 0, 0, 0.1);
          z-index: 9999;
          display: flex;
          flex-direction: column;
          transition: transform 0.3s ease;
          overflow: hidden;
          animation: formmaster-slidein 0.3s ease-out;
          border-left: 1px solid #e0e0e0;
        }

        @keyframes formmaster-slidein {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        
        .formmaster-panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          border-bottom: 1px solid #e0e0e0;
          background-color: #f5f5f5;
          flex-shrink: 0;
        }
        
        .formmaster-panel-title {
          font-size: 18px;
          font-weight: 600;
          color: #4285f4;
          margin: 0;
          display: flex;
          align-items: center;
        }
        
        .formmaster-field-count {
          background-color: #4285f4;
          color: white;
          border-radius: 16px;
          padding: 2px 8px;
          font-size: 14px;
          margin-left: 8px;
        }
        
        .formmaster-panel-close {
          background: none;
          border: none;
          font-size: 24px;
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
        
        .formmaster-panel-close:hover {
          background-color: #e8eaed;
        }
        
        .formmaster-panel-body {
          padding: 16px;
          overflow-y: auto;
          flex-grow: 1;
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
          font-size: 13px;
        }
        
        .formmaster-fields-table th {
          background-color: #f8f9fa;
          position: sticky;
          top: 0;
          font-weight: 600;
          color: #202124;
          font-size: 12px;
          white-space: nowrap;
          z-index: 1;
        }

        .formmaster-fields-table td {
          max-width: 180px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        
        .formmaster-fields-table tr:hover td {
          background-color: #f0f7ff;
        }
        
        .formmaster-options-list {
          margin: 0;
          padding: 0;
          list-style: none;
          font-size: 12px;
        }
        
        .formmaster-option-item {
          padding: 3px 5px;
          margin-bottom: 2px;
          border-radius: 3px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 150px;
        }
        
        .formmaster-selected-option {
          background-color: #e6f2ff;
          font-weight: bold;
          border-left: 3px solid #4285f4;
        }
        
        .formmaster-pdf-field-name {
          font-family: monospace;
          font-size: 0.9em;
          color: #666;
          max-width: 150px;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* Add responsive adjustments for small screens */
        @media (max-width: 768px) {
          .formmaster-side-panel {
            width: 100%;
            max-width: 100%;
          }
        }

        /* Add icon for drag handle */
        .formmaster-drag-handle {
          position: absolute;
          left: -15px;
          top: 50%;
          transform: translateY(-50%);
          width: 15px;
          height: 50px;
          background: #4285f4;
          border-radius: 4px 0 0 4px;
          cursor: ew-resize;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 14px;
        }

        .formmaster-drag-handle::after {
          content: "⋮";
          transform: rotate(90deg);
        }

        /* Toggle button for mobile view */
        .formmaster-toggle-panel {
          position: fixed;
          top: 50%;
          right: 0;
          transform: translateY(-50%);
          background: #4285f4;
          color: white;
          border: none;
          border-radius: 4px 0 0 4px;
          padding: 10px;
          cursor: pointer;
          z-index: 9998;
          display: none;
        }

        @media (max-width: 768px) {
          .formmaster-toggle-panel {
            display: block;
          }
          
          .formmaster-side-panel.collapsed {
            transform: translateX(100%);
          }
        }

        /* Adding proper style reset for the panel to avoid conflicts */
        .formmaster-side-panel, 
        .formmaster-side-panel * {
          box-sizing: border-box;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif;
        }

        /* Add new highlight effect styles */
        .formmaster-field-highlight {
          outline: 3px solid rgba(66, 133, 244, 0.8) !important;
          box-shadow: 0 0 15px rgba(66, 133, 244, 0.4) !important;
          transition: all 0.2s ease-out;
          position: relative;
          z-index: 10000;
        }
        
        .formmaster-checkbox-highlight,
        .formmaster-radio-highlight {
          background-color: rgba(66, 133, 244, 0.15) !important;
          border-radius: 4px;
          transition: all 0.2s ease-out;
        }
        
        .formmaster-row-hover {
          background-color: #f0f7ff !important;
          cursor: pointer;
        }
        
        /* Special handling for Select2 and Chosen dropdowns */
        .select2-container--focus,
        .chosen-container-active {
          box-shadow: 0 0 15px rgba(66, 133, 244, 0.4) !important;
        }
      `
    });

    // Then inject and execute the script to create the panel
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      function: (fieldsData) => {
        // Remove any existing panel first
        const existingPanel = document.querySelector('.formmaster-side-panel');
        if (existingPanel) {
          document.body.removeChild(existingPanel);
        }
        
        // Remove any existing highlight
        clearFormHighlights();
        
        const existingToggle = document.querySelector('.formmaster-toggle-panel');
        if (existingToggle) {
          document.body.removeChild(existingToggle);
        }
        
        // Create the toggle button for mobile view
        const toggleButton = document.createElement('button');
        toggleButton.className = 'formmaster-toggle-panel';
        toggleButton.innerHTML = '⟨';
        toggleButton.setAttribute('aria-label', 'Toggle form analysis panel');
        document.body.appendChild(toggleButton);
        
        // Create the side panel
        const panel = document.createElement('div');
        panel.className = 'formmaster-side-panel';
        panel.id = 'formmaster-side-panel';
        
        // Create drag handle for resizing
        const dragHandle = document.createElement('div');
        dragHandle.className = 'formmaster-drag-handle';
        panel.appendChild(dragHandle);
        
        // Create panel header
        const header = document.createElement('div');
        header.className = 'formmaster-panel-header';
        
        const title = document.createElement('h2');
        title.className = 'formmaster-panel-title';
        title.textContent = 'FormMasterPro Analysis';
        
        const fieldCount = document.createElement('span');
        fieldCount.className = 'formmaster-field-count';
        fieldCount.textContent = fieldsData.length;
        title.appendChild(fieldCount);
        
        const closeButton = document.createElement('button');
        closeButton.className = 'formmaster-panel-close';
        closeButton.innerHTML = '&times;';
        closeButton.setAttribute('aria-label', 'Close form analysis panel');
        closeButton.onclick = () => {
          panel.classList.add('collapsed');
          clearFormHighlights(); // Clear any remaining highlights when closing
          setTimeout(() => {
            if (document.body.contains(panel)) {
              document.body.removeChild(panel);
            }
          }, 300);
        };
        
        header.appendChild(title);
        header.appendChild(closeButton);
        
        // Create panel body
        const body = document.createElement('div');
        body.className = 'formmaster-panel-body';
        
        // Create the table
        const table = document.createElement('table');
        table.className = 'formmaster-fields-table';
        
        // Create table header - Add PDF Field Name column
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        
        // Check if this is a PDF form (at least one field has rawFieldName property)
        const isPdfForm = fieldsData.some(field => field.rawFieldName);
        
        const columns = ['Label/Name', 'Type', 'ID'];
        
        // Add PDF Field Name column if it's a PDF form
        if (isPdfForm) {
          columns.push('PDF Field Name');
        }
        
        // Add Value and Options columns
        columns.push('Value', 'Options');
        
        columns.forEach(headerText => {
          const th = document.createElement('th');
          th.textContent = headerText;
          headerRow.appendChild(th);
        });
        
        thead.appendChild(headerRow);
        table.appendChild(thead);
        
        // Create table body
        const tbody = document.createElement('tbody');
        
        // Helper function to truncate text to 20 characters
        function truncateText(text, maxLength = 12) {
          if (!text) return '';
          text = String(text);
          return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
        }
        
        fieldsData.forEach((field, index) => {
          const row = document.createElement('tr');
          row.setAttribute('data-field-id', field.id || '');
          row.setAttribute('data-field-name', field.name || '');
          row.setAttribute('data-field-label', field.label || '');
          row.setAttribute('data-field-type', field.type || '');
          row.setAttribute('data-field-index', index);
          
          // Add hover handlers to highlight the corresponding form field
          row.addEventListener('mouseenter', function() {
            // Add hover styling to the row
            this.classList.add('formmaster-row-hover');
            
            // Find and highlight the form field
            highlightFormField(field);
          });
          
          row.addEventListener('mouseleave', function() {
            // Remove hover styling from the row
            this.classList.remove('formmaster-row-hover');
            
            // Remove highlight from the form field
            clearFormHighlights();
          });
          
          // Label/Name cell
          const labelCell = document.createElement('td');
          const labelText = field.label || field.name || field.id || 'Unnamed Field';
          labelCell.textContent = truncateText(labelText);
          labelCell.title = labelText; // Show full text on hover
          row.appendChild(labelCell);
          
          // Type cell
          const typeCell = document.createElement('td');
          typeCell.textContent = field.type;
          row.appendChild(typeCell);
          
          // ID cell
          const idCell = document.createElement('td');
          const idText = field.id || '-';
          idCell.textContent = truncateText(idText);
          idCell.title = idText; // Show full ID on hover
          row.appendChild(idCell);
          
          // Add PDF Field Name cell if it's a PDF form
          if (isPdfForm) {
            const pdfFieldNameCell = document.createElement('td');
            
            if (field.rawFieldName) {
              pdfFieldNameCell.className = 'formmaster-pdf-field-name';
              const pdfFieldText = field.rawFieldName;
              pdfFieldNameCell.textContent = truncateText(pdfFieldText);
              pdfFieldNameCell.title = pdfFieldText; // Show full name on hover
            } else {
              pdfFieldNameCell.textContent = '-';
            }
            
            row.appendChild(pdfFieldNameCell);
          }
          
          // Value cell
          const valueCell = document.createElement('td');
          
          let valueText = '';
          if (field.type === 'select' || field.type === 'radio') {
            // For select/radio, show selected option
            const selectedOpt = field.options?.find(opt => opt.selected || opt.checked);
            valueText = selectedOpt ? selectedOpt.value || selectedOpt.text : '-';
          } else if (field.type === 'checkbox') {
            valueText = field.checked ? 'Checked' : 'Unchecked';
          } else {
            valueText = field.value || '-';
          }
          
          valueCell.textContent = truncateText(valueText);
          valueCell.title = valueText; // Show full value on hover
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
              optItem.textContent = truncateText(optionText);
              optItem.title = optionText; // Show full option text on hover
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
        
        // Assemble the panel
        panel.appendChild(header);
        panel.appendChild(body);
        document.body.appendChild(panel);
        
        // Field highlighting functions
        function highlightFormField(field) {
          // Clear any existing highlights first
          clearFormHighlights();
          
          // Try to find the element in different ways
          let element = findFieldElement(field);
          console.log('Found element:', element);
          if (element) {
            scrollElementIntoView(element);
            applyHighlightToElement(element, field.type);
          }
        }
        
        function findFieldElement(field) {
          let element = null;
          
          // Try using ID first
          if (field.id) {
            element = document.getElementById(field.id);
            if (element) return element;
          }
          // Try label matching
          if (field.label) {
            const labels = Array.from(document.querySelectorAll('label'));
            for (const label of labels) {
              if (label.textContent.trim() === field.label) {
                if (label.htmlFor) {
                  element = document.getElementById(label.htmlFor);
                  if (element) return element;
                }
                
                // Check if the label contains the input
                const labeledElement = label.querySelector('input, select, textarea');
                if (labeledElement) return labeledElement;
              }
            }
          }
          
          if (field.ariaLabel){
            // Try using ARIA label
            element = document.querySelector(`[aria-label="${field.ariaLabel}"]`);
            if (element) return element;
          }
          
          
          // Try using name
          if (field.name) {
            const nameElements = document.getElementsByName(field.name);
            if (nameElements.length > 0) return nameElements[0];
            
            // For radio buttons and checkboxes, try a more specific selector
            if (field.type === 'radio' || field.type === 'checkbox') {
              element = document.querySelector(`input[type="${field.type}"][name="${field.name}"]`);
              if (element) return element;
            }
          }
          
          // Try selected options for select fields (when available)
          if (field.type === 'select' && field.options) {
            const selectElements = document.querySelectorAll('select');
            for (const select of selectElements) {
              if (select.options.length === field.options.length) {
                const optionText = Array.from(select.options).map(o => o.text.trim());
                const fieldOptionText = field.options.map(o => o.text?.trim() || '');
                if (optionText.join() === fieldOptionText.join()) {
                  return select;
                }
              }
            }
          }
          
          return null;
        }
        
        function applyHighlightToElement(element, fieldType) {
          // Different highlighting based on element type
          if (fieldType === 'checkbox' || fieldType === 'radio') {
            // For checkboxes/radios, highlight the parent container too
            const container = element.closest('label, .form-check, .checkbox, .radio, .custom-control');
            if (container) {
              container.classList.add('formmaster-checkbox-highlight');
            } else {
              element.parentElement?.classList.add('formmaster-checkbox-highlight');
            }
            
            // Also highlight any associated label
            if (element.id) {
              const label = document.querySelector(`label[for="${element.id}"]`);
              if (label) {
                label.classList.add('formmaster-checkbox-highlight');
              }
            }
            
            element.classList.add('formmaster-field-highlight');
          } else if (fieldType === 'select') {
            // For select fields, check if it's a hidden select with enhanced UI
            if (window.getComputedStyle(element).display === 'none') {
              // Try to find the enhanced select container (Chosen or Select2)
              let enhancedContainer = null;
              
              if (element.id) {
                // Check for Chosen
                enhancedContainer = document.getElementById(`${element.id}_chosen`);
                
                if (!enhancedContainer) {
                  // Check for Select2
                  enhancedContainer = document.querySelector(`[data-select2-id="${element.id}"]`);
                }
                
                if (!enhancedContainer) {
                  // Try other common patterns
                  const possibleContainers = Array.from(
                    document.querySelectorAll(`.select2-container[id$="-${element.id}"], .chosen-container[id$="-${element.id}"]`)
                  );
                  
                  if (possibleContainers.length > 0) {
                    enhancedContainer = possibleContainers[0];
                  }
                }
              }
              
              if (enhancedContainer) {
                enhancedContainer.classList.add('formmaster-field-highlight');
              } else {
                // Fall back to highlighting the original element
                element.classList.add('formmaster-field-highlight');
              }
            } else {
              element.classList.add('formmaster-field-highlight');
            }
          } else {
            element.classList.add('formmaster-field-highlight');
          }
        }
        
        function clearFormHighlights() {
          // Remove all highlight classes
          document.querySelectorAll('.formmaster-field-highlight, .formmaster-checkbox-highlight, .formmaster-radio-highlight')
            .forEach(el => {
              el.classList.remove('formmaster-field-highlight', 'formmaster-checkbox-highlight', 'formmaster-radio-highlight');
            });
        }
        
        function scrollElementIntoView(element) {
          // Only scroll if not already in viewport
          const rect = element.getBoundingClientRect();
          const isInView = (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
          );
          
          if (!isInView) {
            element.scrollIntoView({
              behavior: 'smooth',
              block: 'center'
            });
          }
        }
        
        // Implement panel resizing functionality
        let startX, startWidth;
        
        function initResize(e) {
          startX = e.clientX;
          startWidth = parseInt(document.defaultView.getComputedStyle(panel).width, 10);
          document.documentElement.addEventListener('mousemove', resizePanel);
          document.documentElement.addEventListener('mouseup', stopResize);
          e.preventDefault();
        }
        
        function resizePanel(e) {
          const width = startWidth - (e.clientX - startX);
          if (width > 300 && width < (window.innerWidth * 0.8)) {
            panel.style.width = `${width}px`;
          }
        }
        
        function stopResize() {
          document.documentElement.removeEventListener('mousemove', resizePanel);
          document.documentElement.removeEventListener('mouseup', stopResize);
        }
        
        dragHandle.addEventListener('mousedown', initResize);
        
        // Implement toggle button for mobile view
        toggleButton.addEventListener('click', () => {
          if (panel.classList.contains('collapsed')) {
            panel.classList.remove('collapsed');
            toggleButton.innerHTML = '⟨';
          } else {
            panel.classList.add('collapsed');
            toggleButton.innerHTML = '⟩';
          }
        });
        
        // Add event listener to close panel when pressing ESC key
        document.addEventListener('keydown', (event) => {
          if (event.key === 'Escape') {
            if (document.body.contains(panel)) {
              clearFormHighlights(); // Clear highlights
              panel.classList.add('collapsed');
              setTimeout(() => {
                if (document.body.contains(panel)) {
                  document.body.removeChild(panel);
                }
              }, 300);
            }
          }
        });
      },
      args: [fields]
    });
    
    // Show success message in the popup
    showToast(`Analyzed ${fields.length} form fields`, 'success');
  }

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
      // Use cached data if it exists and is less than 24 hours old
      let response;
      response = await chrome.runtime.sendMessage({ action: 'checkSubscription' });
      if (response && response.isSubscribed) {
        // User has an active subscription
        subscriptionStatus.textContent = 'Active';
        subscriptionStatus.className = 'subscription-badge subscription-active';
        
        // Display expiry date if available
        const expiryElem = document.getElementById('subscription-expiry');
        console.log('Expiry element:', expiryElem);
        if (expiryElem && response.expiresAt) {
          try {
            // Parse ISO date string directly
            const expiryDate = new Date(response.expiresAt);
            const now = new Date();
            
            // Check if subscription has expired
            if (expiryDate < now) {
              // Subscription has expired
              subscriptionStatus.textContent = 'Expired';
              subscriptionStatus.className = 'subscription-badge subscription-expired';
              expiryElem.textContent = `Expired on: ${expiryDate.toLocaleDateString()}`;
              expiryElem.style.color = '#dc3545';
              expiryElem.classList.remove('hidden'); // Make sure it's visible
              subscriptionLink.textContent = 'Renew Now';
              subscriptionLink.classList.remove('hidden');
              
              // Hide unsubscribe button for expired subscriptions
              hideUnsubscribeButton();
              return;
            }
            
            // Format the date in a user-friendly way
            const options = { year: 'numeric', month: 'short', day: 'numeric' };
            const formattedDate = expiryDate.toLocaleDateString(undefined, options);
            
            // Check if the subscription is already cancelled (but still active)
            const isCancelled = response.cancel_at_period_end === true;
            console.log('Subscription cancelled:', isCancelled);
            if (isCancelled) {
              // If cancelled, show in the status and expiry text
              subscriptionStatus.textContent = 'Cancelling';
              subscriptionStatus.className = 'subscription-badge subscription-cancelling';
              expiryElem.textContent = `Access until: ${formattedDate}`;
              expiryElem.style.color = '#dc3545';
              expiryElem.classList.remove('hidden');
              
              // Always show renew button for cancelled subscriptions
              subscriptionLink.textContent = 'Renew';
              subscriptionLink.classList.remove('hidden');
              
              // Don't show unsubscribe button since it's already cancelled
              hideUnsubscribeButton();
              return;
            }
            
            expiryElem.textContent = `Expires: ${formattedDate}`;
            expiryElem.classList.remove('hidden');
            expiryElem.style.color = ''; // Reset color
            
            // Check if subscription expires soon (within 7 days)
            const daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
            
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
            
            // Show unsubscribe button only for active, non-cancelled subscriptions
            if (!isCancelled) {
              showUnsubscribeButton();
            } else {
              hideUnsubscribeButton();
            }
          } catch (e) {
            console.error('Error formatting expiry date:', e, response.expiresAt);
            expiryElem.classList.add('hidden');
            hideUnsubscribeButton();
          }
        }
      } else {
        // User does not have an active subscription
        subscriptionStatus.textContent = 'Inactive';
        subscriptionStatus.className = 'subscription-badge subscription-inactive';
        subscriptionLink.textContent = 'Upgrade';
        subscriptionLink.classList.remove('hidden');
        
        // Hide expiry element for free users
        const expiryElem = document.getElementById('subscription-expiry');
        if (expiryElem) {
          expiryElem.classList.add('hidden');
        }
        
        // Hide unsubscribe button for non-subscribers
        hideUnsubscribeButton();
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
      
      // Hide unsubscribe button on error
      hideUnsubscribeButton();
    }
    
    // Helper function to show the unsubscribe button
    function showUnsubscribeButton() {
      let unsubscribeBtn = document.getElementById('unsubscribe-button');
      
      if (!unsubscribeBtn) {
        // Create the unsubscribe button if it doesn't exist
        unsubscribeBtn = document.createElement('a');
        unsubscribeBtn.id = 'unsubscribe-button';
        unsubscribeBtn.className = 'button-link text-danger';
        unsubscribeBtn.textContent = 'Unsubscribe';
        unsubscribeBtn.style.marginLeft = '10px';
        unsubscribeBtn.style.fontSize = '12px';
        unsubscribeBtn.target = "_blank"; // Open in new tab
        
        // Add it next to the subscription link
        if (subscriptionLink && subscriptionLink.parentNode) {
          subscriptionLink.parentNode.appendChild(unsubscribeBtn);
        }
      }
      
      // Get the subscription URL and add the unsubscribe parameter
      if (subscriptionLink && subscriptionLink.href) {
        const baseUrl = subscriptionLink.href;
        const separator = baseUrl.includes('?') ? '&' : '?';
        const fullUrl = `${baseUrl}${separator}action=unsubscribe`;
        unsubscribeBtn.href = fullUrl;
        
        // Add click event listener to open in new tab
        unsubscribeBtn.addEventListener('click', function(e) {
          e.preventDefault(); // Prevent default link behavior
          chrome.tabs.create({ url: fullUrl }); // Open in new tab
        });
      }
      
      unsubscribeBtn.classList.remove('hidden');
    }
    
    // Helper function to hide the unsubscribe button
    function hideUnsubscribeButton() {
      const unsubscribeBtn = document.getElementById('unsubscribe-button');
      if (unsubscribeBtn) {
        unsubscribeBtn.classList.add('hidden');
      }
    }
  }

  // Function to save Claude API key
  async function saveClaudeApiKey() {
    if (!claudeApiKeyInput || !saveClaudeKeyBtn) return;
    
    const apiKey = claudeApiKeyInput.value.trim();
    
    if (!apiKey) {
      showToast('Please enter a Claude API key', 'warning');
      return;
    }
    
    // Store original text
    const originalText = saveClaudeKeyBtn.textContent;
    
    // Show loading state
    saveClaudeKeyBtn.textContent = 'Saving...';
    saveClaudeKeyBtn.disabled = true;
    
    try {
      console.log('Saving Claude API key:', apiKey.substring(0, 10) + '...');
      
      // Save to chrome storage
      await new Promise((resolve, reject) => {
        chrome.storage.local.set({ claudeApiKey: apiKey }, () => {
          if (chrome.runtime.lastError) {
            console.error('Chrome storage error when saving:', chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
          } else {
            console.log('Claude API key saved successfully to storage');
            resolve();
          }
        });
      });
      
      showToast('Claude API key saved successfully', 'success');
    } catch (error) {
      console.error('Error saving Claude API key:', error);
      showToast('Error saving API key', 'error');
    } finally {
      // Reset button state
      saveClaudeKeyBtn.disabled = false;
      saveClaudeKeyBtn.textContent = originalText;
    }
  }
  
  // Function to load Claude API key
  async function loadClaudeApiKey() {
    if (!claudeApiKeyInput) return;
    
    try {
      const result = await new Promise((resolve, reject) => {
        chrome.storage.local.get(['claudeApiKey'], (result) => {
          if (chrome.runtime.lastError) {
            console.error('Chrome storage error when loading:', chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
          } else {
            console.log('Loaded Claude API key from storage:', result.claudeApiKey ? 'Key found' : 'No key found');
            resolve(result);
          }
        });
      });
      
      if (result.claudeApiKey) {
        claudeApiKeyInput.value = result.claudeApiKey;
        console.log('Set API key in input field');
      }
    } catch (error) {
      console.error('Error loading Claude API key:', error);
    }
  }

  // Function to test Claude API key
  async function testClaudeApiKey() {
    if (!claudeApiKeyInput || !testClaudeKeyBtn) return;
    
    const apiKey = claudeApiKeyInput.value.trim();
    
    if (!apiKey) {
      showToast('Please enter a Claude API key first', 'warning');
      return;
    }
    
    // Store original text
    const originalText = testClaudeKeyBtn.textContent;
    
    // Show loading state
    testClaudeKeyBtn.textContent = 'Testing...';
    testClaudeKeyBtn.disabled = true;
    
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({
          model: "claude-3-haiku-20240307",
          max_tokens: 10,
          messages: [
            {
              role: "user",
              content: "Hello"
            }
          ]
        })
      });

      if (response.ok) {
        showToast('Claude API key is valid!', 'success');
      } else {
        const errorData = await response.json().catch(() => ({}));
        showToast(`API test failed: ${errorData.error?.message || response.statusText}`, 'error');
      }
    } catch (error) {
      console.error('Error testing Claude API key:', error);
      showToast(`Error testing API key: ${error.message}`, 'error');
    } finally {
      // Reset button state
      testClaudeKeyBtn.disabled = false;
      testClaudeKeyBtn.textContent = originalText;
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
        const profileText = response.profileCount === 1 ? 'profile' : 'profiles';
        showToast(`Form data cleared successfully (${response.profileCount} ${profileText})`, 'success');
      } else {
        showToast(response?.error || 'Error clearing form data', 'error');
      }
    });
  }
});
