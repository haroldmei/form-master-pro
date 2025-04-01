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
  const formAnalysisPanel = document.getElementById('form-analysis');
  const fieldCount = document.getElementById('field-count');
  const fieldsContainer = document.getElementById('fields-container');
  
  // Check authentication state on popup open
  checkAuthState();
  
  // Add auth button listeners
  if (loginButton) loginButton.addEventListener('click', login);
  if (logoutButton) logoutButton.addEventListener('click', logout);

  // Set up event listeners
  addSafeEventListener('analyze-form', 'click', analyzeCurrentForm);

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
  
  // Check authentication state
  async function checkAuthState() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'checkAuth' });
      
      if (response && response.isAuthenticated) {
        showAuthenticatedUI();
        loadUserProfile();
      } else {
        showUnauthenticatedUI();
      }
    } catch (error) {
      console.error('Error checking auth state:', error);
      showUnauthenticatedUI();
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
  function showAuthenticatedUI() {
    if (loggedOutView) loggedOutView.classList.add('hidden');
    if (loggedInView) loggedInView.classList.remove('hidden');
    
    // Enable buttons that require authentication
    enableFormFeatures(true);
  }
  
  // Show unauthenticated UI
  function showUnauthenticatedUI() {
    if (loggedOutView) loggedOutView.classList.remove('hidden');
    if (loggedInView) loggedInView.classList.add('hidden');
    
    // Disable buttons that require authentication
    enableFormFeatures(false);
  }
  
  // Enable/disable form features based on auth state
  function enableFormFeatures(enabled) {
    const buttons = []; //[analyzeFormButton, loadDataButton, dataMappingsButton, autoFillButton];
    buttons.forEach(button => {
      if (button) button.disabled = !enabled;
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
        files: ['forms/form_radios.js', 'forms/form_extract.js']
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
            if (formData.checkboxes) {
              fields.push(...formData.checkboxes);
            }
            
            return fields;
          }
        }, results => {
          if (results && results[0] && results[0].result) {
            displayFormFields(results[0].result);
            autoFillBtn.disabled = false;
          } else {
            fieldsContainer.innerHTML = '<p class="error">No form detected or error analyzing form.</p>';
            formAnalysisPanel.classList.remove('hidden');
          }
          
          analyzeFormBtn.disabled = false;
          analyzeFormBtn.textContent = 'Analyze Current Form';
        });
      });
    });
  }

  // Function to display the analyzed form fields
  function displayFormFields(fields) {
    fieldCount.textContent = fields.length;
    fieldsContainer.innerHTML = '';
    
    console.log('Form data fields:', fields);

    // Create table element
    const table = document.createElement('table');
    table.className = 'fields-table';
    
    // Create table header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    // Add column for options
    ['Label/Name', 'Type', 'ID', 'Value', 'Options'].forEach(headerText => {
      const th = document.createElement('th');
      th.textContent = headerText;
      headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Create table body
    const tbody = document.createElement('tbody');
    
    fields.forEach(field => {
      const row = document.createElement('tr');
      
      // Label/Name cell
      const labelCell = document.createElement('td');
      labelCell.className = 'field-label';
      labelCell.textContent = field.label || field.name || field.id || 'Unnamed Field';
      row.appendChild(labelCell);
      
      // Type cell
      const typeCell = document.createElement('td');
      typeCell.className = 'field-type';
      typeCell.textContent = field.type;
      row.appendChild(typeCell);
      
      // ID cell
      const idCell = document.createElement('td');
      idCell.className = 'field-id';
      idCell.textContent = field.id || '-';
      row.appendChild(idCell);
      
      // Value cell
      const valueCell = document.createElement('td');
      valueCell.className = 'field-value';
      
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
      
      // Options cell - new cell for displaying available options
      const optionsCell = document.createElement('td');
      optionsCell.className = 'field-options';
      
      if (field.options && field.options.length > 0) {
        // For fields with options (select, radio), display them
        const optionsList = document.createElement('ul');
        optionsList.className = 'options-list';
        
        // Limit to first 5 options if there are many, to avoid UI clutter
        const displayLimit = 5;
        const displayOptions = field.options.slice(0, displayLimit);
        
        displayOptions.forEach(option => {
          const optItem = document.createElement('li');
          optItem.className = option.selected || option.checked ? 'selected-option' : '';
          
          // Use the most informative value available
          const optionText = option.text || option.value || option.label || '-';
          optItem.textContent = optionText;
          optionsList.appendChild(optItem);
        });
        
        // If there are more options than the display limit, add an indicator
        if (field.options.length > displayLimit) {
          const moreItem = document.createElement('li');
          moreItem.className = 'more-options';
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
    fieldsContainer.appendChild(table);
    
    // No need to add inline styles here anymore since we've defined them in the HTML
    
    formAnalysisPanel.classList.remove('hidden');
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
});
