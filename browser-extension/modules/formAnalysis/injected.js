/**
 * Form Analysis V2 - Injected Module
 * This module runs in the page context and performs the actual form analysis
 */
const formAnalysisInjected = (() => {
  // Map to track elements we've already processed using existing mappings
  const processedElements = new Map();
  
  // Form control analysis results
  let formControls = [];
  
  /**
   * Perform form analysis on the current page
   * @param {boolean} devMode - Whether to run in development mode with debugging
   * @param {string} containerClass - CSS class for container highlights
   * @param {string} labelClass - CSS class for label highlights
   * @param {string} optionClass - CSS class for option highlights
   * @param {string} inputClass - CSS class for input highlights
   * @param {Array} existingMappings - Existing mappings from storage
   * @returns {Object} Analysis results with control count and data
   */
  function performFormAnalysis(devMode, containerClass, labelClass, optionClass, inputClass, existingMappings = []) {
    // Check for dependencies
    if (!formAnalysisHighlighting || !formAnalysisLabels || 
        !formAnalysisContainers || !formAnalysisDomUtils) {
      console.error('Missing required dependencies for form analysis');
      return { count: 0, controls: [] };
    }
    
    // Create or get the FormMaster object
    const FM = window.FormMaster = window.FormMaster || {};
    
    // Initialize highlight styles
    formAnalysisHighlighting.initStyles();
    
    // Clear the processed elements map for this analysis
    processedElements.clear();
    
    // Reset form controls array
    formControls = [];
    
    // Expose the form controls through the global FormMaster object
    FM.formControls = formControls;
    
    // Add an event listener for container changes
    document.addEventListener('fm-container-changed', function(e) {
      // Get the control from the formControls array using the provided index
      const controlIndex = e.detail.controlIndex;
      
      // Update the serializable controls when containers change
      const updatedControls = formControls.map(control => serializeControl(control));
      
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
    formAnalysisHighlighting.clearAllHighlights();
    
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
            container = formAnalysisDomUtils.findElementByXPath(mapping.containerDesc.xpath);
            if (devMode) {
              console.log('Container lookup by XPath:', mapping.containerDesc.xpath, container); 
            }
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
    
    // Process form elements
    processFormElements(inputs);
    processFormElements(selects);
    processFormElements(textareas);
    
    // If in dev mode, add visual highlights and console output
    if (devMode) {
      console.group('FormMasterPro Form Analysis V2');
      console.log(`Analyzed ${formControls.length} form controls`);
      
      formControls.forEach((control, index) => {
        // Highlight the elements
        highlightFormControl(control, index);
      });
      
      console.groupEnd();
    }
    
    // Return a serializable version of the form controls
    const serializableControls = formControls.map(control => serializeControl(control));
    
    // Store on the FormMaster global object
    FM.serializableControls = serializableControls;
    
    return {
      count: formControls.length,
      controls: serializableControls
    };
  }
  
  /**
   * Convert a control to a serializable object
   * @param {Object} control - The control object with DOM references
   * @returns {Object} A serializable version of the control
   */
  function serializeControl(control) {
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
        path: formAnalysisDomUtils.getElementPath(control.container),
        xpath: formAnalysisDomUtils.getElementXPath(control.container),
        // Also save the aicode with the container description
        aicode: control.aicode
      } : null
    };
  }
  
  /**
   * Process a collection of form elements
   * @param {NodeList} elements - Collection of form elements to process
   */
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
  
  /**
   * Highlight a form control and add navigation UI
   * @param {Object} control - The control to highlight
   * @param {number} index - Index in the formControls array
   */
  function highlightFormControl(control, index) {
    // First update the control in the formControls array
    if (index >= 0) {
      // Update the container and its properties
      formControls[index].container = control.container;
      formControls[index].containerPath = formAnalysisDomUtils.getElementPath(control.container);
      formControls[index].containerXPath = formAnalysisDomUtils.getElementXPath(control.container);
      
      // Only generate AI code if it doesn't already exist
      if (!formControls[index].aicode) {
        // Generate new AI code for the updated container using messaging
        (async () => {
          try {
            // Send message to background script to generate AI code
            const response = await new Promise((resolve, reject) => {
              chrome.runtime.sendMessage({
                type: 'FM_GENERATE_AI_CODE',
                payload: {
                  containerHtml: control.container.outerHTML,
                  url: window.location.href
                }
              }, response => {
                if (chrome.runtime.lastError) {
                  reject(chrome.runtime.lastError);
                } else {
                  resolve(response);
                }
              });
            });
            
            if (response && response.code) {
              // Update the aicode property
              formControls[index].aicode = response.code;
              
              // Log the update if in dev mode
              if (window.FormMaster && window.FormMaster.devMode) {
                console.log('Generated new AI code for container:', response.code);
              }
            }
          } catch (error) {
            console.error('Error generating AI code for container:', error);
            // Don't throw the error - we want to continue even if AI code generation fails
          }
        })();
      }
      
      // Fire a custom event to notify about the container change
      const event = new CustomEvent('fm-container-changed', {
        detail: {
          controlIndex: index,
          newContainer: control.container,
          // Add containerInfo object with serializable details
          containerInfo: {
            tagName: control.container.tagName,
            className: control.container.className,
            id: control.container.id,
            html: control.container.outerHTML,
            attributes: Array.from(control.container.attributes).map(attr => ({
              name: attr.name,
              value: attr.value
            })),
            path: formControls[index].containerPath,
            xpath: formControls[index].containerXPath,
            // Keep the aicode reference when container is changed
            aicode: formControls[index].aicode
          }
        }
      });
      document.dispatchEvent(event);
      
      // Log the container change in dev mode
      if (window.FormMaster && window.FormMaster.devMode) {
        console.log('Container updated for control:', formControls[index]);
        console.log('New container:', control.container);
        console.log('Container path:', formControls[index].containerPath);
        console.log('Container XPath:', formControls[index].containerXPath);
      }
      
      // Now apply the highlight after AI code generation
      formAnalysisHighlighting.highlightFormControl(control, async (newContainer) => {
        // Update the control with the new container
        formControls[index].container = newContainer;
        formControls[index].containerPath = formAnalysisDomUtils.getElementPath(newContainer);
        formControls[index].containerXPath = formAnalysisDomUtils.getElementXPath(newContainer);
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
    formAnalysisLabels.findLabels(element, controlInfo);
    
    // Find options for select elements
    if (element.tagName === 'SELECT') {
      formAnalysisLabels.findSelectOptions(element, controlInfo);
    }
    
    // Find options for radio buttons (same name groups)
    if (element.type === 'radio' && element.name) {
      formAnalysisLabels.findRadioOptions(element, controlInfo);
    }
    
    // Find parent container (if not already set by radio group processing)
    formAnalysisContainers.findParentContainer(element, controlInfo);
    
    return controlInfo;
  }
  
  return {
    performFormAnalysis
  };
})();

// Expose the module to the global scope
window.formAnalysisInjected = formAnalysisInjected; 