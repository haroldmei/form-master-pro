/**
 * Form analysis V2 module - Advanced form control detection and analysis
 */
const formAnalysisV3 = (() => {
  // Element highlighting styles
  const CONTAINER_HIGHLIGHT_CLASS = 'fm-container-highlight';
  const CONTAINER_HIGHLIGHT_AICODE_CLASS = 'fm-container-highlight-aicode';
  
  
  // Development mode flag
  let devMode = true;
  
  // Form control analysis data
  let formControls = [];
  
  // Field mappings dictionary to store in local storage
  let fieldMappingsV2 = {};
  
  /**
   * Save field mappings to local storage using the page URL as the key
   * @param {Array} serializableControls - Array of form controls to save
   */
  function saveFieldMappingsToStorage(serializableControls) {
    if (!serializableControls || !serializableControls.length) return;
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs && tabs[0] && tabs[0].url) {
        // Get the root URL (domain) as the key
        const url = new URL(tabs[0].url);
        const rootUrl = url.origin;
        
        // Update the mappings dictionary
        fieldMappingsV2[rootUrl] = serializableControls;
        
        // Save to local storage
        chrome.storage.local.set({'fieldMappingsV2': fieldMappingsV2}, function() {
          if (devMode) {
            console.log('Field mappings saved to local storage:', rootUrl, serializableControls);
          }
        });
      }
    });
  }
  
  /**
   * Load field mappings from local storage
   * @param {Function} callback - Callback function to handle the loaded mappings
   */
  function loadFieldMappingsFromStorage(callback) {
    chrome.storage.local.get('fieldMappingsV2', function(result) {
      if (result && result.fieldMappingsV2) {
        fieldMappingsV2 = result.fieldMappingsV2;
        if (callback && typeof callback === 'function') {
          callback(fieldMappingsV2);
        }
      }
    });
  }
  
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
      // Get the current URL for retrieving existing mappings
      const url = new URL(tabs[0].url);
      const rootUrl = url.origin;
      
      // First, load any existing field mappings for this URL
      chrome.storage.local.get('fieldMappingsV2', function(result) {
        let existingMappings = [];
        
        // Check if we have mappings for this URL
        if (result && result.fieldMappingsV2 && result.fieldMappingsV2[rootUrl]) {
          existingMappings = result.fieldMappingsV2[rootUrl];
          if (devMode) {
            console.log('Found existing mappings for URL:', rootUrl, existingMappings);
          }
        }
        
        // Execute script to analyze the form in the active tab
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          function: performFormAnalysis,
          args: [devMode, 'fm-container-highlight', 'fm-label-highlight', 'fm-option-highlight', 'fm-input-highlight', existingMappings]
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
    });
  }
  
  /**
   * Function that will be injected into the page to perform form analysis
   * @param {boolean} devMode - Whether to run in development mode with additional debugging
   * @param {string} containerClass - CSS class name for container highlights
   * @param {string} labelClass - CSS class name for label highlights
   * @param {string} optionClass - CSS class name for option highlights
   * @param {string} inputClass - CSS class name for input highlights
   * @param {Array} existingMappings - Existing mappings from storage
   * @returns {Object} Analysis results with control count and data
   */
  function performFormAnalysis(devMode, containerClass, labelClass, optionClass, inputClass, existingMappings = []) {
    // Set constants for highlighting classes within this function scope
    const CONTAINER_HIGHLIGHT_CLASS = containerClass;
    const CONTAINER_HIGHLIGHT_AICODE_CLASS = 'fm-container-highlight-aicode';
    
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
        .${CONTAINER_HIGHLIGHT_AICODE_CLASS} {
          outline: 2px dashed rgba(0, 128, 0, 0.7) !important;
          background-color: rgba(0, 128, 0, 0.1) !important;
          position: relative !important;
          z-index: 999 !important;
          transition: outline-color 0.3s ease;
        }
        .${CONTAINER_HIGHLIGHT_AICODE_CLASS}:hover {
          outline-color: rgba(0, 128, 0, 1) !important;
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
        .fm-nav-buttons {
          position: absolute;
          top: 0;
          right: 0;
          display: flex;
          flex-direction: row;
          z-index: 10001;
        }
        .fm-nav-button {
          background: rgba(255, 165, 0, 0.9);
          color: white;
          border: none;
          width: 20px;
          height: 20px;
          margin: 2px;
          padding: 0;
          font-size: 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 3px;
          transition: background-color 0.2s;
        }
        .fm-nav-button:hover {
          background: rgba(255, 140, 0, 1);
        }
        .fm-nav-button:disabled {
          background: rgba(200, 200, 200, 0.7);
          cursor: not-allowed;
        }
      `;
      document.head.appendChild(style);
    }
    
    // Form control analysis results
    let formControls = [];
    
    // Map to track elements we've already processed using existing mappings
    const processedElements = new Map();
    
    // Expose the form controls through the global FormMaster object
    FM.formControls = formControls;
    
    // Add an event listener for container changes
    document.addEventListener('fm-container-changed', function(e) {
      // Get the control from the formControls array using the provided index
      const controlIndex = e.detail.controlIndex;
      
      // Update the serializable controls when containers change
      const updatedControls = formControls.map(control => {
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
          aicode: control.aicode,
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
            id: control.container.id,
            // Save container as a string representation instead of DOM element
            html: control.container.outerHTML,
            attributes: Array.from(control.container.attributes).map(attr => ({
              name: attr.name,
              value: attr.value
            })),
            path: getElementPath(control.container),
            xpath: getElementXPath(control.container),
            // Also save the aicode with the container description
            aicode: control.aicode
          } : null
        };
      });
      
      // Update the global serializable controls
      FM.serializableControls = updatedControls;
      
      // Save updated controls to local storage using current URL as key
      const rootUrl = window.location.origin;
      // Use postMessage to communicate with the extension context for storage access
      window.postMessage({
        type: 'FM_SAVE_FIELD_MAPPINGS',
        payload: {
          rootUrl: rootUrl,
          controls: updatedControls
        }
      }, '*');
      
      // Log the update if in dev mode
      if (devMode) {
        console.log('Form controls updated:', updatedControls);
        console.log('Requested storage update for URL:', rootUrl);
      }
    });
    
    // Clear any existing highlights
    clearAllHighlights();
    
    // First try to use existing mappings if available
    if (existingMappings && existingMappings.length > 0) {
      if (devMode) {
        console.log('Found existing field mappings, attempting to apply stored containers', existingMappings);
      }
      
      existingMappings.forEach(mapping => {
        // Try to find the form element by id or name
        let element = null;
        
        if (mapping.id) {
          element = document.getElementById(mapping.id);
        }
        
        // If not found by ID, try by name
        if (!element && mapping.name) {
          const elements = document.getElementsByName(mapping.name);
          if (elements.length > 0) {
            element = elements[0];
          }
        }
        
        // If we found the element and it has a valid container mapping
        if (element && mapping.containerDesc) {
          let container = null;
          
          // Try using xpath if available and container still not found
          if (!container && mapping.containerDesc.xpath) {
            container = findContainerByXPath(mapping.containerDesc.xpath);
            console.log('Container not found:', mapping.containerDesc.xpath, container); 
          }
          

          // If we found the container
          if (container) {
            // Create a control info object with the existing container reference
            const controlInfo = analyzeFormControl(element);
            if (controlInfo) {
              // Override with the stored container
              controlInfo.container = container;
              // Store path and xpath properties for easier lookup
              controlInfo.containerPath = mapping.containerDesc.path;
              controlInfo.containerXPath = mapping.containerDesc.xpath;
              
              // Check if the mapping has an aicode and store it
              if (mapping.aicode) {
                controlInfo.aicode = mapping.aicode;
              }
              
              formControls.push(controlInfo);
              processedElements.set(element, true);
              
              if (devMode) {
                console.log('Applied existing container to element:', element, container);
              }
            }
          }
        }
      });
    }
    
    // Get all form controls
    const inputs = document.querySelectorAll('input:not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="hidden"])');
    const selects = document.querySelectorAll('select');
    const textareas = document.querySelectorAll('textarea');
    
    // Modified processFormElements to skip elements we've already processed
    function processFormElements(elements) {
      // First, identify radio groups
      const radioGroups = new Map(); // Maps name -> array of radio buttons
      
      // Group radio buttons by name
      elements.forEach(element => {
        if (element.type === 'radio' && element.name) {
          if (!radioGroups.has(element.name)) {
            radioGroups.set(element.name, []);
          }
          radioGroups.get(element.name).push(element);
        }
      });
      
      // Process radio groups as a single entity
      radioGroups.forEach((radios, name) => {
        // Skip if we've already processed any radio in this group using existing mappings
        const alreadyProcessed = radios.some(radio => processedElements.has(radio));
        if (alreadyProcessed) return;
        
        // We'll use the first radio as the representative for the group
        const primaryRadio = radios[0];
        
        // Create a control info and update it with group info
        const controlInfo = analyzeFormControl(primaryRadio);
        if (controlInfo) {
          // Ensure the options are added for all radio buttons in the group
          controlInfo.groupElements = radios; // Store all radios for reference
          formControls.push(controlInfo);
          
          // Mark all radios in this group as processed
          radios.forEach(radio => processedElements.set(radio, true));
        }
      });
      
      // Process non-radio elements normally
      elements.forEach(element => {
        // Skip if we've already processed this element 
        // Or if it's a radio button (handled separately above)
        if (processedElements.has(element) || (element.type === 'radio' && element.name)) {
          return;
        }
        
        const controlInfo = analyzeFormControl(element);
        if (controlInfo) {
          formControls.push(controlInfo);
        }
      });
    }
    
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
        // console.group(`Control #${index + 1}: ${control.type} ${control.id ? '#' + control.id : ''}`);
        // console.log('Element:', control.element);
        // console.log('Labels:', control.labels);
        // console.log('Options:', control.options);
        // console.log('Container:', control.container);
        // console.groupEnd();
        
        // Highlight the elements
        highlightFormControl(control);
      });
      
      console.groupEnd();
    }
    
    /**
     * Highlight a form control and its related elements for visual debugging
     * @param {Object} control - The control info object
     */
    function highlightFormControl(control) {
      // Highlight the container element
      if (control.container) {
        // Apply the appropriate highlight class based on whether the control has aicode
        if (control.aicode) {
          control.container.classList.add(CONTAINER_HIGHLIGHT_AICODE_CLASS);
        } else {
          control.container.classList.add(CONTAINER_HIGHLIGHT_CLASS);
        }
        
        // Add navigation buttons
        const navButtonsContainer = document.createElement('div');
        navButtonsContainer.className = 'fm-nav-buttons';
        
        // Up button (to parent)
        const upButton = document.createElement('button');
        upButton.className = 'fm-nav-button';
        upButton.title = 'Move to parent container';
        upButton.innerHTML = '↑';
        upButton.disabled = !control.container.parentElement || control.container.parentElement.tagName === 'BODY';
        
        // Down button (to child)
        const downButton = document.createElement('button');
        downButton.className = 'fm-nav-button';
        downButton.title = 'Move to child container';
        downButton.innerHTML = '↓';
        
        // Check if there are valid child containers that contain the original element
        const childContainers = Array.from(control.container.children).filter(child => 
          child.nodeType === Node.ELEMENT_NODE && 
          child.contains(control.element) && 
          child !== control.element
        );
        
        downButton.disabled = childContainers.length === 0;
        
        // Add buttons to container
        navButtonsContainer.appendChild(upButton);
        navButtonsContainer.appendChild(downButton);
        
        // Only add if not already there
        if (!control.container.querySelector('.fm-nav-buttons')) {
          control.container.appendChild(navButtonsContainer);
        }
        
        // Track the current container and original element
        let currentContainer = control.container;
        let originalElement = control.element;
        
        // Track the control's index in the formControls array
        const controlIndex = formControls.indexOf(control);
        
        // Up button click handler
        upButton.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          
          // Only proceed if there's a parent and it's not the body
          if (currentContainer.parentElement && currentContainer.parentElement.tagName !== 'BODY') {
            // Remove highlight from current container
            currentContainer.classList.remove(CONTAINER_HIGHLIGHT_CLASS);
            currentContainer.classList.remove(CONTAINER_HIGHLIGHT_AICODE_CLASS);
            
            // Move to parent
            currentContainer = currentContainer.parentElement;
            
            // Apply highlight to new container
            if (control.aicode) {
              currentContainer.classList.add(CONTAINER_HIGHLIGHT_AICODE_CLASS);
            } else {
              currentContainer.classList.add(CONTAINER_HIGHLIGHT_CLASS);
            }
            
            // Move navigation buttons to new container
            if (navButtonsContainer.parentNode) {
              navButtonsContainer.parentNode.removeChild(navButtonsContainer);
            }
            currentContainer.appendChild(navButtonsContainer);
            
            // Update button states
            upButton.disabled = !currentContainer.parentElement || currentContainer.parentElement.tagName === 'BODY';
            
            // Check for valid children in the new container
            const newChildContainers = Array.from(currentContainer.children).filter(child => 
              child !== navButtonsContainer &&
              child.nodeType === Node.ELEMENT_NODE && 
              child.contains(originalElement) && 
              child !== originalElement
            );
            
            downButton.disabled = newChildContainers.length === 0;
            
            // Update the control in the formControls array
            if (controlIndex >= 0) {
              formControls[controlIndex].container = currentContainer;
              // Update path and xpath for the new container
              formControls[controlIndex].containerPath = getElementPath(currentContainer);
              formControls[controlIndex].containerXPath = getElementXPath(currentContainer);
              
              // Fire a custom event to notify about the container change
              const event = new CustomEvent('fm-container-changed', {
                detail: {
                  controlIndex: controlIndex,
                  newContainer: currentContainer,
                  // Add containerInfo object with serializable details
                  containerInfo: {
                    tagName: currentContainer.tagName,
                    className: currentContainer.className,
                    id: currentContainer.id,
                    html: currentContainer.outerHTML,
                    attributes: Array.from(currentContainer.attributes).map(attr => ({
                      name: attr.name,
                      value: attr.value
                    })),
                    path: getElementPath(currentContainer),
                    xpath: getElementXPath(currentContainer),
                    // Keep the aicode reference when container is changed
                    aicode: formControls[controlIndex].aicode
                  }
                }
              });
              document.dispatchEvent(event);
              
              // Log the change if in dev mode
              if (devMode) {
                console.log(`Control #${controlIndex + 1} container updated:`, currentContainer);
                console.log(`New path: ${formControls[controlIndex].containerPath}`);
                console.log(`New xpath: ${formControls[controlIndex].containerXPath}`);
              }
            }
          }
        });
        
        // Down button click handler
        downButton.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          
          // Find child containers that contain the original form element
          const validChildren = Array.from(currentContainer.children).filter(child => 
            child !== navButtonsContainer &&
            child.nodeType === Node.ELEMENT_NODE && 
            child.contains(originalElement) && 
            child !== originalElement
          );
          
          if (validChildren.length > 0) {
            // Remove highlight from current container
            currentContainer.classList.remove(CONTAINER_HIGHLIGHT_CLASS);
            currentContainer.classList.remove(CONTAINER_HIGHLIGHT_AICODE_CLASS);
            
            // Move to first valid child
            currentContainer = validChildren[0];
            
            // Apply highlight to new container
            if (control.aicode) {
              currentContainer.classList.add(CONTAINER_HIGHLIGHT_AICODE_CLASS);
            } else {
              currentContainer.classList.add(CONTAINER_HIGHLIGHT_CLASS);
            }
            
            // Move navigation buttons to new container
            if (navButtonsContainer.parentNode) {
              navButtonsContainer.parentNode.removeChild(navButtonsContainer);
            }
            currentContainer.appendChild(navButtonsContainer);
            
            // Update button states
            upButton.disabled = false; // We can always go back up since we just went down
            
            // Check for valid children in the new container
            const newChildContainers = Array.from(currentContainer.children).filter(child => 
              child !== navButtonsContainer &&
              child.nodeType === Node.ELEMENT_NODE && 
              child.contains(originalElement) && 
              child !== originalElement
            );
            
            downButton.disabled = newChildContainers.length === 0;
            
            // Update the control in the formControls array
            if (controlIndex >= 0) {
              formControls[controlIndex].container = currentContainer;
              // Update path and xpath for the new container
              formControls[controlIndex].containerPath = getElementPath(currentContainer);
              formControls[controlIndex].containerXPath = getElementXPath(currentContainer);
              
              // Fire a custom event to notify about the container change
              const event = new CustomEvent('fm-container-changed', {
                detail: {
                  controlIndex: controlIndex,
                  newContainer: currentContainer,
                  // Add containerInfo object with serializable details
                  containerInfo: {
                    tagName: currentContainer.tagName,
                    className: currentContainer.className,
                    id: currentContainer.id,
                    html: currentContainer.outerHTML,
                    attributes: Array.from(currentContainer.attributes).map(attr => ({
                      name: attr.name,
                      value: attr.value
                    })),
                    path: getElementPath(currentContainer),
                    xpath: getElementXPath(currentContainer),
                    // Keep the aicode reference when container is changed
                    aicode: formControls[controlIndex].aicode
                  }
                }
              });
              document.dispatchEvent(event);
              
              // Log the change if in dev mode
              if (devMode) {
                console.log(`Control #${controlIndex + 1} container updated:`, currentContainer);
                console.log(`New path: ${formControls[controlIndex].containerPath}`);
                console.log(`New xpath: ${formControls[controlIndex].containerXPath}`);
              }
            }
          }
        });
        
        // Add click event to toggle highlighting (preserve existing functionality)
        control.container.addEventListener('click', function(e) {
          // Prevent default only if explicitly clicking the container (not a child input or button)
          if (e.target === control.container) {
            e.preventDefault();
            e.stopPropagation();
            
            // Toggle highlight
            if (control.aicode) {
              this.classList.toggle(CONTAINER_HIGHLIGHT_AICODE_CLASS);
            } else {
              this.classList.toggle(CONTAINER_HIGHLIGHT_CLASS);
            }
          }
        });
      }
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
        aicode: null, // Initialize aicode property to null
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
     * Find the parent container of a form control
     * @param {HTMLElement} element - The form control element
     * @param {Object} controlInfo - The control info object to update
     */
    function findParentContainer(element, controlInfo) {
      // If container is already set (e.g., by findRadioOptions), don't override it
      if (controlInfo.container) {
        return;
      }
      
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
      // Get all radios in this group, either from stored groupElements or by querying
      const radioGroup = controlInfo.groupElements || 
                         document.querySelectorAll(`input[type="radio"][name="${name}"]`);
      
      // Find common container for all radio buttons in the group
      let commonContainer = null;
      
      // If there are multiple radio buttons, try to find a common container
      if (radioGroup.length > 1) {
        // Try finding common container by DOM structure first
        commonContainer = findCommonAncestor(radioGroup);
        
        // If no common container found using DOM structure, try more advanced techniques
        if (!commonContainer || commonContainer === document.body) {
          commonContainer = findBestRadioGroupContainer(radioGroup);
        }
      }
      
      // If we found a common container, use it
      if (commonContainer && commonContainer !== document.body) {
        controlInfo.container = commonContainer;
        controlInfo.isRadioGroup = true; // Mark as radio group for special handling
      }
      
      // Gather all options from the radio group
      controlInfo.options = [];
      radioGroup.forEach(radio => {
        // Find the label for this radio
        let labelText = '';
        let labelElement = null;
        
        // Try explicit label
        if (radio.id) {
          labelElement = document.querySelector(`label[for="${radio.id}"]`);
          if (labelElement) {
            labelText = labelElement.textContent.trim();
          }
        }
        
        // Try implicit label (parent is a label)
        if (!labelText) {
          let parent = radio.parentElement;
          while (parent && parent.tagName !== 'BODY') {
            if (parent.tagName === 'LABEL') {
              labelElement = parent;
              labelText = parent.textContent.trim();
              break;
            }
            parent = parent.parentElement;
          }
        }
        
        // Try nearby text node or simple elements
        if (!labelText) {
          labelText = findNearbyText(radio);
        }
        
        controlInfo.options.push({
          element: radio,
          value: radio.value,
          text: labelText || radio.value,
          selected: radio.checked,
          labelElement: labelElement
        });
      });
      
      // Add a more descriptive label for the radio group if possible
      if (controlInfo.labels.length === 0) {
        // Try to find a legend or heading near the container
        const groupLabel = findRadioGroupLabel(controlInfo.container, radioGroup);
        if (groupLabel) {
          controlInfo.labels.push({
            element: groupLabel.element,
            text: groupLabel.text,
            type: 'group-label'
          });
        }
      }
    }
    
    /**
     * Find the common ancestor of multiple elements
     * @param {Array} elements - Array of DOM elements 
     * @returns {HTMLElement} The common ancestor element
     */
    function findCommonAncestor(elements) {
      if (!elements || elements.length === 0) return null;
      if (elements.length === 1) return elements[0].parentElement;
      
      // Get all ancestors of the first element
      const firstElementAncestors = [];
      let parent = elements[0].parentElement;
      
      while (parent && parent.tagName !== 'BODY' && parent.tagName !== 'HTML') {
        firstElementAncestors.push(parent);
        parent = parent.parentElement;
      }
      
      if (firstElementAncestors.length === 0) return document.body;
      
      // Find the closest common ancestor
      for (let ancestor of firstElementAncestors) {
        let isCommonAncestor = true;
        
        // Check if this ancestor contains all other elements
        for (let i = 1; i < elements.length; i++) {
          if (!ancestor.contains(elements[i])) {
            isCommonAncestor = false;
            break;
          }
        }
        
        if (isCommonAncestor) {
          return ancestor;
        }
      }
      
      // Default to body if no common ancestor found
      return document.body;
    }
    
    /**
     * Find the best container for a radio group using heuristics
     * @param {Array} radioGroup - Array of radio button elements
     * @returns {HTMLElement} The best container element
     */
    function findBestRadioGroupContainer(radioGroup) {
      if (!radioGroup || radioGroup.length === 0) return null;
      
      // Try to find common fieldset, form-group, or similar container
      for (const radio of radioGroup) {
        let parent = radio.parentElement;
        while (parent && parent.tagName !== 'BODY') {
          // Check for semantic containers
          if (parent.tagName === 'FIELDSET' || 
              parent.tagName === 'UL' || 
              parent.tagName === 'OL' ||
              parent.className.toLowerCase().includes('form-group') ||
              parent.className.toLowerCase().includes('radio-group') ||
              parent.className.toLowerCase().includes('option-group')) {
            
            // Check if this container holds all radio buttons
            const containsAll = Array.from(radioGroup).every(r => parent.contains(r));
            if (containsAll) {
              return parent;
            }
          }
          parent = parent.parentElement;
        }
      }
      
      // If no semantic container found, find the smallest common container
      const commonAncestor = findCommonAncestor(radioGroup);
      
      // Try to find a more specific container within the common ancestor
      if (commonAncestor && commonAncestor !== document.body) {
        // Check for div or other container with class indicating a group
        const potentialContainers = Array.from(commonAncestor.querySelectorAll('div, section, article, aside, form, fieldset'))
          .filter(el => {
            // Container must contain all radio buttons
            const containsAll = Array.from(radioGroup).every(r => el.contains(r));
            if (!containsAll) return false;
            
            // Container should have group-like styling or class name
            return el.className.toLowerCase().includes('group') || 
                   el.className.toLowerCase().includes('option') ||
                   el.className.toLowerCase().includes('radio') ||
                   el.className.toLowerCase().includes('choice');
          });
        
        if (potentialContainers.length > 0) {
          // Find the smallest container (most specific)
          return potentialContainers.reduce((smallest, current) => {
            if (!smallest) return current;
            return current.contains(smallest) ? smallest : current;
          }, null);
        }
      }
      
      return commonAncestor;
    }
    
    /**
     * Find nearby text node that may act as a label for a radio button
     * @param {HTMLElement} element - The radio button element
     * @returns {string} The nearby text content
     */
    function findNearbyText(element) {
      // Check for nearby text nodes or simple elements
      const parent = element.parentElement;
      if (!parent) return '';
      
      // Look at child nodes of parent to find text nodes near the radio
      let foundRadio = false;
      let labelText = '';
      
      for (const node of parent.childNodes) {
        if (node === element) {
          foundRadio = true;
        } else if (foundRadio && (node.nodeType === 3 || node.tagName === 'SPAN')) {
          // This is a text node or simple element after the radio
          const text = node.nodeType === 3 ? node.textContent : node.innerText;
          if (text && text.trim()) {
            labelText = text.trim();
            break;
          }
        }
      }
      
      return labelText;
    }
    
    /**
     * Find a label for a radio group (often a legend or heading)
     * @param {HTMLElement} container - The container element
     * @param {Array} radioGroup - Array of radio button elements
     * @returns {Object} Label element and text
     */
    function findRadioGroupLabel(container, radioGroup) {
      if (!container) return null;
      
      // Check for a legend inside fieldset
      if (container.tagName === 'FIELDSET') {
        const legend = container.querySelector('legend');
        if (legend) {
          return {
            element: legend,
            text: legend.textContent.trim()
          };
        }
      }
      
      // Check for headings or strong text inside the container
      const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6, strong, b, [role="heading"]');
      if (headings.length > 0) {
        const heading = headings[0]; // Use the first heading
        return {
          element: heading,
          text: heading.textContent.trim()
        };
      }
      
      // Look for a label or div that seems to be a label (positioned before radio buttons)
      const possibleLabels = Array.from(container.querySelectorAll('label, div, span, p'))
        .filter(el => {
          // Must come before the first radio button in the DOM
          if (!el.compareDocumentPosition) return false;
          const pos = el.compareDocumentPosition(radioGroup[0]);
          const isBefore = pos & Node.DOCUMENT_POSITION_FOLLOWING;
          
          // Should not contain any radio buttons
          const containsRadio = Array.from(radioGroup).some(r => el.contains(r));
          
          return isBefore && !containsRadio && el.textContent.trim().length > 0;
        });
      
      if (possibleLabels.length > 0) {
        return {
          element: possibleLabels[0],
          text: possibleLabels[0].textContent.trim()
        };
      }
      
      return null;
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
      
      document.querySelectorAll(`.${CONTAINER_HIGHLIGHT_AICODE_CLASS}`)
        .forEach(el => {
          el.classList.remove(CONTAINER_HIGHLIGHT_AICODE_CLASS);
        });
      
      // Remove all tooltips
      document.querySelectorAll('.fm-tooltip').forEach(tooltip => {
        tooltip.parentNode.removeChild(tooltip);
      });
      
      // Remove navigation buttons
      document.querySelectorAll('.fm-nav-buttons').forEach(buttons => {
        buttons.parentNode.removeChild(buttons);
      });
    }
    
    
    // Return a simplified version of the form controls
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
        aicode: control.aicode,
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
          id: control.container.id,
          // Save container as a string representation instead of DOM element
          html: control.container.outerHTML,
          attributes: Array.from(control.container.attributes).map(attr => ({
            name: attr.name,
            value: attr.value
          })),
          path: getElementPath(control.container),
          xpath: getElementXPath(control.container),
          // Also save the aicode with the container description
          aicode: control.aicode
        } : null
      };
    });
    
    // Helper function to create a CSS selector path for an element
    function getElementPath(element) {
      if (!element || element === document.body) return '';
      
      let path = '';
      let current = element;
      
      while (current && current !== document.body) {
        let selector = current.tagName.toLowerCase();
        
        if (current.id) {
          selector += '#' + current.id;
        } else {
          // If no ID, use class or position among siblings
          if (current.className) {
            const classes = current.className.split(' ').filter(c => c.trim().length > 0);
            if (classes.length > 0) {
              selector += '.' + classes.join('.');
            }
          }
          
          // Add position if needed
          if (!current.id) {
            let index = 1;
            let sibling = current.previousElementSibling;
            
            while (sibling) {
              if (sibling.tagName === current.tagName) index++;
              sibling = sibling.previousElementSibling;
            }
            
            if (index > 1 || !current.className) {
              selector += `:nth-child(${index})`;
            }
          }
        }
        
        path = selector + (path ? ' > ' + path : '');
        current = current.parentElement;
      }
      
      return path;
    }
    
    // Helper function to get XPath for an element
    function getElementXPath(element) {
      if (!element || element === document.body) return '';
      
      // Try to create a unique XPath using id
      if (element.id) {
        return `//*[@id="${element.id}"]`;
      }
      
      // Try to use other unique attributes if available
      if (element.name) {
        // For inputs, check if the name is unique
        const nameMatches = document.querySelectorAll(`*[name="${element.name}"]`);
        if (nameMatches.length === 1) {
          return `//*[@name="${element.name}"]`;
        }
      }
      
      // If element has a class, try to create a more specific XPath
      if (element.className && typeof element.className === 'string' && element.className.trim()) {
        const classes = element.className.trim().split(/\s+/);
        if (classes.length > 0) {
          // Use the first class as identifier and check if it's reasonably unique
          const classSelector = `//${element.nodeName}[contains(@class, "${classes[0]}")]`;
          try {
            const matches = document.evaluate(
              classSelector, 
              document, 
              null, 
              XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, 
              null
            );
            
            // If reasonably unique (fewer than 5 matches), use this class-based XPath
            if (matches.snapshotLength > 0 && matches.snapshotLength < 5) {
              // Add position if there are multiple elements with this class
              if (matches.snapshotLength > 1) {
                // Find our element's position
                for (let i = 0; i < matches.snapshotLength; i++) {
                  if (matches.snapshotItem(i) === element) {
                    return `(${classSelector})[${i + 1}]`;
                  }
                }
              }
              return classSelector;
            }
          } catch (e) {
            // If error, fall back to full path calculation
          }
        }
      }
      
      // Fall back to a relative path from a parent with ID or unique attribute
      let current = element;
      let path = '';
      let hasUniqueAncestor = false;
      
      while (current && current !== document.body) {
        if (current.id) {
          // Found ancestor with ID, create relative path from here
          return `//*[@id="${current.id}"]${path}`;
        }
        
        // Calculate position among siblings of same type
        let position = 1;
        let sibling = current.previousElementSibling;
        while (sibling) {
          if (sibling.nodeName === current.nodeName) {
            position++;
          }
          sibling = sibling.previousElementSibling;
        }
        
        // Append this node to the path
        const nodeName = current.nodeName;
        path = `/${nodeName}${position > 1 ? `[${position}]` : ''}${path}`;
        
        // Move up to parent
        current = current.parentElement;
      }
      
      // Return the relative path, not starting with / for document
      return `/${path}`;
    }

    // Function to find container by XPath with better error handling and fallbacks
    function findContainerByXPath(xpath) {
      if (!xpath) return null;
      
      // Try the exact XPath first
      try {
        const result = document.evaluate(
          xpath,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        );
        
        if (result.singleNodeValue) {
          return result.singleNodeValue;
        }
      } catch (e) {
        if (devMode) {
          console.warn('Error evaluating exact XPath:', xpath, e);
        }
      }
      
      // Try a case-insensitive version as fallback
      try {
        // Create a lowercase version of the XPath by replacing tag names
        const lowercaseXPath = xpath.replace(/\/([A-Z]+)(\[|\b|$)/g, function(match, p1, p2) {
          return '/' + p1.toLowerCase() + p2;
        });
        
        if (lowercaseXPath !== xpath) {
          const result = document.evaluate(
            lowercaseXPath,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
          );
          
          if (result.singleNodeValue) {
            if (devMode) {
              console.log('Found container with lowercase XPath:', lowercaseXPath);
            }
            return result.singleNodeValue;
          }
        }
      } catch (e) {
        if (devMode) {
          console.warn('Error evaluating lowercase XPath fallback', e);
        }
      }
      
      // If ID-based or attribute XPath, try to be more lenient with positioning
      if (xpath.includes('@id') || xpath.includes('@class')) {
        try {
          // Extract just the attribute part and create a more lenient selector
          const attrMatch = xpath.match(/@(\w+)="([^"]+)"/);
          if (attrMatch && attrMatch.length === 3) {
            const [_, attrName, attrValue] = attrMatch;
            const lenientXPath = `//*[@${attrName}="${attrValue}"]`;
            
            const result = document.evaluate(
              lenientXPath,
              document,
              null,
              XPathResult.FIRST_ORDERED_NODE_TYPE,
              null
            );
            
            if (result.singleNodeValue) {
              if (devMode) {
                console.log('Found container with lenient attribute XPath:', lenientXPath);
              }
              return result.singleNodeValue;
            }
          }
        } catch (e) {
          if (devMode) {
            console.warn('Error evaluating lenient attribute XPath', e);
          }
        }
      }
      
      return null;
    }
    
    // Save the controls to local storage with current URL as key
    const rootUrl = window.location.origin;
    // Use postMessage to communicate with the extension context for storage access
    window.postMessage({
      type: 'FM_SAVE_FIELD_MAPPINGS',
      payload: {
        rootUrl: rootUrl,
        controls: serializableControls
      }
    }, '*');
    
    return {
      count: formControls.length,
      controls: serializableControls
    };
  }
    
  // Add message listener to handle storage requests from content script
  chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    if (message.type === 'FM_SAVE_FIELD_MAPPINGS') {
      const { rootUrl, controls } = message.payload;
      fieldMappingsV2[rootUrl] = controls;
      
      // Save to local storage
      chrome.storage.local.set({'fieldMappingsV2': fieldMappingsV2}, function() {
        if (devMode) {
          console.log('Field mappings saved to local storage:', rootUrl, controls);
        }
        sendResponse({success: true});
      });
      return true; // Indicates async response
    }
  });
  
  // Initialize by loading existing mappings
  loadFieldMappingsFromStorage();
  
  // Public API
  return {
    analyzeCurrentForm,
    saveFieldMappingsToStorage,
    loadFieldMappingsFromStorage,
    getFieldMappings: () => fieldMappingsV2
  };
})();
