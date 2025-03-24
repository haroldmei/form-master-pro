document.addEventListener('DOMContentLoaded', function() {

  // Load existing profile
  loadUserProfile();
  
  // Add event listeners - only keep import
  document.getElementById('import-profile').addEventListener('click', importProfile);
  
  /**
   * Load user profile from storage
   */
  function loadUserProfile() {
    chrome.storage.sync.get(['userProfile'], function(result) {
      const userProfile = result.userProfile || {};
      
      // Get the container where we'll display the profile data
      const profileContainer = document.getElementById('profile-container');
      
      // Clear existing content
      profileContainer.innerHTML = '';
      
      if (Object.keys(userProfile).length === 0) {
        profileContainer.innerHTML = '<p>No profile data loaded. Please import a profile file.</p>';
        return;
      }
      
      // Generate dynamic HTML for the profile
      const profileHtml = generateProfileHtml(userProfile);
      profileContainer.innerHTML = profileHtml;
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
          
          // Get the container where we'll display the profile data
          const profileContainer = document.getElementById('profile-container');
          
          // Clear existing content
          profileContainer.innerHTML = '';
          
          // Generate dynamic HTML for the profile
          const profileHtml = generateProfileHtml(userProfile);
          profileContainer.innerHTML = profileHtml;
          
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
   * Generate HTML for displaying profile data
   */
  function generateProfileHtml(data, parentKey = '') {
    let html = '<div class="profile-section">';
    
    for (const [key, value] of Object.entries(data)) {
      const displayKey = key.charAt(0).toUpperCase() + key.slice(1);
      const fullKey = parentKey ? `${parentKey}.${key}` : key;
      
      if (typeof value === 'object' && value !== null) {
        // For nested objects, create a section with a header
        html += `<div class="profile-subsection">
                  <h3>${displayKey}</h3>
                  ${generateProfileHtml(value, fullKey)}
                </div>`;
      } else {
        // For simple values, create a read-only field
        html += `<div class="profile-field">
                  <label for="${fullKey}">${displayKey}:</label>
                  <input type="text" id="${fullKey}" value="${value || ''}" readonly>
                </div>`;
      }
    }
    
    html += '</div>';
    return html;
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
