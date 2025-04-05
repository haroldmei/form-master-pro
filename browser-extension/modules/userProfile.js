/**
 * User profile management module
 * Using local storage for persistence
 */

const userProfileManager = (() => {
  const USER_PROFILE_KEY = 'userProfileData';
  // Cache for the current profile to avoid excessive storage reads
  let profileCache = null;
  
  /**
   * Initialize with existing data (optional)
   */
  function initWithData(existingData) {
    if (existingData) {
      profileCache = existingData;
      return new Promise((resolve) => {
        chrome.storage.local.set({ [USER_PROFILE_KEY]: existingData }, () => {
          resolve(existingData);
        });
      });
    }
    return loadUserProfile();
  }
  
  /**
   * Load user profile from local storage
   */
  async function loadUserProfile() {
    // Return cached profile if available
    if (profileCache) return profileCache;
    
    return new Promise((resolve) => {
      chrome.storage.local.get([USER_PROFILE_KEY], (result) => {
        profileCache = result[USER_PROFILE_KEY] || {};
        resolve(profileCache);
      });
    });
  }
  
  /**
   * Save changes to user profile
   */
  function saveUserProfile(profileData) {
    // Update cache
    profileCache = profileData;
    
    return new Promise((resolve) => {
      chrome.storage.local.set({ [USER_PROFILE_KEY]: profileData }, () => {
        resolve(profileData);
      });
    });
  }
  
  /**
   * Get a value from the user profile - SYNCHRONOUS version that returns cached value
   * Use this version in code that can't easily be made async
   */
  function getUserProfileFieldSync(field) {
    if (!profileCache) {
      console.warn("Accessing user profile before it's loaded - returning empty value");
      return '';
    }
    
    const parts = field.split('.');
    let value = profileCache;
    
    for (const part of parts) {
      if (!value || typeof value !== 'object') return '';
      value = value[part];
    }
    
    return value || '';
  }
  
  /**
   * Get a value from the user profile - ASYNC version
   */
  async function getUserProfileField(field) {
    const profile = await loadUserProfile();
    const parts = field.split('.');
    let value = profile;
    
    for (const part of parts) {
      if (!value || typeof value !== 'object') return '';
      value = value[part];
    }
    
    return value || '';
  }
  
  /**
   * Get the entire user profile - SYNCHRONOUS version
   */
  function getUserProfileSync() {
    return profileCache || {};
  }
  
  /**
   * Get the entire user profile - ASYNC version
   */
  function getUserProfile() {
    return loadUserProfile();
  }
  
  /**
   * Update a specific field in the user profile
   */
  async function updateUserProfileField(fieldPath, value) {
    const profile = await loadUserProfile();
    const parts = fieldPath.split('.');
    let current = profile;
    
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
    
    // Save to local storage
    return saveUserProfile(profile);
  }
  
  // Initialize the cache from storage on module load
  chrome.storage.local.get([USER_PROFILE_KEY], (result) => {
    profileCache = result[USER_PROFILE_KEY] || {};
    console.log("User profile cache initialized from storage");
  });
  
  // Return public API
  return {
    initWithData,
    loadUserProfile,
    saveUserProfile,
    getUserProfileField,
    getUserProfileFieldSync, // New synchronous version
    getUserProfile,
    getUserProfileSync, // New synchronous version
    updateUserProfileField
  };
})();

// Attach to the global scope
self.userProfileManager = userProfileManager;