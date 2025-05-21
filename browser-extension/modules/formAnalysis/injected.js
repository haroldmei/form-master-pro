/**
 * Form Analysis V2 - Injected Module
 * This module runs in the page context and performs the actual form analysis
 */
// Prevent redeclaration error by checking if the module already exists
if (typeof formAnalysisInjected === 'undefined') {
  const formAnalysisInjected = (() => {
    // Form control analysis results
    let formControls = [];
    let mainContainer = null;
    
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
      
      // Reset form controls array and main container
      formControls = [];
      mainContainer = null;
      
      // Expose the form controls through the global FormMaster object
      FM.formControls = formControls;
      
      // Clear any existing highlights
      formAnalysisHighlighting.clearAllHighlights();
      
      // Get all form controls
      const inputs = document.querySelectorAll('input:not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="hidden"])');
      const selects = document.querySelectorAll('select');
      const textareas = document.querySelectorAll('textarea');
      
      // Filter for only visible elements
      const visibleInputs = Array.from(inputs).filter(isElementVisible);
      const visibleSelects = Array.from(selects).filter(isElementVisible);
      const visibleTextareas = Array.from(textareas).filter(isElementVisible);
      
      const allFormControls = [...visibleInputs, ...visibleSelects, ...visibleTextareas];
      
      console.log(`Total form controls: ${inputs.length + selects.length + textareas.length}`);
      console.log(`Visible form controls: ${allFormControls.length}`);
      
      // Find the main container for all form controls
      if (allFormControls.length > 0) {
        const controlObjects = allFormControls.map(element => ({ element }));
        mainContainer = formAnalysisContainers.findMainFormContainer(controlObjects);

        // Process each form control
        allFormControls.forEach(element => {
          const controlInfo = analyzeFormControl(element);
          if (controlInfo) {
            // Set the container to the main container
            controlInfo.container = mainContainer;
            controlInfo.containerPath = formAnalysisDomUtils.getElementPath(mainContainer);
            controlInfo.containerXPath = formAnalysisDomUtils.getElementXPath(mainContainer);
            formControls.push(controlInfo);
          }
        });
      }
      
      // If in dev mode, add visual highlights and console output
      console.group('FormMasterPro Form Analysis V2');
      console.log(`Main Container: ${sanitizeContainerHTML(mainContainer)}`);
      
      // Highlight the main container if we found one
      if (mainContainer) {
        formAnalysisHighlighting.highlightFormControl({
          container: mainContainer,
          containerPath: formAnalysisDomUtils.getElementPath(mainContainer),
          containerXPath: formAnalysisDomUtils.getElementXPath(mainContainer)
        });
      }
      
      console.groupEnd();
      
      // Return a serializable version of the form controls
      const serializableControls = formControls.map(control => serializeControl(control));
      
      // Store on the FormMaster global object
      FM.serializableControls = serializableControls;
      
      return {
        count: formControls.length,
        controls: serializableControls,
        mainContainer: sanitizeContainerHTML(mainContainer)
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
          path: control.containerPath,
          xpath: control.containerXPath
        } : null
      };
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
        container: null // Will be set to the main container
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
      
      return controlInfo;
    }
    
    /**
     * Sanitize container HTML to only include essential element information
     * @param {HTMLElement} container - The container element
     * @returns {string} Sanitized HTML string
     */
    function sanitizeContainerHTML(container) {
      if (!container) return '';
      
      // Create a clone to avoid modifying the original
      const clone = container.cloneNode(true);
      
      // Remove all script tags
      const scripts = clone.getElementsByTagName('script');
      while (scripts.length > 0) {
        scripts[0].parentNode.removeChild(scripts[0]);
      }
      
      // Remove all event handlers and inline styles
      const allElements = clone.getElementsByTagName('*');
      for (let element of allElements) {
        // Remove all attributes except id, class, type, and text content
        const attributes = element.attributes;
        for (let i = attributes.length - 1; i >= 0; i--) {
          const attr = attributes[i];
          if (!['id', 'class', 'type'].includes(attr.name)) {
            element.removeAttribute(attr.name);
          }
        }
      }
      
      return clone.outerHTML;
    }
    
    return {
      performFormAnalysis
    };
  })();

  // Expose the module to the global scope
  window.formAnalysisInjected = formAnalysisInjected;
} 