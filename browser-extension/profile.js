document.addEventListener('DOMContentLoaded', function() {

  // Load existing profile
  loadUserProfile();
  
  // Add event listeners - only keep import
  document.getElementById('import-profile').addEventListener('click', importProfile);
  
  /**
   * Load user profile from storage with error handling
   */
  function loadUserProfile() {
    chrome.storage.local.get(['userProfile'], function(result) {
      if (chrome.runtime.lastError) {
        console.error('Error loading profile:', chrome.runtime.lastError);
        showStatusMessage('Error loading profile: ' + chrome.runtime.lastError.message, 'error');
        return;
      }
      
      console.log('Loaded profile from storage:', result.userProfile);
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
   * Import profile from JSON or DOCX file
   */
  function importProfile() {
    // Create a file input element
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.docx'; // Accept both JSON and DOCX files
    
    // Handle file selection
    input.onchange = async e => {
      const file = e.target.files[0];
      if (!file) return;
      
      const fileExtension = file.name.split('.').pop().toLowerCase();
      
      if (fileExtension === 'json') {
        // Process JSON file
        processJsonFile(file);
      } else if (fileExtension === 'docx') {
        // Process DOCX file
        try {
          await processDocxFile(file);
        } catch (error) {
          showStatusMessage('Error processing DOCX file: ' + error.message, 'error');
          console.error('DOCX processing error:', error);
        }
      } else {
        showStatusMessage('Unsupported file type. Please use JSON or DOCX files.', 'error');
      }
    };
    
    // Trigger the file dialog
    input.click();
  }
  
  /**
   * Process JSON file
   */
  function processJsonFile(file) {
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
        
        // Check if the profile data is too large for Chrome storage
        // Local storage has a higher limit (5MB per origin) than sync storage (100KB)
        const jsonSize = new Blob([JSON.stringify(userProfile)]).size;
        if (jsonSize > 5000000) {
          console.warn(`Profile size ${jsonSize} bytes exceeds Chrome local storage recommended limits`);
          showStatusMessage('Profile very large. Some browsers may have issues storing it.', 'warning');
        }
        
        // Save to Chrome local storage with error handling
        chrome.storage.local.set({ userProfile }, function() {
          if (chrome.runtime.lastError) {
            console.error('Error saving profile:', chrome.runtime.lastError);
            showStatusMessage('Error saving profile: ' + chrome.runtime.lastError.message, 'error');
            return;
          }
          
          // Verify the profile was saved by reading it back
          chrome.storage.local.get(['userProfile'], function(result) {
            if (chrome.runtime.lastError) {
              console.error('Error verifying profile save:', chrome.runtime.lastError);
              return;
            }
            
            console.log('Profile saved successfully:', result.userProfile);
            showStatusMessage('Profile imported successfully!', 'success');
            
            // Notify background script that profile has been updated
            chrome.runtime.sendMessage({ action: 'settingsUpdated' });
          });
        });
      } catch (error) {
        showStatusMessage('Error importing profile: ' + error.message, 'error');
        console.error('JSON parsing error:', error);
      }
    };
    
    reader.onerror = () => {
      showStatusMessage('Error reading file', 'error');
      console.error('FileReader error:', reader.error);
    };
    
    reader.readAsText(file);
  }
  
  /**
   * Process DOCX file
   */
  async function processDocxFile(file) {
    try {
      // Load the docx-extractor.js module
      try {
        const extractorModule = await import('./files/docx-extractor.js');
        const { extractDocxContent } = extractorModule;
        
        // Extract content from DOCX
        const docxContent = await extractDocxContent(file, file.name);
        console.log('Extracted DOCX content:', docxContent);
        
        // Create a user profile structure from the DOCX content
        const userProfile = {
          source: 'docx',
          filename: file.name,
          extractedContent: docxContent,
          // Create a simple representation for display
          docxData: {
            paragraphs: docxContent.paragraphs.map(p => p.text),
            tables: docxContent.tables
          }
        };
        
        // Check if the profile data is too large for Chrome storage
        const jsonSize = new Blob([JSON.stringify(userProfile)]).size;
        if (jsonSize > 5000000) { // Local storage recommended limit is 5MB
          console.warn(`Profile size ${jsonSize} bytes exceeds Chrome local storage recommended limits`);
          
          // Create a simplified version of the profile for storage
          const simplifiedProfile = {
            source: 'docx',
            filename: file.name,
            docxData: {
              paragraphs: docxContent.paragraphs.map(p => p.text).slice(0, 50), // Keep more paragraphs than before
              tables: docxContent.tables.slice(0, 5) // Keep more tables than before
            }
          };
          
          showStatusMessage('Profile too large. Saving simplified version.', 'warning');
          
          // Save the simplified profile
          saveProfile(simplifiedProfile);
        } else {
          // Save the full profile
          saveProfile(userProfile);
        }
        
        // Get the container where we'll display the profile data
        const profileContainer = document.getElementById('profile-container');
        
        // Clear existing content
        profileContainer.innerHTML = '';
        
        // Generate dynamic HTML for the profile
        const profileHtml = generateProfileHtml(userProfile);
        profileContainer.innerHTML = profileHtml;
      } catch (moduleError) {
        console.error("Error loading DOCX extractor module:", moduleError);
        throw new Error(`Could not load DOCX extractor: ${moduleError.message}`);
      }
    } catch (error) {
      throw new Error(`Error processing DOCX: ${error.message}`);
    }
  }
  
  /**
   * Save profile to Chrome storage with verification
   */
  function saveProfile(userProfile) {
    chrome.storage.local.set({ userProfile }, function() {
      if (chrome.runtime.lastError) {
        console.error('Error saving profile:', chrome.runtime.lastError);
        showStatusMessage('Error saving profile: ' + chrome.runtime.lastError.message, 'error');
        return;
      }
      
      // Verify the profile was saved
      chrome.storage.local.get(['userProfile'], function(result) {
        if (chrome.runtime.lastError) {
          console.error('Error verifying profile save:', chrome.runtime.lastError);
          return;
        }
        
        if (!result.userProfile) {
          console.error('Profile verification failed: userProfile not found in storage');
          showStatusMessage('Profile may not have saved correctly', 'warning');
          return;
        }
        
        console.log('Profile saved successfully:', result.userProfile);
        showStatusMessage('Profile imported successfully!', 'success');
        
        // Notify background script that profile has been updated
        chrome.runtime.sendMessage({ action: 'settingsUpdated' });
      });
    });
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
