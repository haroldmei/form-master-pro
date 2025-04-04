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


function extractRadioGroups(container) {
  console.log('FormExtract.extractRadioGroups called', self.FormRadios ? 'FormRadios exists' : 'FormRadios missing');
  
  // Use FormRadios if available (from form_radios.js), otherwise fall back to internal implementation
  if (self.FormRadios && typeof self.FormRadios.extractRadioGroups === 'function') {
    try {
      const radioGroups = self.FormRadios.extractRadioGroups(container);
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
  
  // Look for form groups with label + control structure (Bootstrap, Foundation, etc.)
  parent = element.parentElement;
  while (parent && !parent.matches('form') && parent.tagName !== 'BODY') {
    // Look for common form group patterns
    const formGroup = parent.closest('.form-group, .sv-form-group, .input-group, .field-wrapper, .field');
    if (formGroup) {
      // Check for label within the form group
      const groupLabel = formGroup.querySelector('label');
      if (groupLabel) {
        return groupLabel.textContent.trim();
      }
      break;
    }
    parent = parent.parentElement;
  }
  
  // Handle hidden selects with UI enhancements like Chosen, Select2, etc.
  if (element.tagName === 'SELECT' && element.style.display === 'none') {
    // 1. Try to find Chosen container
    const chosenId = `${element.id}_chosen`;
    const chosenContainer = document.getElementById(chosenId);
    if (chosenContainer) {
      // Look for a label in the parent structure of the Chosen container
      const containerParent = chosenContainer.parentElement;
      if (containerParent) {
        const parentGroup = containerParent.closest('.form-group, .sv-form-group, .control-group');
        if (parentGroup) {
          const groupLabel = parentGroup.querySelector('label');
          if (groupLabel) {
            return groupLabel.textContent.trim();
          }
        }
      }
    }
    
    // 2. Try to find any container with a similar ID pattern
    const containers = document.querySelectorAll(`[id$="_${element.id}"], [id^="${element.id}_"], [data-select-id="${element.id}"]`);
    for (const container of containers) {
      // Look in the parent structure for a label
      const containerParent = container.parentElement;
      if (containerParent) {
        const groupLabel = containerParent.querySelector('label');
        if (groupLabel) {
          return groupLabel.textContent.trim();
        }
      }
    }
  }
  
  // Try to find nearby text that might be a label
  const prevSibling = element.previousElementSibling;
  if (prevSibling && prevSibling.tagName !== 'INPUT' && 
      prevSibling.tagName !== 'SELECT' && prevSibling.tagName !== 'TEXTAREA') {
    return prevSibling.textContent.trim();
  }
  
  // Try to find a parent div with a sibling label (common pattern for structured forms)
  parent = element.parentElement;
  while (parent && !parent.matches('form') && parent.tagName !== 'BODY') {
    const parentSibling = parent.previousElementSibling;
    if (parentSibling && parentSibling.tagName === 'LABEL') {
      return parentSibling.textContent.trim();
    }
    parent = parent.parentElement;
  }
  
  return '';
}


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
self.FormExtract = {
  extractFormControls,
  extractFormStructure
};
