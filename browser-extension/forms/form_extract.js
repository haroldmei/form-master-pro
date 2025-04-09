// Add function to check if an element is hidden
function isElementHidden(element) {
  if (!element) return true;
  
  // Check element's own visibility
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return true;
  }
  
  // Check if element has zero dimensions
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    return true;
  }
  
  // Check if element is detached from DOM
  if (!document.body.contains(element)) {
    return true;
  }
  
  // Check if any parent is hidden (recursive check)
  let parent = element.parentElement;
  while (parent) {
    const parentStyle = window.getComputedStyle(parent);
    if (parentStyle.display === 'none' || parentStyle.visibility === 'hidden' || parentStyle.opacity === '0') {
      return true;
    }
    parent = parent.parentElement;
  }
  
  return false;
}

function extractFormControls(formSelector = null) {
  try {
    // Find target form if selector provided, otherwise use whole document
    const container = formSelector ? document.querySelector(formSelector) : document.body;
    if (formSelector && !container) {
      console.warn(`Form selector '${formSelector}' not found`);
      return {};
    }
    
    // Extract checkbox groups first to ensure we don't duplicate checkboxes
    const checkboxGroups = self.FormCheckboxGroups ? self.FormCheckboxGroups.extractCheckboxGroups(container) : [];
    
    // Get IDs of checkboxes that are part of groups to avoid duplication
    const groupedCheckboxIds = new Set();
    if (checkboxGroups.length > 0 && self.FormCheckboxGroups) {
      const ids = self.FormCheckboxGroups.getGroupedCheckboxIds(checkboxGroups);
      ids.forEach(id => groupedCheckboxIds.add(id));
    }
    
    // Extract different control types
    const controls = {
      inputs: extractInputs(container),
      selects: extractSelects(container),
      textareas: extractTextareas(container),
      buttons: extractButtons(container),
      radios: self.FormRadios ? self.FormRadios.extractRadioGroups(container) : [], 
      checkboxGroups: checkboxGroups,
      checkboxes: extractCheckboxes(container, groupedCheckboxIds)
    };
    
    console.log('Extracted controls:', controls.checkboxGroups);
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
    // Skip inputs that are part of enhanced UI widgets like Chosen, Select2, etc.
    if (isEnhancedSelectComponent(input)) {
      return;
    }
    
    // Skip hidden inputs
    if (isElementHidden(input)) {
      return;
    }
    
    // Determine if this is a date input
    const isDateInput = detectDateInput(input);
    
    inputs.push({
      type: isDateInput ? 'date' : input.type || 'text',
      id: input.id || '',
      name: input.name || '',
      placeholder: input.placeholder || '',
      className: input.className || '',
      class: input.getAttribute('class') || '',
      value: input.value || '',
      label: getElementLabel(input),
      hidden: false, // It's visible since we're filtering hidden elements
      isDateInput: isDateInput // Additional flag to mark date inputs
    });
  });
  
  return inputs;
}

// Helper function to identify inputs that are part of enhanced select widgets
function isEnhancedSelectComponent(input) {
  // Check for Chosen search inputs
  if (input.classList.contains('chosen-search-input')) {
    return true;
  }
  
  // Check if input is inside a Chosen container
  if (input.closest('.chosen-container')) {
    return true;
  }
  
  // Check for Select2 search box
  if (input.classList.contains('select2-search__field')) {
    return true;
  }
  
  // Check if input is inside a Select2 container
  if (input.closest('.select2-container')) {
    return true;
  }
  
  // Check for other common enhanced select libraries
  const parent = input.parentElement;
  if (parent && (
      parent.classList.contains('selectize-input') || 
      parent.classList.contains('ui-select-search') ||
      parent.classList.contains('bootstrap-select-searchbox')
    )) {
    return true;
  }
  
  return false;
}

// New function to detect date inputs based on various indicators
function detectDateInput(input) {
  // Check if element has datepicker-related classes
  if (input.className.match(/date|datepicker|hasDatepicker|calendar-input/i)) {
    return true;
  }
  
  // Check if there's a calendar icon nearby
  const parent = input.parentElement;
  if (parent) {
    // Check for calendar icon in input group
    if (parent.className.match(/input-group|date-group|sv-input-group/i)) {
      // Look for calendar icon or addon with calendar
      const calendarIcon = parent.querySelector('.ui-datepicker-trigger, .calendar-icon, [class*="calendar"], img[src*="calendar"]');
      if (calendarIcon) {
        return true;
      }
      
      // Check for input group addon with icon
      const addon = parent.querySelector('.input-group-addon, .sv-input-group-addon');
      if (addon && (addon.innerHTML.includes('calendar') || addon.querySelector('img'))) {
        return true;
      }
    }
  }
  
  // Check for date-related placeholder or pattern
  if (input.placeholder && input.placeholder.match(/date|dd[^a-z]mm|mm[^a-z]dd|yyyy|^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/i)) {
    return true;
  }
  
  // Check for date format pattern attribute
  if (input.getAttribute('pattern') && input.getAttribute('pattern').match(/\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/)) {
    return true;
  }
  
  // Check for date-related label
  const label = getElementLabel(input);
  if (label && label.match(/\bdate\b|\bday\b|birthday|birth date|start date|end date|arrival|departure|check[ -]?in|check[ -]?out|(dd|mm)[ /-](mm|dd)[ /-](yy|yyyy)/i)) {
    return true;
  }
  
  // Check for data attributes related to date functionality
  if (input.getAttribute('data-date') || input.getAttribute('data-provide') === 'datepicker') {
    return true;
  }
  
  return false;
}

function extractSelects(container) {
  const selects = [];
  const selectElements = container.querySelectorAll('select');
  
  selectElements.forEach(select => {
    // Skip hidden selects
    if (isElementHidden(select)) {
      return;
    }
    
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
      class: select.getAttribute('class') || '',
      value: select.value || '',
      label: getElementLabel(select),
      hidden: false,
      options: options
    });
  });
  
  return selects;
}

function extractTextareas(container) {
  const textareas = [];
  const textareaElements = container.querySelectorAll('textarea');
  
  textareaElements.forEach(textarea => {
    // Skip hidden textareas
    if (isElementHidden(textarea)) {
      return;
    }
    
    textareas.push({
      type: 'textarea',
      id: textarea.id || '',
      name: textarea.name || '',
      placeholder: textarea.placeholder || '',
      className: textarea.className || '',
      class: textarea.getAttribute('class') || '',
      value: textarea.value || '',
      label: getElementLabel(textarea),
      hidden: false
    });
  });
  
  return textareas;
}

function extractButtons(container) {
  const buttons = [];
  const buttonElements = container.querySelectorAll('button, input[type="button"], input[type="submit"], input[type="reset"]');
  
  buttonElements.forEach(button => {
    // Skip hidden buttons
    if (isElementHidden(button)) {
      return;
    }
    
    buttons.push({
      type: button.tagName.toLowerCase() === 'button' ? 'button' : button.type,
      id: button.id || '',
      name: button.name || '',
      className: button.className || '',
      class: button.getAttribute('class') || '',
      value: button.value || button.textContent || '',
      label: button.textContent || button.value || '',
      hidden: false
    });
  });
  
  return buttons;
}

function extractCheckboxes(container, groupedIds = new Set()) {
  const checkboxes = [];
  const checkboxElements = container.querySelectorAll('input[type="checkbox"]');
  
  checkboxElements.forEach(checkbox => {
    // Skip checkboxes that are part of a group
    if (checkbox.id && groupedIds.has(checkbox.id)) {
      return;
    }
    
    // Skip hidden checkboxes
    if (isElementHidden(checkbox)) {
      return;
    }
    
    checkboxes.push({
      type: 'checkbox',
      id: checkbox.id || '',
      name: checkbox.name || '',
      className: checkbox.className || '',
      class: checkbox.getAttribute('class') || '',
      value: checkbox.value || '',
      checked: checkbox.checked,
      label: getElementLabel(checkbox),
      hidden: false
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

function createLabelMapping(controls) {
  const mapping = {};
  
  // Process checkbox groups first
  if (controls.checkboxGroups && controls.checkboxGroups.length) {
    // Add checkbox groups to the mapping
    controls.checkboxGroups.forEach(group => {
      if (group.label) {
        mapping[group.label] = group;
      }
    });
  }
  
  // Process each type of control
  ['inputs', 'selects', 'textareas', 'radios', 'checkbox', 'checkboxes'].forEach(type => {
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
  extractFormStructure,
  isElementHidden // Export for potential reuse
};
