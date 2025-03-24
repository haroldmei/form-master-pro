/**
 * Form control extraction utilities for FormMaster.
 * This module provides functions to extract and analyze form controls from HTML pages.
 * Browser-compatible version - no Node.js dependencies.
 */

/**
 * Extract form controls from the current page
 * 
 * @param {string} formSelector - CSS selector for the form element
 * @returns {Object} Dictionary of form controls grouped by type
 */
function extractFormControls(formSelector = null) {
  try {
    // Find target form if selector provided, otherwise use whole document
    const container = formSelector ? document.querySelector(formSelector) : document.body;
    if (formSelector && !container) {
      console.warn(`Form selector '${formSelector}' not found`);
      return {};
    }
    
    // Extract different control types
    const controls = {
      inputs: extractInputs(container),
      selects: extractSelects(container),
      textareas: extractTextareas(container),
      buttons: extractButtons(container),
      radios: extractRadioGroups(container), // Now using the updated function
      checkboxes: extractCheckboxes(container)
    };
    
    // Create a label-to-control mapping for easier reference
    controls.label_mapping = createLabelMapping(controls);
    
    return controls;
  } catch (e) {
    console.error(`Error extracting form controls: ${e.message}`);
    console.error(e.stack);
    return {};
  }
}

/**
 * Extract a more user-friendly form structure with labels as primary keys
 * 
 * @param {string} formSelector - CSS selector for the form element
 * @returns {Object} Dictionary with labels as keys and control information as values
 */
function extractFormStructure(formSelector = null) {
  try {
    const controls = extractFormControls(formSelector);
    return controls.label_mapping || {};
  } catch (e) {
    console.error(`Error extracting form structure: ${e.message}`);
    console.error(e.stack);
    return {};
  }
}

/**
 * Extract input elements from the container
 * 
 * @param {Element} container - Container element to extract inputs from
 * @returns {Array} Array of input elements
 */
function extractInputs(container) {
  const inputs = [];
  const inputElements = container.querySelectorAll('input:not([type="submit"]):not([type="button"]):not([type="image"]):not([type="reset"]):not([type="file"]):not([type="radio"]):not([type="checkbox"]):not([type="hidden"])');
  
  inputElements.forEach(input => {
    inputs.push({
      type: input.type || 'text',
      id: input.id || '',
      name: input.name || '',
      placeholder: input.placeholder || '',
      className: input.className || '',
      value: input.value || '',
      label: getElementLabel(input)
    });
  });
  
  return inputs;
}

/**
 * Extract select elements from the container
 * 
 * @param {Element} container - Container element to extract selects from
 * @returns {Array} Array of select elements
 */
function extractSelects(container) {
  const selects = [];
  const selectElements = container.querySelectorAll('select');
  
  selectElements.forEach(select => {
    const options = Array.from(select.options).map(opt => ({
      value: opt.value,
      text: opt.text,
      selected: opt.selected
    }));
    
    selects.push({
      type: 'select',
      id: select.id || '',
      name: select.name || '',
      className: select.className || '',
      value: select.value || '',
      label: getElementLabel(select),
      options: options
    });
  });
  
  return selects;
}

/**
 * Extract textarea elements from the container
 * 
 * @param {Element} container - Container element to extract textareas from
 * @returns {Array} Array of textarea elements
 */
function extractTextareas(container) {
  const textareas = [];
  const textareaElements = container.querySelectorAll('textarea');
  
  textareaElements.forEach(textarea => {
    textareas.push({
      type: 'textarea',
      id: textarea.id || '',
      name: textarea.name || '',
      placeholder: textarea.placeholder || '',
      className: textarea.className || '',
      value: textarea.value || '',
      label: getElementLabel(textarea)
    });
  });
  
  return textareas;
}

/**
 * Extract button elements from the container
 * 
 * @param {Element} container - Container element to extract buttons from
 * @returns {Array} Array of button elements
 */
function extractButtons(container) {
  const buttons = [];
  const buttonElements = container.querySelectorAll('button, input[type="button"], input[type="submit"], input[type="reset"]');
  
  buttonElements.forEach(button => {
    buttons.push({
      type: button.tagName.toLowerCase() === 'button' ? 'button' : button.type,
      id: button.id || '',
      name: button.name || '',
      className: button.className || '',
      value: button.value || button.textContent || '',
      label: button.textContent || button.value || ''
    });
  });
  
  return buttons;
}

/**
 * Extract radio button groups from the container
 * 
 * @param {Element} container - Container element to extract radio groups from
 * @returns {Array} Array of radio groups
 */
function extractRadioGroups(container) {
  console.log('FormExtract.extractRadioGroups called', window.FormRadios ? 'FormRadios exists' : 'FormRadios missing');
  
  // Use FormRadios if available (from form_radios.js), otherwise fall back to internal implementation
  if (window.FormRadios && typeof window.FormRadios.extractRadioGroups === 'function') {
    try {
      const radioGroups = window.FormRadios.extractRadioGroups(container);
      console.log('FormRadios.extractRadioGroups returned', radioGroups);
      return radioGroups;
    } catch (error) {
      console.error('Error using FormRadios.extractRadioGroups:', error);
      // Fall through to fallback implementation
    }
  }
  
  // Fallback implementation if FormRadios is not available or failed
  console.warn('Using fallback extractRadioGroups implementation');
  const groups = {};
  const radioButtons = container.querySelectorAll('input[type="radio"]');
  
  radioButtons.forEach(radio => {
    const name = radio.name || '';
    if (!name) return;
    
    if (!groups[name]) {
      groups[name] = {
        type: 'radio',
        name: name,
        label: getGroupLabel(radio) || name,
        options: []
      };
    }
    
    groups[name].options.push({
      value: radio.value,
      id: radio.id,
      checked: radio.checked,
      label: getElementLabel(radio)
    });
  });
  
  return Object.values(groups);
}

/**
 * Extract checkbox elements from the container
 * 
 * @param {Element} container - Container element to extract checkboxes from
 * @returns {Array} Array of checkbox elements
 */
function extractCheckboxes(container) {
  const checkboxes = [];
  const checkboxElements = container.querySelectorAll('input[type="checkbox"]');
  
  checkboxElements.forEach(checkbox => {
    checkboxes.push({
      type: 'checkbox',
      id: checkbox.id || '',
      name: checkbox.name || '',
      className: checkbox.className || '',
      value: checkbox.value || '',
      checked: checkbox.checked,
      label: getElementLabel(checkbox)
    });
  });
  
  return checkboxes;
}

/**
 * Try to find a label for an element
 * 
 * @param {Element} element - Element to find label for
 * @returns {string} Label text or empty string if not found
 */
function getElementLabel(element) {
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
      return parent.textContent.trim().replace(element.value, '').trim();
    }
    parent = parent.parentElement;
  }
  
  // Try to find nearby text that might be a label
  const prevSibling = element.previousElementSibling;
  if (prevSibling && prevSibling.tagName !== 'INPUT' && 
      prevSibling.tagName !== 'SELECT' && prevSibling.tagName !== 'TEXTAREA') {
    return prevSibling.textContent.trim();
  }
  
  return '';
}

/**
 * Try to find a label for a group of radio buttons
 * 
 * @param {Element} radioElement - Radio button element
 * @returns {string} Group label or empty string if not found
 */
function getGroupLabel(radioElement) {
  // Try to find a fieldset legend
  let parent = radioElement.parentElement;
  while (parent) {
    if (parent.tagName === 'FIELDSET') {
      const legend = parent.querySelector('legend');
      if (legend) {
        return legend.textContent.trim();
      }
      break;
    }
    parent = parent.parentElement;
  }
  
  return '';
}

/**
 * Create a mapping of labels to control information for easier reference
 * 
 * @param {Object} controls - Controls object with different control types
 * @returns {Object} Mapping of labels to control information
 */
function createLabelMapping(controls) {
  const mapping = {};
  
  // Process each type of control
  ['inputs', 'selects', 'textareas', 'radios', 'checkboxes'].forEach(type => {
    if (!controls[type]) return;
    
    controls[type].forEach(control => {
      const label = control.label || control.name || control.id || '';
      if (label) {
        mapping[label] = control;
      }
    });
  });
  
  return mapping;
}

// Export functions in a way that works in browser context
window.FormExtract = {
  extractFormControls,
  extractFormStructure
};
