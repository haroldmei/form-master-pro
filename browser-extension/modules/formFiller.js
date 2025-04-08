/**
 * Form filling module
 */
const formFiller = (() => {
  
  function performFormFilling(fieldValues) {
    
    console.log("Filling form with data:", fieldValues);

    function findFillableElement(identifier) {
      // Try by ID first
      let element = document.getElementById(identifier);
      if (element) return element;

      // Try by name
      element = document.querySelector(`[name="${identifier}"]`);
      if (element) return element;

      // Try by other common selectors
      return null;
    }

    function findRadioButton(name, value) {
      // First try exact match
      const exactMatch = document.querySelector(`input[type="radio"][name="${name}"][value="${value}"]`);
      if (exactMatch) return exactMatch;

      // If no exact match, try case-insensitive match for common yes/no patterns
      if (typeof value === 'string') {
        // Handle common yes/no patterns
        if (value.toLowerCase() === 'yes' || value.toLowerCase() === 'y') {
          // Look for yes, y, true, 1
          const yesRadio = document.querySelector(`input[type="radio"][name="${name}"][value="yes"], 
                                                 input[type="radio"][name="${name}"][value="Yes"], 
                                                 input[type="radio"][name="${name}"][value="Y"], 
                                                 input[type="radio"][name="${name}"][value="y"], 
                                                 input[type="radio"][name="${name}"][value="true"], 
                                                 input[type="radio"][name="${name}"][value="1"]`);
          if (yesRadio) return yesRadio;
        } else if (value.toLowerCase() === 'no' || value.toLowerCase() === 'n') {
          // Look for no, n, false, 0
          const noRadio = document.querySelector(`input[type="radio"][name="${name}"][value="no"], 
                                                input[type="radio"][name="${name}"][value="No"], 
                                                input[type="radio"][name="${name}"][value="N"], 
                                                input[type="radio"][name="${name}"][value="n"], 
                                                input[type="radio"][name="${name}"][value="false"], 
                                                input[type="radio"][name="${name}"][value="0"]`);
          if (noRadio) return noRadio;
        }

        // NEW: Try to find options by data-* attributes which often contain descriptive text
        const allRadios = document.querySelectorAll(`input[type="radio"][name="${name}"]`);
        for (const radio of allRadios) {
          // Check all data-* attributes for matches with the value
          const dataAttributes = Array.from(radio.attributes)
            .filter(attr => attr.name.startsWith('data-'))
            .map(attr => attr.value.toLowerCase());

          // If any data attribute contains our value, this is likely the match
          if (dataAttributes.some(attr => 
              attr.includes(value.toLowerCase()) || 
              value.toLowerCase().includes(attr))) {
            console.log(`Found radio match through data attribute: ${radio.id}`);
            return radio;
          }

          // Also check if the analytics ID or similar attributes contain our text
          if (radio.dataset.analyticsid && 
              radio.dataset.analyticsid.toLowerCase().includes(value.toLowerCase())) {
            console.log(`Found radio match through analytics ID: ${radio.dataset.analyticsid}`);
            return radio;
          }
        }

        // NEW: For complex nested structures with role="radiogroup"
        // First try to find the radio group container
        const radioGroups = document.querySelectorAll('[role="radiogroup"]');
        for (const group of radioGroups) {
          // Find all radio buttons within this group with our name
          const groupRadios = group.querySelectorAll(`input[type="radio"][name="${name}"]`);
          if (groupRadios.length === 0) continue;

          // Try to match by label text within this group
          for (const radio of groupRadios) {
            // Look for the label associated with this radio
            let label = null;

            // Try by 'for' attribute first
            if (radio.id) {
              label = group.querySelector(`label[for="${radio.id}"]`);
            }

            // If no label found, find label in parent structure (common pattern)
            if (!label) {
              const radioParent = radio.parentElement;
              if (radioParent) {
                label = radioParent.querySelector('label');
              }
            }

            // If we have a label and its text matches our value
            if (label && label.textContent.trim().toLowerCase() === value.toLowerCase()) {
              console.log(`Found radio match in ARIA radiogroup by label: ${label.textContent}`);
              return radio;
            }

            // If label doesn't match but contains our value
            if (label && label.textContent.trim().toLowerCase().includes(value.toLowerCase())) {
              console.log(`Found partial radio match in ARIA radiogroup: ${label.textContent}`);
              return radio;
            }
          }
        }

        // Try finding by label text when no match by value
        for (const radio of allRadios) {
          // Check the radio's associated label
          let label = null;

          // First try to find label by 'for' attribute
          if (radio.id) {
            label = document.querySelector(`label[for="${radio.id}"]`);
          }

          // If no label found, check parent or next sibling
          if (!label) {
            // Check if radio is wrapped in a label
            let parent = radio.parentElement;
            while (parent && parent.tagName !== 'LABEL' && 
                   !parent.classList.contains('form-check') && 
                   !parent.classList.contains('radio')) {
              parent = parent.parentElement;
            }

            if (parent) {
              // Find label inside this container
              label = parent.tagName === 'LABEL' ? parent : parent.querySelector('label');
            }

            // If still no label, try next sibling
            if (!label) {
              let sibling = radio.nextElementSibling;
              if (sibling && sibling.tagName === 'LABEL') {
                label = sibling;
              }
            }
          }

          // If we found a label and its text matches our value
          if (label && label.textContent.trim().toLowerCase() === value.toLowerCase()) {
            return radio;
          }
        }
      }

      return null;
    }

    function fillField(element, tagName, inputType, value) {
      // Handle different element types
      if (tagName === 'select') {
        return fillSelectField(element, value);
      } else if (tagName === 'input' && (inputType === 'checkbox' || inputType === 'radio')) {
        return fillCheckboxOrRadio(element, inputType, value);
      } else {
        return fillTextField(element, value);
      }
    }

    function fillSelectField(element, value) {
      if (element.style.display === 'none') {
        // This is likely an enhanced select with a UI widget replacement
        console.log(`Hidden select detected with id: ${element.id}, trying enhanced handling`);
        return updateEnhancedSelect(element, value);
      } else {
        // Regular select handling
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

        // Check if value looks like an option value rather than a boolean/state
        if (typeof value === 'string') {
          // For bootstrap form-check-inline structure, first try to find the specific radio button
          const radioButton = findRadioButton(element.name, value);
          if (radioButton) {
            // Select this specific radio button
            radioButton.checked = true;
            radioButton.dispatchEvent(new Event('change', { bubbles: true }));
            console.log(`Selected radio option with value: ${value}`);
            return true;
          } else {
            console.warn(`Could not find radio button with name ${element.name} and value ${value}`);
          }

          // Handle Yes/No or Y/N patterns for radio buttons
          if (['yes', 'y', 'true', '1'].includes(value.toLowerCase())) {
            const yesOptions = document.querySelectorAll(`input[type="radio"][name="${element.name}"]`);
            // Try to find a "Yes" option among the radio group
            for (const option of yesOptions) {
              if (['yes', 'y', '1', 'true'].includes(option.value.toLowerCase()) ||
                  option.id.toLowerCase().includes('yes') ||
                  option.id.toLowerCase().includes('y')) {
                option.checked = true;
                option.dispatchEvent(new Event('change', { bubbles: true }));
                console.log(`Selected radio yes option: ${option.value}`);
                return true;
              }

              // Check if the label indicates this is a "Yes" option
              if (option.id) {
                const label = document.querySelector(`label[for="${option.id}"]`);
                if (label && ['yes', 'y'].includes(label.textContent.trim().toLowerCase())) {
                  option.checked = true;
                  option.dispatchEvent(new Event('change', { bubbles: true }));
                  console.log(`Selected radio yes option by label: ${label.textContent}`);
                  return true;
                }
              }
            }
          }

          if (['no', 'n', 'false', '0'].includes(value.toLowerCase())) {
            const noOptions = document.querySelectorAll(`input[type="radio"][name="${element.name}"]`);
            // Try to find a "No" option among the radio group
            for (const option of noOptions) {
              if (['no', 'n', '0', 'false'].includes(option.value.toLowerCase()) ||
                  option.id.toLowerCase().includes('no') ||
                  option.id.toLowerCase().includes('n')) {
                option.checked = true;
                option.dispatchEvent(new Event('change', { bubbles: true }));
                console.log(`Selected radio no option: ${option.value}`);
                return true;
              }

              // Check if the label indicates this is a "No" option
              if (option.id) {
                const label = document.querySelector(`label[for="${option.id}"]`);
                if (label && ['no', 'n'].includes(label.textContent.trim().toLowerCase())) {
                  option.checked = true;
                  option.dispatchEvent(new Event('change', { bubbles: true }));
                  console.log(`Selected radio no option by label: ${label.textContent}`);
                  return true;
                }
              }
            }
          }
        }
      }

      // Regular checkbox/radio handling for cases not covered above
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
      return true;
    }

    function fillTextField(element, value) {
      // Special handling for fields that might trigger popups/tags
      if (element.getAttribute('role') === 'combobox' || 
          element.classList.contains('tags-input') || 
          element.classList.contains('autocomplete') ||
          element.getAttribute('autocomplete') === 'off') {
          
        console.log(`Detected potential tag/autocomplete field: ${element.id || element.name}`);
          
        // First focus the field to activate any attached behaviors
        element.focus();
          
        // Set the value
        element.value = value;
          
        // Dispatch events in the right order to simulate typing
        element.dispatchEvent(new Event('focus', { bubbles: true }));
        element.dispatchEvent(new Event('input', { bubbles: true }));
          
        // Small delay to let any dropdown/suggestions appear
        setTimeout(() => {
          // Press Enter key to potentially confirm the value
          element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
          element.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', bubbles: true }));
          element.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));

          // Then blur the field
          element.dispatchEvent(new Event('change', { bubbles: true }));
          element.dispatchEvent(new Event('blur', { bubbles: true }));

          // Visual indicator
          element.style.borderLeft = '3px solid #4285f4';
        }, 200);

        return true;
      }

      // Standard behavior for regular inputs
      element.value = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));

      // Add a visual indicator that the field was filled
      element.style.borderLeft = '3px solid #4285f4';
      return true;
    }

    function updateEnhancedSelect(selectElement, value) {
      if (!selectElement) return false;

      // First update the native select element
      const options = Array.from(selectElement.options);
      const option = options.find(opt => 
        opt.value === value || 
        opt.text.trim() === value || 
        opt.textContent.trim() === value
      );

      if (option) {
        // Update the native select element
        selectElement.value = option.value;

        // Trigger native change event
        selectElement.dispatchEvent(new Event('change', { bubbles: true }));

        // Check for enhanced dropdown implementations
        // 1. Chosen.js
        const chosenId = `${selectElement.id}_chosen`;
        const chosenContainer = document.getElementById(chosenId);

        if (chosenContainer) {
          console.log(`Found enhanced Chosen.js dropdown: ${chosenId}`);

          try {
            // Update Chosen's display text
            const chosenSpan = chosenContainer.querySelector('.chosen-single span');
            if (chosenSpan) {
              chosenSpan.textContent = option.text || option.value;
            }

            // Update the result-selected class in the dropdown list
            const resultItems = chosenContainer.querySelectorAll('.chosen-results li');
            resultItems.forEach(item => item.classList.remove('result-selected'));

            // Find the matching item in the dropdown and mark it as selected
            const selectedIndex = options.indexOf(option);
            if (selectedIndex >= 0) {
              const resultItem = chosenContainer.querySelector(`.chosen-results li:nth-child(${selectedIndex + 1})`);
              if (resultItem) {
                resultItem.classList.add('result-selected');
              }
            }

            // If the library is available, try to update using its API
            if (window.jQuery && window.jQuery(selectElement).chosen) {
              window.jQuery(selectElement).trigger('chosen:updated');
            }

            return true;
          } catch (error) {
            console.error(`Error updating Chosen dropdown: ${error.message}`);
          }
        }

        // 2. Select2
        if (window.jQuery && window.jQuery(selectElement).data('select2')) {
          console.log(`Found enhanced Select2 dropdown: ${selectElement.id}`);
          try {
            window.jQuery(selectElement).trigger('change');
            return true;
          } catch (error) {
            console.error(`Error updating Select2 dropdown: ${error.message}`);
          }
        }

        // If we made it here, we at least updated the native select
        return true;
      }

      return false;
    }

  
    // Track stats
    const stats = {
      filled: 0,
      failed: 0,
      total: Object.keys(fieldValues).length
    };
    
    // Fill each field
    for (const [identifier, value] of Object.entries(fieldValues)) {
      try {
        const element = findFillableElement(identifier);
        
        if (!element) {
          console.warn(`No element found for key: ${identifier}`);
          stats.failed++;
          continue;
        }
        
        const tagName = element.tagName.toLowerCase();
        const inputType = element.type ? element.type.toLowerCase() : '';
        
        if (fillField(element, tagName, inputType, value)) {
          stats.filled++;
        } else {
          stats.failed++;
        }
      } catch (error) {
        console.error(`Error filling field ${identifier}:`, error);
        stats.failed++;
      }
    }
    
    // Special handling for radio groups by name
    // This finds all radio groups and then sets the right one based on value
    const processedRadioGroups = new Set();
    
    for (const key in fieldValues) {
      // Skip already processed items
      if (processedRadioGroups.has(key)) continue;
      
      const value = fieldValues[key];
      if (value === null || value === undefined) continue;
      
      // Look for radio buttons with this name
      const radioGroup = document.querySelectorAll(`input[type="radio"][name="${CSS.escape(key)}"]`);
      
      if (radioGroup.length > 1) {
        console.log(`Processing radio group: ${key} with value: ${value}`);
        processedRadioGroups.add(key);
        
        // Try to find the radio with matching value
        let foundMatch = false;
        
        // First try exact match
        for (const radio of radioGroup) {
          if (radio.value === String(value)) {
            radio.checked = true;
            foundMatch = true;
            radio.dispatchEvent(new Event('change', { bubbles: true }));
            break;
          }
        }
        
        // If no exact match, try case-insensitive
        if (!foundMatch) {
          const lcValue = String(value).toLowerCase();
          for (const radio of radioGroup) {
            if (radio.value.toLowerCase() === lcValue) {
              radio.checked = true;
              foundMatch = true;
              radio.dispatchEvent(new Event('change', { bubbles: true }));
              break;
            }
          }
        }
        
        // If still no match, try matching against labels
        if (!foundMatch) {
          for (const radio of radioGroup) {
            // Try to get the label text
            let labelText = '';
            
            // By "for" attribute
            if (radio.id) {
              const labelElement = document.querySelector(`label[for="${radio.id}"]`);
              if (labelElement) labelText = labelElement.textContent.trim();
            }
            
            // By parent label
            if (!labelText) {
              let parent = radio.parentElement;
              while (parent && parent.tagName !== 'FORM') {
                if (parent.tagName === 'LABEL') {
                  labelText = parent.textContent.trim();
                  break;
                }
                parent = parent.parentElement;
              }
            }
            
            // By next sibling text node
            if (!labelText) {
              let nextSibling = radio.nextSibling;
              while (nextSibling && !labelText) {
                if (nextSibling.nodeType === 3) { // Text node
                  labelText = nextSibling.textContent.trim();
                  if (labelText) break;
                } else if (nextSibling.nodeType === 1) { // Element node
                  labelText = nextSibling.textContent.trim();
                  if (labelText) break;
                }
                nextSibling = nextSibling.nextSibling;
              }
            }
            
            // Compare if we found any label text
            if (labelText && 
               (labelText.toLowerCase() === String(value).toLowerCase() ||
                labelText.toLowerCase().includes(String(value).toLowerCase()))) {
              radio.checked = true;
              foundMatch = true;
              radio.dispatchEvent(new Event('change', { bubbles: true }));
              break;
            }
          }
        }
        
        if (!foundMatch) {
          console.log(`Could not find matching radio button for ${key} with value ${value}`);
        }
      }
    }
    
    // Process radio groups passed as objects with name and options
    for (const key in fieldValues) {
      const value = fieldValues[key];
      
      // Check if this is a radio group object from our extraction
      if (value && typeof value === 'object' && value.type === 'radio' && 
          value.name && Array.isArray(value.options)) {
        
        const groupName = value.name;
        const selectedValue = value.selectedValue || '';
        
        if (!selectedValue) continue;
        
        const radioButtons = document.querySelectorAll(`input[type="radio"][name="${CSS.escape(groupName)}"]`);
        for (const radio of radioButtons) {
          if (radio.value === selectedValue) {
            radio.checked = true;
            radio.dispatchEvent(new Event('change', { bubbles: true }));
            break;
          }
        }
      }
    }
    
    return stats;
  }

  // Return public API
  return {
    performFormFilling
  };
})();

self.formFiller = formFiller;