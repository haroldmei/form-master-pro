// FormMaster content script for form analysis and filling

// Store form analysis results
let formAnalysis = null;

// Store field values for click-to-fill
let clickToFillValues = null;

// Global UI elements and state
let indicator = null;
let valueTooltip = null;
let valueText = null;
let labelIndicator = null;
let optionsIndicator = null;
let currentHighlightedElement = null;
let currentHighlightedLabels = [];
let currentHighlightedOptions = [];
let currentHighlightedInputs = [];
let currentHighlightedContainer = null;
let valueMap = new Map();

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
  valueMap = new Map();
  
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
  indicator = document.createElement('div');
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
  
  // Create label highlight indicator
  labelIndicator = document.createElement('div');
  labelIndicator.id = 'formmaster-label-indicator';
  labelIndicator.style.cssText = `
    position: fixed;
    background-color: rgba(66, 133, 244, 0.1);
    border: 1px dashed rgba(66, 133, 244, 0.6);
    border-radius: 3px;
    pointer-events: none;
    display: none;
    box-shadow: 0 0 5px rgba(66, 133, 244, 0.2);
    transition: all 0.2s ease-in-out;
    z-index: 999998;
  `;
  
  // Create options highlight container for select/radio options
  optionsIndicator = document.createElement('div');
  optionsIndicator.id = 'formmaster-options-indicator';
  optionsIndicator.style.cssText = `
    position: absolute;
    pointer-events: none;
    z-index: 999997;
  `;
  
  // Create value tooltip element
  valueTooltip = document.createElement('div');
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
  valueText = document.createElement('span');
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
  document.body.appendChild(labelIndicator);
  document.body.appendChild(optionsIndicator);
  
  // Reset highlighted elements tracking
  currentHighlightedElement = null;
  currentHighlightedLabels = [];
  currentHighlightedOptions = [];
  currentHighlightedInputs = [];
  currentHighlightedContainer = null;
  
  // Add event listeners
  document.addEventListener('mouseover', handleMouseover, true);
  document.addEventListener('mouseout', handleMouseout, true);
  document.addEventListener('click', handleClick, true);
  document.addEventListener('scroll', updateIndicatorPosition, true);
  window.addEventListener('resize', updateIndicatorPosition, true);
  
  // Add event listeners for labels
  document.addEventListener('mouseover', handleLabelMouseover, true);
  document.addEventListener('mouseout', handleLabelMouseout, true);
  document.addEventListener('click', handleLabelClick, true);
  
  // Add container event listeners
  document.addEventListener('mouseover', handleContainerMouseover, true);
  document.addEventListener('mouseout', handleContainerMouseout, true);
  document.addEventListener('click', handleContainerClick, true);
  
  console.log("Click-to-fill enabled with event listeners attached");
  
  // Clean up function
  function cleanupClickToFill() {
    document.removeEventListener('mouseover', handleMouseover, true);
    document.removeEventListener('mouseout', handleMouseout, true);
    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('mouseover', handleLabelMouseover, true);
    document.removeEventListener('mouseout', handleLabelMouseout, true);
    document.removeEventListener('click', handleLabelClick, true);
    document.removeEventListener('mouseover', handleContainerMouseover, true);
    document.removeEventListener('mouseout', handleContainerMouseout, true);
    document.removeEventListener('click', handleContainerClick, true);
    document.removeEventListener('scroll', updateIndicatorPosition, true);
    window.removeEventListener('resize', updateIndicatorPosition, true);
    
    if (indicator && indicator.parentNode) {
      indicator.parentNode.removeChild(indicator);
    }
    
    if (valueTooltip && valueTooltip.parentNode) {
      valueTooltip.parentNode.removeChild(valueTooltip);
    }
    
    if (labelIndicator && labelIndicator.parentNode) {
      labelIndicator.parentNode.removeChild(labelIndicator);
    }
    
    if (optionsIndicator && optionsIndicator.parentNode) {
      optionsIndicator.parentNode.removeChild(optionsIndicator);
    }
    
    // Clear any remaining highlights
    clearLabelHighlights();
    clearOptionsHighlights();
    clearHighlightedInputs();
    clearContainerHighlight();
    
    console.log("Click-to-fill functionality disabled");
  }
  
  // Return a function to disable click-to-fill
  return cleanupClickToFill;
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

// Label event handlers
function handleLabelMouseover(e) {
  const element = e.target;
  
  // Check if this is a label or label-like element
  const isLabelOrLabelLike = 
    element.tagName === 'LABEL' || 
    (element.tagName === 'SPAN' && element.classList.contains('label')) ||
    (element.tagName === 'DIV' && element.classList.contains('label')) ||
    element.getAttribute('aria-label') !== null;
  
  if (!isLabelOrLabelLike) {
    // Only clear if it's not already being handled by input hover
    if (!currentHighlightedElement) {
      clearHighlightedInputs();
      clearLabelHighlights(); // Also clear label highlights
    }
    return;
  }
  
  // Clear any previous label highlights first
  clearLabelHighlights();
  
  // Create highlight for the label with more visible styling
  const labelHighlight = document.createElement('div');
  labelHighlight.className = 'formmaster-label-highlight';
  labelHighlight.style.cssText = `
    position: fixed;
    background-color: rgba(255, 193, 7, 0.2);
    border: 3px solid rgba(255, 153, 0, 0.8);
    border-radius: 3px;
    pointer-events: none;
    z-index: 999998;
    display: block !important;
    box-shadow: 0 0 10px rgba(255, 153, 0, 0.4);
    animation: formmaster-pulse-amber 1.5s infinite;
  `;
  
  const labelRect = element.getBoundingClientRect();
  labelHighlight.style.top = `${labelRect.top - 2}px`;
  labelHighlight.style.left = `${labelRect.left - 2}px`;
  labelHighlight.style.width = `${labelRect.width + 4}px`;
  labelHighlight.style.height = `${labelRect.height + 4}px`;
  
  // Associate the highlight element with the label
  element._highlightElement = labelHighlight;
  
  // Add label to tracked labels
  currentHighlightedLabels = [element];
  
  // Add the highlight to the DOM
  document.body.appendChild(labelHighlight);
  
  // Add amber pulse animation if it doesn't exist yet
  if (!document.getElementById('formmaster-animations') || 
      !document.getElementById('formmaster-animations').textContent.includes('formmaster-pulse-amber')) {
    const styleEl = document.getElementById('formmaster-animations') || document.createElement('style');
    styleEl.id = 'formmaster-animations';
    styleEl.textContent += `
      @keyframes formmaster-pulse-amber {
        0% { border-color: rgba(255, 153, 0, 0.8); }
        50% { border-color: rgba(255, 153, 0, 1.0); }
        100% { border-color: rgba(255, 153, 0, 0.8); }
      }
    `;
    if (!styleEl.parentNode) {
      document.head.appendChild(styleEl);
    }
  }
  
  // Find associated inputs for this label
  const associatedInputs = findAssociatedInputs(element);
  
  if (associatedInputs.length === 0) {
    clearHighlightedInputs();
    return;
  }
  
  // Highlight the associated inputs
  highlightAssociatedInputs(associatedInputs);
  
  // Register scroll and resize handlers to keep the highlights in position
  document.addEventListener('scroll', updateIndicatorPosition, { passive: true });
  window.addEventListener('resize', updateIndicatorPosition, { passive: true });
}

function handleLabelMouseout(e) {
  const element = e.target;
  
  // Check if this is a label or label-like element
  const isLabelOrLabelLike = 
    element.tagName === 'LABEL' || 
    (element.tagName === 'SPAN' && element.classList.contains('label')) ||
    (element.tagName === 'DIV' && element.classList.contains('label')) ||
    element.getAttribute('aria-label') !== null;
  
  if (!isLabelOrLabelLike) {
    return;
  }
  
  // Only clear if we're not hovering over an input
  if (!currentHighlightedElement) {
    clearHighlightedInputs();
    clearLabelHighlights(); // Also clear label highlights
  }
}

function handleLabelClick(e) {
  const element = e.target;
  
  // Check if this is a label or label-like element
  const isLabelOrLabelLike = 
    element.tagName === 'LABEL' || 
    (element.tagName === 'SPAN' && element.classList.contains('label')) ||
    (element.tagName === 'DIV' && element.classList.contains('label')) ||
    element.getAttribute('aria-label') !== null;
  
  if (!isLabelOrLabelLike) {
    return;
  }
  
  console.log('Label HTML:', element.outerHTML);
  
  // Also log details about associated inputs
  const associatedInputs = findAssociatedInputs(element);
  if (associatedInputs.length > 0) {
    console.log(`Found ${associatedInputs.length} associated input(s):`);
    associatedInputs.forEach((input, index) => {
      console.log(`Input ${index + 1}:`, input.outerHTML);
    });
  } else {
    console.log('No associated inputs found for this label');
  }
}

// Helper function to check if an element is a container based on existing criteria
function isContainerElement(element) {
  return element.tagName === 'DIV' || 
    element.tagName === 'FIELDSET' ||
    element.classList.contains('form-group') ||
    element.classList.contains('field-group') ||
    element.classList.contains('input-group') ||
    element.classList.contains('form-field') ||
    element.classList.contains('control-group') ||
    (element.tagName === 'LI' && element.querySelector('input, select, textarea'));
}

// Container event handlers
function handleContainerMouseover(e) {
  const element = e.target;
  
  // Only process container elements that aren't already being handled
  // as form controls or labels
  const isFormElement = 
    element instanceof HTMLInputElement || 
    element instanceof HTMLSelectElement || 
    element instanceof HTMLTextAreaElement ||
    element.tagName === 'LABEL' ||
    (element.tagName === 'SPAN' && element.classList.contains('label')) ||
    (element.tagName === 'DIV' && element.classList.contains('label'));
  
  if (isFormElement || currentHighlightedElement) {
    return;
  }
  
  // Check for common container classes using the helper function
  const isContainer = isContainerElement(element);
  
  if (isContainer) {
    // Check if this container has multiple sub-containers
    let subContainerCount = 0;
    const childElements = element.children;
    
    for (let i = 0; i < childElements.length; i++) {
      if (isContainerElement(childElements[i])) {
        subContainerCount++;
        if (subContainerCount > 1) {
          // Found multiple sub-containers, don't highlight
          return;
        }
      }
    }
    
    // If we get here, there are either 0 or 1 sub-containers, so highlight the container
    highlightFormContainer(element);
  }
}

function handleContainerMouseout(e) {
  // Don't clear highlight if we're moving to the buttons or child elements
  const relatedTarget = e.relatedTarget;
  
  // Check if we're moving to the container highlight or its children (buttons)
  if (currentHighlightedContainer && currentHighlightedContainer._highlightElement) {
    if (currentHighlightedContainer._highlightElement.contains(relatedTarget) || 
        relatedTarget?.classList?.contains('formmaster-container-button')) {
      // Mouse moved to the buttons or highlight element - don't clear the highlight
      return;
    }
  }
  
  // Otherwise proceed with normal clearing
  if (currentHighlightedContainer === e.target) {
    clearContainerHighlight();
  }
}

function handleContainerClick(e) {
  const element = e.target;
  
  // Check if this is one of our buttons - if so, don't process further
  if (element.classList.contains('formmaster-container-button')) {
    return;
  }
  
  // Only process container elements that aren't already being handled
  // as form controls or labels
  const isFormElement = 
    element instanceof HTMLInputElement || 
    element instanceof HTMLSelectElement || 
    element instanceof HTMLTextAreaElement ||
    element.tagName === 'LABEL' ||
    (element.tagName === 'SPAN' && element.classList.contains('label')) ||
    (element.tagName === 'DIV' && element.classList.contains('label'));
  
  if (isFormElement) {
    return;
  }
  
  // Check for common container classes - same logic as in handleContainerMouseover
  const isContainer = 
    element.tagName === 'DIV' || 
    element.tagName === 'FIELDSET' ||
    element.classList.contains('form-group') ||
    element.classList.contains('field-group') ||
    element.classList.contains('input-group') ||
    element.classList.contains('form-field') ||
    element.classList.contains('control-group') ||
    (element.tagName === 'LI' && element.querySelector('input, select, textarea'));
  
  if (isContainer) {      
    console.group('Form Container Content');
    console.log('Container element:', element);
    console.groupEnd();
  }
}

// Form element event handlers
function handleMouseover(e) {
  const element = e.target;
  
  // Only handle input elements, selects, and textareas
  if (!(element instanceof HTMLInputElement || 
        element instanceof HTMLSelectElement || 
        element instanceof HTMLTextAreaElement)) {
    indicator.style.display = 'none';
    valueTooltip.style.display = 'none';
    valueTooltip.style.opacity = '0';
    clearLabelHighlights();
    clearOptionsHighlights();
    currentHighlightedElement = null;
    return;
  }
  
  // Ignore submit/button inputs
  if (element.type === 'submit' || element.type === 'button' || element.type === 'reset') {
    indicator.style.display = 'none';
    valueTooltip.style.display = 'none';
    valueTooltip.style.opacity = '0';
    clearLabelHighlights();
    clearOptionsHighlights();
    currentHighlightedElement = null;
    return;
  }
  
  // Find matching field
  const matchingField = findMatchingField(element);
  if (!matchingField || matchingField.value === undefined) {
    indicator.style.display = 'none';
    valueTooltip.style.display = 'none';
    valueTooltip.style.opacity = '0';
    clearLabelHighlights();
    clearOptionsHighlights();
    currentHighlightedElement = null;
    return;
  }
  
  // Store current element for scroll updates
  currentHighlightedElement = element;
  
  // Find and highlight labels and options
  findAndHighlightLabels(element);
  findAndHighlightOptions(element);
  
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

function handleMouseout(e) {
  if (e.target === currentHighlightedElement) {
    indicator.style.display = 'none';
    valueTooltip.style.opacity = '0';
    clearLabelHighlights();
    clearOptionsHighlights();
    setTimeout(() => {
      if (valueTooltip.style.opacity === '0') {
        valueTooltip.style.display = 'none';
      }
    }, 200);
    currentHighlightedElement = null;
  }
}

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

// Function to find and highlight labels associated with an element
function findAndHighlightLabels(element) {
  // Clear any previous label highlights
  clearLabelHighlights();
  
  // Try to find labels for this element
  let labels = [];
  
  // 1. Check for label with 'for' attribute matching element id
  if (element.id) {
    const forLabels = document.querySelectorAll(`label[for="${element.id}"]`);
    forLabels.forEach(label => labels.push(label));
  }
  
  // 2. Check for label as parent
  let parent = element.parentElement;
  while (parent && parent.tagName !== 'FORM' && parent.tagName !== 'BODY' && labels.length < 3) {
    if (parent.tagName === 'LABEL') {
      labels.push(parent);
    }
    parent = parent.parentElement;
  }
  
  // 3. Check for aria-labelledby
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    labelledBy.split(' ').forEach(id => {
      const labelElement = document.getElementById(id);
      if (labelElement) {
        labels.push(labelElement);
      }
    });
  }
  
  // 4. Check for label-like elements nearby
  const siblings = Array.from(element.parentElement?.children || []);
  siblings.forEach(sibling => {
    if ((sibling.tagName === 'SPAN' || sibling.tagName === 'DIV' || sibling.tagName === 'P') && 
        !sibling.contains(element) && 
        labels.length < 3) {
      const rect1 = element.getBoundingClientRect();
      const rect2 = sibling.getBoundingClientRect();
      const horizontalDistance = Math.min(
        Math.abs(rect1.left - rect2.right),
        Math.abs(rect1.right - rect2.left)
      );
      const verticalDistance = Math.min(
        Math.abs(rect1.top - rect2.bottom),
        Math.abs(rect1.bottom - rect2.top)
      );
      
      // Consider as label if close enough
      if ((horizontalDistance < 50 && verticalDistance < 30) || 
          (horizontalDistance < 20 && verticalDistance < 100)) {
        labels.push(sibling);
      }
    }
  });
  
  // Create highlight elements for each label
  labels.forEach(label => {
    const labelHighlight = document.createElement('div');
    labelHighlight.className = 'formmaster-label-highlight';
    labelHighlight.style.cssText = `
      position: fixed;
      background-color: rgba(66, 133, 244, 0.1);
      border: 1px dashed rgba(66, 133, 244, 0.6);
      border-radius: 3px;
      pointer-events: none;
      z-index: 999998;
      display: block;
    `;
    
    const labelRect = label.getBoundingClientRect();
    labelHighlight.style.top = `${labelRect.top}px`;
    labelHighlight.style.left = `${labelRect.left}px`;
    labelHighlight.style.width = `${labelRect.width}px`;
    labelHighlight.style.height = `${labelRect.height}px`;
    
    // Associate the highlight element with the label for later updates
    label._highlightElement = labelHighlight;
    
    document.body.appendChild(labelHighlight);
  });
  
  currentHighlightedLabels = labels;
}

// Function to find and highlight options for select elements or radio groups
function findAndHighlightOptions(element) {
  // Clear any previous options highlights
  clearOptionsHighlights();
  
  let options = [];
  
  // For select elements, find the options
  if (element instanceof HTMLSelectElement) {
    // Get all option elements in the select
    Array.from(element.options).forEach(option => {
      options.push(option);
    });
    
    // If the select has a visible dropdown, try to find its options
    const selectRect = element.getBoundingClientRect();
    
    // Look for visible dropdown options (for custom select elements)
    document.querySelectorAll('.select-options, .dropdown-menu, [role="listbox"], ul.options')
      .forEach(optionContainer => {
        const containerRect = optionContainer.getBoundingClientRect();
        
        // Check if container is near the select element
        if (Math.abs(containerRect.top - selectRect.bottom) < 30 || 
            Math.abs(containerRect.left - selectRect.left) < 50) {
          Array.from(optionContainer.children).forEach(option => {
            options.push(option);
          });
        }
      });
  }
  
  // For radio buttons, find other buttons in the same group
  if (element instanceof HTMLInputElement && element.type === 'radio') {
    const name = element.name;
    if (name) {
      document.querySelectorAll(`input[type="radio"][name="${name}"]`).forEach(radio => {
        if (radio !== element) {
          options.push(radio);
          
          // Also include labels for these radio buttons
          if (radio.id) {
            const radioLabel = document.querySelector(`label[for="${radio.id}"]`);
            if (radioLabel) options.push(radioLabel);
          }
        }
      });
    }
  }
  
  // Create highlight elements for each option
  options.forEach(option => {
    if (!option || !option.getBoundingClientRect) return;
    
    const optionHighlight = document.createElement('div');
    optionHighlight.className = 'formmaster-option-highlight';
    optionHighlight.style.cssText = `
      position: fixed;
      background-color: rgba(66, 133, 244, 0.05);
      border: 1px dotted rgba(66, 133, 244, 0.4);
      border-radius: 2px;
      pointer-events: none;
      z-index: 999997;
      display: block;
    `;
    
    const optionRect = option.getBoundingClientRect();
    optionHighlight.style.top = `${optionRect.top}px`;
    optionHighlight.style.left = `${optionRect.left}px`;
    optionHighlight.style.width = `${optionRect.width}px`;
    optionHighlight.style.height = `${optionRect.height}px`;
    
    // Associate the highlight element with the option for later updates
    option._highlightElement = optionHighlight;
    
    document.body.appendChild(optionHighlight);
  });
  
  currentHighlightedOptions = options;
}

// Function to detect and highlight containers with form elements
function highlightFormContainer(element) {
  // First, check if we're already on a form control - if so, don't try to highlight containers
  if (element instanceof HTMLInputElement || 
      element instanceof HTMLSelectElement || 
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLLabelElement) {
    return;
  }
  
  // Check if this element contains form controls
  const formControls = element.querySelectorAll('input, select, textarea');
  if (formControls.length === 0) {
    return;
  }
  
  // Clean any previous container highlight
  clearContainerHighlight();
  
  const rect = element.getBoundingClientRect();
  
  // Create highlight for the container
  const containerHighlight = document.createElement('div');
  containerHighlight.className = 'formmaster-container-highlight';
  containerHighlight.style.cssText = `
    position: fixed;
    background-color: rgba(76, 175, 80, 0.1);
    border: 2px dashed rgba(76, 175, 80, 0.7);
    border-radius: 4px;
    pointer-events: none;
    z-index: 999995;
    display: block;
    box-shadow: 0 0 5px rgba(76, 175, 80, 0.3);
  `;
  
  containerHighlight.style.top = `${rect.top}px`;
  containerHighlight.style.left = `${rect.left}px`;
  containerHighlight.style.width = `${rect.width}px`;
  containerHighlight.style.height = `${rect.height}px`;
  
  // Create control buttons container (allows proper positioning)
  const buttonsContainer = document.createElement('div');
  buttonsContainer.className = 'formmaster-buttons-container';
  buttonsContainer.style.cssText = `
    position: absolute;
    top: 10px;
    right: 10px;
    display: flex;
    gap: 6px;
    padding: 5px;
    pointer-events: auto;
    z-index: 999999;
    background-color: rgba(255, 255, 255, 0.8);
    border-radius: 4px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
  `;
  
  // Create Analyse button
  const analyseButton = document.createElement('button');
  analyseButton.className = 'formmaster-container-button formmaster-analyse-button';
  analyseButton.textContent = 'Analyse';
  analyseButton.style.cssText = `
    background-color: #4285f4;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 4px 8px;
    font-size: 12px;
    cursor: pointer;
    font-weight: bold;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    transition: all 0.2s;
  `;
  analyseButton.addEventListener('mouseover', () => {
    analyseButton.style.backgroundColor = '#2b76f5';
  });
  analyseButton.addEventListener('mouseout', () => {
    analyseButton.style.backgroundColor = '#4285f4';
  });
  analyseButton.addEventListener('click', (e) => {
    e.stopPropagation();
    analyseContainer(element);
  });
  
  // Create Fill button
  const fillButton = document.createElement('button');
  fillButton.className = 'formmaster-container-button formmaster-fill-button';
  fillButton.textContent = 'Fill';
  fillButton.style.cssText = `
    background-color: #34a853;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 4px 8px;
    font-size: 12px;
    cursor: pointer;
    font-weight: bold;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    transition: all 0.2s;
  `;
  fillButton.addEventListener('mouseover', () => {
    fillButton.style.backgroundColor = '#2d9249';
  });
  fillButton.addEventListener('mouseout', () => {
    fillButton.style.backgroundColor = '#34a853';
  });
  fillButton.addEventListener('click', (e) => {
    e.stopPropagation();
    fillContainer(element);
  });
  
  // Add buttons to container
  buttonsContainer.appendChild(analyseButton);
  buttonsContainer.appendChild(fillButton);
  containerHighlight.appendChild(buttonsContainer);
  
  // Associate the highlight element with the container
  element._highlightElement = containerHighlight;
  currentHighlightedContainer = element;
  
  document.body.appendChild(containerHighlight);
}

// Function to analyse a container's form elements
function analyseContainer(container) {
  const inputs = container.querySelectorAll('input, select, textarea');
  const labels = container.querySelectorAll('label');
  
  console.group('📊 Form Container Analysis');
  console.log('Container element:', container);
  console.groupEnd();
}

// Function to attempt to fill all form elements in a container
function fillContainer(container) {
  const inputs = container.querySelectorAll('input, select, textarea');
  
  console.group('🖊️ Form Container Fill');
  console.log(`Attempting to fill ${inputs.length} form fields in container:`);
  console.log(container);
  
  let filledCount = 0;
  
  inputs.forEach(input => {
    // Skip submit/button/image/reset inputs
    if (input instanceof HTMLInputElement && 
        (input.type === 'submit' || input.type === 'button' || 
         input.type === 'image' || input.type === 'reset')) {
      return;
    }
    
    // Find matching field
    const matchingField = findMatchingField(input);
    if (!matchingField || matchingField.value === undefined) {
      console.log(`No match found for:`, input);
      return;
    }
    
    // Fill the field based on its type
    try {
      const value = matchingField.value;
      
      // Apply visual highlight effect
      const originalBg = input.style.backgroundColor;
      input.style.transition = 'background-color 0.3s ease';
      input.style.backgroundColor = 'rgba(66, 133, 244, 0.2)';
      
      setTimeout(() => {
        input.style.backgroundColor = originalBg;
      }, 500);
      
      if (input instanceof HTMLSelectElement) {
        fillSelectField(input, value);
        filledCount++;
      } else if (input.type === 'checkbox' || input.type === 'radio') {
        fillCheckboxOrRadio(input, input.type, value);
        filledCount++;
      } else {
        fillTextField_explore(input, value);
        filledCount++;
      }
      
      console.log(`Filled ${input.tagName.toLowerCase()} with value: ${value}`, input);
    } catch (err) {
      console.error(`Error filling field:`, err);
    }
  });
  
  console.log(`Successfully filled ${filledCount} out of ${inputs.length} fields`);
  console.groupEnd();
}

// Function to clear label highlights
function clearLabelHighlights() {
  currentHighlightedLabels.forEach(label => {
    if (label && label._highlightElement && label._highlightElement.parentNode) {
      label._highlightElement.parentNode.removeChild(label._highlightElement);
      delete label._highlightElement;
    }
  });
  currentHighlightedLabels = [];
}

// Function to clear options highlights
function clearOptionsHighlights() {
  currentHighlightedOptions.forEach(option => {
    if (option && option._highlightElement && option._highlightElement.parentNode) {
      option._highlightElement.parentNode.removeChild(option._highlightElement);
      delete option._highlightElement;
    }
  });
  currentHighlightedOptions = [];
}

// Function to clear highlighted inputs
function clearHighlightedInputs() {
  currentHighlightedInputs.forEach(input => {
    if (input && input._highlightElement && input._highlightElement.parentNode) {
      input._highlightElement.parentNode.removeChild(input._highlightElement);
      delete input._highlightElement;
    }
  });
  currentHighlightedInputs = [];
}

// Function to clear container highlight
function clearContainerHighlight() {
  if (currentHighlightedContainer && currentHighlightedContainer._highlightElement) {
    if (currentHighlightedContainer._highlightElement.parentNode) {
      currentHighlightedContainer._highlightElement.parentNode.removeChild(
        currentHighlightedContainer._highlightElement
      );
    }
    delete currentHighlightedContainer._highlightElement;
    currentHighlightedContainer = null;
  }
}

// Function to highlight input elements when hovering over a label
function highlightAssociatedInputs(inputs) {
  clearHighlightedInputs();
  
  inputs.forEach(input => {
    const inputHighlight = document.createElement('div');
    inputHighlight.className = 'formmaster-input-highlight';
    inputHighlight.style.cssText = `
      position: fixed;
      background-color: rgba(66, 133, 244, 0.1);
      border: 2px solid rgba(66, 133, 244, 0.6);
      border-radius: 4px;
      pointer-events: none;
      z-index: 999999;
      display: block;
    `;
    
    const inputRect = input.getBoundingClientRect();
    inputHighlight.style.top = `${inputRect.top}px`;
    inputHighlight.style.left = `${inputRect.left}px`;
    inputHighlight.style.width = `${inputRect.width}px`;
    inputHighlight.style.height = `${inputRect.height}px`;
    
    input._highlightElement = inputHighlight;
    document.body.appendChild(inputHighlight);
  });
  
  currentHighlightedInputs = inputs;
}

// Function to update indicator position
function updateIndicatorPosition() {
  // Update main indicator if active
  if (currentHighlightedElement && indicator.style.display !== 'none') {
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
  
  // Update label indicators positions
  updateLabelIndicatorsPositions();
  
  // Update options indicators positions
  updateOptionsIndicatorsPositions();
  
  // Update input highlights positions
  updateInputHighlightsPositions();
  
  // Update container highlight if active
  if (currentHighlightedContainer && currentHighlightedContainer._highlightElement) {
    const containerRect = currentHighlightedContainer.getBoundingClientRect();
    const containerHighlight = currentHighlightedContainer._highlightElement;
    
    containerHighlight.style.top = `${containerRect.top}px`;
    containerHighlight.style.left = `${containerRect.left}px`;
    containerHighlight.style.width = `${containerRect.width}px`;
    containerHighlight.style.height = `${containerRect.height}px`;
  }
}

// Function to update label indicators positions
function updateLabelIndicatorsPositions() {
  currentHighlightedLabels.forEach(label => {
    if (label && label.getBoundingClientRect) {
      const labelRect = label.getBoundingClientRect();
      const highlightEl = label._highlightElement;
      if (highlightEl) {
        highlightEl.style.top = `${labelRect.top}px`;
        highlightEl.style.left = `${labelRect.left}px`;
        highlightEl.style.width = `${labelRect.width}px`;
        highlightEl.style.height = `${labelRect.height}px`;
      }
    }
  });
}

// Function to update options indicators positions
function updateOptionsIndicatorsPositions() {
  currentHighlightedOptions.forEach(option => {
    if (option && option.getBoundingClientRect) {
      const optionRect = option.getBoundingClientRect();
      const highlightEl = option._highlightElement;
      if (highlightEl) {
        highlightEl.style.top = `${optionRect.top}px`;
        highlightEl.style.left = `${optionRect.left}px`;
        highlightEl.style.width = `${optionRect.width}px`;
        highlightEl.style.height = `${optionRect.height}px`;
      }
    }
  });
}

// Function to update input highlights positions
function updateInputHighlightsPositions() {
  currentHighlightedInputs.forEach(input => {
    if (input && input.getBoundingClientRect) {
      const inputRect = input.getBoundingClientRect();
      const highlightEl = input._highlightElement;
      if (highlightEl) {
        highlightEl.style.top = `${inputRect.top}px`;
        highlightEl.style.left = `${inputRect.left}px`;
        highlightEl.style.width = `${inputRect.width}px`;
        highlightEl.style.height = `${inputRect.height}px`;
      }
    }
  });
}
