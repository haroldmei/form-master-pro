// EventHandlers Module - Manages event handlers for form interactions
(function() {
  // Get reference to the global FormMaster object
  const FM = window.FormMaster = window.FormMaster || {};
  
  // Form element event handlers
  function handleMouseover(e) {
    const element = e.target;
    
    // Only handle input elements, selects, and textareas
    if (!(element instanceof HTMLInputElement || 
          element instanceof HTMLSelectElement || 
          element instanceof HTMLTextAreaElement)) {
      FM.indicator.style.display = 'none';
      FM.valueTooltip.style.display = 'none';
      FM.valueTooltip.style.opacity = '0';
      if (typeof FM.clearLabelHighlights === 'function') FM.clearLabelHighlights();
      if (typeof FM.clearOptionsHighlights === 'function') FM.clearOptionsHighlights();
      FM.currentHighlightedElement = null;
      return;
    }
    
    // Ignore submit/button inputs
    if (element.type === 'submit' || element.type === 'button' || element.type === 'reset') {
      FM.indicator.style.display = 'none';
      FM.valueTooltip.style.display = 'none';
      FM.valueTooltip.style.opacity = '0';
      if (typeof FM.clearLabelHighlights === 'function') FM.clearLabelHighlights();
      if (typeof FM.clearOptionsHighlights === 'function') FM.clearOptionsHighlights();
      FM.currentHighlightedElement = null;
      return;
    }
    
    // Find matching field
    const matchingField = typeof FM.findMatchingField === 'function' ? FM.findMatchingField(element) : null;
    if (!matchingField || matchingField.value === undefined) {
      FM.indicator.style.display = 'none';
      FM.valueTooltip.style.display = 'none';
      FM.valueTooltip.style.opacity = '0';
      if (typeof FM.clearLabelHighlights === 'function') FM.clearLabelHighlights();
      if (typeof FM.clearOptionsHighlights === 'function') FM.clearOptionsHighlights();
      FM.currentHighlightedElement = null;
      return;
    }
    
    // Store current element for scroll updates
    FM.currentHighlightedElement = element;
    
    // Find and highlight labels and options
    if (typeof FM.findAndHighlightLabels === 'function') FM.findAndHighlightLabels(element);
    if (typeof FM.findAndHighlightOptions === 'function') FM.findAndHighlightOptions(element);
    
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
    FM.valueText.textContent = displayValue;
    FM.valueTooltip.style.display = 'flex';
    
    // Show indicator for fillable field using fixed positioning
    const rect = element.getBoundingClientRect();
    FM.indicator.style.top = `${rect.top}px`;
    FM.indicator.style.left = `${rect.left}px`;
    FM.indicator.style.width = `${rect.width}px`;
    FM.indicator.style.height = `${rect.height}px`;
    FM.indicator.style.display = 'block';
    
    // Position the tooltip as overlay directly on the field
    FM.valueTooltip.style.top = `${rect.top}px`;
    FM.valueTooltip.style.left = `${rect.left}px`;
    FM.valueTooltip.style.width = `${rect.width}px`;
    FM.valueTooltip.style.height = `${rect.height}px`;
    
    // Adjust the text size to be double the height of the control
    const desiredFontSize = Math.max(16, rect.height * 0.7); // 70% of height, minimum 16px
    FM.valueText.style.fontSize = `${desiredFontSize}px`;
    FM.valueText.style.lineHeight = `${desiredFontSize}px`;
    
    // Fade in the tooltip
    setTimeout(() => {
      FM.valueTooltip.style.opacity = '1';
    }, 10);
  }
  
  function handleMouseout(e) {
    if (e.target === FM.currentHighlightedElement) {
      FM.indicator.style.display = 'none';
      FM.valueTooltip.style.opacity = '0';
      if (typeof FM.clearLabelHighlights === 'function') FM.clearLabelHighlights();
      if (typeof FM.clearOptionsHighlights === 'function') FM.clearOptionsHighlights();
      setTimeout(() => {
        if (FM.valueTooltip.style.opacity === '0') {
          FM.valueTooltip.style.display = 'none';
        }
      }, 200);
      FM.currentHighlightedElement = null;
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
    const matchingField = typeof FM.findMatchingField === 'function' ? FM.findMatchingField(element) : null;
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
      if (typeof FM.fillSelectField === 'function') FM.fillSelectField(element, value);
    } else if (element.type === 'checkbox' || element.type === 'radio') {
      if (typeof FM.fillCheckboxOrRadio === 'function') FM.fillCheckboxOrRadio(element, element.type, value);
    } else {
      if (typeof FM.fillTextField_explore === 'function') FM.fillTextField_explore(element, value);
    }
    
    console.log(`Click-to-fill: Filled ${element.tagName.toLowerCase()} with value: ${value}`);
  }
  
  // Set up all event listeners
  FM.setupEventListeners = function() {
    // Form field event listeners
    document.addEventListener('mouseover', handleMouseover, true);
    document.addEventListener('mouseout', handleMouseout, true);
    document.addEventListener('click', handleClick, true);
    document.addEventListener('scroll', FM.updateIndicatorPosition, true);
    window.addEventListener('resize', FM.updateIndicatorPosition, true);
    
    // Add label and container event handlers when they are implemented
    if (typeof FM.handleLabelMouseover === 'function') {
      document.addEventListener('mouseover', FM.handleLabelMouseover, true);
    }
    
    if (typeof FM.handleLabelMouseout === 'function') {
      document.addEventListener('mouseout', FM.handleLabelMouseout, true);
    }
    
    if (typeof FM.handleLabelClick === 'function') {
      document.addEventListener('click', FM.handleLabelClick, true);
    }
    
    if (typeof FM.handleContainerMouseover === 'function') {
      document.addEventListener('mouseover', FM.handleContainerMouseover, true);
    }
    
    if (typeof FM.handleContainerMouseout === 'function') {
      document.addEventListener('mouseout', FM.handleContainerMouseout, true);
    }
    
    if (typeof FM.handleContainerClick === 'function') {
      document.addEventListener('click', FM.handleContainerClick, true);
    }
  };
  
  // Clean up all event listeners
  FM.cleanupEventListeners = function() {
    document.removeEventListener('mouseover', handleMouseover, true);
    document.removeEventListener('mouseout', handleMouseout, true);
    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('scroll', FM.updateIndicatorPosition, true);
    window.removeEventListener('resize', FM.updateIndicatorPosition, true);
    
    if (typeof FM.handleLabelMouseover === 'function') {
      document.removeEventListener('mouseover', FM.handleLabelMouseover, true);
    }
    
    if (typeof FM.handleLabelMouseout === 'function') {
      document.removeEventListener('mouseout', FM.handleLabelMouseout, true);
    }
    
    if (typeof FM.handleLabelClick === 'function') {
      document.removeEventListener('click', FM.handleLabelClick, true);
    }
    
    if (typeof FM.handleContainerMouseover === 'function') {
      document.removeEventListener('mouseover', FM.handleContainerMouseover, true);
    }
    
    if (typeof FM.handleContainerMouseout === 'function') {
      document.removeEventListener('mouseout', FM.handleContainerMouseout, true);
    }
    
    if (typeof FM.handleContainerClick === 'function') {
      document.removeEventListener('click', FM.handleContainerClick, true);
    }
  };
})(); 