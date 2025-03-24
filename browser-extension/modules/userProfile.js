/**
 * User profile management module
 */
const userProfileManager = (() => {
  // User profile data - will be loaded from storage
  let userProfileData = {};
  
  /**
   * Load user profile from storage
   */
  function loadUserProfile() {
    chrome.storage.sync.get(['userProfile'], function(result) {
      userProfileData = result.userProfile || {};
      console.log("User profile loaded:", userProfileData);
    });
  }
  
  /**
   * Save changes to user profile
   */
  function saveUserProfile() {
    chrome.storage.sync.set({ userProfile: userProfileData }, function() {
      console.log("User profile saved");
    });
  }
  
  /**
   * Get a value from the user profile
   */
  function getUserProfileField(field) {
    const parts = field.split('.');
    let value = userProfileData;
    
    for (const part of parts) {
      if (!value || typeof value !== 'object') return '';
      value = value[part];
    }
    
    return value || '';
  }
  
  /**
   * Get the entire user profile
   */
  function getUserProfile() {
    return userProfileData;
  }
  
  /**
   * Update a specific field in the user profile
   */
  function updateUserProfileField(fieldPath, value) {
    const parts = fieldPath.split('.');
    let current = userProfileData;
    
    // Navigate to the nested location, creating objects as needed
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part] || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part];
    }
    
    // Set the value at the final location
    current[parts[parts.length - 1]] = value;
    
    // Save the updated profile
    saveUserProfile();
    
    return userProfileData;
  }
  
  // Return public API
  return {
    loadUserProfile,
    saveUserProfile,
    getUserProfileField,
    getUserProfile,
    updateUserProfileField
  };
})();
