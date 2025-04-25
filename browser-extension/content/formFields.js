// FormFields Module - Manages form field-related operations
(function() {
  // Get reference to the global FormMaster object
  const FM = window.FormMaster = window.FormMaster || {};
  
  // Function to find matching field
  FM.findMatchingField = function(element) {
    let foundField = null;
    const debugInfo = {
      elementId: element.id,
      elementName: element.name,
      elementAriaLabel: element.getAttribute('aria-label'),
      elementPlaceholder: element.getAttribute('placeholder'),
      matches: []
    };
    
    // Try by ID
    if (element.id && FM.valueMap.has(element.id.toLowerCase())) {
      foundField = FM.valueMap.get(element.id.toLowerCase());
      debugInfo.matches.push(`ID match: ${element.id}`);
    }
    
    // Try by name
    if (!foundField && element.name && FM.valueMap.has(element.name.toLowerCase())) {
      foundField = FM.valueMap.get(element.name.toLowerCase());
      debugInfo.matches.push(`Name match: ${element.name}`);
    }
    
    // Try by aria-label
    const ariaLabel = element.getAttribute('aria-label');
    if (!foundField && ariaLabel && FM.valueMap.has(ariaLabel.toLowerCase())) {
      foundField = FM.valueMap.get(ariaLabel.toLowerCase());
      debugInfo.matches.push(`Aria-label match: ${ariaLabel}`);
    }
    
    // Try by label element (for="id")
    if (!foundField && element.id) {
      const label = document.querySelector(`label[for="${element.id}"]`);
      if (label && label.textContent) {
        const labelText = label.textContent.trim().toLowerCase();
        if (FM.valueMap.has(labelText)) {
          foundField = FM.valueMap.get(labelText);
          debugInfo.matches.push(`Label text match: ${labelText}`);
        } else {
          // Try with spaces removed
          const noSpaces = labelText.replace(/\s+/g, '');
          if (FM.valueMap.has(noSpaces)) {
            foundField = FM.valueMap.get(noSpaces);
            debugInfo.matches.push(`Label text (no spaces) match: ${noSpaces}`);
          } else {
            // Try partial match
            for (const [key, field] of FM.valueMap.entries()) {
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
      if (FM.valueMap.has(placeholderText)) {
        foundField = FM.valueMap.get(placeholderText);
        debugInfo.matches.push(`Placeholder match: ${placeholderText}`);
      } else {
        // Try partial match
        for (const [key, field] of FM.valueMap.entries()) {
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
  };
  
  /**
   * Fill a text field with the provided value
   */
  FM.fillTextField_explore = async function(element, value) {
    console.log(`Filling text field: ${element.id}, ${element.name}, ${value}`);
    
    console.log("Requesting form values from background script...");
    const codeString = 
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
  };
  
  /**
   * Fill a select element with the provided value
   */
  FM.fillSelectField = function(element, value) {
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
  };
  
  /**
   * Fill a checkbox or radio button with the provided value
   */
  FM.fillCheckboxOrRadio = function(element, inputType, value) {
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
  };
})(); 