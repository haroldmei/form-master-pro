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
  
  // Function to check connection with companion app
  function checkCompanionConnection() {
    chrome.runtime.sendMessage({ action: 'checkConnection' }, response => {
      if (response && response.connected) {
        statusIndicator.classList.add('connected');
        statusText.textContent = 'Connected to FormMaster';
      } else {
        statusIndicator.classList.add('disconnected');
        statusText.textContent = 'Companion App Not Running';
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
});
