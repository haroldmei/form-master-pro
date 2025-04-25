// UIState Module - Global UI elements and state management
(function() {
  // Define variables in the global scope to make them accessible to other scripts
  window.FormMaster = window.FormMaster || {};
  const FM = window.FormMaster;
  
  // UI elements
  FM.indicator = null;
  FM.valueTooltip = null;
  FM.valueText = null;
  FM.labelIndicator = null;
  FM.optionsIndicator = null;
  FM.currentHighlightedElement = null;
  FM.currentHighlightedLabels = [];
  FM.currentHighlightedOptions = [];
  FM.currentHighlightedInputs = [];
  FM.currentHighlightedContainer = null;
  FM.valueMap = new Map();

  /**
   * Initialize the UI state
   */
  FM.initUIState = function() {
    FM.indicator = null;
    FM.valueTooltip = null;
    FM.valueText = null;
    FM.labelIndicator = null;
    FM.optionsIndicator = null;
    FM.currentHighlightedElement = null;
    FM.currentHighlightedLabels = [];
    FM.currentHighlightedOptions = [];
    FM.currentHighlightedInputs = [];
    FM.currentHighlightedContainer = null;
    FM.valueMap = new Map();
  };

  /**
   * Create UI elements for form field visualization
   */
  FM.createUIElements = function() {
    // Check if there's an existing indicator and remove it
    const existingIndicator = document.getElementById('formmaster-click-indicator');
    if (existingIndicator) {
      existingIndicator.parentNode.removeChild(existingIndicator);
    }
    
    // Create highlight indicator
    FM.indicator = document.createElement('div');
    FM.indicator.id = 'formmaster-click-indicator';
    FM.indicator.style.cssText = `
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
    FM.labelIndicator = document.createElement('div');
    FM.labelIndicator.id = 'formmaster-label-indicator';
    FM.labelIndicator.style.cssText = `
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
    FM.optionsIndicator = document.createElement('div');
    FM.optionsIndicator.id = 'formmaster-options-indicator';
    FM.optionsIndicator.style.cssText = `
      position: absolute;
      pointer-events: none;
      z-index: 999997;
    `;
    
    // Create value tooltip element
    FM.valueTooltip = document.createElement('div');
    FM.valueTooltip.id = 'formmaster-value-tooltip';
    FM.valueTooltip.style.cssText = `
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
    FM.valueText = document.createElement('span');
    FM.valueText.style.cssText = `
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
    FM.valueTooltip.appendChild(FM.valueText);
    
    document.body.appendChild(FM.indicator);
    document.body.appendChild(FM.valueTooltip);
    document.body.appendChild(FM.labelIndicator);
    document.body.appendChild(FM.optionsIndicator);
    
    // Reset highlighted elements tracking
    FM.currentHighlightedElement = null;
    FM.currentHighlightedLabels = [];
    FM.currentHighlightedOptions = [];
    FM.currentHighlightedInputs = [];
    FM.currentHighlightedContainer = null;
  };

  /**
   * Clean up UI elements 
   */
  FM.cleanupUIElements = function() {
    if (FM.indicator && FM.indicator.parentNode) {
      FM.indicator.parentNode.removeChild(FM.indicator);
    }
    
    if (FM.valueTooltip && FM.valueTooltip.parentNode) {
      FM.valueTooltip.parentNode.removeChild(FM.valueTooltip);
    }
    
    if (FM.labelIndicator && FM.labelIndicator.parentNode) {
      FM.labelIndicator.parentNode.removeChild(FM.labelIndicator);
    }
    
    if (FM.optionsIndicator && FM.optionsIndicator.parentNode) {
      FM.optionsIndicator.parentNode.removeChild(FM.optionsIndicator);
    }
  };

})(); 