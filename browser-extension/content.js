// FormMaster content script for form analysis and filling

// Store form analysis results
let formAnalysis = null;

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
  }
});

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
 * Get element by XPath
 */
function getElementByXPath(xpath) {
  return document.evaluate(
    xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null
  ).singleNodeValue;
}
