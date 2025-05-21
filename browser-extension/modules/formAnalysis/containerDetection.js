/**
 * Form Analysis V2 - Container Detection Module
 * Handles identifying and managing form element containers
 */
// Prevent redeclaration error by checking if the module already exists
if (typeof formAnalysisContainers === 'undefined') {
  const formAnalysisContainers = (() => {
    // Track the main form container
    let mainFormContainer = null;
    
    /**
     * Find the main container that encompasses all form controls
     * @param {Array} formControls - Array of form control elements
     * @returns {HTMLElement} The main container element
     */
    function findMainFormContainer(formControls) {
      // Validate input
      if (!formControls || !Array.isArray(formControls) || formControls.length === 0) {
        console.warn('No form controls provided to findMainFormContainer');
        return document.body;
      }
      
      // Get all form control elements, filtering out any null/undefined
      const formElements = formControls
        .filter(control => control && control.element && control.element.nodeType === Node.ELEMENT_NODE)
        .map(control => control.element);
      
      if (formElements.length === 0) {
        console.warn('No valid form elements found');
        return document.body;
      }
      
      // Find the common ancestor of all form controls
      const commonAncestor = formAnalysisDomUtils.findCommonAncestor(formElements);
      
      // If the common ancestor is the body, try to find a more specific container
      if (commonAncestor === document.body) {
        // Look for common semantic containers that might contain all form controls
        const potentialContainers = [
          document.querySelector('form'),
          document.querySelector('main'),
          document.querySelector('[role="main"]'),
          document.querySelector('.main-content'),
          document.querySelector('#main-content'),
          document.querySelector('.form-container'),
          document.querySelector('.form-wrapper')
        ].filter(Boolean);
        
        // Find the smallest container that contains all form controls
        for (const container of potentialContainers) {
          if (container && formElements.every(el => container.contains(el))) {
            return container;
          }
        }
        
        // If no semantic container found, try to find the smallest div that contains all controls
        const allDivs = Array.from(document.getElementsByTagName('div'));
        const containingDivs = allDivs.filter(div => 
          formElements.every(el => div.contains(el))
        );
        
        if (containingDivs.length > 0) {
          // Find the smallest div (most specific) that contains all controls
          return containingDivs.reduce((smallest, current) => {
            if (!smallest) return current;
            return current.contains(smallest) ? smallest : current;
          }, null);
        }
      }
      
      return commonAncestor;
    }
    
    /**
     * Find the parent container of a form control
     * @param {HTMLElement} element - The form control element
     * @param {Object} controlInfo - The control info object to update
     */
    function findParentContainer(element, controlInfo) {
      if (!element || !controlInfo) {
        console.warn('Invalid element or controlInfo provided to findParentContainer');
        return;
      }
      
      // If we haven't found the main container yet, find it
      if (!mainFormContainer) {
        try {
          // Get all form controls on the page
          const allFormControls = Array.from(document.querySelectorAll('input:not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="hidden"]), select, textarea'))
            .filter(isElementVisible)
            .map(element => ({ element }));
          
          mainFormContainer = findMainFormContainer(allFormControls);
        } catch (error) {
          console.error('Error finding main form container:', error);
          mainFormContainer = document.body;
        }
      }
      
      // Set the container to the main form container
      controlInfo.container = mainFormContainer;
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
     * Reset the main form container
     */
    function resetMainContainer() {
      mainFormContainer = null;
    }
    
    /**
     * Find the best container for a radio group using heuristics
     * @param {Array} radioGroup - Array of radio button elements
     * @returns {HTMLElement} The best container element
     */
    function findBestRadioGroupContainer(radioGroup) {
      if (!radioGroup || radioGroup.length === 0) return null;
      if (!formAnalysisDomUtils) {
        console.error('Required dependency missing: formAnalysisDomUtils');
        return null;
      }
      
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
      const commonAncestor = formAnalysisDomUtils.findCommonAncestor(radioGroup);
      
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
     * Find nearby text node that may act as a label
     * @param {HTMLElement} element - The element to look around
     * @returns {string} The nearby text content
     */
    function findNearbyText(element) {
      // Check for nearby text nodes or simple elements
      const parent = element.parentElement;
      if (!parent) return '';
      
      // Look at child nodes of parent to find text nodes near the element
      let foundElement = false;
      let labelText = '';
      
      for (const node of parent.childNodes) {
        if (node === element) {
          foundElement = true;
        } else if (foundElement && (node.nodeType === 3 || node.tagName === 'SPAN')) {
          // This is a text node or simple element after the element
          const text = node.nodeType === 3 ? node.textContent : node.innerText;
          if (text && text.trim()) {
            labelText = text.trim();
            break;
          }
        }
      }
      
      return labelText;
    }
    
    return {
      findParentContainer,
      resetMainContainer,
      findMainFormContainer,
      findBestRadioGroupContainer,
      findRadioGroupLabel,
      findNearbyText
    };
  })();

  // Expose the module to the global scope
  self.formAnalysisContainers = formAnalysisContainers;
} 