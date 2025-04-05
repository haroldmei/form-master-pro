/**
 * Utility functions
 */
const utils = (() => {
  
  function formatValueForFieldType(value, fieldType, fieldInfo) {
    // Return null or undefined values as empty string to avoid errors
    if (value === null || value === undefined) {
      return '';
    }
    
    // Convert value to string if it's not already
    const strValue = typeof value === 'string' ? value : String(value);
    
    // Trim leading/trailing whitespace
    const trimmedValue = strValue.trim();
    
    switch (fieldType.toLowerCase()) {
      case 'checkbox':
        // Normalize various truthy/falsy values for checkboxes
        if (typeof value === 'boolean') {
          return value;
        }
        
        // Handle string representations of boolean values
        const lowercaseValue = trimmedValue.toLowerCase();
        const truthy = ['true', 'yes', 'on', '1', 'checked', 'selected', 'enabled'];
        const falsy = ['false', 'no', 'off', '0', 'unchecked', 'unselected', 'disabled'];
        
        if (truthy.includes(lowercaseValue)) {
          return true;
        }
        if (falsy.includes(lowercaseValue)) {
          return false;
        }
        
        // Default to truthy for other strings
        return !!trimmedValue;
        
      case 'radio':
        return trimmedValue; // Radio value - will be checked if it matches
        
      case 'select':
      case 'select-one':
      case 'select-multiple':
        // For select fields, try to find the option that matches
        if (fieldInfo.options && Array.isArray(fieldInfo.options)) {
          // Look for exact matches in option values or text
          for (const option of fieldInfo.options) {
            if (option.value?.toLowerCase() === trimmedValue.toLowerCase() || 
                option.text?.toLowerCase() === trimmedValue.toLowerCase()) {
              return option.value || option.text; // Prefer value over text
            }
          }
          
          // If no exact match, try fuzzy matching
          for (const option of fieldInfo.options) {
            const optValue = option.value?.toLowerCase() || '';
            const optText = option.text?.toLowerCase() || '';
            
            if (optValue.includes(trimmedValue.toLowerCase()) || 
                trimmedValue.toLowerCase().includes(optValue) ||
                optText.includes(trimmedValue.toLowerCase()) ||
                trimmedValue.toLowerCase().includes(optText)) {
              return option.value || option.text;
            }
          }
        }
        
        // If no match found among options, return the original value
        return trimmedValue;
        
      case 'number':
      case 'range':
        // Try to convert to a number, but fallback to string if not a valid number
        const num = parseFloat(trimmedValue);
        return isNaN(num) ? trimmedValue : num;
        
      case 'date':
        // Try to format as a valid date string if possible
        try {
          if (trimmedValue) {
            const date = new Date(trimmedValue);
            if (!isNaN(date.getTime())) {
              // Format as YYYY-MM-DD for date inputs
              return date.toISOString().split('T')[0];
            }
          }
        } catch (e) {
          console.log('Error formatting date:', e);
        }
        return trimmedValue;
        
      case 'time':
        // Try to format as a valid time string
        try {
          if (trimmedValue) {
            const date = new Date(`1970-01-01T${trimmedValue}`);
            if (!isNaN(date.getTime())) {
              // Format as HH:MM for time inputs
              return date.toTimeString().split(' ')[0].substring(0, 5);
            }
          }
        } catch (e) {
          console.log('Error formatting time:', e);
        }
        return trimmedValue;
        
      case 'email':
        // Ensure email format
        if (trimmedValue && !trimmedValue.includes('@')) {
          // If it doesn't look like an email, try to extract from user profile
          const emailFromProfile = userProfileManager.getUserProfileField('personal.email') || '';
          return emailFromProfile || trimmedValue;
        }
        return trimmedValue;
        
      case 'tel':
      case 'phone':
        // Try to format phone numbers consistently
        // Remove non-digit characters for consistency
        const digitsOnly = trimmedValue.replace(/\D/g, '');
        
        // Apply basic formatting based on length
        if (digitsOnly.length === 10) {
          return `(${digitsOnly.substring(0,3)}) ${digitsOnly.substring(3,6)}-${digitsOnly.substring(6)}`;
        }
        return trimmedValue;
        
      case 'url':
        // Ensure URLs have a protocol
        if (trimmedValue && !trimmedValue.match(/^https?:\/\//i)) {
          return `https://${trimmedValue}`;
        }
        return trimmedValue;
        
      case 'password':
        // For security, don't autofill passwords unless explicitly allowed
        return ''; // You can change this policy if needed
        
      case 'textarea':
        // For textareas, preserve newlines
        return trimmedValue;
        
      case 'text':
      default:
        // For generic text fields, just return the trimmed value
        return trimmedValue;
    }
  }
  
  function isPatternMatch(identifier, pattern) {
    if (!identifier || !pattern) return false;
    
    // Simple wildcard matching
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'), 'i');
      return regex.test(identifier);
    }
    
    // Direct match
    return identifier.includes(pattern);
  }
  
  // Return public API
  return {
    formatValueForFieldType,
    isPatternMatch
  };
})();

self.utils = utils;