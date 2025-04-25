// ClickToFill Module - Manages click-to-fill functionality for form fields
(function() {
  // Get reference to the global FormMaster object
  const FM = window.FormMaster = window.FormMaster || {};
  
  /**
   * Enable click-to-fill functionality for form fields
   * @param {Array} fieldValues - Array of field values for form filling
   */
  FM.enableClickToFill = function(fieldValues) {
    console.log('Enabling click-to-fill with', fieldValues.length, 'field values');
    
    // Create UI elements for highlighting and tooltips
    if (FM.createUIElements) {
      FM.createUIElements();
    }
    
    // Populate the value map for field matching
    if (fieldValues && fieldValues.length > 0) {
      fieldValues.forEach(field => {
        // Store values by key for easy lookup
        if (field.key) {
          FM.valueMap.set(field.key.toLowerCase(), field);
        }
        
        // Also store by name if different from key
        if (field.name && field.name !== field.key) {
          FM.valueMap.set(field.name.toLowerCase(), field);
        }
        
        // Store by label too if available
        if (field.label && field.label !== field.key && field.label !== field.name) {
          FM.valueMap.set(field.label.toLowerCase(), field);
        }
      });
    }
    
    console.log('Click-to-fill initialized with', FM.valueMap.size, 'mapped values');
  };
})(); 