/**
 * Form Analysis V2 - Highlighting Module
 * Handles visual highlighting of form elements
 */
const formAnalysisHighlighting = (() => {
  // Element highlighting styles
  const CONTAINER_HIGHLIGHT_CLASS = 'fm-container-highlight';
  const CONTAINER_HIGHLIGHT_AICODE_CLASS = 'fm-container-highlight-aicode';
  
  /**
   * Initialize the highlight styles in the document
   */
  function initStyles() {
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
  }
  
  /**
   * Highlight a form control and add navigation UI
   * @param {Object} control - The control object with element, container, and path information
   * @param {Function} onContainerChange - Optional callback when container changes
   */
  function highlightFormControl(control, onContainerChange) {
    
    // Ensure we have the necessary container info
    if (!control.containerXPath) {
      console.warn('Missing container xpath in control:', control);
      return;
    }
    
    // Find the container element using xpath
    const container = formAnalysisDomUtils.findElementByXPath(control.containerXPath);
    if (!container) {
      console.warn('Could not find container using xpath:', control.containerXPath);
      return;
    }
    
    // Initialize styles if not already done
    initStyles();
    
    // Clear any existing highlights on this container
    container.classList.remove(CONTAINER_HIGHLIGHT_CLASS);
    container.classList.remove(CONTAINER_HIGHLIGHT_AICODE_CLASS);
    
    // Apply the appropriate highlight class based on whether the control has aicode
    if (control.aicode) {
      try {
        // Parse aicode to extract the xpath
        const aiCodeObj = typeof control.aicode === 'string' ? JSON.parse(control.aicode) : control.aicode;
        
        // Check if the aicode contains a valid xpath and it matches the container's xpath
        if (aiCodeObj && aiCodeObj.xPath && aiCodeObj.xPath === control.containerXPath) {
          // Green highlight when aicode exists and xpath matches
          container.classList.add(CONTAINER_HIGHLIGHT_AICODE_CLASS);
        } else {
          // Yellow highlight when aicode exists but xpath doesn't match
          container.classList.add(CONTAINER_HIGHLIGHT_CLASS);
        }
      } catch (error) {
        // If parsing fails, use yellow highlight
        console.error('Error parsing aicode:', error);
        container.classList.add(CONTAINER_HIGHLIGHT_CLASS);
      }
    } else {
      // No aicode, use yellow highlight
      container.classList.add(CONTAINER_HIGHLIGHT_CLASS);
    }
    
    // Add navigation buttons
    const navButtonsContainer = document.createElement('div');
    navButtonsContainer.className = 'fm-nav-buttons';
    
    // Up button (to parent)
    const upButton = document.createElement('button');
    upButton.className = 'fm-nav-button';
    upButton.title = 'Move to parent container';
    upButton.innerHTML = '↑';
    upButton.disabled = !container.parentElement || container.parentElement.tagName === 'BODY';
    
    // Down button (to child)
    const downButton = document.createElement('button');
    downButton.className = 'fm-nav-button';
    downButton.title = 'Move to child container';
    downButton.innerHTML = '↓';
    
    // Check if there are valid child containers
    const childContainers = Array.from(container.children).filter(child => 
      child.nodeType === Node.ELEMENT_NODE && 
      child.querySelector('input, select, textarea') && 
      child !== container
    );
    
    downButton.disabled = childContainers.length === 0;
    
    // Add buttons to container
    navButtonsContainer.appendChild(upButton);
    navButtonsContainer.appendChild(downButton);
    
    // Only add if not already there
    if (!container.querySelector('.fm-nav-buttons')) {
      container.appendChild(navButtonsContainer);
    }
    
    // Track the current container
    let currentContainer = container;
    
    // Up button click handler - move to parent container
    upButton.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      // Only proceed if there's a parent and it's not the body
      if (currentContainer.parentElement && currentContainer.parentElement.tagName !== 'BODY') {
        // Check if parent has multiple valid child containers
        const siblingContainers = Array.from(currentContainer.parentElement.children).filter(child => 
          child !== navButtonsContainer &&
          child.nodeType === Node.ELEMENT_NODE && 
          child.querySelector('input, select, textarea') && 
          child !== currentContainer.parentElement
        );
        
        // If parent has multiple valid children (more than just the current container),
        // don't allow moving up as it would cause issues with moving back down
        if (siblingContainers.length > 1) {
          console.log('Parent has multiple form containers, preventing upward navigation to avoid issues');
          return;
        }
        
        // Remove highlight from current container
        currentContainer.classList.remove(CONTAINER_HIGHLIGHT_CLASS);
        currentContainer.classList.remove(CONTAINER_HIGHLIGHT_AICODE_CLASS);
        
        // Move to parent
        currentContainer = currentContainer.parentElement;
        
        // Apply highlight to new container
        if (control.aicode) {
          try {
            // Parse aicode to extract the xpath
            const aiCodeObj = typeof control.aicode === 'string' ? JSON.parse(control.aicode) : control.aicode;
            
            // Check if the aicode contains a valid xpath and it matches the container's xpath
            const currentXPath = formAnalysisDomUtils.getElementXPath(currentContainer);
            if (aiCodeObj && aiCodeObj.xPath && aiCodeObj.xPath === currentXPath) {
              // Green highlight when aicode exists and xpath matches
              currentContainer.classList.add(CONTAINER_HIGHLIGHT_AICODE_CLASS);
            } else {
              // Yellow highlight when aicode exists but xpath doesn't match
              currentContainer.classList.add(CONTAINER_HIGHLIGHT_CLASS);
            }
          } catch (error) {
            // If parsing fails, use yellow highlight
            console.error('Error parsing aicode in up button handler:', error);
            currentContainer.classList.add(CONTAINER_HIGHLIGHT_CLASS);
          }
        } else {
          // No aicode, use yellow highlight
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
          child.querySelector('input, select, textarea') && 
          child !== currentContainer
        );
        
        downButton.disabled = newChildContainers.length === 0;
        
        // Create serialized container info
        const newContainerInfo = {
          tagName: currentContainer.tagName,
          className: currentContainer.className,
          id: currentContainer.id,
          html: currentContainer.outerHTML,
          attributes: Array.from(currentContainer.attributes).map(attr => ({
            name: attr.name,
            value: attr.value
          })),
          path: formAnalysisDomUtils.getElementPath(currentContainer),
          xpath: formAnalysisDomUtils.getElementXPath(currentContainer),
          aicode: control.aicode
        };
        
        // Update local storage with the new container information
        // This ensures the change persists across page reloads
        const currentUrl = window.location.origin;
        chrome.storage.local.get(['fieldMappingsV2'], function(result) {
          const fieldMappingsV2 = result.fieldMappingsV2 || {};
          if (fieldMappingsV2[currentUrl]) {
            // Find the matching control by id or name
            const controlIndex = fieldMappingsV2[currentUrl].findIndex(mapping => 
              (control.id && mapping.id === control.id) || 
              (control.name && mapping.name === control.name)
            );
            
            if (controlIndex !== -1) {
              // Update the container information
              fieldMappingsV2[currentUrl][controlIndex].containerDesc = {
                ...fieldMappingsV2[currentUrl][controlIndex].containerDesc,
                tagName: newContainerInfo.tagName,
                className: newContainerInfo.className,
                id: newContainerInfo.id,
                html: newContainerInfo.html,
                attributes: newContainerInfo.attributes,
                path: newContainerInfo.path,
                xpath: newContainerInfo.xpath,
                aicode: newContainerInfo.aicode
              };
              
              // Save the updated mappings back to storage
              chrome.storage.local.set({ fieldMappingsV2: fieldMappingsV2 }, function() {
                console.log('Container scope change saved to storage');
              });
            }
          }
        });
        
        // Notify of container change with serialized info
        if (onContainerChange && typeof onContainerChange === 'function') {
          onContainerChange(newContainerInfo);
        }
      }
    });
    
    // Down button click handler - move to child container
    downButton.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      // Find child containers that contain form elements
      const validChildren = Array.from(currentContainer.children).filter(child => 
        child !== navButtonsContainer &&
        child.nodeType === Node.ELEMENT_NODE && 
        child.querySelector('input, select, textarea') && 
        child !== currentContainer
      );
      
      if (validChildren.length > 0) {
        // Remove highlight from current container
        currentContainer.classList.remove(CONTAINER_HIGHLIGHT_CLASS);
        currentContainer.classList.remove(CONTAINER_HIGHLIGHT_AICODE_CLASS);
        
        // Move to first valid child
        currentContainer = validChildren[0];
        
        // Apply highlight to new container
        if (control.aicode) {
          try {
            // Parse aicode to extract the xpath
            const aiCodeObj = typeof control.aicode === 'string' ? JSON.parse(control.aicode) : control.aicode;
            
            // Check if the aicode contains a valid xpath and it matches the container's xpath
            const currentXPath = formAnalysisDomUtils.getElementXPath(currentContainer);
            if (aiCodeObj && aiCodeObj.xPath && aiCodeObj.xPath === currentXPath) {
              // Green highlight when aicode exists and xpath matches
              currentContainer.classList.add(CONTAINER_HIGHLIGHT_AICODE_CLASS);
            } else {
              // Yellow highlight when aicode exists but xpath doesn't match
              currentContainer.classList.add(CONTAINER_HIGHLIGHT_CLASS);
            }
          } catch (error) {
            // If parsing fails, use yellow highlight
            console.error('Error parsing aicode in down button handler:', error);
            currentContainer.classList.add(CONTAINER_HIGHLIGHT_CLASS);
          }
        } else {
          // No aicode, use yellow highlight
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
          child.querySelector('input, select, textarea') && 
          child !== currentContainer
        );
        
        downButton.disabled = newChildContainers.length === 0;
        
        // Create serialized container info
        const newContainerInfo = {
          tagName: currentContainer.tagName,
          className: currentContainer.className,
          id: currentContainer.id,
          html: currentContainer.outerHTML,
          attributes: Array.from(currentContainer.attributes).map(attr => ({
            name: attr.name,
            value: attr.value
          })),
          path: formAnalysisDomUtils.getElementPath(currentContainer),
          xpath: formAnalysisDomUtils.getElementXPath(currentContainer),
          aicode: control.aicode
        };
        
        // Update local storage with the new container information
        // This ensures the change persists across page reloads
        const currentUrl = window.location.origin;
        chrome.storage.local.get(['fieldMappingsV2'], function(result) {
          const fieldMappingsV2 = result.fieldMappingsV2 || {};
          if (fieldMappingsV2[currentUrl]) {
            // Find the matching control by id or name
            const controlIndex = fieldMappingsV2[currentUrl].findIndex(mapping => 
              (control.id && mapping.id === control.id) || 
              (control.name && mapping.name === control.name)
            );
            
            if (controlIndex !== -1) {
              // Update the container information
              fieldMappingsV2[currentUrl][controlIndex].containerDesc = {
                ...fieldMappingsV2[currentUrl][controlIndex].containerDesc,
                tagName: newContainerInfo.tagName,
                className: newContainerInfo.className,
                id: newContainerInfo.id,
                html: newContainerInfo.html,
                attributes: newContainerInfo.attributes,
                path: newContainerInfo.path,
                xpath: newContainerInfo.xpath,
                aicode: newContainerInfo.aicode
              };
              
              // Save the updated mappings back to storage
              chrome.storage.local.set({ fieldMappingsV2: fieldMappingsV2 }, function() {
                console.log('Container scope change saved to storage');
              });
            }
          }
        });
        
        // Notify of container change with serialized info
        if (onContainerChange && typeof onContainerChange === 'function') {
          onContainerChange(newContainerInfo);
        }
      }
    });
    
    // Add click event to toggle highlighting
    container.addEventListener('click', function(e) {
      // Prevent default only if explicitly clicking the container (not a child input or button)
      if (e.target === container) {
        e.preventDefault();
        e.stopPropagation();
        
        // Toggle highlight
        if (control.aicode) {
          try {
            // Parse aicode to extract the xpath
            const aiCodeObj = typeof control.aicode === 'string' ? JSON.parse(control.aicode) : control.aicode;
            
            // Check if the aicode contains a valid xpath and it matches the container's xpath
            const currentXPath = formAnalysisDomUtils.getElementXPath(container);
            if (aiCodeObj && aiCodeObj.xPath && aiCodeObj.xPath === currentXPath) {
              // Toggle green highlight when aicode exists and xpath matches
              this.classList.toggle(CONTAINER_HIGHLIGHT_AICODE_CLASS);
            } else {
              // Toggle yellow highlight when aicode exists but xpath doesn't match
              this.classList.toggle(CONTAINER_HIGHLIGHT_CLASS);
            }
          } catch (error) {
            // If parsing fails, toggle yellow highlight
            console.error('Error parsing aicode in click handler:', error);
            this.classList.toggle(CONTAINER_HIGHLIGHT_CLASS);
          }
        } else {
          // No aicode, toggle yellow highlight
          this.classList.toggle(CONTAINER_HIGHLIGHT_CLASS);
        }
      }
    });
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
  
  return {
    initStyles,
    highlightFormControl,
    clearAllHighlights,
    CONTAINER_HIGHLIGHT_CLASS,
    CONTAINER_HIGHLIGHT_AICODE_CLASS
  };
})();

// Expose the module to the global scope
self.formAnalysisHighlighting = formAnalysisHighlighting; 