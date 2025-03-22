document.addEventListener('DOMContentLoaded', function() {
  // Profile fields mapping
  const profileFields = {
    firstName: 'personal.firstName',
    lastName: 'personal.lastName',
    email: 'personal.email',
    phone: 'personal.phone',
    streetAddress: 'address.street',
    city: 'address.city',
    state: 'address.state',
    zipCode: 'address.zipCode',
    country: 'address.country',
    company: 'work.company',
    occupation: 'work.occupation',
    website: 'work.website'
  };
  
  // Load existing profile
  loadUserProfile();
  
  // Add event listeners
  document.getElementById('save-profile').addEventListener('click', saveUserProfile);
  document.getElementById('export-profile').addEventListener('click', exportProfile);
  document.getElementById('import-profile').addEventListener('click', importProfile);
  
  /**
   * Load user profile from storage
   */
  function loadUserProfile() {
    chrome.storage.sync.get(['userProfile'], function(result) {
      const userProfile = result.userProfile || {};

      // Fill form fields with profile data
      for (const [field, path] of Object.entries(profileFields)) {
        const value = getNestedValue(userProfile, path);
        console.log(field, path, value);
        if (value) {
          document.getElementById(field).value = value;
        }
      }
    });
  }
  
  /**
   * Save user profile to storage
   */
  function saveUserProfile() {
    const userProfile = {};
    
    // Get values from form fields
    for (const [field, path] of Object.entries(profileFields)) {
      const value = document.getElementById(field).value;
      setNestedValue(userProfile, path, value);
    }
    
    // Save to Chrome storage
    chrome.storage.sync.set({ userProfile }, function() {
      showStatusMessage('Profile saved successfully!', 'success');
      
      // Notify background script that profile has been updated
      chrome.runtime.sendMessage({ action: 'settingsUpdated' });
    });
  }
  
  /**
   * Export profile as JSON file
   */
  function exportProfile() {
    chrome.storage.sync.get(['userProfile'], function(result) {
      const userProfile = result.userProfile || {};
      
      // Create a JSON blob
      const jsonString = JSON.stringify(userProfile, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      // Create a download link and click it
      const link = document.createElement('a');
      link.href = url;
      link.download = 'formmaster_profile.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      showStatusMessage('Profile exported successfully!', 'success');
    });
  }
  
  /**
   * Import profile from JSON file
   */
  function importProfile() {
    // Create a file input element
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    // Handle file selection
    input.onchange = e => {
      const file = e.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = event => {
        try {
          const userProfile = JSON.parse(event.target.result);
          
          // Fill form fields directly with the imported data
          for (const [field, path] of Object.entries(profileFields)) {
            const value = getNestedValue(userProfile, path);
            if (value) {
              document.getElementById(field).value = value;
            }
          }
          
          // Save to Chrome storage
          chrome.storage.sync.set({ userProfile }, function() {
            showStatusMessage('Profile imported successfully!', 'success');
            
            // Notify background script that profile has been updated
            chrome.runtime.sendMessage({ action: 'settingsUpdated' });
          });
        } catch (error) {
          showStatusMessage('Error importing profile: ' + error.message, 'error');
        }
      };
      
      reader.readAsText(file);
    };
    
    // Trigger the file dialog
    input.click();
  }
  
  /**
   * Get a nested value from an object using a path string (e.g., 'address.city')
   */
  function getNestedValue(obj, path) {
    const parts = path.split('.');
    let value = obj;
    
    for (const part of parts) {
      if (!value || typeof value !== 'object') return '';
      value = value[part];
    }
    
    return value || '';
  }
  
  /**
   * Set a nested value in an object using a path string
   */
  function setNestedValue(obj, path, value) {
    const parts = path.split('.');
    let current = obj;
    
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part] || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part];
    }
    
    current[parts[parts.length - 1]] = value;
  }
  
  /**
   * Show a status message
   */
  function showStatusMessage(message, type) {
    const statusElement = document.getElementById('status-message');
    statusElement.textContent = message;
    statusElement.className = `status-message ${type}`;
    statusElement.style.display = 'block';
    
    setTimeout(() => {
      statusElement.style.display = 'none';
    }, 5000);
  }
});
