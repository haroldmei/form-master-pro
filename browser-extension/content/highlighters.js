// Highlighters Module - Manages form element highlighting
(function() {
  // Get reference to the global FormMaster object
  const FM = window.FormMaster = window.FormMaster || {};
  
  // Function to clear label highlights
  FM.clearLabelHighlights = function() {
    if (!FM.currentHighlightedLabels) return;
    
    FM.currentHighlightedLabels.forEach(label => {
      if (label && label._highlightElement && label._highlightElement.parentNode) {
        label._highlightElement.parentNode.removeChild(label._highlightElement);
        delete label._highlightElement;
      }
    });
    FM.currentHighlightedLabels = [];
  };
  
  // Function to clear options highlights
  FM.clearOptionsHighlights = function() {
    if (!FM.currentHighlightedOptions) return;
    
    FM.currentHighlightedOptions.forEach(option => {
      if (option && option._highlightElement && option._highlightElement.parentNode) {
        option._highlightElement.parentNode.removeChild(option._highlightElement);
        delete option._highlightElement;
      }
    });
    FM.currentHighlightedOptions = [];
  };
  
  // Function to clear highlighted inputs
  FM.clearHighlightedInputs = function() {
    if (!FM.currentHighlightedInputs) return;
    
    FM.currentHighlightedInputs.forEach(input => {
      if (input && input._highlightElement && input._highlightElement.parentNode) {
        input._highlightElement.parentNode.removeChild(input._highlightElement);
        delete input._highlightElement;
      }
    });
    FM.currentHighlightedInputs = [];
  };
  
  // Function to clear container highlight
  FM.clearContainerHighlight = function() {
    if (FM.currentHighlightedContainer && FM.currentHighlightedContainer._highlightElement) {
      if (FM.currentHighlightedContainer._highlightElement.parentNode) {
        FM.currentHighlightedContainer._highlightElement.parentNode.removeChild(
          FM.currentHighlightedContainer._highlightElement
        );
      }
      delete FM.currentHighlightedContainer._highlightElement;
      FM.currentHighlightedContainer = null;
    }
  };
  
  // Helper function to check if an element is a container based on existing criteria
  FM.isContainerElement = function(element) {
    return element.tagName === 'DIV' || 
      element.tagName === 'FIELDSET' ||
      element.classList.contains('form-group') ||
      element.classList.contains('field-group') ||
      element.classList.contains('input-group') ||
      element.classList.contains('form-field') ||
      element.classList.contains('control-group') ||
      (element.tagName === 'LI' && element.querySelector('input, select, textarea'));
  };
  
  // Function to find and highlight labels associated with an element
  FM.findAndHighlightLabels = function(element) {
    // Clear any previous label highlights
    FM.clearLabelHighlights();
    
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
    
    FM.currentHighlightedLabels = labels;
  };
  
  // Function to find and highlight options for select elements or radio groups
  FM.findAndHighlightOptions = function(element) {
    // Clear any previous options highlights
    FM.clearOptionsHighlights();
    
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
    
    FM.currentHighlightedOptions = options;
  };
  
  // Function to find input elements associated with a label
  FM.findAssociatedInputs = function(labelElement) {
    const associatedInputs = [];
    
    // Check for 'for' attribute
    if (labelElement.htmlFor) {
      const input = document.getElementById(labelElement.htmlFor);
      if (input) associatedInputs.push(input);
    }
    
    // Check for inputs within the label
    const inputs = labelElement.querySelectorAll('input, select, textarea');
    inputs.forEach(input => associatedInputs.push(input));
    
    return associatedInputs;
  };
  
  // Function to highlight input elements when hovering over a label
  FM.highlightAssociatedInputs = function(inputs) {
    FM.clearHighlightedInputs();
    
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
    
    FM.currentHighlightedInputs.push(...inputs);
  };
  
  // Label event handlers
  FM.handleLabelMouseover = function(e) {
    const element = e.target;
    
    // Check if this is a label or label-like element
    const isLabelOrLabelLike = 
      element.tagName === 'LABEL' || 
      (element.tagName === 'SPAN' && element.classList.contains('label')) ||
      (element.tagName === 'DIV' && element.classList.contains('label')) ||
      element.getAttribute('aria-label') !== null;
    
    if (!isLabelOrLabelLike) {
      // Only clear if it's not already being handled by input hover
      if (!FM.currentHighlightedElement) {
        FM.clearHighlightedInputs();
        FM.clearLabelHighlights(); // Also clear label highlights
      }
      return;
    }
    
    // Clear any previous label highlights first
    FM.clearLabelHighlights();
    
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
    
    // Add to tracked labels
    FM.currentHighlightedLabels = [element];
    
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
    const associatedInputs = FM.findAssociatedInputs(element);
    
    if (associatedInputs.length === 0) {
      FM.clearHighlightedInputs();
      return;
    }
    
    // Highlight the associated inputs
    FM.highlightAssociatedInputs(associatedInputs);
    
    // Register scroll and resize handlers to keep the highlights in position
    document.addEventListener('scroll', FM.updateIndicatorPosition, { passive: true });
    window.addEventListener('resize', FM.updateIndicatorPosition, { passive: true });
  };
  
  FM.handleLabelMouseout = function(e) {
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
    if (!FM.currentHighlightedElement) {
      FM.clearHighlightedInputs();
      FM.clearLabelHighlights(); // Also clear label highlights
    }
  };
  
  FM.handleLabelClick = function(e) {
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
    const associatedInputs = FM.findAssociatedInputs(element);
    if (associatedInputs.length > 0) {
      console.log(`Found ${associatedInputs.length} associated input(s):`);
      associatedInputs.forEach((input, index) => {
        console.log(`Input ${index + 1}:`, input.outerHTML);
      });
    } else {
      console.log('No associated inputs found for this label');
    }
  };
})(); 