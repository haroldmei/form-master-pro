/**
 * Form processing module
 */
const formProcessor = (() => {
  // Cache for ALL suggestions (both AI and rule-based) to minimize API calls
  const allSuggestionsCache = {};
  
  function generateProfileHash(userProfile) {
    if (!userProfile.filename) return 'default';
    return 'profile_' + userProfile.filename;
  }
  
  // Helper function to get default field values directly
  async function getDefaultFieldValues(url) {
    return new Promise((resolve) => {
      chrome.storage.local.get(['defaultFieldValues'], function(result) {
        const defaultFieldValues = result.defaultFieldValues || {};
        resolve(defaultFieldValues[url] || {});
      });
    });
  }
  
  
  async function processForm(url, userProfile) {
    try {
      console.log("Processing form for URL:", url);
      
      // Extract the root URL (domain + path up to first directory)
      const urlObj = new URL(url);
      const rootUrl = urlObj.origin;
      
      console.log("User profile:", userProfile);
      if (!userProfile.filename) {
        throw new Error('Please load data first.');
      }

      const profileHash = generateProfileHash(userProfile);
      const cacheKey = `${rootUrl}_${profileHash}`;
      
      // Get suggestions from storage
      const result = await chrome.storage.local.get(['allSuggestions']);
      
      // Initialize or load ALL suggestions cache
      const storedSuggestions = result.allSuggestions || {};
      if (!allSuggestionsCache[cacheKey] && storedSuggestions[cacheKey]) {
        allSuggestionsCache[cacheKey] = storedSuggestions[cacheKey];
      } else if (!allSuggestionsCache[cacheKey]) {
        allSuggestionsCache[cacheKey] = {};
      }
      
      // Get current form fields from the page
      const formFields = await getCurrentFormFields();
      console.log("Current form fields:", formFields);
      
      // Create fieldKeywords for current form
      const currentFormFields = {};
      formFields.forEach(field => {
        const keyName = field.name || field.id || '';
        if (keyName.trim() === '') return;
        
        if (field.options && Array.isArray(field.options) && field.options.length > 0) {
          currentFormFields[keyName] = field.options;
        } else {
          currentFormFields[keyName] = [];
        }
      });
      
      // Check if we need to make an API call
      let needApiCall = false;
      let allSuggestions = { ...allSuggestionsCache[cacheKey] };
      
      console.log("Cached suggestions:", allSuggestions);
      
      // Check if all current form fields have suggestions in our cache
      for (const fieldKey of Object.keys(currentFormFields)) {
        if (!allSuggestions || !(fieldKey in allSuggestions)) {
          needApiCall = true;
          console.log("Need API call for field:", fieldKey, currentFormFields[fieldKey]);
        }
      }
      
      // Step 1: First check with AI for missing fields if needed
      if (needApiCall && Object.keys(userProfile).length > 0) {
        console.log("API call needed for new fields");
        
        // Gather all known fields for this site
        const allSiteFields = {...currentFormFields};
        
        // Make API call to get suggestions for all fields
        const suggestions = await getSuggestionsFromAI(allSiteFields, userProfile);
        
        // Update suggestions cache
        allSuggestionsCache[cacheKey] = {
          ...allSuggestionsCache[cacheKey],
          ...suggestions
        };
        
        // Save to storage
        await saveSuggestionsToStorage();
      }
      
      return {
        success: true,
        suggestions: allSuggestionsCache[cacheKey],
        fields: currentFormFields
      };
    } catch (error) {
      console.error("Error processing form:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  // Helper function to get current form fields from the page
  async function getCurrentFormFields() {
    return new Promise((resolve) => {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs && tabs[0]) {
          chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            function: () => {
              const fields = [];
              document.querySelectorAll('input, select, textarea').forEach(element => {
                if (element.offsetParent !== null) { // Only visible elements
                  fields.push({
                    id: element.id,
                    name: element.name,
                    type: element.type,
                    options: element.options ? Array.from(element.options).map(opt => opt.value) : []
                  });
                }
              });
              return fields;
            }
          }, (results) => {
            resolve(results && results[0] ? results[0].result : []);
          });
        } else {
          resolve([]);
        }
      });
    });
  }
  
  /**
   * Get value from general mappings (non-site-specific)
   */
  function getValueFromGeneralMappings(field, fieldId, fieldName, fieldLabel, fieldType) {
    // Check if we have a user profile value that matches
    // Common field patterns and their corresponding user profile paths
    const commonMappings = [
      // Personal information
      { pattern: /first.?name|fname|given.?name/i, path: "personal.firstName", source: "profile" },
      { pattern: /last.?name|lname|surname|family.?name/i, path: "personal.lastName", source: "profile" },
      { pattern: /full.?name|name/i, path: "personal.fullName", source: "profile" },
      { pattern: /email|e.?mail|mail/i, path: "personal.email", source: "profile" },
      { pattern: /phone|mobile|cell/i, path: "personal.phone", source: "profile" },
      { pattern: /birth|dob|birthday/i, path: "personal.dateOfBirth", source: "profile" },
      { pattern: /gender|sex/i, path: "personal.gender", source: "profile" },
      
      // Address information
      { pattern: /address|street/i, path: "address.street", source: "profile" },
      { pattern: /city|town|locality/i, path: "address.city", source: "profile" },
      { pattern: /state|province|region/i, path: "address.state", source: "profile" },
      { pattern: /zip|postal|post.?code/i, path: "address.postalCode", source: "profile" },
      { pattern: /country/i, path: "address.country", source: "profile" },
      
      // Payment information (handle with care)
      { pattern: /cc.?name|card.?name|name.?on.?card/i, path: "payment.cardholderName", source: "profile" },
      
      // Credential information (don't auto-fill by default)
      { pattern: /username|user|login/i, path: "credentials.username", source: "profile" }
    ];
    
    // Field identifiers to check against patterns
    const identifiers = [
      fieldId, 
      fieldName,
      fieldLabel,
      field.placeholder
    ].filter(Boolean).map(id => id.toLowerCase());
    
    // Check each identifier against our common mappings
    for (const identifier of identifiers) {
      for (const mapping of commonMappings) {
        if (mapping.pattern.test(identifier)) {
          // Use the synchronous version to avoid Promise issues
          const value = userProfileManager.getUserProfileFieldSync(mapping.path);
          if (value) {
            return { 
              value: utils.formatValueForFieldType(value, fieldType, field),
              source: mapping.source
            };
          }
        }
      }
    }
    
    // No matching value found
    return { value: null, source: null };
  }
  
  /**
   * Clear all suggestions data from cache and storage
   */
  async function clearSuggestions() {
    try {
      // Count the number of profile caches before clearing
      const profileCount = Object.keys(allSuggestionsCache).length;
      
      // Clear in-memory cache
      Object.keys(allSuggestionsCache).forEach(key => {
        delete allSuggestionsCache[key];
      });
      
      // Clear storage
      await new Promise((resolve, reject) => {
        chrome.storage.local.remove('allSuggestions', () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });
      
      console.log(`All form suggestions data cleared (${profileCount} profile caches)`);
      return { success: true, profileCount: profileCount };
    } catch (error) {
      console.error("Error clearing suggestions:", error);
      return { success: false, error: error.message || "Unknown error clearing data" };
    }
  }
  
  // Initialize by loading ALL suggestions from storage
  chrome.storage.local.get(['allSuggestions'], function(result) {
    if (result.allSuggestions) {
      Object.assign(allSuggestionsCache, result.allSuggestions);
      console.log("Loaded all suggestions from storage");
    }
  });
  
  // Return public API
  return {
    processForm,
    clearSuggestions
  };
})();

self.formProcessor = formProcessor;