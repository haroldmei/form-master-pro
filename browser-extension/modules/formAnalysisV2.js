/**
 * Form analysis V2 module - Advanced form control detection and analysis
 */
const formAnalysisV2 = (() => {
  // Element highlighting styles
  const CONTAINER_HIGHLIGHT_CLASS = 'fm-container-highlight';
  
  
  // Development mode flag
  let devMode = true;
  
  // Form control analysis data
  let formControls = [];
  
  /**
   * Analyze the current form with form controls, labels, and containers
   * @param {HTMLElement} analyzeFormBtn - The button that was clicked to trigger analysis
   * @param {Function} showToastCallback - Callback to show toast messages in the UI
   */
  function analyzeCurrentForm(analyzeFormBtn, showToastCallback) {
    // Set button to loading state
    if (analyzeFormBtn) {
      analyzeFormBtn.disabled = true;
      analyzeFormBtn.textContent = 'Analyzing...';
    }
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      // Execute script to analyze the form in the active tab
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        function: performFormAnalysis,
        args: [devMode, 'fm-container-highlight', 'fm-label-highlight', 'fm-option-highlight', 'fm-input-highlight']
      }, results => {
        // Reset button state
        if (analyzeFormBtn) {
          analyzeFormBtn.disabled = false;
          analyzeFormBtn.textContent = 'Analyze Current Form';
        }
        
        console.log('Results:', results);
        if (results && results[0] && results[0].result) {
          const controlCount = results[0].result.count || 0;
          showToastCallback(`Analyzed ${controlCount} form controls`, 'success');
        } else {
          showToastCallback('No form controls detected or error analyzing form.', 'error');
        }
      });
    });
  }
  
  /**
   * Function that will be injected into the page to perform form analysis
   * @param {boolean} devMode - Whether to run in development mode with additional debugging
   * @param {string} containerClass - CSS class name for container highlights
   * @param {string} labelClass - CSS class name for label highlights
   * @param {string} optionClass - CSS class name for option highlights
   * @param {string} inputClass - CSS class name for input highlights
   * @returns {Object} Analysis results with control count and data
   */
  function performFormAnalysis(devMode, containerClass, optionClass, inputClass) {
    // Set constants for highlighting classes within this function scope
    const CONTAINER_HIGHLIGHT_CLASS = containerClass;
    
    // Create or get the FormMaster object
    const FM = window.FormMaster = window.FormMaster || {};
    
    // Create CSS styles for highlights if they don't exist
    if (!document.getElementById('fm-highlight-styles')) {
      const style = document.createElement('style');
      style.id = 'fm-highlight-styles';
      style.textContent = `
        .${CONTAINER_HIGHLIGHT_CLASS} {
          outline: 2px dashed rgba(255, 165, 0, 0.7) !important;
          background-color: rgba(255, 165, 0, 0.1) !important;
          position: relative !important;
          z-index: 999 !important;
          transition: outline-color 0.3s ease;
        }
        .${CONTAINER_HIGHLIGHT_CLASS}:hover {
          outline-color: rgba(255, 165, 0, 1) !important;
        }
        .fm-tooltip {
          position: absolute;
          background: rgba(0, 0, 0, 0.8);
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          z-index: 10000;
          pointer-events: none;
          max-width: 300px;
          box-shadow: 0 2px 5px rgba(0,0,0,0.2);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .fm-badge {
          display: inline-block;
          background: #0d6efd;
          color: white;
          border-radius: 10px;
          padding: 0 6px;
          font-size: 10px;
          margin-left: 4px;
          position: absolute;
          top: -5px;
          right: -5px;
        }
      `;
      document.head.appendChild(style);
    }
    
    // Form control analysis results
    let formControls = [];
    
    // Clear any existing highlights
    clearAllHighlights();
    
    // Get all form controls
    const inputs = document.querySelectorAll('input:not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="hidden"])');
    const selects = document.querySelectorAll('select');
    const textareas = document.querySelectorAll('textarea');
    
    // Process each type of control
    processFormElements(inputs);
    processFormElements(selects);
    processFormElements(textareas);
    
    // If in dev mode, add visual highlights and console output
    if (devMode) {
      console.group('FormMasterPro Form Analysis V2');
      console.log(`Analyzed ${formControls.length} form controls`);
      
      formControls.forEach((control, index) => {
        // Log to console
        console.group(`Control #${index + 1}: ${control.type} ${control.id ? '#' + control.id : ''}`);
        console.log('Element:', control.element);
        console.log('Labels:', control.labels);
        console.log('Options:', control.options);
        console.log('Container:', control.container);
        console.groupEnd();
        
        // Highlight the elements
        highlightFormControl(control);
      });
      
      console.groupEnd();
    }
    
    /**
     * Process a collection of form elements
     * @param {NodeList} elements - Collection of form elements to process
     */
    function processFormElements(elements) {
      elements.forEach(element => {
        const controlInfo = analyzeFormControl(element);
        if (controlInfo) {
          formControls.push(controlInfo);
        }
      });
    }
    
    /**
     * Analyze a single form control to extract all relevant information
     * @param {HTMLElement} element - The form control element
     * @returns {Object} Information about the form control
     */
    function analyzeFormControl(element) {
      // Basic element information
      const controlInfo = {
        element: element,
        id: element.id,
        name: element.name,
        type: element.type || element.tagName.toLowerCase(),
        value: element.value,
        placeholder: element.placeholder,
        required: element.required,
        disabled: element.disabled,
        labels: [], // Will contain label text and elements
        options: [], // Will contain options if applicable
        container: null // Will contain parent container element
      };
      
      // Special handling for checkboxes and radio buttons
      if (element.type === 'checkbox' || element.type === 'radio') {
        controlInfo.checked = element.checked;
        controlInfo.value = element.checked;
      }
      
      // Find labels
      findLabels(element, controlInfo);
      
      // Find options for select elements
      if (element.tagName === 'SELECT') {
        findSelectOptions(element, controlInfo);
      }
      
      // Find options for radio buttons (same name groups)
      if (element.type === 'radio' && element.name) {
        findRadioOptions(element, controlInfo);
      }
      
      // Find parent container
      findParentContainer(element, controlInfo);
      
      return controlInfo;
    }
    
    /**
     * Find all labels associated with a form control
     * @param {HTMLElement} element - The form control element
     * @param {Object} controlInfo - The control info object to update
     */
    function findLabels(element, controlInfo) {
      // Method 1: Check for explicit label with 'for' attribute
      if (element.id) {
        const explicitLabels = document.querySelectorAll(`label[for="${element.id}"]`);
        explicitLabels.forEach(label => {
          controlInfo.labels.push({
            element: label,
            text: label.textContent.trim(),
            type: 'explicit'
          });
        });
      }
      
      // Method 2: Check for ancestor label (implicit label)
      let parent = element.parentElement;
      while (parent && parent.tagName !== 'BODY') {
        if (parent.tagName === 'LABEL') {
          controlInfo.labels.push({
            element: parent,
            text: parent.textContent.trim().replace(element.value || '', ''),
            type: 'implicit'
          });
          break;
        }
        parent = parent.parentElement;
      }
      
      // Method 3: Check for preceding text or elements that might be labels
      if (controlInfo.labels.length === 0) {
        const previousElement = element.previousElementSibling;
        if (previousElement && 
            (previousElement.tagName === 'SPAN' || 
             previousElement.tagName === 'DIV' || 
             previousElement.tagName === 'P')) {
          controlInfo.labels.push({
            element: previousElement,
            text: previousElement.textContent.trim(),
            type: 'preceding'
          });
        }
      }
      
      // Method 4: Look for aria-labelledby
      if (element.hasAttribute('aria-labelledby')) {
        const labelIds = element.getAttribute('aria-labelledby').split(' ');
        labelIds.forEach(id => {
          const labelElement = document.getElementById(id);
          if (labelElement) {
            controlInfo.labels.push({
              element: labelElement,
              text: labelElement.textContent.trim(),
              type: 'aria-labelledby'
            });
          }
        });
      }
      
      // Method 5: Check for aria-label
      if (element.hasAttribute('aria-label')) {
        controlInfo.labels.push({
          element: null,
          text: element.getAttribute('aria-label').trim(),
          type: 'aria-label'
        });
      }
      
      // If still no label found, use placeholder or name as fallback
      if (controlInfo.labels.length === 0) {
        if (element.placeholder) {
          controlInfo.labels.push({
            element: null,
            text: element.placeholder,
            type: 'placeholder'
          });
        } else if (element.name) {
          controlInfo.labels.push({
            element: null,
            text: element.name.replace(/[-_]/g, ' '),
            type: 'name'
          });
        }
      }
    }
    
    /**
     * Find options for select elements
     * @param {HTMLSelectElement} element - The select element
     * @param {Object} controlInfo - The control info object to update
     */
    function findSelectOptions(element, controlInfo) {
      const options = Array.from(element.options);
      options.forEach(option => {
        controlInfo.options.push({
          element: option,
          value: option.value,
          text: option.text.trim(),
          selected: option.selected
        });
      });
    }
    
    /**
     * Find options for radio button groups
     * @param {HTMLInputElement} element - The radio button element
     * @param {Object} controlInfo - The control info object to update
     */
    function findRadioOptions(element, controlInfo) {
      const name = element.name;
      const radioGroup = document.querySelectorAll(`input[type="radio"][name="${name}"]`);
      
      radioGroup.forEach(radio => {
        // Find the label for this radio
        let labelText = '';
        const explicitLabel = radio.id ? document.querySelector(`label[for="${radio.id}"]`) : null;
        
        if (explicitLabel) {
          labelText = explicitLabel.textContent.trim();
        } else {
          // Check for parent label
          let parent = radio.parentElement;
          while (parent && parent.tagName !== 'BODY') {
            if (parent.tagName === 'LABEL') {
              labelText = parent.textContent.trim();
              break;
            }
            parent = parent.parentElement;
          }
        }
        
        controlInfo.options.push({
          element: radio,
          value: radio.value,
          text: labelText || radio.value,
          selected: radio.checked
        });
      });
    }
    
    /**
     * Find the parent container of a form control
     * @param {HTMLElement} element - The form control element
     * @param {Object} controlInfo - The control info object to update
     */
    function findParentContainer(element, controlInfo) {
      // Try to find a semantic parent first (like form-group, input-group, etc.)
      let parent = element.parentElement;
      let container = null;
      
      // Look up to 5 levels up
      for (let i = 0; i < 5 && parent && parent.tagName !== 'BODY' && parent.tagName !== 'FORM'; i++) {
        // Check for common container classes
        const className = parent.className.toLowerCase();
        if (className.includes('form-group') || 
            className.includes('input-group') || 
            className.includes('form-field') || 
            className.includes('input-field') ||
            className.includes('form-control-container') || 
            className.includes('field-wrapper')) {
          container = parent;
          break;
        }
        
        // Check if this contains the element and its label
        if (controlInfo.labels.length > 0) {
          const labelElement = controlInfo.labels[0].element;
          if (labelElement && parent.contains(labelElement)) {
            container = parent;
            break;
          }
        }
        
        parent = parent.parentElement;
      }
      
      // If no semantic container found, use immediate parent as fallback
      if (!container) {
        container = element.parentElement;
      }
      
      controlInfo.container = container;
    }
    
    /**
     * Highlight a form control and its related elements for visual debugging
     * @param {Object} control - The control info object
     */
    function highlightFormControl(control) {
      
      // Highlight the container element
      if (control.container) {
        control.container.classList.add(CONTAINER_HIGHLIGHT_CLASS);
        
        
        // Add click event to toggle highlighting
        control.container.addEventListener('click', function(e) {
          // Prevent default only if explicitly clicking the container (not a child input)
          if (e.target === control.container) {
            e.preventDefault();
            e.stopPropagation();
            
            // Toggle highlight
            this.classList.toggle(CONTAINER_HIGHLIGHT_CLASS);
          }
        });
      }
    }
    
    /**
     * Clear all highlights from the page
     */
    function clearAllHighlights() {
      // Remove all highlight classes
      document.querySelectorAll(`.${CONTAINER_HIGHLIGHT_CLASS}`)
        .forEach(el => {
          el.classList.remove(CONTAINER_HIGHLIGHT_CLASS);
        });
      
      // Remove all tooltips
      document.querySelectorAll('.fm-tooltip').forEach(tooltip => {
        tooltip.parentNode.removeChild(tooltip);
      });
    }
    
    // Return a simplified version of the form controls
    // that can be serialized for message passing
    const serializableControls = formControls.map(control => {
      // Convert DOM elements to descriptions
      return {
        id: control.id,
        name: control.name,
        type: control.type,
        value: control.value,
        placeholder: control.placeholder,
        required: control.required,
        disabled: control.disabled,
        checked: control.checked,
        labels: control.labels.map(label => ({
          text: label.text,
          type: label.type
        })),
        options: control.options.map(option => ({
          value: option.value,
          text: option.text,
          selected: option.selected
        })),
        containerDesc: control.container ? {
          tagName: control.container.tagName,
          className: control.container.className,
          id: control.container.id
        } : null
      };
    });
    
    return {
      count: formControls.length,
      controls: serializableControls
    };
  }
    
  // Public API
  return {
    analyzeCurrentForm
  };
})();

// Expose the module to the global scope
self.formAnalysisV2 = formAnalysisV2; 