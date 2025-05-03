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
  
  
  async function processForm(formFields, url, userProfile) {
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
      
      // Get existing field mappings and ALL suggestions from storage - now using fieldMappingsV2
      const result = await chrome.storage.local.get(['fieldMappingsV2', 'allSuggestions']);
      // Get the field mappings from fieldMappingsV2 for this URL
      const siteFieldMappingsV2 = result.fieldMappingsV2 || {};
      
      // Initialize site mappings if not present
      if (!siteFieldMappingsV2[rootUrl]) {
        siteFieldMappingsV2[rootUrl] = [];
      }
      
      // Initialize or load ALL suggestions cache
      const storedSuggestions = result.allSuggestions || {};
      if (!allSuggestionsCache[cacheKey] && storedSuggestions[cacheKey]) {
        allSuggestionsCache[cacheKey] = storedSuggestions[cacheKey];
      } else if (!allSuggestionsCache[cacheKey]) {
        allSuggestionsCache[cacheKey] = {};
      }
      
      // Create fieldKeywords for current form
      const currentFormFields = {};
      formFields.forEach(field => {
        const keyName = field.label || field.name || field.id || '';
        if (keyName.trim() === '') return;
        
        if (field.options && Array.isArray(field.options) && field.options.length > 0) {
          currentFormFields[keyName] = field.options.map(option => 
            option.text || option.label || option.value || ''
          ).filter(Boolean);
        } else {
          currentFormFields[keyName] = [];
        }
      });
      
      // Check if we need to make an API call
      let needApiCall = false;
      let allSuggestions = { ...allSuggestionsCache[cacheKey] };
      
      console.log("Current form fields:", currentFormFields);
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
        
        // Gather all known fields for this site (current form + historical mappings)
        const allSiteFields = {...currentFormFields};
        
        // Add fields from historical site mappings - adapted for fieldMappingsV2 structure
        if (Array.isArray(siteFieldMappingsV2[rootUrl])) {
          siteFieldMappingsV2[rootUrl].forEach(mapping => {
            // Get field identifiers
            const labels = mapping.labels && Array.isArray(mapping.labels) 
              ? mapping.labels.map(l => l.text).filter(Boolean) : [];
            
            const keyName = labels[0] || mapping.name || mapping.id || '';
            if (keyName.trim() !== '' && !allSiteFields[keyName]) {
              // Handle different field types appropriately
              if (mapping.type === 'select' || mapping.type === 'radio') {
                // Get options from the mapping
                if (mapping.options && Array.isArray(mapping.options)) {
                  allSiteFields[keyName] = mapping.options.map(option => 
                    option.text || option.value || ''
                  ).filter(Boolean);
                } else {
                  allSiteFields[keyName] = [];
                }
              } else {
                allSiteFields[keyName] = [];
              }
            }
          });
        }
        
        console.log("Making API call with ALL site fields:", Object.keys(allSiteFields));
        
        try {
          // Make ONE comprehensive API call for all fields
          const aiSuggestions = await aiService.getAiSuggestions(allSiteFields, userProfile, url);
          console.log("Received AI suggestions: ", Object.keys(aiSuggestions).length);
          // Fill in any missing fields from allSiteFields with empty string
          Object.keys(allSiteFields).forEach(key => {
            if (!aiSuggestions.hasOwnProperty(key)) {
              aiSuggestions[key] = '';
            }
          });
          
          // Merge AI suggestions into our combined suggestions
          allSuggestions = {
            ...allSuggestions,
            ...aiSuggestions
          };
        } catch (apiError) {
          console.error("Error getting AI suggestions:", apiError);
          // Continue with processing - we'll use rule-based suggestions as fallback
          throw apiError;
        }
      } else {
        console.log("Using cached suggestions - no API call needed");
      }
      
      // Load any saved default field values directly from storage
      const savedDefaultValues = await getDefaultFieldValues(rootUrl);
      console.log(`Loaded ${Object.keys(savedDefaultValues).length} saved default values for ${rootUrl}`);
      
      // Step 2: Apply rule-based matches for any remaining fields without answers
      const missingFields = []; // Track fields that need default values
      
      formFields.forEach(field => {
        const fieldId = field.id || '';
        const fieldName = field.name || '';
        const fieldLabel = field.label || '';
        
        // Skip if we already have a suggestion for this field
        const keyName = fieldLabel || fieldName || fieldId;
        
        if (!keyName || allSuggestions[keyName]) return;
        
        // Check if we have a saved default value for this field
        if (savedDefaultValues && keyName in savedDefaultValues) {
          allSuggestions[keyName] = savedDefaultValues[keyName];
          console.log("Using saved default value for field:", keyName, savedDefaultValues[keyName]);
          return;
        }
        
        // Apply rule-based mapping for this field
        const fieldType = field.type || 'text';
        const result = getValueFromGeneralMappings(field, fieldId, fieldName, fieldLabel, fieldType);
        
        if (result.value) {
          // Add rule-based suggestion to our collection
          allSuggestions[keyName] = result.value;
        } else {
          // If no rule-based value, add to missing fields list
          missingFields.push({
            id: fieldId,
            name: fieldName,
            label: fieldLabel || keyName,
            type: fieldType,
            options: field.options,
            // Try to determine if field is mandatory based on various signals
            mandatory: field.required === true || 
                      fieldLabel?.includes('*') ||
                      fieldId?.toLowerCase().includes('required') ||
                      fieldName?.toLowerCase().includes('required')
          });

          // Still set a temporary default value (will be overridden if user provides one)
          if (field.options && Array.isArray(field.options) && field.options.length > 0) {
            allSuggestions[keyName] = field.options[0].value || field.options[0].text || field.options[0].label;
          } else if (fieldType === 'date') {
            const today = new Date();
            const yyyy = today.getFullYear();
            const mm = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-based
            const dd = String(today.getDate()).padStart(2, '0');
            allSuggestions[keyName] = `${yyyy}-${mm}-${dd}`;
          } else if (fieldType === 'text') {
            allSuggestions[keyName] = '';
          } else if (fieldType === 'checkbox' || fieldType === 'radio') {
            allSuggestions[keyName] = field.type === 'radio' ? field.options?.[0]?.value || 'on' : 'on';
          } else {
            allSuggestions[keyName] = '';
          }
        }
      });
      
      // Save all suggestions to cache
      allSuggestionsCache[cacheKey] = {...allSuggestions};
      
      // Step 3: Save everything to 'allSuggestions' storage
      storedSuggestions[cacheKey] = allSuggestionsCache[cacheKey];
      chrome.storage.local.set({ allSuggestions: storedSuggestions }, function() {
        console.log("Saved all suggestions for URL + profile");
      });
      
      // Match form fields with mappings and retrieve values
      const fieldValues = [];
      // Use the fieldMappingsV2 structure but don't update it
      const existingMappings = Array.isArray(siteFieldMappingsV2[rootUrl]) ? [...siteFieldMappingsV2[rootUrl]] : [];
      
      console.log("Current page:", formFields.map(f => f.label || f.id || f.name));
      formFields.forEach(field => {
        const fieldId = field.id || '';
        const fieldName = field.name || '';
        const fieldLabel = field.label || '';
        const fieldType = field.type || 'text';
        
        // Check if we have a suggestion for this field from any source
        let suggestionValue = null;
        let isAiGenerated = false;
        
        // Look for suggestions using various field identifiers
        if (fieldId && allSuggestions[fieldId]) {
          suggestionValue = allSuggestions[fieldId];
          isAiGenerated = true; // Assume AI-generated by default
        } else if (fieldName && allSuggestions[fieldName]) {
          suggestionValue = allSuggestions[fieldName];
          isAiGenerated = true;
        } else if (fieldLabel && allSuggestions[fieldLabel]) {
          suggestionValue = allSuggestions[fieldLabel];
          isAiGenerated = true;
        } else {
          // Try to find any matching key in suggestions
          const suggestionKeys = Object.keys(allSuggestions);
          
          for (const key of suggestionKeys) {
            const keyLower = key.toLowerCase();
            
            if ((fieldId && keyLower.includes(fieldId.toLowerCase())) || 
                (fieldName && keyLower.includes(fieldName.toLowerCase())) || 
                (fieldLabel && keyLower.includes(fieldLabel.toLowerCase()))) {
              suggestionValue = allSuggestions[key];
              isAiGenerated = true;
              break;
            }
          }
        }
        
        // If we found a suggestion, process it according to field type
        if (suggestionValue !== null) {
          // Format the value based on field type
          let formattedValue = utils.formatValueForFieldType(suggestionValue, fieldType, field);
          
          // Create a new mapping in the fieldMappingsV2 format
          const newMapping = {
            id: fieldId,
            name: fieldName,
            labels: fieldLabel ? [{ text: fieldLabel, type: 'explicit' }] : [],
            type: fieldType,
            value: formattedValue,
            containerDesc: field.containerDesc || {},
            options: field.options || [],
            disabled: field.disabled || false,
            required: field.required || false,
            aiGenerated: isAiGenerated,
            lastUsed: new Date().toISOString()
          };
          
          // Add to our field values collection to return to the caller
          fieldValues.push(newMapping);
        }
      });
      
      console.log("Processed field values:", fieldValues);
      return { success: true, fields: fieldValues };
    } catch (error) {
      console.error("Error processing form:", error);
      return { success: false, error: error.message };
    }
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