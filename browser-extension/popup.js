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
  
  // Button elements
  const analyzeFormBtn = document.getElementById('analyze-form');
  const loadDataBtn = document.getElementById('load-data');
  const dataMappingsBtn = document.getElementById('data-mappings');
  const autoFillBtn = document.getElementById('auto-fill');
  const openOptionsBtn = document.getElementById('open-options');
  
  // Form analysis panel
  const formAnalysisPanel = document.getElementById('form-analysis');
  const fieldCount = document.getElementById('field-count');
  const fieldsContainer = document.getElementById('fields-container');
  
  // Check connection status - in standalone mode, it's always "connected"
  displayStandaloneStatus();
  
  // Set up event listeners
  addSafeEventListener('analyze-form', 'click', analyzeCurrentForm);
  addSafeEventListener('load-data', 'click', loadProfileData);
  addSafeEventListener('data-mappings', 'click', openDataMappings);
  addSafeEventListener('auto-fill', 'click', autoFillForm);
  addSafeEventListener('open-options', 'click', openOptions);
  
  // Remove redundant event listeners for elements that don't exist
  // addSafeEventListener('fill-form-btn', 'click', fillCurrentForm);
  // addSafeEventListener('settings-btn', 'click', openSettings);
  
  // Update reconnect button to be profile editor in standalone mode
  const reconnectBtn = document.getElementById('reconnect-btn');
  if (reconnectBtn) {
    reconnectBtn.textContent = "Edit Profile";
    reconnectBtn.addEventListener('click', editUserProfile);
  }
  
  // Function to display standalone status
  function displayStandaloneStatus() {
    const statusElement = document.getElementById('connection-status');
    statusElement.textContent = 'Standalone Mode - No companion app required';
    statusElement.className = 'status connected';
  }
  
  // Function to analyze the current form
  function analyzeCurrentForm() {
    analyzeFormBtn.disabled = true;
    analyzeFormBtn.textContent = 'Analyzing...';
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        function: scanFormFields
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
  }
  
  // Function to scan form fields
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
  
  // Function to display the analyzed form fields
  function displayFormFields(fields) {
    fieldCount.textContent = fields.length;
    fieldsContainer.innerHTML = '';
    
    fields.forEach(field => {
      const fieldItem = document.createElement('div');
      fieldItem.className = 'field-item';
      
      const fieldLabel = document.createElement('div');
      fieldLabel.className = 'field-label';
      fieldLabel.textContent = field.label || field.name || field.id || 'Unnamed Field';
      
      const fieldType = document.createElement('div');
      fieldType.className = 'field-type';
      fieldType.textContent = field.type;
      
      fieldItem.appendChild(fieldLabel);
      fieldItem.appendChild(fieldType);
      fieldsContainer.appendChild(fieldItem);
    });
    
    formAnalysisPanel.classList.remove('hidden');
  }
  
  // Function to load user profile data
  function loadProfileData() {
    // In standalone mode, open the profile editor
    chrome.tabs.create({url: 'profile.html'});
    showToast('Opening profile editor');
  }
  
  // Function to open data mappings page
  function openDataMappings() {
    chrome.tabs.create({url: 'mappings.html'});
  }
  
  // Function to trigger auto-fill
  function autoFillForm() {
    autoFillBtn.disabled = true;
    autoFillBtn.textContent = 'Filling...';
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.runtime.sendMessage({ 
        action: 'fillForm', 
        tabId: tabs[0].id,
        url: tabs[0].url
      }, response => {
        if (response && response.success) {
          showToast('Form filled successfully');
        } else {
          showToast('Error filling form: ' + (response?.error || 'Unknown error'), 'error');
        }
        
        autoFillBtn.disabled = false;
        autoFillBtn.textContent = 'Auto Fill Form';
      });
    });
  }
  
  // Function to open options page
  function openOptions() {
    chrome.runtime.openOptionsPage();
  }
  
  // Function to open user profile editor
  function editUserProfile() {
    chrome.tabs.create({url: 'profile.html'});
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
  
  /**
   * Fill the current form with data
   */
  function fillCurrentForm() {
    // This function is now only used internally, not connected to a DOM element
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      const tab = tabs[0];
      if (!tab) return;
      
      chrome.runtime.sendMessage({ 
        action: 'fillForm', 
        tabId: tab.id,
        url: tab.url
      }, response => {
        if (response && response.success) {
          showToast('Form filled successfully');
        } else {
          showToast('Error filling form: ' + (response?.error || 'Unknown error'), 'error');
        }
      });
    });
  }
  
  /**
   * Open the extension settings page
   */
  function openSettings() {
    // This function is now only used internally, not connected to a DOM element
    chrome.runtime.openOptionsPage();
  }
  
  // Initialize your popup interface
  function initializePopup() {
    // Your initialization code
  }
  
  initializePopup();
});
