/**
 * Form Analysis V2 - Highlighting Module
 * Handles visual highlighting of form elements
 */
// Prevent redeclaration error by checking if the module already exists
if (typeof formAnalysisHighlighting === 'undefined') {
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
        `;
        document.head.appendChild(style);
      }
    }
    
    /**
     * Highlight a form control and its container
     * @param {Object} control - The control object with element, container, and path information
     */
    function highlightFormControl(control) {
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
      
      // Clear any existing highlights
      clearAllHighlights();
      
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
} 