/**
 * Form Analysis V2 - Injected Module
 * This module runs in the page context and performs the actual form analysis
 */
// Prevent redeclaration error by checking if the module already exists
if (typeof formAnalysisInjected === 'undefined') {
  const formAnalysisInjected = (() => {
    // Map to track elements we've already processed using existing mappings
    const processedElements = new Map();
    
    // Form control analysis results
    let formControls = [];
    
    /**
     * Perform form analysis on the current page
     * @param {Array} existingMappings - Existing mappings from storage
     * @returns {Object} Analysis results with control count and data
     */
    function performFormAnalysis(existingMappings = []) {
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
        const newContainer = e.detail.newContainer;
        
        if (controlIndex >= 0 && controlIndex < formControls.length) {
          // Update the control with the new container info
          const control = formControls[controlIndex];
          
          // Update the container and its properties
          control.container = formAnalysisDomUtils.findElementByXPath(newContainer.xpath);
          control.containerPath = newContainer.path;
          control.containerXPath = newContainer.xpath;
          control.aicode = newContainer.aicode;
          
          // Apply the highlight
          formAnalysisHighlighting.highlightFormControl(control);
        }
      });
      
      // Clear any existing highlights
      formAnalysisHighlighting.clearAllHighlights();
      
      // First try to use existing mappings if available
      if (existingMappings && existingMappings.length > 0) {
        console.log('Found existing field mappings, attempting to apply stored containers', existingMappings);
        
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
            // Check if element is visible before processing
            if (!isElementVisible(element)) {
              console.log('Skipping hidden element from existing mappings:', element);
              return; // Skip this iteration
            }
            
            let container = null;
            
            // Try using xpath if available and container still not found
            if (!container && mapping.containerDesc.xpath) {
              container = formAnalysisDomUtils.findElementByXPath(mapping.containerDesc.xpath);
              console.log('Container lookup by XPath:', mapping.containerDesc.xpath, container); 
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
                if (mapping.containerDesc.aicode) {
                  controlInfo.containerDesc = {
                    ...mapping.containerDesc,
                    aicode: mapping.containerDesc.aicode
                  };
                }
                
                formControls.push(controlInfo);
                processedElements.set(element, true);
                
                console.log('Applied existing container to element:', element, container);
              }
            }
          }
        });
      }
      
      // Get all form controls
      const inputs = document.querySelectorAll('input:not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="hidden"])');
      const selects = document.querySelectorAll('select');
      const textareas = document.querySelectorAll('textarea');
      
      // Filter for only visible elements
      const visibleInputs = Array.from(inputs).filter(isElementVisible);
      const visibleSelects = Array.from(selects).filter(isElementVisible);
      const visibleTextareas = Array.from(textareas).filter(isElementVisible);
      
      console.log(`Total form controls: ${inputs.length + selects.length + textareas.length}`);
      console.log(`Visible form controls: ${visibleInputs.length + visibleSelects.length + visibleTextareas.length}`);
      
      // Process form elements - only the visible ones
      processFormElements(visibleInputs);
      processFormElements(visibleSelects);
      processFormElements(visibleTextareas);
      
      // If in dev mode, add visual highlights and console output
      console.group('FormMasterPro Form Analysis V2');
      console.log(`Analyzed ${formControls.length} form controls`);
      formControls.forEach((control, index) => {
        // Highlight the elements
        highlightFormControl(control, index);
      });
      console.groupEnd();
      
      // Return a serializable version of the form controls
      const serializableControls = formControls.map(control => serializeControl(control));
      
      // Store on the FormMaster global object
      FM.serializableControls = serializableControls;
      
      // Save to local storage using current URL as key
      const rootUrl = window.location.origin;
      chrome.storage.local.get(['fieldMappingsV2'], function(result) {
        const fieldMappingsV2 = result.fieldMappingsV2 || {};
        
        // Check if there are existing controls for this URL and append instead of overwrite
        if (fieldMappingsV2[rootUrl] && Array.isArray(fieldMappingsV2[rootUrl])) {
          // Create a map of existing controls by ID or name to avoid duplicates
          const existingControlsMap = new Map();
          fieldMappingsV2[rootUrl].forEach(control => {
            // Use ID if available, otherwise use name as the key
            const key = control.id || control.name;
            if (key) {
              existingControlsMap.set(key, control);
            }
          });
          
          // Add new controls, overriding existing ones with same ID/name
          serializableControls.forEach(control => {
            const key = control.id || control.name;
            if (key) {
              existingControlsMap.set(key, control);
            }
          });
          
          // Convert map back to array
          fieldMappingsV2[rootUrl] = Array.from(existingControlsMap.values());
        } else {
          // If no existing controls, just set the new ones
          fieldMappingsV2[rootUrl] = serializableControls;
        }
        
        chrome.storage.local.set({ fieldMappingsV2: fieldMappingsV2 }, function() {
          console.log(`Saved ${fieldMappingsV2[rootUrl].length} controls for ${rootUrl}`);
        });
      });
      
      return {
        count: formControls.length,
        controls: serializableControls
      };
    }
    
    /**
     * Check if an element is visible on the page
     * @param {HTMLElement} element - The element to check
     * @returns {boolean} - True if element is visible, false otherwise
     */
    function isElementVisible(element) {
      if (!element) return false;
      
      // Check if element or any of its ancestors have display:none or visibility:hidden
      const style = window.getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden') {
        return false;
      }
      
      // Check if element has 0 dimensions (effectively hidden)
      if (element.offsetWidth === 0 && element.offsetHeight === 0) {
        // Special case for radio/checkbox which might be small but still visible
        if (element.type !== 'radio' && element.type !== 'checkbox') {
          return false;
        }
      }
      
      // Check all ancestors as well
      let parent = element.parentElement;
      while (parent) {
        const parentStyle = window.getComputedStyle(parent);
        if (parentStyle.display === 'none' || parentStyle.visibility === 'hidden') {
          return false;
        }
        parent = parent.parentElement;
      }
      
      return true;
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
          // Store aicode in containerDesc
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
        
        // Fire a custom event to notify about the container change
        const event = new CustomEvent('fm-container-changed', {
          detail: {
            controlIndex: index,
            newContainer: {
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
              aicode: formControls[index].containerDesc?.aicode
            }
          }
        });
        document.dispatchEvent(event);
        console.log('Container updated for control:', formControls[index]);
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
} 