/**
 * FormAnalysisEx - Enhanced form analysis module
 * Identifies and analyzes form containers on the current page
 */
class FormAnalysisEx {
  constructor() {
    this.formContainers = [];
    this.formElements = [];
  }

  /**
   * Main function to analyze forms on the current page
   * @param {HTMLElement} triggerBtn - Button that triggered the analysis
   * @param {Function} notify - Function to show notifications (optional)
   * @returns {Array} - Array of form containers with their elements
   */
  async analyzeCurrentForm(triggerBtn, notify = null) {
    if (triggerBtn) {
      const originalText = triggerBtn.textContent;
      triggerBtn.textContent = 'Analyzing...';
      triggerBtn.disabled = true;
      
      // Reset to original state when done
      const resetButton = () => {
        triggerBtn.textContent = originalText;
        triggerBtn.disabled = false;
      };
      
      // Schedule button reset after analysis
      setTimeout(resetButton, 1500);
    }
    
    try {
      // Execute analysis in the active tab
      const results = await this.executeInActivePage();
      
      if (notify) {
        const containerCount = results.containers.length;
        const elementCount = results.elements.length;
        notify(`Analyzed ${containerCount} containers with ${elementCount} form elements`, 'success');
      }
      
      return results;
    } catch (error) {
      console.error('Form analysis failed:', error);
      if (notify) {
        notify('Form analysis failed: ' + error.message, 'error');
      }
      return { containers: [], elements: [] };
    }
  }
  
  /**
   * Execute the analysis in the current active page
   * @returns {Promise<Object>} - Analysis results
   */
  async executeInActivePage() {
    return new Promise((resolve, reject) => {
      try {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
          if (!tabs || !tabs[0] || !tabs[0].id) {
            reject(new Error('No active tab found'));
            return;
          }
          
          // Execute the content script to analyze the page directly
          chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: analyzePageContent
          }, (results) => {
            if (!results || chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError ? chrome.runtime.lastError.message : 'Script execution failed'));
              return;
            }

            // Make sure we have valid results before accessing properties
            if (results[0] && results[0].result) {
              const analysisResult = results[0].result;
              console.log('Form analysis results:', analysisResult);
              
              // Ensure we always have valid containers and elements arrays
              if (!analysisResult.containers) analysisResult.containers = [];
              if (!analysisResult.elements) analysisResult.elements = [];
              
              resolve(analysisResult);
            } else {
              console.error('Invalid analysis results:', results);
              // Return empty valid results instead of rejecting
              resolve({
                containers: [],
                elements: []
              });
            }
          });
        });
      } catch (error) {
        console.error('Form analysis execution error:', error);
        reject(error);
      }
    });
  }
}

// Move the analysis function outside of the class as a standalone function
// This avoids the issue with `this` context and CSP restrictions
function analyzePageContent() {
  try {
    // Store analysis results
    const results = {
      containers: [],
      elements: []
    };
    
    /**
     * Find all form elements on the page
     */
    function findFormElements() {
      const elements = [];
      
      // Find all input elements
      document.querySelectorAll('input, select, textarea').forEach(input => {
        // Skip hidden and button-type inputs
        if (input.type === 'hidden' || input.type === 'submit' || 
            input.type === 'button' || input.type === 'reset' || 
            input.type === 'image') {
          return;
        }
        
        elements.push({
          element: input,
          type: input.tagName.toLowerCase(),
          inputType: input.type || null,
          id: input.id || null,
          name: input.name || null,
          value: input.value || null,
          placeholder: input.placeholder || null,
          required: input.required || false
        });
      });
      
      return elements;
    }
    
    /**
     * Find associated label for an input element
     */
    function findAssociatedLabel(input) {
      const labels = [];
      
      // 1. Check for label with 'for' attribute
      if (input.id) {
        document.querySelectorAll(`label[for="${input.id}"]`).forEach(label => {
          labels.push({
            element: label,
            text: label.textContent.trim(),
            type: 'explicit'  // Explicit label with 'for' attribute
          });
        });
      }
      
      // 2. Check for label as parent
      let parent = input.parentElement;
      while (parent && parent.tagName !== 'FORM' && parent.tagName !== 'BODY') {
        if (parent.tagName === 'LABEL') {
          labels.push({
            element: parent,
            text: parent.textContent.trim().replace(input.value || '', ''),
            type: 'parent'  // Label is parent of the input
          });
        }
        parent = parent.parentElement;
      }
      
      // 3. Check for aria-labelledby
      const labelledBy = input.getAttribute('aria-labelledby');
      if (labelledBy) {
        labelledBy.split(' ').forEach(id => {
          const labelElement = document.getElementById(id);
          if (labelElement) {
            labels.push({
              element: labelElement,
              text: labelElement.textContent.trim(),
              type: 'aria'  // ARIA label reference
            });
          }
        });
      }
      
      // 4. Check for nearby label-like elements
      const inputRect = input.getBoundingClientRect();
      const potentialLabels = document.querySelectorAll('span, div, p');
      
      potentialLabels.forEach(el => {
        // Skip if this would be the input itself or if text is empty
        if (el.contains(input) || !el.textContent.trim()) return;
        
        // Check if elements are close to each other
        const labelRect = el.getBoundingClientRect();
        const horizontalDistance = Math.min(
          Math.abs(inputRect.left - labelRect.right),
          Math.abs(inputRect.right - labelRect.left)
        );
        const verticalDistance = Math.min(
          Math.abs(inputRect.top - labelRect.bottom),
          Math.abs(inputRect.bottom - labelRect.top)
        );
        
        // Consider as label if close enough
        if ((horizontalDistance < 50 && verticalDistance < 20) || 
            (horizontalDistance < 20 && verticalDistance < 50)) {
          labels.push({
            element: el,
            text: el.textContent.trim(),
            type: 'proximity'  // Label determined by proximity
          });
        }
      });
      
      return labels;
    }
    
    /**
     * Find container element for a form input
     */
    function findInputContainer(input) {
      // Common container selectors
      const containerSelectors = [
        '.form-group',
        '.form-field', 
        '.field-group',
        '.input-group',
        '.form-control-group',
        '.control-group',
        '.field',
        'fieldset',
        '.form-row',
      ];
      
      // Start with the input's parent and look for known container classes
      let container = input.parentElement;
      let depth = 0;
      const maxDepth = 5; // Don't go too deep in the DOM
      
      while (container && container.tagName !== 'FORM' && container.tagName !== 'BODY' && depth < maxDepth) {
        // Check if this element matches any known container selectors
        for (const selector of containerSelectors) {
          try {
            if (container.matches(selector)) {
              return {
                element: container,
                selector: selector,
                depth: depth
              };
            }
          } catch (e) {
            // Invalid selector, skip
          }
        }
        
        // Check if multiple inputs are siblings in this container
        const formElements = container.querySelectorAll('input, select, textarea');
        if (formElements.length > 1) {
          return {
            element: container,
            selector: 'multiple-inputs',
            depth: depth
          };
        }
        
        // Move up to parent
        container = container.parentElement;
        depth++;
      }
      
      // If no specific container found, return the closest parent div
      container = input.parentElement;
      depth = 0;
      
      while (container && container.tagName !== 'FORM' && container.tagName !== 'BODY' && depth < 3) {
        if (container.tagName === 'DIV') {
          return {
            element: container,
            selector: 'parent-div',
            depth: depth
          };
        }
        container = container.parentElement;
        depth++;
      }
      
      // Fallback to immediate parent if nothing else found
      return {
        element: input.parentElement,
        selector: 'immediate-parent',
        depth: 0
      };
    }
    
    /**
     * Find related inputs that belong in the same logical group
     */
    function findRelatedInputs(input, allFormElements) {
      const related = [];
      
      // For radio buttons, find others with the same name
      if (input.tagName === 'INPUT' && input.type === 'radio' && input.name) {
        document.querySelectorAll(`input[type="radio"][name="${input.name}"]`).forEach(radio => {
          if (radio !== input) {
            related.push({
              element: radio,
              relationship: 'same-radio-group'
            });
          }
        });
      }
      
      // Find inputs with similar IDs or names (like address1, address2)
      const baseId = input.id ? input.id.replace(/[0-9]+$/, '') : null;
      const baseName = input.name ? input.name.replace(/[0-9]+$/, '') : null;
      
      if (baseId || baseName) {
        allFormElements.forEach(formEl => {
          const element = formEl.element;
          if (element === input) return; // Skip self
          
          // Check for sequential IDs or names
          if (baseId && element.id && element.id.startsWith(baseId) && 
              element.id !== input.id) {
            related.push({
              element: element,
              relationship: 'sequential-id'
            });
          }
          
          if (baseName && element.name && element.name.startsWith(baseName) && 
              element.name !== input.name) {
            related.push({
              element: element,
              relationship: 'sequential-name'
            });
          }
        });
      }
      
      return related;
    }
    
    // Find all form elements
    const formElements = findFormElements();
    
    // Important: We need to make DOM elements serializable
    const serializableElements = formElements.map(el => ({
      ...el,
      element: null, // Can't return DOM elements directly
      tagName: el.element.tagName,
      className: el.element.className,
      attributes: Array.from(el.element.attributes || []).map(attr => ({
        name: attr.name,
        value: attr.value
      }))
    }));
    
    results.elements = serializableElements;
    
    // Create a map to track which elements have been processed
    const processedInputs = new Set();
    
    // Find containers and group elements
    formElements.forEach(formEl => {
      const input = formEl.element;
      
      // Skip if already processed
      if (processedInputs.has(input)) return;
      processedInputs.add(input);
      
      // Find container, labels, and related inputs
      const container = findInputContainer(input);
      const labels = findAssociatedLabel(input);
      const relatedInputs = findRelatedInputs(input, formElements);
      
      // Mark related inputs as processed
      relatedInputs.forEach(related => processedInputs.add(related.element));
      
      // Create container data structure - with serializable data only
      const containerInfo = {
        containerTagName: container.element.tagName,
        containerClassName: container.element.className,
        containerSelector: container.selector,
        containerDepth: container.depth,
        containerHTML: container.element.outerHTML,
        primaryInputId: input.id || null,
        primaryInputName: input.name || null,
        primaryInputType: input.type || input.tagName.toLowerCase(),
        labels: labels.map(l => ({
          text: l.text,
          type: l.type,
          html: l.element.outerHTML
        })),
        relatedInputs: relatedInputs.map(r => ({
          relationship: r.relationship,
          inputId: r.element.id || null,
          inputName: r.element.name || null,
          inputType: r.element.type || r.element.tagName.toLowerCase()
        }))
      };
      
      // Print container to console
      console.group('Form Container Analysis');
      console.log('Container:', container.element);
      console.log('Container HTML:', container.element.outerHTML);
      console.log('Primary Input:', input);
      if (labels.length > 0) {
        console.log('Labels:', labels.map(l => `${l.text} (${l.type})`));
      }
      if (relatedInputs.length > 0) {
        console.log('Related Inputs:', relatedInputs);
      }
      console.groupEnd();
      
      // Add to results
      results.containers.push(containerInfo);
    });
    
    return results;
  } catch (error) {
    console.error("Form analysis error:", error);
    return {
      error: error.message,
      containers: [],
      elements: []
    };
  }
}

// Export the module
self.formAnalysisEx = new FormAnalysisEx();
