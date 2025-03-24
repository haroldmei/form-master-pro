/**
 * Form processing module
 */
const formProcessor = (() => {
  /**
   * Process a form with field mappings
   */
  async function processForm(formFields, url) {
    try {
      console.log("Processing form for URL:", url);
      
      // Extract the root URL (domain + path up to first directory)
      const urlObj = new URL(url);
      const rootUrl = urlObj.hostname;
      console.log("Using root URL for mappings:", rootUrl);
      
      // Get existing field mappings from storage
      const result = await chrome.storage.sync.get(['fieldMappings']);
      let siteFieldMappings = result.fieldMappings || {};
      
      // Initialize site mappings if not present
      if (!siteFieldMappings[rootUrl]) {
        siteFieldMappings[rootUrl] = [];
      }
      
      // Collect field labels and names for AI analysis
      const fieldKeywords = formFields.map(field => {
        // Prefer label if available, otherwise use name
        return field.label || field.name || field.id || '';
      }).filter(keyword => keyword.trim() !== ''); // Filter out empty values
      
      // If we have field keywords and user profile data, make an API call
      let aiSuggestions = {};
      if (fieldKeywords.length > 0) {
        try {
          const userProfile = userProfileManager.getUserProfile();
          if (Object.keys(userProfile).length > 0) {
            aiSuggestions = await aiService.getAiSuggestions(fieldKeywords, userProfile, url);
            console.log("AI suggestions:", aiSuggestions);
            
            // Store the AI suggestions for later reference
            chrome.storage.local.set({ lastAiSuggestions: aiSuggestions });
          }
        } catch (apiError) {
          console.error("Error getting AI suggestions:", apiError);
        }
      }
      
      // Match form fields with mappings and retrieve values
      const fieldValues = {};
      const updatedSiteMapping = [...siteFieldMappings[rootUrl]]; // Clone existing mappings
      let mappingsUpdated = false;
      
      formFields.forEach(field => {
        const fieldId = field.id || '';
        const fieldName = field.name || '';
        const fieldLabel = field.label || '';
        const fieldType = field.type || 'text';
        
        // First check if AI provided a suggestion for this field
        // Try multiple identifiers to find a match
        let suggestionValue = null;
        
        // Look for AI suggestions using various field identifiers
        if (fieldId && aiSuggestions[fieldId]) {
          suggestionValue = aiSuggestions[fieldId];
        } else if (fieldName && aiSuggestions[fieldName]) {
          suggestionValue = aiSuggestions[fieldName];
        } else if (fieldLabel && aiSuggestions[fieldLabel]) {
          suggestionValue = aiSuggestions[fieldLabel];
        } else {
          // Try to find any matching key in suggestions that contains our field identifiers
          const suggestionKeys = Object.keys(aiSuggestions);
          
          for (const key of suggestionKeys) {
            // Case-insensitive matching for better results
            const keyLower = key.toLowerCase();
            
            if ((fieldId && keyLower.includes(fieldId.toLowerCase())) || 
                (fieldName && keyLower.includes(fieldName.toLowerCase())) || 
                (fieldLabel && keyLower.includes(fieldLabel.toLowerCase()))) {
              suggestionValue = aiSuggestions[key];
              break;
            }
          }
        }
        
        // If we found a suggestion, process it according to field type
        if (suggestionValue !== null) {
          // Format the value based on field type
          let formattedValue = utils.formatValueForFieldType(suggestionValue, fieldType, field);
          fieldValues[fieldId || fieldName] = formattedValue;
          
          // Store this successful AI mapping for future use
          const existingIndex = updatedSiteMapping.findIndex(mapping => 
            (mapping.id === fieldId) || (mapping.name === fieldName)
          );
          
          const newMapping = {
            id: fieldId,
            label: fieldLabel,
            name: fieldName,
            type: fieldType,
            value: formattedValue,
            aiGenerated: true,
            lastUsed: new Date().toISOString()
          };
          
          if (existingIndex >= 0) {
            updatedSiteMapping[existingIndex] = newMapping;
          } else {
            updatedSiteMapping.push(newMapping);
          }
          
          mappingsUpdated = true;
          return; // Skip further processing for this field
        }
        
        // Check if the field exists in our site-specific mappings
        const existingMapping = siteFieldMappings[rootUrl].find(mapping => 
          (mapping.id && mapping.id === fieldId) || (mapping.name && mapping.name === fieldName)
        );
        
        if (existingMapping) {
          // Use the existing mapping
          const formattedValue = utils.formatValueForFieldType(existingMapping.value, fieldType, field);
          fieldValues[fieldId || fieldName] = formattedValue;
          
          // Update the lastUsed timestamp
          const mappingIndex = updatedSiteMapping.findIndex(m => 
            (m.id === existingMapping.id) || (m.name === existingMapping.name)
          );
          
          if (mappingIndex >= 0) {
            updatedSiteMapping[mappingIndex].lastUsed = new Date().toISOString();
            mappingsUpdated = true;
          }
        } else {
          // If no existing mapping found, fall back to general field mappings
          const result = getValueFromGeneralMappings(field, fieldId, fieldName, fieldLabel, fieldType);
          
          if (result.value) {
            fieldValues[fieldId || fieldName] = result.value;
            
            // Add this mapping to the site-specific mappings for future use
            updatedSiteMapping.push({
              id: fieldId,
              label: fieldLabel,
              name: fieldName,
              type: fieldType,
              value: result.value,
              source: result.source,
              lastUsed: new Date().toISOString()
            });
            
            mappingsUpdated = true;
          }
        }
      });
      
      // If we made updates to the mappings, save them back to storage
      if (mappingsUpdated) {
        siteFieldMappings[rootUrl] = updatedSiteMapping;
        console.log("Saving updated field mappings for site:", rootUrl);
        
        // Limit storage size by keeping only the last 100 mappings per site
        if (updatedSiteMapping.length > 100) {
          // Sort by lastUsed and keep only the most recent 100
          siteFieldMappings[rootUrl] = updatedSiteMapping
            .sort((a, b) => new Date(b.lastUsed) - new Date(a.lastUsed))
            .slice(0, 100);
        }
        
        // Save the updated mappings
        chrome.storage.sync.set({ fieldMappings: siteFieldMappings }, function() {
          console.log("Field mappings updated successfully");
        });
      }
      
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
          const value = userProfileManager.getUserProfileField(mapping.path);
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
  
  // Return public API
  return {
    processForm
  };
})();
