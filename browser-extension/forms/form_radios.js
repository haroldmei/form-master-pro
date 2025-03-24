/**
 * Radio button group extraction utilities for FormMaster.
 * This module provides specialized functions for extracting and analyzing radio button groups from HTML pages.
 * Browser-compatible version - no Node.js dependencies.
 */

/**
 * Extract radio button groups from the container
 * 
 * @param {Element} container - Container element to extract radio groups from
 * @returns {Array} Array of radio groups
 */
function extractRadioGroups(container) {
  try {
    console.log('FormRadios.extractRadioGroups called with container:', container);
    
    // Create a map to group radio buttons by name
    const groups = {};
    const radioButtons = container.querySelectorAll('input[type="radio"]');
    
    console.log(`Found ${radioButtons.length} radio buttons in container`);
    
    // First pass: gather all radio buttons by name
    radioButtons.forEach(radio => {
      const name = radio.name || '';
      if (!name) {
        console.log('Skipping radio button without name attribute:', radio);
        return;
      }
      
      if (!groups[name]) {
        groups[name] = {
          type: 'radio',
          name: name,
          label: getRadioGroupLabel(radio) || name,
          options: []
        };
        console.log(`Created new radio group with name "${name}"`);
      }
      
      // Add this radio button to its group
      groups[name].options.push({
        value: radio.value || '',
        id: radio.id || '',
        checked: radio.checked,
        label: getRadioElementLabel(radio)
      });
      
      console.log(`Added option "${radio.value}" to group "${name}", total options: ${groups[name].options.length}`);
    });
    
    // Convert the groups object to an array
    const result = Object.values(groups);
    console.log(`Extracted ${result.length} radio groups with options counts:`, 
                result.map(g => `${g.name}: ${g.options.length} options`));
    
    return result;
  } catch (error) {
    console.error('Error in FormRadios.extractRadioGroups:', error);
    return [];
  }
}

/**
 * Try to find a label for a radio button element
 * 
 * @param {Element} element - Radio button element to find label for
 * @returns {string} Label text or empty string if not found
 */
function getRadioElementLabel(element) {
  // Try to find a label by for attribute
  if (element.id) {
    const labelElement = document.querySelector(`label[for="${element.id}"]`);
    if (labelElement) {
      return labelElement.textContent.trim();
    }
  }
  
  // Try to find a parent label
  let parent = element.parentElement;
  while (parent) {
    if (parent.tagName === 'LABEL') {
      // Extract text but exclude the radio button's value
      let labelText = parent.textContent.trim();
      if (element.value && labelText.includes(element.value)) {
        labelText = labelText.replace(element.value, '').trim();
      }
      return labelText;
    }
    parent = parent.parentElement;
  }
  
  // Try to find adjacent label or text
  const nextSibling = element.nextSibling;
  if (nextSibling && nextSibling.nodeType === 3) { // Text node
    return nextSibling.textContent.trim();
  }
  
  const nextElement = element.nextElementSibling;
  if (nextElement && nextElement.tagName === 'LABEL') {
    return nextElement.textContent.trim();
  }
  
  return element.value || ''; // Fall back to value as last resort
}

/**
 * Try to find a label for a group of radio buttons
 * 
 * @param {Element} radioElement - Radio button element
 * @returns {string} Group label or empty string if not found
 */
function getRadioGroupLabel(radioElement) {
  try {
    console.log('Trying to find label for radio group:', radioElement.name);
    
    // First try to find a fieldset legend
    let parent = radioElement.parentElement;
    let depth = 0;
    const maxDepth = 5; // Limit how far up we search to avoid performance issues
    
    while (parent && depth < maxDepth) {
      if (parent.tagName === 'FIELDSET') {
        const legend = parent.querySelector('legend');
        if (legend) {
          const text = legend.textContent.trim();
          console.log(`Found fieldset legend: "${text}"`);
          return text;
        }
        break;
      }
      parent = parent.parentElement;
      depth++;
    }
    
    // Try to find a common heading or label for the radio group
    const name = radioElement.name;
    if (!name) {
      console.log('Radio button has no name attribute');
      return '';
    }
    
    // Get all radio buttons with the same name
    const selector = `input[type="radio"][name="${CSS.escape(name)}"]`;
    console.log(`Looking for radio buttons with selector: ${selector}`);
    const radioGroup = Array.from(document.querySelectorAll(selector));
    console.log(`Found ${radioGroup.length} radio buttons in group "${name}"`);
    
    if (radioGroup.length > 0) {
      // Try these approaches in sequence:
      
      // 1. Look for aria-labelledby attribute
      for (const radio of radioGroup) {
        const labelledBy = radio.getAttribute('aria-labelledby');
        if (labelledBy) {
          const labelElement = document.getElementById(labelledBy);
          if (labelElement) {
            const text = labelElement.textContent.trim();
            console.log(`Found aria-labelledby label: "${text}"`);
            return text;
          }
        }
      }
      
      // 2. Look for a parent element with role="radiogroup" and aria-label
      for (const radio of radioGroup) {
        let el = radio.parentElement;
        let searchDepth = 0;
        while (el && searchDepth < 4) {
          if (el.getAttribute('role') === 'radiogroup') {
            const ariaLabel = el.getAttribute('aria-label');
            if (ariaLabel) {
              console.log(`Found role="radiogroup" with aria-label: "${ariaLabel}"`);
              return ariaLabel;
            }
            break;
          }
          el = el.parentElement;
          searchDepth++;
        }
      }
      
      // 3. Find the first radio button in the DOM
      const firstRadio = radioGroup.reduce((first, current) => {
        try {
          return document.compareDocumentPosition(current) & Node.DOCUMENT_POSITION_PRECEDING ? current : first;
        } catch (e) {
          console.error('Error comparing DOM positions:', e);
          return first;
        }
      }, radioGroup[0]);
      
      // 4. Look for a heading, label, or emphasized text above the first radio
      if (firstRadio) {
        console.log('Searching above first radio button for labels');
        
        // Check for a heading above the group
        let element = firstRadio;
        while (element && element.previousElementSibling) {
          const prev = element.previousElementSibling;
          
          // Check if it's a heading
          if (/^H[1-6]$/.test(prev.tagName)) {
            const text = prev.textContent.trim();
            console.log(`Found heading above group: "${text}"`);
            return text;
          }
          
          // Check for label/div with strong/b elements
          if (['DIV', 'P', 'LABEL', 'SPAN'].includes(prev.tagName)) {
            // Check for emphasized text
            const emphasized = prev.querySelector('strong, b, label, .form-label, .control-label');
            if (emphasized) {
              const text = emphasized.textContent.trim();
              console.log(`Found emphasized text above group: "${text}"`);
              return text;
            }
            
            // If close to radio and has text but no child inputs, might be a label
            const hasInputs = prev.querySelector('input, select, textarea, button');
            if (!hasInputs && prev.textContent.trim().length > 0) {
              const text = prev.textContent.trim();
              console.log(`Found potential text label above group: "${text}"`);
              return text;
            }
          }
          
          element = prev;
        }
        
        // 5. Look for a common parent with a label-like child
        parent = firstRadio.parentElement;
        depth = 0;
        while (parent && depth < 3) {
          // Check if any children might be labels
          const labelCandidates = parent.querySelectorAll('label, .form-label, .control-label, legend');
          for (const labelEl of labelCandidates) {
            // Make sure this label doesn't belong to a specific radio button
            const forAttr = labelEl.getAttribute('for');
            if (!forAttr || !document.getElementById(forAttr)) {
              const text = labelEl.textContent.trim();
              if (text) {
                console.log(`Found potential parent label: "${text}"`);
                return text;
              }
            }
          }
          parent = parent.parentElement;
          depth++;
        }
      }
    }
    
    // Default: if no label found, use the name attribute with formatting
    const formattedName = name
      .replace(/([A-Z])/g, ' $1') // Add spaces before capital letters
      .replace(/[-_]/g, ' ')      // Replace dashes and underscores with spaces
      .replace(/^\w/, c => c.toUpperCase()); // Capitalize first letter
      
    console.log(`No label found, using formatted name: "${formattedName}"`);
    return formattedName;
  } catch (error) {
    console.error('Error in getRadioGroupLabel:', error);
    return radioElement.name || '';
  }
}

/**
 * Get all radio groups on the page with their selected values
 * 
 * @param {Element} container - Container element to search within
 * @returns {Object} Dictionary of radio groups with name as key and selected value as value
 */
function getRadioGroupValues(container = document.body) {
  const values = {};
  const radioGroups = extractRadioGroups(container);
  
  radioGroups.forEach(group => {
    const selectedOption = group.options.find(opt => opt.checked);
    values[group.name] = selectedOption ? selectedOption.value : null;
  });
  
  return values;
}

// Export functions in a way that works in browser context
window.FormRadios = {
  extractRadioGroups,
  getRadioElementLabel,
  getRadioGroupLabel,
  getRadioGroupValues
};
