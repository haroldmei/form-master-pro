// PositionUpdater Module - Manages UI element positions during scrolling and resizing
(function() {
  // Get reference to the global FormMaster object
  const FM = window.FormMaster = window.FormMaster || {};
  
  /**
   * Updates the position of indicators and highlights when scrolling or resizing
   */
  FM.updateIndicatorPosition = function() {
    // Update form field indicator and tooltip if present
    if (FM.currentHighlightedElement && FM.indicator.style.display === 'block') {
      const rect = FM.currentHighlightedElement.getBoundingClientRect();
      
      // Update indicator position
      FM.indicator.style.top = `${rect.top}px`;
      FM.indicator.style.left = `${rect.left}px`;
      FM.indicator.style.width = `${rect.width}px`;
      FM.indicator.style.height = `${rect.height}px`;
      
      // Update tooltip position
      if (FM.valueTooltip.style.display === 'flex') {
        FM.valueTooltip.style.top = `${rect.top}px`;
        FM.valueTooltip.style.left = `${rect.left}px`;
        FM.valueTooltip.style.width = `${rect.width}px`;
        FM.valueTooltip.style.height = `${rect.height}px`;
      }
    }
    
    // Update label highlight positions if any exist
    const labelHighlights = document.querySelectorAll('.formmaster-label-highlight');
    labelHighlights.forEach(highlight => {
      const associatedElement = Array.from(document.querySelectorAll('*')).find(
        el => el._highlightElement === highlight
      );
      
      if (associatedElement) {
        const rect = associatedElement.getBoundingClientRect();
        highlight.style.top = `${rect.top - 2}px`;
        highlight.style.left = `${rect.left - 2}px`;
        highlight.style.width = `${rect.width + 4}px`;
        highlight.style.height = `${rect.height + 4}px`;
      }
    });
    
    // Update input highlight positions if any exist
    const inputHighlights = document.querySelectorAll('.formmaster-input-highlight');
    inputHighlights.forEach(highlight => {
      const associatedElement = Array.from(document.querySelectorAll('input, select, textarea')).find(
        el => el._highlightElement === highlight
      );
      
      if (associatedElement) {
        const rect = associatedElement.getBoundingClientRect();
        highlight.style.top = `${rect.top - 2}px`;
        highlight.style.left = `${rect.left - 2}px`;
        highlight.style.width = `${rect.width + 4}px`;
        highlight.style.height = `${rect.height + 4}px`;
      }
    });
    
    // Update container highlight position if present
    if (FM.currentHighlightedContainer && FM.currentHighlightedContainer._highlightElement) {
      const highlight = FM.currentHighlightedContainer._highlightElement;
      const rect = FM.currentHighlightedContainer.getBoundingClientRect();
      
      // Update container highlight
      highlight.style.top = `${rect.top}px`;
      highlight.style.left = `${rect.left}px`;
      highlight.style.width = `${rect.width}px`;
      highlight.style.height = `${rect.height}px`;
      
      // Update action buttons
      const buttons = highlight.querySelectorAll('.formmaster-container-button');
      if (buttons.length > 0) {
        // Position the buttons at the bottom of the highlight
        const buttonContainer = highlight.querySelector('.formmaster-container-buttons');
        if (buttonContainer) {
          buttonContainer.style.top = `${rect.height - 30}px`;
        }
      }
    }
  };
  
  /**
   * Updates the positions of label indicators
   */
  FM.updateLabelIndicatorsPositions = function() {
    if (!FM.currentHighlightedLabels || !FM.currentHighlightedLabels.length) return;
    
    FM.currentHighlightedLabels.forEach(label => {
      const labelRect = label.getBoundingClientRect();
      if (label._highlightElement) {
        label._highlightElement.style.top = `${labelRect.top + window.scrollY}px`;
        label._highlightElement.style.left = `${labelRect.left + window.scrollX}px`;
        label._highlightElement.style.width = `${labelRect.width}px`;
        label._highlightElement.style.height = `${labelRect.height}px`;
      }
    });
  };
  
  /**
   * Updates the positions of option indicators
   */
  FM.updateOptionsIndicatorsPositions = function() {
    if (!FM.currentHighlightedOptions || !FM.currentHighlightedOptions.length) return;
    
    FM.currentHighlightedOptions.forEach(option => {
      const optionRect = option.getBoundingClientRect();
      if (option._highlightElement) {
        option._highlightElement.style.top = `${optionRect.top + window.scrollY}px`;
        option._highlightElement.style.left = `${optionRect.left + window.scrollX}px`;
        option._highlightElement.style.width = `${optionRect.width}px`;
        option._highlightElement.style.height = `${optionRect.height}px`;
      }
    });
  };
  
  /**
   * Updates the positions of input highlights
   */
  FM.updateInputHighlightsPositions = function() {
    if (!FM.currentHighlightedInputs || !FM.currentHighlightedInputs.length) return;
    
    FM.currentHighlightedInputs.forEach(input => {
      const inputRect = input.getBoundingClientRect();
      if (input._highlightElement) {
        input._highlightElement.style.top = `${inputRect.top + window.scrollY}px`;
        input._highlightElement.style.left = `${inputRect.left + window.scrollX}px`;
        input._highlightElement.style.width = `${inputRect.width}px`;
        input._highlightElement.style.height = `${inputRect.height}px`;
      }
    });
  };
  
  // Throttle the position updater to improve performance
  function throttle(func, delay) {
    let lastCall = 0;
    return function(...args) {
      const now = new Date().getTime();
      if (now - lastCall < delay) {
        return;
      }
      lastCall = now;
      return func(...args);
    }
  }
  
  // Create throttled version of the position updater
  FM.throttledUpdatePosition = throttle(FM.updateIndicatorPosition, 16); // ~60fps
})(); 