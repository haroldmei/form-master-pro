// FormMaster content script for form analysis and filling

// Store form analysis results
let formAnalysis = null;

// Store field values for click-to-fill
let clickToFillValues = null;

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
  
  // Create value tooltip element
  const valueTooltip = document.createElement('div');
  valueTooltip.id = 'formmaster-value-tooltip';
  valueTooltip.style.cssText = `
    position: fixed;
    background-color: rgba(66, 133, 244, 0.25);
    color: white;
    display: none;
    z-index: 1000000;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.2s ease-in-out;
    border-radius: 4px;
    display: flex;
    justify-content: center;
    align-items: center;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    font-weight: bold;
    text-align: center;
    overflow: hidden;
  `;
  
  // Create a span for the text content to allow styling
  const valueText = document.createElement('span');
  valueText.style.cssText = `
    text-shadow: 0 0 4px #000, 0 0 6px #000, 0 0 8px rgba(0,0,0,0.8);
    padding: 4px 8px;
    color: white;
    font-weight: bold;
    background-color: rgba(0, 0, 0, 0.4);
    border-radius: 4px;
    backdrop-filter: blur(1px);
    max-width: 90%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `;
  valueTooltip.appendChild(valueText);
  
  document.body.appendChild(indicator);
  document.body.appendChild(valueTooltip);
  
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
    
    // Update tooltip position to overlay directly on the field
    valueTooltip.style.top = `${rect.top}px`;
    valueTooltip.style.left = `${rect.left}px`;
    valueTooltip.style.width = `${rect.width}px`;
    valueTooltip.style.height = `${rect.height}px`;
    
    // Adjust the text size to be double the height of the control
    const desiredFontSize = Math.max(16, rect.height * 0.7); // 70% of height, minimum 16px
    valueText.style.fontSize = `${desiredFontSize}px`;
    valueText.style.lineHeight = `${desiredFontSize}px`;
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
      valueTooltip.style.display = 'none';
      valueTooltip.style.opacity = '0';
      currentHighlightedElement = null;
      return;
    }
    
    // Ignore submit/button inputs
    if (element.type === 'submit' || element.type === 'button' || element.type === 'reset') {
      indicator.style.display = 'none';
      valueTooltip.style.display = 'none';
      valueTooltip.style.opacity = '0';
      currentHighlightedElement = null;
      return;
    }
    
    // Find matching field
    const matchingField = findMatchingField(element);
    if (!matchingField || matchingField.value === undefined) {
      indicator.style.display = 'none';
      valueTooltip.style.display = 'none';
      valueTooltip.style.opacity = '0';
      currentHighlightedElement = null;
      return;
    }
    
    // Store current element for scroll updates
    currentHighlightedElement = element;
    
    // Format the value for display
    let displayValue = matchingField.value;
    if (element.type === 'password') {
      displayValue = '•••••••••';
    } else if (displayValue === true || displayValue === 'true') {
      displayValue = '✓ Checked';
    } else if (displayValue === false || displayValue === 'false') {
      displayValue = '✗ Unchecked';
    } else if (displayValue === '') {
      displayValue = '[Empty]';
    }
    
    // Show the value in the tooltip
    valueText.textContent = displayValue;
    valueTooltip.style.display = 'flex';
    
    // Show indicator for fillable field using fixed positioning
    const rect = element.getBoundingClientRect();
    indicator.style.top = `${rect.top}px`;
    indicator.style.left = `${rect.left}px`;
    indicator.style.width = `${rect.width}px`;
    indicator.style.height = `${rect.height}px`;
    indicator.style.display = 'block';
    
    // Position the tooltip as overlay directly on the field
    valueTooltip.style.top = `${rect.top}px`;
    valueTooltip.style.left = `${rect.left}px`;
    valueTooltip.style.width = `${rect.width}px`;
    valueTooltip.style.height = `${rect.height}px`;
    
    // Adjust the text size to be double the height of the control
    const desiredFontSize = Math.max(16, rect.height * 0.7); // 70% of height, minimum 16px
    valueText.style.fontSize = `${desiredFontSize}px`;
    valueText.style.lineHeight = `${desiredFontSize}px`;
    
    // Fade in the tooltip
    setTimeout(() => {
      valueTooltip.style.opacity = '1';
    }, 10);
  }
  
  // Also update mouseout handler to hide the tooltip
  function handleMouseout(e) {
    if (e.target === currentHighlightedElement) {
      indicator.style.display = 'none';
      valueTooltip.style.opacity = '0';
      setTimeout(() => {
        if (valueTooltip.style.opacity === '0') {
          valueTooltip.style.display = 'none';
        }
      }, 200);
      currentHighlightedElement = null;
    }
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
      fillTextField_explore(element, value);
    }
    
    console.log(`Click-to-fill: Filled ${element.tagName.toLowerCase()} with value: ${value}`);
  }
  
  // Add event listeners
  document.addEventListener('mouseover', handleMouseover, true);
  document.addEventListener('mouseout', handleMouseout, true);
  document.addEventListener('click', handleClick, true);
  document.addEventListener('scroll', updateIndicatorPosition, true);
  window.addEventListener('resize', updateIndicatorPosition, true);
  
  // Clean up function
  function cleanupClickToFill() {
    document.removeEventListener('mouseover', handleMouseover, true);
    document.removeEventListener('mouseout', handleMouseout, true);
    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('scroll', updateIndicatorPosition, true);
    window.removeEventListener('resize', updateIndicatorPosition, true);
    
    if (indicator && indicator.parentNode) {
      indicator.parentNode.removeChild(indicator);
    }
    
    if (valueTooltip && valueTooltip.parentNode) {
      valueTooltip.parentNode.removeChild(valueTooltip);
    }
    
    console.log("Click-to-fill functionality disabled");
  }
  
  console.log("Click-to-fill enabled with event listeners attached");
  
  // Return a function to disable click-to-fill
  return cleanupClickToFill;
}

/**
 * Emulate keyboard typing character by character
 */
async function emulateTyping(element, text) {
  // Focus the element first
  element.focus();
  element.value = '';
  element.dispatchEvent(new Event('focus', { bubbles: true }));
  
  // Type each character with a delay
  for (let i = 0; i < text.length; i++) {
    // Get the current character
    const char = text[i];
    
    // Add the character to the current value
    const currentValue = element.value;
    element.value = currentValue + char;
    
    // Dispatch keyboard events for the character
    const keyCode = char.charCodeAt(0);
    element.dispatchEvent(new KeyboardEvent('keydown', { 
      key: char, 
      code: `Key${char.toUpperCase()}`, 
      keyCode: keyCode, 
      which: keyCode, 
      bubbles: true 
    }));
    
    element.dispatchEvent(new KeyboardEvent('keypress', { 
      key: char, 
      code: `Key${char.toUpperCase()}`, 
      keyCode: keyCode, 
      which: keyCode, 
      bubbles: true 
    }));
    
    // Dispatch input event after each character
    element.dispatchEvent(new Event('input', { bubbles: true }));
    
    element.dispatchEvent(new KeyboardEvent('keyup', { 
      key: char, 
      code: `Key${char.toUpperCase()}`, 
      keyCode: keyCode, 
      which: keyCode, 
      bubbles: true 
    }));
    
    // Short delay between characters (50-100ms makes it look realistic)
    await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 50));
  }
}


async function fillTextField_explore(element, value) {
  console.log(`Filling text field: ${element.id}, ${element.name}, ${value}`);
  
  console.log("Requesting form values from background script...");
  codeString = 
  `
  async function setTitleValue(newValue) {
    const options = ["Mr", "Ms", "Mrs", "Miss", "Mx"];
    console.log("============= Setting title value to:", newValue);

    if (options.includes(newValue)) {
      // Set hidden input
      document.getElementById("sTitle-postback").value = newValue;
  
      // Set visible value in the editable combobox
      document.getElementById("sTitle-edit").value = newValue;
  
      // Update the selection indicator (if visible)
      const indicator = document.getElementById("formmaster-indicator-sTitle-edit");
      if (indicator) {
        indicator.textContent = newValue;
      }
  
      // Optionally mark the selected option in the list visually
      document.querySelectorAll("#sTitle-list .cb_option").forEach(option => {
        option.classList.toggle("selected", option.dataset.value === newValue);
      });
    }
  }
  `;

  chrome.runtime.sendMessage({ action: "injectExplora", url: window.location.href, codeString: codeString}, function(response) {
    console.log("Received response:", response);
    if (response && response.success) {
      console.log("Filling text field with custom code");
    } else {
      console.warn("No form values available for click-to-fill");
    }
  });
  return true;
}


async function fillTextField(element, value) {
  console.log(`Filling text field: ${element.id}, ${element.name}, ${value}`);
  
  // Check if this is a dropdown/autocomplete field
  const isDropdownField = 
      element.getAttribute('role') === 'combobox' ||
      element.classList.contains('tags-input') ||
      element.classList.contains('autocomplete') ||
      element.classList.contains('ui-autocomplete-input') ||
      element.hasAttribute('list') ||
      element.getAttribute('autocomplete') === 'off' ||
      window.getComputedStyle(element).getPropertyValue('background-image').includes('dropdown');
  
  if (isDropdownField) {
    // Clear any existing value
    element.value = '';
    element.dispatchEvent(new Event('focus', { bubbles: true }));
    
    // Emulate typing for dropdown fields
    await emulateTyping(element, value);
    
    // Wait for dropdown to appear
    await new Promise(resolve => setTimeout(resolve, 300));
    
    console.log(`Filled dropdown/autocomplete field: ${element.id}, ${element.name}, ${element.value}`);
    element.style.borderLeft = '4px solid #4285f4';
    return true;
  }

  // For standard inputs, use direct setting
  element.value = value;
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  element.dispatchEvent(new Event('blur', { bubbles: true }));
  
  element.style.borderLeft = '4px solid #4285f4';
  return true;
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
