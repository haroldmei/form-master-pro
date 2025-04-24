// FormMaster content script for form analysis and filling

// Store form analysis results
let formAnalysis = null;

// Store field values for click-to-fill
let clickToFillValues = null;

// Listen for messages from the extension
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "analyzeForm") {
    // Analyze the form on the current page
    const fields = analyzeFormFields();
    formAnalysis = fields;
    sendResponse({ fields: fields });
    
  } else if (request.action === "fillForm") {
    // Fill the form with provided data
    fillForm(request.data)
      .then(result => sendResponse({ success: true, message: "Form filled successfully" }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Required for async response
  } else if (request.action === "enableClickToFill") {
    // Store the field values for click-to-fill
    clickToFillValues = request.fieldValues;
    enableClickToFill(clickToFillValues);
    sendResponse({ success: true, message: "Click-to-fill enabled" });
  }
});

// Automatically get field values and enable click-to-fill when page loads
document.addEventListener('DOMContentLoaded', function() {
  // Wait a bit for forms to fully initialize
  setTimeout(() => {
    console.log("Requesting form values from background script...");
    chrome.runtime.sendMessage({ action: "getFormValues", url: window.location.href }, function(response) {
      console.log("Received response:", response);
      if (response && response.success && response.fields && response.fields.length > 0) {
        clickToFillValues = response.fields;
        enableClickToFill(clickToFillValues);
      } else {
        console.warn("No form values available for click-to-fill");
      }
    });
  }, 1000);
});

/**
 * Enable click-to-fill functionality for form fields
 */
function enableClickToFill(fieldValues) {
  if (!fieldValues || !fieldValues.length) {
    console.log("No field values available for click-to-fill");
    return;
  }
  
  console.log(`Enabling click-to-fill with ${fieldValues.length} field values`);
  
  // Create a map for quick lookups
  const valueMap = new Map();
  
  // Populate the map with various lookup keys
  fieldValues.forEach(field => {
    // Always include basic debugging info
    console.log(`Adding field to click-to-fill map: ${field.id || field.name || field.label || 'unnamed'} = ${field.value}`);
    
    // Create lowercase keys for case-insensitive matching
    if (field.id) valueMap.set(field.id.toLowerCase(), field);
    if (field.name) valueMap.set(field.name.toLowerCase(), field);
    if (field.label) valueMap.set(field.label.toLowerCase(), field);
    if (field.ariaLabel) valueMap.set(field.ariaLabel.toLowerCase(), field);
    
    // Also try with spaces removed for more flexible matching
    if (field.label) {
      const noSpaces = field.label.toLowerCase().replace(/\s+/g, '');
      valueMap.set(noSpaces, field);
    }
  });
  
  // Check if there's an existing indicator and remove it
  const existingIndicator = document.getElementById('formmaster-click-indicator');
  if (existingIndicator) {
    existingIndicator.parentNode.removeChild(existingIndicator);
  }
  
  // Create highlight indicator
  const indicator = document.createElement('div');
  indicator.id = 'formmaster-click-indicator';
  indicator.style.cssText = `
    position: fixed;
    background-color: rgba(66, 133, 244, 0.2);
    border: 2px solid rgba(66, 133, 244, 0.6);
    border-radius: 4px;
    pointer-events: none;
    display: none;
    box-shadow: 0 0 10px rgba(66, 133, 244, 0.4);
    transition: all 0.2s ease-in-out;
    z-index: 999999;
  `;
  document.body.appendChild(indicator);
  
  // Keep track of the currently highlighted element
  let currentHighlightedElement = null;
  
  // Function to update indicator position
  function updateIndicatorPosition() {
    if (!currentHighlightedElement || indicator.style.display === 'none') return;
    
    const rect = currentHighlightedElement.getBoundingClientRect();
    indicator.style.top = `${rect.top}px`;
    indicator.style.left = `${rect.left}px`;
    indicator.style.width = `${rect.width}px`;
    indicator.style.height = `${rect.height}px`;
  }
  
  // Function to find matching field
  function findMatchingField(element) {
    let foundField = null;
    const debugInfo = {
      elementId: element.id,
      elementName: element.name,
      elementAriaLabel: element.getAttribute('aria-label'),
      elementPlaceholder: element.getAttribute('placeholder'),
      matches: []
    };
    
    // Try by ID
    if (element.id && valueMap.has(element.id.toLowerCase())) {
      foundField = valueMap.get(element.id.toLowerCase());
      debugInfo.matches.push(`ID match: ${element.id}`);
    }
    
    // Try by name
    if (!foundField && element.name && valueMap.has(element.name.toLowerCase())) {
      foundField = valueMap.get(element.name.toLowerCase());
      debugInfo.matches.push(`Name match: ${element.name}`);
    }
    
    // Try by aria-label
    const ariaLabel = element.getAttribute('aria-label');
    if (!foundField && ariaLabel && valueMap.has(ariaLabel.toLowerCase())) {
      foundField = valueMap.get(ariaLabel.toLowerCase());
      debugInfo.matches.push(`Aria-label match: ${ariaLabel}`);
    }
    
    // Try by label element (for="id")
    if (!foundField && element.id) {
      const label = document.querySelector(`label[for="${element.id}"]`);
      if (label && label.textContent) {
        const labelText = label.textContent.trim().toLowerCase();
        if (valueMap.has(labelText)) {
          foundField = valueMap.get(labelText);
          debugInfo.matches.push(`Label text match: ${labelText}`);
        } else {
          // Try with spaces removed
          const noSpaces = labelText.replace(/\s+/g, '');
          if (valueMap.has(noSpaces)) {
            foundField = valueMap.get(noSpaces);
            debugInfo.matches.push(`Label text (no spaces) match: ${noSpaces}`);
          } else {
            // Try partial match
            for (const [key, field] of valueMap.entries()) {
              if (labelText.includes(key) || key.includes(labelText)) {
                foundField = field;
                debugInfo.matches.push(`Partial label match: ${key} in ${labelText}`);
                break;
              }
            }
          }
        }
      }
    }
    
    // Try by placeholder
    const placeholder = element.getAttribute('placeholder');
    if (!foundField && placeholder) {
      const placeholderText = placeholder.toLowerCase();
      if (valueMap.has(placeholderText)) {
        foundField = valueMap.get(placeholderText);
        debugInfo.matches.push(`Placeholder match: ${placeholderText}`);
      } else {
        // Try partial match
        for (const [key, field] of valueMap.entries()) {
          if (placeholderText.includes(key) || key.includes(placeholderText)) {
            foundField = field;
            debugInfo.matches.push(`Partial placeholder match: ${key} in ${placeholderText}`);
            break;
          }
        }
      }
    }
    
    // If we couldn't find a match, log debug info
    if (!foundField && (element.id || element.name)) {
      console.log("No field match found for:", debugInfo);
    }
    
    return foundField;
  }
  
  // Mouseover handler to highlight fillable fields
  function handleMouseover(e) {
    const element = e.target;
    
    // Only handle input elements, selects, and textareas
    if (!(element instanceof HTMLInputElement || 
          element instanceof HTMLSelectElement || 
          element instanceof HTMLTextAreaElement)) {
      indicator.style.display = 'none';
      currentHighlightedElement = null;
      return;
    }
    
    // Ignore submit/button inputs
    if (element.type === 'submit' || element.type === 'button' || element.type === 'reset') {
      indicator.style.display = 'none';
      currentHighlightedElement = null;
      return;
    }
    
    // Find matching field
    const matchingField = findMatchingField(element);
    if (!matchingField) {
      indicator.style.display = 'none';
      currentHighlightedElement = null;
      return;
    }
    
    // Store current element for scroll updates
    currentHighlightedElement = element;
    
    // Show indicator for fillable field using fixed positioning
    const rect = element.getBoundingClientRect();
    indicator.style.top = `${rect.top}px`;
    indicator.style.left = `${rect.left}px`;
    indicator.style.width = `${rect.width}px`;
    indicator.style.height = `${rect.height}px`;
    indicator.style.display = 'block';
  }
  
  // Click handler to fill fields
  function handleClick(e) {
    const element = e.target;
    
    // Only handle input elements, selects, and textareas
    if (!(element instanceof HTMLInputElement || 
          element instanceof HTMLSelectElement || 
          element instanceof HTMLTextAreaElement)) {
      return;
    }
    
    // Ignore submit/button inputs
    if (element.type === 'submit' || element.type === 'button' || element.type === 'reset') {
      return;
    }
    
    // Find matching field
    const matchingField = findMatchingField(element);
    if (!matchingField || matchingField.value === undefined) {
      console.log("No matching field value found or value is undefined");
      return;
    }
    
    // Fill the field
    const value = matchingField.value;
    
    console.log(`Click-to-fill: Filling ${element.tagName.toLowerCase()} with value: ${value}`);
    
    // Apply visual highlight effect
    element.style.transition = 'background-color 0.3s ease';
    const originalBg = element.style.backgroundColor;
    element.style.backgroundColor = 'rgba(66, 133, 244, 0.2)';
    
    setTimeout(() => {
      element.style.backgroundColor = originalBg;
    }, 500);
    
    // Call appropriate fill method based on element type
    if (element instanceof HTMLSelectElement) {
      fillSelectField(element, value);
    } else if (element.type === 'checkbox' || element.type === 'radio') {
      fillCheckboxOrRadio(element, element.type, value);
    } else {
      setInputValue(element, value);
    }
    
    console.log(`Click-to-fill: Filled ${element.tagName.toLowerCase()} with value: ${value}`);
  }
  
  // Add event listeners
  document.addEventListener('mouseover', handleMouseover, true);
  document.addEventListener('click', handleClick, true);
  document.addEventListener('scroll', updateIndicatorPosition, true);
  window.addEventListener('resize', updateIndicatorPosition, true);
  
  // Clean up function
  function cleanupClickToFill() {
    document.removeEventListener('mouseover', handleMouseover, true);
    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('scroll', updateIndicatorPosition, true);
    window.removeEventListener('resize', updateIndicatorPosition, true);
    
    if (indicator && indicator.parentNode) {
      indicator.parentNode.removeChild(indicator);
    }
    
    console.log("Click-to-fill functionality disabled");
  }
  
  console.log("Click-to-fill enabled with event listeners attached");
  
  // Return a function to disable click-to-fill
  return cleanupClickToFill;
}

/**
 * Analyze all form fields on the page
 */
function analyzeFormFields() {
  const forms = document.forms;
  const fields = [];
  
  // Process all forms on the page
  for (let i = 0; i < forms.length; i++) {
    const form = forms[i];
    
    // Process each form element
    for (let j = 0; j < form.elements.length; j++) {
      const element = form.elements[j];
      
      // Skip non-input elements like fieldsets
      if (!element.type) continue;
      
      // Skip submit, reset, and button inputs
      if (element.type === 'submit' || element.type === 'reset' || element.type === 'button') continue;
      
      // Get field information
      const field = {
        id: element.id,
        name: element.name,
        type: element.type,
        required: element.required,
        disabled: element.disabled,
        formId: form.id || `form_${i}`,
        xpath: getXPath(element)
      };
      
      // Get field label (try multiple strategies)
      field.label = getFieldLabel(element);
      
      // Handle specific field types
      if (element.type === 'select-one' || element.type === 'select-multiple') {
        field.options = getSelectOptions(element);
      } else if (element.type === 'radio') {
        // Group radio buttons by name
        const existing = fields.find(f => f.name === element.name && f.type === 'radio');
        if (existing) {
          existing.options = existing.options || [];
          existing.options.push({
            value: element.value,
            label: element.labels?.[0]?.textContent?.trim() || element.value,
            id: element.id
          });
          continue; // Skip adding this as a new field
        } else {
          field.options = [{
            value: element.value,
            label: element.labels?.[0]?.textContent?.trim() || element.value,
            id: element.id
          }];
        }
      }
      
      fields.push(field);
    }
  }
  
  return fields;
}

/**
 * Get the label text for a form field
 */
function getFieldLabel(element) {
  // Method 1: Check for label with matching 'for' attribute
  if (element.id) {
    const label = document.querySelector(`label[for="${element.id}"]`);
    if (label) return label.textContent.trim();
  }
  
  // Method 2: Check if the element is inside a label
  let parent = element.parentElement;
  while (parent) {
    if (parent.tagName === 'LABEL') {
      // Clone the label to work with
      const clone = parent.cloneNode(true);
      
      // Remove the input element from the clone to get just the label text
      const inputToRemove = clone.querySelector(`#${element.id}`);
      if (inputToRemove) inputToRemove.remove();
      
      return clone.textContent.trim();
    }
    parent = parent.parentElement;
  }
  
  // Method 3: Look for preceding label or heading
  const prevSibling = element.previousElementSibling;
  if (prevSibling && 
     (prevSibling.tagName === 'LABEL' || 
      prevSibling.tagName.match(/^H[1-6]$/))) {
    return prevSibling.textContent.trim();
  }
  
  // Method 4: Look for a nearby element with class containing "label"
  parent = element.parentElement;
  if (parent) {
    const possibleLabel = parent.querySelector('[class*="label" i], [class*="title" i]');
    if (possibleLabel) return possibleLabel.textContent.trim();
  }
  
  // Fallback to placeholder or name
  return element.placeholder || element.name || '';
}

/**
 * Get options from a select element
 */
function getSelectOptions(selectElement) {
  const options = [];
  for (let i = 0; i < selectElement.options.length; i++) {
    const option = selectElement.options[i];
    options.push({
      value: option.value,
      text: option.text,
      selected: option.selected
    });
  }
  return options;
}

/**
 * Generate XPath for an element
 */
function getXPath(element) {
  if (!element) return '';
  
  // Use id if available
  if (element.id) {
    return `//*[@id="${element.id}"]`;
  }
  
  let path = '';
  let current = element;
  
  while (current && current.nodeType === Node.ELEMENT_NODE) {
    let currentTag = current.nodeName.toLowerCase();
    let sibling = current.previousSibling;
    let siblingCount = 1;
    
    while (sibling) {
      if (sibling.nodeType === Node.ELEMENT_NODE && sibling.nodeName.toLowerCase() === currentTag) {
        siblingCount++;
      }
      sibling = sibling.previousSibling;
    }
    
    let siblingPosition = 1;
    sibling = current;
    
    while (sibling.previousSibling) {
      if (sibling.previousSibling.nodeType === Node.ELEMENT_NODE && 
          sibling.previousSibling.nodeName.toLowerCase() === currentTag) {
        siblingPosition++;
      }
      sibling = sibling.previousSibling;
    }
    
    if (siblingCount > 1) {
      path = `/${currentTag}[${siblingPosition}]${path}`;
    } else {
      path = `/${currentTag}${path}`;
    }
    
    current = current.parentNode;
  }
  
  return path;
}

/**
 * Fill a form with the provided data
 */
async function fillForm(data) {
  if (!formAnalysis) {
    throw new Error("No form analysis available. Please analyze the form first.");
  }
  
  if (!data || !data.fields) {
    throw new Error("No data provided for form filling.");
  }
  
  for (const fieldData of data.fields) {
    // Find matching field in analysis
    const fieldInfo = formAnalysis.find(field => 
      (fieldData.id && field.id === fieldData.id) ||
      (fieldData.name && field.name === fieldData.name) ||
      (fieldData.label && field.label === fieldData.label) ||
      (fieldData.xpath && field.xpath === fieldData.xpath)
    );
    
    if (!fieldInfo) {
      console.warn(`Could not find field matching: ${fieldData.label || fieldData.name || fieldData.id}`);
      continue;
    }
    
    // Find the element using the most reliable method
    let element;
    if (fieldInfo.id) {
      element = document.getElementById(fieldInfo.id);
    }
    if (!element && fieldInfo.name) {
      element = document.querySelector(`[name="${fieldInfo.name}"]`);
    }
    if (!element && fieldInfo.xpath) {
      element = getElementByXPath(fieldInfo.xpath);
    }
    
    if (!element) {
      console.warn(`Could not locate element for field: ${fieldInfo.label || fieldInfo.name || fieldInfo.id}`);
      continue;
    }
    
    // Fill the field based on its type
    switch (fieldInfo.type) {
      case 'text':
      case 'email':
      case 'tel':
      case 'number':
      case 'date':
      case 'url':
      case 'password':
      case 'textarea':
        await setInputValue(element, fieldData.value);
        break;
        
      case 'select-one':
        await selectOption(element, fieldData.value);
        break;
        
      case 'select-multiple':
        if (Array.isArray(fieldData.value)) {
          for (const value of fieldData.value) {
            await selectOption(element, value);
          }
        }
        break;
        
      case 'checkbox':
        if (fieldData.value === true || fieldData.value === 'true' || fieldData.value === '1') {
          if (!element.checked) element.click();
        } else {
          if (element.checked) element.click();
        }
        break;
        
      case 'radio':
        // For radio buttons, find the matching value
        if (fieldInfo.options) {
          const option = fieldInfo.options.find(opt => opt.value == fieldData.value);
          if (option && option.id) {
            const radioElement = document.getElementById(option.id);
            if (radioElement) radioElement.click();
          }
        }
        break;
    }
  }
  
  return true;
}

/**
 * Set value to an input field with proper events
 */
async function setInputValue(element, value) {
  // Focus the element
  element.focus();
  
  // Clear existing value
  element.value = '';
  
  // Set new value
  element.value = value;
  
  // Trigger events
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  
  // Add slight delay for stability
  await new Promise(resolve => setTimeout(resolve, 50));
}

/**
 * Select an option in a dropdown
 */
async function selectOption(selectElement, value) {
  // Find the option with matching value
  let found = false;
  for (let i = 0; i < selectElement.options.length; i++) {
    if (selectElement.options[i].value == value ||
        selectElement.options[i].text == value) {
      selectElement.selectedIndex = i;
      found = true;
      break;
    }
  }
  
  // If option not found by value/text, try setting value directly
  if (!found) {
    selectElement.value = value;
  }
  
  // Trigger change event
  selectElement.dispatchEvent(new Event('change', { bubbles: true }));
  
  // Add slight delay for stability
  await new Promise(resolve => setTimeout(resolve, 50));
}

/**
 * Fill a select element with the provided value
 */
function fillSelectField(element, value) {
  // Find the option with matching value
  let found = false;
  for (let i = 0; i < element.options.length; i++) {
    if (element.options[i].value == value ||
        element.options[i].text == value) {
      element.selectedIndex = i;
      found = true;
      break;
    }
  }
  
  // If option not found by value/text, try setting value directly
  if (!found) {
    element.value = value;
  }
  
  // Trigger change event
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Fill a checkbox or radio button with the provided value
 */
function fillCheckboxOrRadio(element, inputType, value) {
  if (inputType === 'radio') {
    // For radio buttons, find all in the same group
    const radioGroup = document.querySelectorAll(`input[type="radio"][name="${element.name}"]`);
    
    // Try to find the matching value in the group
    for (const radio of radioGroup) {
      if (radio.value === value || 
          (typeof value === 'string' && 
           (radio.value.toLowerCase() === value.toLowerCase() ||
            radio.id.toLowerCase().includes(value.toLowerCase())))) {
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
        radio.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        return;
      }
    }
    
    // If no match found, set the current radio button
    element.checked = true;
  } else if (inputType === 'checkbox') {
    // For checkboxes, use boolean logic
    if (typeof value === 'boolean') {
      element.checked = value;
    } else if (typeof value === 'string') {
      element.checked = value.toLowerCase() === 'true' || 
                       value === '1' || 
                       value.toLowerCase() === 'yes' || 
                       value === element.value ||
                       value.toLowerCase() === 'checked';
    }
  }
  
  // Trigger events
  element.dispatchEvent(new Event('change', { bubbles: true }));
  if (inputType === 'radio') {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  }
}

/**
 * Get element by XPath
 */
function getElementByXPath(xpath) {
  return document.evaluate(
    xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null
  ).singleNodeValue;
}
