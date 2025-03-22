document.addEventListener('DOMContentLoaded', function() {
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
  
  // Check companion app connection
  checkCompanionConnection();
  
  // Set up event listeners
  analyzeFormBtn.addEventListener('click', analyzeCurrentForm);
  loadDataBtn.addEventListener('click', loadDataFile);
  dataMappingsBtn.addEventListener('click', openDataMappings);
  autoFillBtn.addEventListener('click', autoFillForm);
  openOptionsBtn.addEventListener('click', openOptions);
  
  // Check connection status when popup opens
  checkCompanionConnection();
  
  // Add event listeners
  document.getElementById('fill-form-btn').addEventListener('click', fillCurrentForm);
  document.getElementById('settings-btn').addEventListener('click', openSettings);
  document.getElementById('reconnect-btn').addEventListener('click', reconnectCompanion);
  
  // Function to check connection with companion app
  function checkCompanionConnection() {
    const statusElement = document.getElementById('connection-status');
    statusElement.textContent = 'Checking connection...';
    statusElement.className = 'status';
    
    chrome.runtime.sendMessage({ action: 'checkCompanionConnection' }, response => {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError);
        statusElement.textContent = 'Error checking connection';
        statusElement.className = 'status disconnected';
        return;
      }
      
      if (response && response.connected) {
        statusElement.textContent = 'Connected to companion app ✓';
        statusElement.className = 'status connected';
      } else {
        statusElement.textContent = 'Disconnected from companion app ✗';
        statusElement.className = 'status disconnected';
      }
    });
  }
  
  // Function to analyze the current form
  function analyzeCurrentForm() {
    analyzeFormBtn.disabled = true;
    analyzeFormBtn.textContent = 'Analyzing...';
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {action: "analyzeForm"}, function(response) {
        if (response && response.fields) {
          displayFormFields(response.fields);
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
  
  // Function to load data file
  function loadDataFile() {
    chrome.runtime.sendMessage({ action: 'openFilePicker' }, response => {
      if (response && response.success) {
        showToast('Data file loaded: ' + response.filename);
      } else {
        showToast('Failed to load data file', 'error');
      }
    });
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
   * Attempt to reconnect to the companion app
   */
  function reconnectCompanion() {
    const statusElement = document.getElementById('connection-status');
    statusElement.textContent = 'Reconnecting...';
    statusElement.className = 'status';
    
    // Send a message to the background script to reinitialize the connection
    chrome.runtime.sendMessage({ action: 'sendToCompanion', data: { type: 'ping' } }, response => {
      setTimeout(checkCompanionConnection, 1000); // Check again after a short delay
    });
  }
  
  /**
   * Fill the current form with data from the companion app
   */
  function fillCurrentForm() {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      const tab = tabs[0];
      if (!tab) return;
      
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: scanFormFields
      }, results => {
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError);
          return;
        }
        
        if (!results || !results[0]) return;
        
        const formFields = results[0].result;
        if (!formFields || formFields.length === 0) {
          alert('No form fields detected on this page');
          return;
        }
        
        // Send form fields to companion app for processing
        chrome.runtime.sendMessage({
          action: 'sendToCompanion',
          data: {
            type: 'fillForm',
            formFields,
            url: tab.url
          }
        }, response => {
          if (!response || !response.success) {
            alert('Error retrieving form data. Please check the companion app connection.');
            return;
          }
          
          // Fill the form with the returned data
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: fillFormWithData,
            args: [response.data.fieldValues]
          });
        });
      });
    });
  }
  
  /**
   * Scan the page for form fields
   * This function will be injected into the page
   */
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
  
  /**
   * Fill the form with the provided data
   * This function will be injected into the page
   * @param {object} fieldValues - The field values to fill
   */
  function fillFormWithData(fieldValues) {
    if (!fieldValues || !fieldValues.fields) return;
    
    const fields = fieldValues.fields;
    
    for (const key in fields) {
      // Find elements by ID, name, or placeholder
      const elements = [
        ...document.querySelectorAll(`input#${key}, input[name="${key}"], input[placeholder="${key}"]`),
        ...document.querySelectorAll(`select#${key}, select[name="${key}"]`),
        ...document.querySelectorAll(`textarea#${key}, textarea[name="${key}"], textarea[placeholder="${key}"]`)
      ];
      
      elements.forEach(element => {
        if (element.type === 'checkbox' || element.type === 'radio') {
          element.checked = !!fields[key];
        } else {
          element.value = fields[key];
          // Trigger change event to notify the page
          element.dispatchEvent(new Event('change', { bubbles: true }));
          element.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
    }
  }
  
  /**
   * Open the extension settings page
   */
  function openSettings() {
    chrome.runtime.openOptionsPage();
  }
});
