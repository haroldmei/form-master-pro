document.addEventListener('DOMContentLoaded', function() {
  // No longer need to check companion connection
  displayExtensionMode();
  
  // Load existing settings
  loadSettings();
  
  // Add event listeners
  document.getElementById('add-mapping').addEventListener('click', addNewMapping);
  document.getElementById('save-settings').addEventListener('click', saveSettings);
});

function displayExtensionMode() {
  const statusElement = document.getElementById('companion-status');
  statusElement.textContent = 'Standalone Mode - No companion app required';
  statusElement.style.color = 'green';
}

function loadSettings() {
  chrome.storage.sync.get(['fieldMappings'], function(result) {
    const mappings = result.fieldMappings || [];
    
    const mappingsList = document.getElementById('mappings-list');
    mappingsList.innerHTML = '';
    
    if (mappings.length === 0) {
      // Add a default empty mapping if none exist
      addMappingToUI({ fieldPattern: '', dataSource: 'profile', dataField: '' });
    } else {
      // Add all existing mappings
      mappings.forEach(mapping => {
        addMappingToUI(mapping);
      });
    }
  });
}

function addNewMapping() {
  addMappingToUI({ fieldPattern: '', dataSource: 'profile', dataField: '' });
}

function addMappingToUI(mapping) {
  const mappingsList = document.getElementById('mappings-list');
  
  const mappingDiv = document.createElement('div');
  mappingDiv.className = 'form-group mapping-item';
  mappingDiv.innerHTML = `
    <div style="display: flex; gap: 10px; margin-bottom: 15px;">
      <div style="flex: 3;">
        <label>Field Pattern/ID:</label>
        <input type="text" class="field-pattern" value="${mapping.fieldPattern || ''}" placeholder="e.g., email, first-name, *address*">
      </div>
      <div style="flex: 2;">
        <label>Data Source:</label>
        <select class="data-source">
          <option value="profile" ${mapping.dataSource === 'profile' ? 'selected' : ''}>User Profile</option>
          <option value="custom" ${mapping.dataSource === 'custom' ? 'selected' : ''}>Custom Field</option>
        </select>
      </div>
      <div style="flex: 3;">
        <label>Data Field:</label>
        <input type="text" class="data-field" value="${mapping.dataField || ''}" placeholder="e.g., email, firstName">
      </div>
      <div style="align-self: flex-end; margin-bottom: 8px;">
        <button class="remove-mapping" style="background-color: #dc3545;">✕</button>
      </div>
    </div>
  `;
  
  mappingsList.appendChild(mappingDiv);
  
  // Add event listener for the remove button
  mappingDiv.querySelector('.remove-mapping').addEventListener('click', function() {
    mappingDiv.remove();
  });
}

function saveSettings() {
  const mappingItems = document.querySelectorAll('.mapping-item');
  const mappings = [];
  
  mappingItems.forEach(item => {
    const fieldPattern = item.querySelector('.field-pattern').value.trim();
    const dataSource = item.querySelector('.data-source').value;
    const dataField = item.querySelector('.data-field').value.trim();
    
    if (fieldPattern && dataField) {
      mappings.push({
        fieldPattern,
        dataSource,
        dataField
      });
    }
  });
  
  chrome.storage.sync.set({ fieldMappings: mappings }, function() {
    showStatusMessage('Settings saved successfully!', 'success');
    
    // Directly apply settings without needing to notify external app
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'settingsUpdated' });
      }
    });
  });
}

function showStatusMessage(message, type) {
  const statusElement = document.getElementById('status-message');
  statusElement.textContent = message;
  statusElement.className = `status-message ${type}`;
  statusElement.style.display = 'block';
  
  setTimeout(() => {
    statusElement.style.display = 'none';
  }, 3000);
}
