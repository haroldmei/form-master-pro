/**
 * User profile management module
 * Using global memory only - no storage operations
 */

// Define global user profile
self.globalUserProfile = self.globalUserProfile || {};

const userProfileManager = (() => {
  /**
   * Initialize with existing data (optional)
   */
  function initWithData(existingData) {
    if (existingData) {
      self.globalUserProfile = existingData;
    }
    return self.globalUserProfile;
  }
  
  /**
   * Load user profile from global memory
   */
  function loadUserProfile() {
    // Just return the global profile - no need to fetch from storage
    return Promise.resolve(self.globalUserProfile);
  }
  
  /**
   * Save changes to user profile (updates global memory only)
   */
  function saveUserProfile() {
    // No need to do anything - changes to the object are already in memory
    return Promise.resolve(self.globalUserProfile);
  }
  
  /**
   * Get a value from the user profile
   */
  function getUserProfileField(field) {
    const parts = field.split('.');
    let value = self.globalUserProfile;
    
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
    return self.globalUserProfile;
  }
  
  /**
   * Update a specific field in the user profile
   */
  function updateUserProfileField(fieldPath, value) {
    const parts = fieldPath.split('.');
    let current = self.globalUserProfile;
    
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
    
    // No need to save to storage
    return self.globalUserProfile;
  }
  
  // Return public API
  return {
    initWithData,
    loadUserProfile,
    saveUserProfile,
    getUserProfileField,
    getUserProfile,
    updateUserProfileField
  };
})();

// Attach to the global scope
self.userProfileManager = userProfileManager;