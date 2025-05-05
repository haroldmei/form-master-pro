/**
 * Form filling module
 */
const formFiller = (() => {
  // Define field types for priority ordering (checkboxes first, then radios, etc.)
  const fieldTypes = {
    checkbox: 1,  // Highest priority - may show/hide other fields
    radio: 2,     // High priority - may affect form sections
    select: 3,    // Medium priority
    date: 4,      // Lower priority
    text: 5       // Lowest priority
  };

  // Helper function to determine field type priority
  function getFieldTypePriority(field, priorityMap = fieldTypes) {
    // Get field type from field object
    const fieldType = (field.type || '').toLowerCase();
    
    // Exact match for known types
    if (fieldType in priorityMap) {
      return priorityMap[fieldType];
    }
    
    // Check for date-type inputs
    if (field.isDateInput || fieldType.includes('date')) {
      return priorityMap.date;
    }
    
    // For input fields, check by input type
    if (fieldType.startsWith('text') || 
        fieldType === 'email' || 
        fieldType === 'number' || 
        fieldType === 'password' || 
        fieldType === 'textarea') {
      return priorityMap.text;
    }
    
    // Check field identifiers for clues if type is ambiguous
    const identifiers = [
      field.id, 
      field.name, 
      field.label
    ].filter(Boolean).map(str => str.toLowerCase());
    
    // Look for type hints in identifiers
    for (const id of identifiers) {
      if (id.includes('checkbox')) return priorityMap.checkbox;
      if (id.includes('radio')) return priorityMap.radio;
      if (id.includes('select') || id.includes('dropdown')) return priorityMap.select;
      if (id.includes('date')) return priorityMap.date;
    }
    
    // Default to text (lowest priority)
    return priorityMap.text;
  }

  // Helper function to check if an element is hidden
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
    
    // Check if any parent is hidden
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

  function findFillableElement(field) {
    const { id, label, ariaLabel, name, type, value, aiGenerated } = field;
    console.log(`Finding fillable element for: ${id} ${name} ${label}, aria: ${ariaLabel}, value: ${value}`);

    if (value === null || value === undefined) {
      console.warn(`Skipping field with missing value: ${id || name || label}`);
      return null;
    }

    let element = null;

    if (id) {
      element = document.getElementById(id);
    }

    if (!element && label) {
      const labels = Array.from(document.querySelectorAll('label')).filter(
        l => l.textContent.trim().toLowerCase().includes(label.toLowerCase())
      );

      for (const foundLabel of labels) {
        if (foundLabel.htmlFor) {
          const labeledElement = document.getElementById(foundLabel.htmlFor);
          if (labeledElement) {
            element = labeledElement;
            break;
          }
        }
      }
    }

    if (!element && ariaLabel) {
      element = document.querySelector(`[aria-label="${ariaLabel}"]`);
      if (!element) {
        element = document.querySelector(`[aria-labelledby="${ariaLabel}"]`);
      }
    }

    if (!element && name) {
      element = document.querySelector(`[name="${name}"]`);
    }

    if (!element) {
      element = document.querySelector(`input[placeholder*="${label}"], textarea[placeholder*="${label}"]`);

      if (!element) {
        element = document.querySelector(`[aria-label*="${label}"]`);
      }
    }

    if (!element) {
      console.warn(`Element not found for: ${id || name || label}`);
      return null;
    }

    return element;
  }

  function findRadioButton(name, value) {
    const exactMatch = document.querySelector(`input[type="radio"][name="${name}"][value="${value}"]`);
    if (exactMatch) return exactMatch;

    if (typeof value === 'string') {
      if (value.toLowerCase() === 'yes' || value.toLowerCase() === 'y') {
        const yesRadio = document.querySelector(`input[type="radio"][name="${name}"][value="yes"], 
                                               input[type="radio"][name="${name}"][value="Yes"], 
                                               input[type="radio"][name="${name}"][value="Y"], 
                                               input[type="radio"][name="${name}"][value="y"], 
                                               input[type="radio"][name="${name}"][value="true"], 
                                               input[type="radio"][name="${name}"][value="1"]`);
        if (yesRadio) return yesRadio;
      } else if (value.toLowerCase() === 'no' || value.toLowerCase() === 'n') {
        const noRadio = document.querySelector(`input[type="radio"][name="${name}"][value="no"], 
                                              input[type="radio"][name="${name}"][value="No"], 
                                              input[type="radio"][name="${name}"][value="N"], 
                                              input[type="radio"][name="${name}"][value="n"], 
                                              input[type="radio"][name="${name}"][value="false"], 
                                              input[type="radio"][name="${name}"][value="0"]`);
        if (noRadio) return noRadio;
      }

      const allRadios = document.querySelectorAll(`input[type="radio"][name="${name}"]`);
      for (const radio of allRadios) {
        const dataAttributes = Array.from(radio.attributes)
          .filter(attr => attr.name.startsWith('data-'))
          .map(attr => attr.value.toLowerCase());

        if (dataAttributes.some(attr =>
          attr.includes(value.toLowerCase()) ||
          value.toLowerCase().includes(attr))) {
          console.log(`Found radio match through data attribute: ${radio.id}`);
          return radio;
        }

        if (radio.dataset.analyticsid &&
          radio.dataset.analyticsid.toLowerCase().includes(value.toLowerCase())) {
          console.log(`Found radio match through analytics ID: ${radio.dataset.analyticsid}`);
          return radio;
        }
      }

      const radioGroups = document.querySelectorAll('[role="radiogroup"]');
      for (const group of radioGroups) {
        const groupRadios = group.querySelectorAll(`input[type="radio"][name="${name}"]`);
        if (groupRadios.length === 0) continue;

        for (const radio of groupRadios) {
          let label = null;

          if (radio.id) {
            label = group.querySelector(`label[for="${radio.id}"]`);
          }

          if (!label) {
            const radioParent = radio.parentElement;
            if (radioParent) {
              label = radioParent.querySelector('label');
            }
          }

          if (label && label.textContent.trim().toLowerCase() === value.toLowerCase()) {
            console.log(`Found radio match in ARIA radiogroup by label: ${label.textContent}`);
            return radio;
          }

          if (label && label.textContent.trim().toLowerCase().includes(value.toLowerCase())) {
            console.log(`Found partial radio match in ARIA radiogroup: ${label.textContent}`);
            return radio;
          }
        }
      }

      for (const radio of allRadios) {
        let label = null;

        if (radio.id) {
          label = document.querySelector(`label[for="${radio.id}"]`);
        }

        if (!label) {
          let parent = radio.parentElement;
          while (parent && parent.tagName !== 'LABEL' &&
            !parent.classList.contains('form-check') &&
            !parent.classList.contains('radio')) {
            parent = parent.parentElement;
          }

          if (parent) {
            label = parent.tagName === 'LABEL' ? parent : parent.querySelector('label');
          }

          if (!label) {
            let sibling = radio.nextElementSibling;
            if (sibling && sibling.tagName === 'LABEL') {
              label = sibling;
            }
          }
        }

        if (label && label.textContent.trim().toLowerCase() === value.toLowerCase()) {
          return radio;
        }
      }
    }

    return null;
  }

  // Function to add visual effect styles to the page
  function addVisualEffectStyles() {
    console.log("Adding visual effect styles to the page");

    
    if (document.getElementById('form-fill-effects')) return;
    
    const styleEl = document.createElement('style');
    styleEl.id = 'form-fill-effects';
    styleEl.textContent = `
      @keyframes formFillPulse {
        0% { box-shadow: 0 0 0 0 rgba(66, 133, 244, 0.7); }
        50% { box-shadow: 0 0 0 15px rgba(66, 133, 244, 0); }
        100% { box-shadow: 0 0 0 0 rgba(66, 133, 244, 0); }
      }
      
      @keyframes formFillHighlight {
        0% { background-color: rgba(66, 133, 244, 0); }
        30% { background-color: rgba(66, 133, 244, 0.4); }
        70% { background-color: rgba(66, 133, 244, 0.4); }
        100% { background-color: rgba(66, 133, 244, 0); }
      }
      
      @keyframes formFillSuccess {
        0% { border-left-color: #4285f4; border-left-width: 0px; }
        100% { border-left-color: #4285f4; border-left-width: 4px; }
      }
      
      @keyframes formFillBorder {
        0% { outline: 0px solid rgba(66, 133, 244, 0); }
        25% { outline: 3px solid rgba(66, 133, 244, 0.7); }
        75% { outline: 3px solid rgba(66, 133, 244, 0.7); }
        100% { outline: 0px solid rgba(66, 133, 244, 0); }
      }
      
      .form-fill-highlight {
        animation: formFillHighlight 1.5s ease-out forwards, formFillBorder 1.5s ease-out forwards;
        transition: all 0.3s ease;
        z-index: 9999;
        position: relative;
      }
      
      .form-fill-pulse {
        animation: formFillPulse 1.2s ease-out forwards;
        z-index: 9999;
        position: relative;
      }
      
      .form-fill-success {
        animation: formFillSuccess 0.5s ease-out forwards;
        border-left: 4px solid #4285f4;
      }
      
      /* Special styling for select elements */
      select.form-fill-highlight {
        transition: all 0.3s ease;
        background-image: linear-gradient(to bottom, rgba(66, 133, 244, 0.3), rgba(66, 133, 244, 0.1));
      }
      
      /* For checkbox groups */
      .form-check.active-fill, .checkbox-wrapper.active-fill, label.active-fill {
        background-color: rgba(66, 133, 244, 0.2) !important;
        box-shadow: 0 0 8px rgba(66, 133, 244, 0.5) !important;
        transition: all 0.5s ease;
      }
      
      /* Make sure highlights are visible over everything */
      .form-fill-highlight:after {
        content: '';
        position: absolute;
        top: -3px;
        left: -3px;
        right: -3px;
        bottom: -3px;
        border: 2px solid rgba(66, 133, 244, 0.7);
        border-radius: 5px;
        pointer-events: none;
        opacity: 0;
        animation: formFillBorder 1.5s ease-out forwards;
      }
    `;
    
    document.head.appendChild(styleEl);
  }

  // Function to apply visual effects based on element type
  function addVisualEffect(element, tagName, inputType) {
    try {
      // Remove previous animations if any
      element.classList.remove('form-fill-highlight', 'form-fill-pulse');
      
      // Scroll element into view if not already visible
      const rect = element.getBoundingClientRect();
      const isInViewport = (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
      );
      
      if (!isInViewport) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      
      // Find container for checkbox/radio for better visual effect
      let container = null;
      if (inputType === 'checkbox' || inputType === 'radio') {
        container = element.closest('.form-check, .checkbox-wrapper, label') || 
                   element.parentElement;
      }
      
      // Apply specific animation based on element type
      if (tagName === 'select') {
        element.classList.add('form-fill-highlight');
        
        // Add temporary highlight background for better visibility
        const originalBackground = element.style.background;
        element.style.background = 'rgba(66, 133, 244, 0.2)';
        
        setTimeout(() => {
          element.style.background = originalBackground;
        }, 1500);
        
      } else if (inputType === 'checkbox' || inputType === 'radio') {
        element.classList.add('form-fill-pulse');
        
        // Also highlight the container if found
        if (container) {
          container.classList.add('form-fill-highlight', 'active-fill');
          
          // Store original background to restore later
          const originalBackground = container.style.background;
          container.style.background = 'rgba(66, 133, 244, 0.2)';
          
          setTimeout(() => {
            container.classList.remove('active-fill');
            container.style.background = originalBackground;
          }, 1500);
        }
        
        // If there's an associated label, highlight it too with a strong effect
        if (element.id) {
          const label = document.querySelector(`label[for="${element.id}"]`);
          if (label) {
            label.classList.add('form-fill-highlight', 'active-fill');
            setTimeout(() => label.classList.remove('active-fill'), 1500);
          }
        }
      } else {
        // For text fields, textareas, etc. - add a stronger highlight
        element.classList.add('form-fill-highlight');
        
        // Store original values to restore later
        const originalBackground = element.style.background;
        const originalBoxShadow = element.style.boxShadow;
        
        // Apply temporary stronger highlighting
        element.style.background = 'rgba(66, 133, 244, 0.2)';
        element.style.boxShadow = '0 0 8px rgba(66, 133, 244, 0.7)';
        
        setTimeout(() => {
          // Restore original styling after animation completes
          element.style.background = originalBackground;
          element.style.boxShadow = originalBoxShadow;
        }, 1500);
      }
      
      // Remove highlight classes after animation completes
      setTimeout(() => {
        element.classList.remove('form-fill-highlight', 'form-fill-pulse');
        
        // Also remove from container and label
        if (container) {
          container.classList.remove('form-fill-highlight');
        }
        
        if (element.id && (inputType === 'checkbox' || inputType === 'radio')) {
          const label = document.querySelector(`label[for="${element.id}"]`);
          if (label) label.classList.remove('form-fill-highlight');
        }
        
        // Add success marking
        if (tagName !== 'select' && !(inputType === 'checkbox' || inputType === 'radio')) {
          element.classList.add('form-fill-success');
        }
      }, 1500);
    } catch (e) {
      console.error('Error applying visual effect:', e);
    }
  }

  function fillSelectField(element, value) {
    if (element.style.display === 'none') {
      console.log(`Hidden select detected with id: ${element.id}, trying enhanced handling`);
      return updateEnhancedSelect(element, value);
    } else {
      const options = Array.from(element.options);
      const option = options.find(opt =>
        opt.value === value ||
        opt.text === value ||
        opt.textContent.trim() === value
      );

      if (option) {
        element.value = option.value;
        element.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
      return false;
    }
  }

  function fillCheckboxOrRadio(element, inputType, value) {
    if (inputType === 'radio') {
      console.log(`Handling radio button: ${element.name} with value: ${value}`);

      if (typeof value === 'string') {
        const radioButton = findRadioButton(element.name, value);
        if (radioButton) {
          radioButton.checked = true;
          radioButton.dispatchEvent(new Event('change', { bubbles: true }));
          radioButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          console.log(`Selected radio option with value: ${value}`);
          return true;
        } else {
          console.warn(`Could not find radio button with name ${element.name} and value ${value}`);
        }

        if (['yes', 'y', 'true', '1'].includes(value.toLowerCase())) {
          const yesOptions = document.querySelectorAll(`input[type="radio"][name="${element.name}"]`);
          for (const option of yesOptions) {
            if (['yes', 'y', '1', 'true'].includes(option.value.toLowerCase()) ||
              option.id.toLowerCase().includes('yes') ||
              option.id.toLowerCase().includes('y')) {
              option.checked = true;
              option.dispatchEvent(new Event('change', { bubbles: true }));
              option.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
              console.log(`Selected radio yes option: ${option.value}`);
              return true;
            }

            if (option.id) {
              const label = document.querySelector(`label[for="${option.id}"]`);
              if (label && ['yes', 'y'].includes(label.textContent.trim().toLowerCase())) {
                option.checked = true;
                option.dispatchEvent(new Event('change', { bubbles: true }));
                option.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                console.log(`Selected radio yes option by label: ${label.textContent}`);
                return true;
              }
            }
          }
        }

        if (['no', 'n', 'false', '0'].includes(value.toLowerCase())) {
          const noOptions = document.querySelectorAll(`input[type="radio"][name="${element.name}"]`);
          for (const option of noOptions) {
            if (['no', 'n', '0', 'false'].includes(option.value.toLowerCase()) ||
              option.id.toLowerCase().includes('no') ||
              option.id.toLowerCase().includes('n')) {
              option.checked = true;
              option.dispatchEvent(new Event('change', { bubbles: true }));
              option.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
              console.log(`Selected radio no option: ${option.value}`);
              return true;
            }

            if (option.id) {
              const label = document.querySelector(`label[for="${option.id}"]`);
              if (label && ['no', 'n'].includes(label.textContent.trim().toLowerCase())) {
                option.checked = true;
                option.dispatchEvent(new Event('change', { bubbles: true }));
                option.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                console.log(`Selected radio no option by label: ${label.textContent}`);
                return true;
              }
            }
          }
        }
      }
    }

    if (typeof value === 'boolean') {
      element.checked = value;
    } else if (typeof value === 'string') {
      element.checked = value.toLowerCase() === 'true' ||
        value === '1' ||
        value.toLowerCase() === 'yes' ||
        value === element.value ||
        value.toLowerCase() === 'checked';
    }
    
    element.dispatchEvent(new Event('change', { bubbles: true }));
    if (inputType === 'radio') {
      element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    }

    // After filling the checkbox/radio, enhance the container styling
    if (inputType === 'radio') {
      // Find the radio group container for better visual feedback
      const radioGroup = element.closest('.radio-group, fieldset, .form-group');
      if (radioGroup) {
        radioGroup.style.backgroundColor = 'rgba(66, 133, 244, 0.05)';
        setTimeout(() => {
          radioGroup.style.backgroundColor = '';
        }, 800);
      }
    }
    
    return true;
  }

  async function fillTextField(element, value) {
    if (element.getAttribute('role') === 'combobox' ||
        element.classList.contains('tags-input') ||
        element.classList.contains('autocomplete') ||
        element.getAttribute('autocomplete') === 'off') {

      element.focus();
      element.value = value;

      element.dispatchEvent(new Event('focus', { bubbles: true }));
      element.dispatchEvent(new Event('input', { bubbles: true }));

      setTimeout(() => {
        element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
        element.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', bubbles: true }));
        element.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));

        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.dispatchEvent(new Event('blur', { bubbles: true }));
        console.log(`Filled tag/autocomplete field: ${element.id}, ${element.name}, ${element.value}`);

        element.style.borderLeft = '4px solid #4285f4';
      }, 200);

      return true;
    }

    // For standard inputs, add success indicator after setting value
    if (!(element.getAttribute('role') === 'combobox' ||
        element.classList.contains('tags-input') ||
        element.classList.contains('autocomplete') ||
        element.getAttribute('autocomplete') === 'off')) {
      element.value = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      element.dispatchEvent(new Event('blur', { bubbles: true }));
      
      // Visual indicator already applied by addVisualEffect
      return true;
    }
    
    element.style.borderLeft = '4px solid #4285f4';
    return true;
  }

  function updateEnhancedSelect(selectElement, value) {
    if (!selectElement) return false;

    const options = Array.from(selectElement.options);
    const option = options.find(opt =>
      opt.value === value ||
      opt.text.trim() === value ||
      opt.textContent.trim() === value
    );

    if (option) {
      selectElement.value = option.value;

      selectElement.dispatchEvent(new Event('change', { bubbles: true }));

      const chosenId = `${selectElement.id}_chosen`;
      const chosenContainer = document.getElementById(chosenId);

      if (chosenContainer) {
        console.log(`Found enhanced Chosen.js dropdown: ${chosenId}`);

        try {
          const chosenSpan = chosenContainer.querySelector('.chosen-single span');
          if (chosenSpan) {
            chosenSpan.textContent = option.text || option.value;
          }

          const resultItems = chosenContainer.querySelectorAll('.chosen-results li');
          resultItems.forEach(item => item.classList.remove('result-selected'));

          const selectedIndex = options.indexOf(option);
          if (selectedIndex >= 0) {
            const resultItem = chosenContainer.querySelector(`.chosen-results li:nth-child(${selectedIndex + 1})`);
            if (resultItem) {
              resultItem.classList.add('result-selected');
            }
          }

          if (window.jQuery && window.jQuery(selectElement).chosen) {
            window.jQuery(selectElement).trigger('chosen:updated');
          }

          return true;
        } catch (error) {
          console.error(`Error updating Chosen dropdown: ${error.message}`);
        }
      }

      if (window.jQuery && window.jQuery(selectElement).data('select2')) {
        console.log(`Found enhanced Select2 dropdown: ${selectElement.id}`);
        try {
          window.jQuery(selectElement).trigger('change');
          return true;
        } catch (error) {
          console.error(`Error updating Select2 dropdown: ${error.message}`);
        }
      }

      return true;
    }

    return false;
  }

  // Helper function to fill a form field based on its type
  async function fillField(element, tagName, inputType, value) {
    // Add visual highlight before filling
    addVisualEffect(element, tagName, inputType);
    
    let result;
    if (tagName === 'select') {
      result = fillSelectField(element, value);
    } else if (tagName === 'input' && (inputType === 'checkbox' || inputType === 'radio')) {
      result = fillCheckboxOrRadio(element, inputType, value);
    } else {
      result = await fillTextField(element, value);
    }
    
    if (tagName !== 'select' && 
        !(tagName === 'input' && (inputType === 'checkbox' || inputType === 'radio')) && 
        (element.getAttribute('role') === 'combobox' ||
         element.classList.contains('tags-input') ||
         element.classList.contains('autocomplete') ||
         element.getAttribute('autocomplete') === 'off')) {
      await new Promise(resolve => setTimeout(resolve, 500)); 
    }
    
    // Add permanent value indicator if the fill was successful
    if (result) {
      addPermanentValueIndicator(element, tagName, inputType, value);
    }
    
    return result;
  }

  /**
   * Add permanent visual indicator showing filled value
   */
  function addPermanentValueIndicator(element, tagName, inputType, value) {
    try {
      // Create a unique ID for the element if it doesn't have one
      if (!element.id) {
        element.id = 'formmaster-field-' + Math.random().toString(36).substring(2, 10);
      }
      
      // Check if we already added an indicator to this element
      const existingIndicator = document.getElementById(`formmaster-indicator-${element.id}`);
      if (existingIndicator) {
        existingIndicator.remove(); // Remove existing indicator to update with new value
      }
      
      // Format the display value based on field type
      let displayValue = value;
      if (inputType === 'password') {
        displayValue = '•••••••••';
      } else if (tagName === 'select') {
        // For select elements, try to get the display text instead of the value
        const selectedOption = Array.from(element.options).find(opt => opt.value === value);
        if (selectedOption) {
          displayValue = selectedOption.text;
        }
      } else if (inputType === 'checkbox') {
        displayValue = element.checked ? '✓' : '✗';
      } else if (inputType === 'radio') {
        if (element.checked) {
          displayValue = element.value || 'Selected';
        } else {
          return; // Don't add indicator for unselected radio options
        }
      }
      
      // Create the indicator element as a span
      const indicator = document.createElement('span');
      indicator.id = `formmaster-indicator-${element.id}`;
      indicator.className = 'formmaster-value-indicator';
      
      // Style the indicator based on field type
      if (inputType === 'checkbox' || inputType === 'radio') {
        indicator.style.cssText = `
          display: inline-block;
          background-color: rgba(66, 133, 244, 0.15);
          color: #1a73e8;
          padding: 2px 6px;
          margin-left: 6px;
          border-radius: 3px;
          font-size: 12px;
          border-left: 3px solid #4285f4;
          vertical-align: middle;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
        `;
      } else {
        indicator.style.cssText = `
          display: inline-block;
          background-color: rgba(66, 133, 244, 0.15);
          color: #1a73e8;
          padding: 2px 6px;
          margin-left: 6px;
          border-radius: 3px;
          font-size: 12px;
          border-left: 3px solid #4285f4;
          vertical-align: middle;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        `;
      }
      
      // Set the content
      indicator.textContent = displayValue;
      
      // For checkbox and radio, add to the label if possible
      if ((inputType === 'checkbox' || inputType === 'radio') && element.id) {
        const label = document.querySelector(`label[for="${element.id}"]`);
        if (label) {
          label.appendChild(indicator);
          return;
        }
      }
      
      // Try to find a good insertion point for the indicator
      if (element.nextSibling) {
        // Insert right after the element
        element.parentNode.insertBefore(indicator, element.nextSibling);
      } else {
        // Append to parent if no next sibling
        element.parentNode.appendChild(indicator);
      }
      
      // If element is in a container div/label, we need to handle special cases
      const parent = element.parentElement;
      if (parent && (parent.tagName === 'DIV' || parent.tagName === 'LABEL' || parent.tagName === 'SPAN')) {
        // If the parent only contains this element, append to parent
        if (parent.children.length === 1 && parent.children[0] === element) {
          parent.appendChild(indicator);
        }
      }
      
      // Add visual highlight to the field itself
      if (tagName === 'input' || tagName === 'textarea') {
        // Add subtle left border to input field itself (common convention for filled fields)
        if (window.getComputedStyle(element).position === 'static') {
          element.style.position = 'relative';
        }
        element.style.borderLeft = '3px solid #4285f4';
        
        // If we need to adjust padding to account for border
        const computedStyle = window.getComputedStyle(element);
        const currentPaddingLeft = parseInt(computedStyle.paddingLeft) || 0;
        if (currentPaddingLeft < 5) {
          element.style.paddingLeft = '5px';
        }
      }
      
      // Add stylesheet for permanent indicators if not already added
      if (!document.getElementById('formmaster-permanent-indicators-style')) {
        const styleEl = document.createElement('style');
        styleEl.id = 'formmaster-permanent-indicators-style';
        styleEl.textContent = `
          .formmaster-value-indicator {
            opacity: 0.85;
            transition: opacity 0.2s ease, transform 0.2s ease;
            box-shadow: 0 1px 2px rgba(60, 64, 67, 0.3);
          }
          .formmaster-value-indicator:hover {
            opacity: 1;
            transform: translateY(-1px);
            box-shadow: 0 1px 3px rgba(60, 64, 67, 0.4);
          }
        `;
        document.head.appendChild(styleEl);
      }
    } catch (e) {
      console.error('Error adding permanent value indicator:', e);
    }
  }

  async function performFormFilling(url, profile) {

    const tabUrl = new URL(url);
    const baseUrl = tabUrl.origin;
    console.log("Starting form filling for URL:", baseUrl, profile.filename);
    
    // Add visual effects styles to the page
    addVisualEffectStyles();

    // Add permanent indicators style
    if (!document.getElementById('formmaster-permanent-indicators-style')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'formmaster-permanent-indicators-style';
      styleEl.textContent = `
        .formmaster-value-indicator {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
          font-size: 12px;
          transition: all 0.2s ease;
          display: inline-block;
          background-color: rgba(66, 133, 244, 0.15);
          color: #1a73e8;
          padding: 2px 6px;
          margin-left: 6px;
          border-radius: 3px;
          border-left: 3px solid #4285f4;
          vertical-align: middle;
          box-shadow: 0 1px 2px rgba(60, 64, 67, 0.3);
        }
        .formmaster-value-indicator:hover {
          opacity: 1;
          transform: translateY(-1px);
          box-shadow: 0 1px 3px rgba(60, 64, 67, 0.4);
        }
      `;
      document.head.appendChild(styleEl);
    }

    // Get field values from local storage for the specific URL
    const result = await new Promise(resolve => {
      chrome.storage.local.get(['allSuggestions', 'fieldMappingsV2'], function(data) {
        resolve(data);
      });
    });

    // Extract the field values and field mappings for this URL
    const allSuggestions = result.allSuggestions || {};
    const fieldMappingsV2 = result.fieldMappingsV2 || {};
    
    console.log('allSuggestions', allSuggestions);
    console.log('fieldMappingsV2', fieldMappingsV2);
    console.log('baseUrl', baseUrl);

    // Get field values specifically for this URL
    const fieldValues = allSuggestions[baseUrl + '_profile_' + userProfile.filename] || [];
    const fieldMappings = fieldMappingsV2[baseUrl] || [];
    
    console.log(`Found ${fieldValues.length} suggestions and ${fieldMappings.length} field mappings for URL: ${baseUrl}`);
    
    // Initialize stats for tracking fill results
    const stats = {
      filled: 0,
      failed: 0,
      skipped: 0,
      total: fieldMappings.length
    };

    // Process each field mapping using AI code
    for (const control of fieldMappings) {
      try {
        // Skip controls without AI code
        if (!control.containerDesc || !control.containerDesc.aicode) {
          console.log(`Skipping control without AI code:`, control.id || control.name);
          stats.skipped++;
          continue;
        }
        
        // Parse the AI code from the control
        let aiCodeObj;
        try {
          aiCodeObj = JSON.parse(control.containerDesc.aicode);
        } catch (e) {
          console.error(`Error parsing AI code for control:`, control.id || control.name, e);
          stats.failed++;
          continue;
        }
        
        // Skip if no AI code function available
        if (!aiCodeObj || !aiCodeObj.aicode) {
          console.log(`No AI code function found for control:`, control.id || control.name);
          stats.skipped++;
          continue;
        }
        
        const id = aiCodeObj.id;
        const title = aiCodeObj.title;
        
        // Find a matching value from suggestions
        let valueToSet = control.value;
        
        // If no direct value on the control, try to find a matching field in suggestions
        if (valueToSet === undefined || valueToSet === null) {
          const matchingSuggestion = fieldValues.find(f => 
            (f.id === control.id) || 
            (f.name === control.name) ||
            (f.id === id) ||
            (f.labels && f.labels.some(l => l.text && title && l.text.includes(title)))
          );
          
          if (matchingSuggestion) {
            valueToSet = matchingSuggestion.value;
            console.log(`Found matching suggestion for ${title || id}: ${valueToSet}`);
          } else {
            console.log(`No matching suggestion found for ${title || id}, skipping`);
            stats.skipped++;
            continue;
          }
        }
        
        // Skip if value is still undefined
        if (valueToSet === undefined || valueToSet === null) {
          console.log(`No value to set for ${title || id}, skipping`);
          stats.skipped++;
          continue;
        }
        
        // Create and execute the AI code function
        console.log(`Executing AI code for ${title || id} with value: ${valueToSet}`);
        const functionBody = aiCodeObj.aicode;
        try {
          // Create a function from the AI code and execute it with the value
          const setValueFunction = new Function('return ' + functionBody)();
          
          // Execute the setValue function with the field value
          setValueFunction(valueToSet);
          
          stats.filled++;
          console.log(`Successfully filled field: ${title || id}`);
        } catch (error) {
          console.error(`Error executing AI code for ${title || id}:`, error);
          stats.failed++;
          
          // Fallback: try using standard form filling as backup
          try {
            const element = document.getElementById(id);
            if (element) {
              const tagName = element.tagName.toLowerCase();
              const inputType = element.type ? element.type.toLowerCase() : '';
              
              if (await fillField(element, tagName, inputType, valueToSet)) {
                stats.filled++;
                stats.failed--; // Correct the stats since we recovered
                console.log(`Successfully filled field using fallback method: ${title || id}`);
              }
            }
          } catch (fallbackError) {
            console.error(`Fallback filling also failed for ${title || id}:`, fallbackError);
          }
        }
      } catch (error) {
        console.error(`Error processing control:`, error);
        stats.failed++;
      }
    }

    console.log("Form filling complete:", stats);
    return stats;
  }

  // Expose public API
  return {
    performFormFilling,
    addVisualEffectStyles,
    findFillableElement,
    findRadioButton,
    fillField,
    fillTextField,
    fillSelectField,
    fillCheckboxOrRadio,
    isElementHidden,
    getFieldTypePriority,
    addVisualEffect,
    updateEnhancedSelect
  };
})();

self.formFiller = formFiller;