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
   * Highlight a form control and its container
   * @param {Object} control - The control info object with element and container
   * @param {Function} onContainerChange - Callback when container changes
   */
  function highlightFormControl(control, onContainerChange) {
    if (!control.container) return;
    
    // Initialize styles if not already done
    initStyles();
    
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
    
    // Check if there are valid child containers
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
    
    // Up button click handler - move to parent container
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
        
        // Notify of container change
        if (onContainerChange && typeof onContainerChange === 'function') {
          onContainerChange(currentContainer);
        }
      }
    });
    
    // Down button click handler - move to child container
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
        
        // Notify of container change
        if (onContainerChange && typeof onContainerChange === 'function') {
          onContainerChange(currentContainer);
        }
      }
    });
    
    // Add click event to toggle highlighting
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