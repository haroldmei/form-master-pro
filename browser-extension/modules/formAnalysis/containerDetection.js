/**
 * Form Analysis V2 - Container Detection Module
 * Handles identifying and managing form element containers
 */
const formAnalysisContainers = (() => {
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
      if (controlInfo.labels && controlInfo.labels.length > 0) {
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
    findBestRadioGroupContainer,
    findRadioGroupLabel,
    findNearbyText
  };
})();

// Expose the module to the global scope
self.formAnalysisContainers = formAnalysisContainers; 