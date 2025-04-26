/**
 * Form analysis V2 module - Advanced form control detection and analysis
 */
const formAnalysisV2 = (() => {
  // Element highlighting styles
  const CONTAINER_HIGHLIGHT_CLASS = 'fm-container-highlight';
  
  
  // Development mode flag
  let devMode = true;
  
  // Form control analysis data
  let formControls = [];
  
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
      // Execute script to analyze the form in the active tab
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        function: performFormAnalysis,
        args: [devMode, 'fm-container-highlight', 'fm-label-highlight', 'fm-option-highlight', 'fm-input-highlight']
      }, results => {
        // Reset button state
        if (analyzeFormBtn) {
          analyzeFormBtn.disabled = false;
          analyzeFormBtn.textContent = 'Analyze Current Form';
        }
        
        console.log('Results:', results);
        if (results && results[0] && results[0].result) {
          const controlCount = results[0].result.count || 0;
          displayFormFieldsInPageDialog(results[0].result.controls, tabs[0].id, showToastCallback);
          showToastCallback(`Analyzed ${controlCount} form controls`, 'success');
        } else {
          showToastCallback('No form controls detected or error analyzing form.', 'error');
        }
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
   * @returns {Object} Analysis results with control count and data
   */
  function performFormAnalysis(devMode, containerClass, optionClass, inputClass) {
    // Set constants for highlighting classes within this function scope
    const CONTAINER_HIGHLIGHT_CLASS = containerClass;
    
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
      `;
      document.head.appendChild(style);
    }
    
    // Form control analysis results
    let formControls = [];
    
    // Clear any existing highlights
    clearAllHighlights();
    
    // Get all form controls
    const inputs = document.querySelectorAll('input:not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="hidden"])');
    const selects = document.querySelectorAll('select');
    const textareas = document.querySelectorAll('textarea');
    
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
        console.group(`Control #${index + 1}: ${control.type} ${control.id ? '#' + control.id : ''}`);
        console.log('Element:', control.element);
        console.log('Labels:', control.labels);
        console.log('Options:', control.options);
        console.log('Container:', control.container);
        console.groupEnd();
        
        // Highlight the elements
        highlightFormControl(control);
      });
      
      console.groupEnd();
    }
    
    /**
     * Process a collection of form elements
     * @param {NodeList} elements - Collection of form elements to process
     */
    function processFormElements(elements) {
      elements.forEach(element => {
        const controlInfo = analyzeFormControl(element);
        if (controlInfo) {
          formControls.push(controlInfo);
        }
      });
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
      const radioGroup = document.querySelectorAll(`input[type="radio"][name="${name}"]`);
      
      radioGroup.forEach(radio => {
        // Find the label for this radio
        let labelText = '';
        const explicitLabel = radio.id ? document.querySelector(`label[for="${radio.id}"]`) : null;
        
        if (explicitLabel) {
          labelText = explicitLabel.textContent.trim();
        } else {
          // Check for parent label
          let parent = radio.parentElement;
          while (parent && parent.tagName !== 'BODY') {
            if (parent.tagName === 'LABEL') {
              labelText = parent.textContent.trim();
              break;
            }
            parent = parent.parentElement;
          }
        }
        
        controlInfo.options.push({
          element: radio,
          value: radio.value,
          text: labelText || radio.value,
          selected: radio.checked
        });
      });
    }
    
    /**
     * Find the parent container of a form control
     * @param {HTMLElement} element - The form control element
     * @param {Object} controlInfo - The control info object to update
     */
    function findParentContainer(element, controlInfo) {
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
     * Highlight a form control and its related elements for visual debugging
     * @param {Object} control - The control info object
     */
    function highlightFormControl(control) {
      
      // Highlight the container element
      if (control.container) {
        control.container.classList.add(CONTAINER_HIGHLIGHT_CLASS);
        
        
        // Add click event to toggle highlighting
        control.container.addEventListener('click', function(e) {
          // Prevent default only if explicitly clicking the container (not a child input)
          if (e.target === control.container) {
            e.preventDefault();
            e.stopPropagation();
            
            // Toggle highlight
            this.classList.toggle(CONTAINER_HIGHLIGHT_CLASS);
          }
        });
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
      
      // Remove all tooltips
      document.querySelectorAll('.fm-tooltip').forEach(tooltip => {
        tooltip.parentNode.removeChild(tooltip);
      });
    }
    
    // Return a simplified version of the form controls
    // that can be serialized for message passing
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
          id: control.container.id
        } : null
      };
    });
    
    return {
      count: formControls.length,
      controls: serializableControls
    };
  }
  
  /**
   * Display the form fields data in a panel on the page
   * @param {Array} fields - Array of form control data
   * @param {number} tabId - The tab ID where the panel will be shown
   * @param {Function} showToastCallback - Callback to show toast messages
   */
  function displayFormFieldsInPageDialog(fields, tabId, showToastCallback) {
    // First inject the CSS file for the panel
    chrome.scripting.insertCSS({
      target: { tabId: tabId },
      files: ['styles/formAnalysis.css']
    });
    
    // Then inject and execute the script to create the panel
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      function: (fieldsData) => {
        // Function to create and display the form analysis panel
        function createFormAnalysisPanel(formFields) {
          // Remove any existing panel first
          const existingPanel = document.querySelector('.formmaster-side-panel');
          if (existingPanel) {
            document.body.removeChild(existingPanel);
          }
          
          // Create the side panel
          const panel = document.createElement('div');
          panel.className = 'formmaster-side-panel';
          panel.id = 'formmaster-side-panel';
          
          // Create panel header
          const header = document.createElement('div');
          header.className = 'formmaster-panel-header';
          
          const title = document.createElement('h2');
          title.className = 'formmaster-panel-title';
          title.textContent = 'FormMasterPro Analysis V2';
          
          const closeButton = document.createElement('button');
          closeButton.className = 'formmaster-panel-close';
          closeButton.innerHTML = '&times;';
          closeButton.setAttribute('aria-label', 'Close form analysis panel');
          closeButton.onclick = () => {
            panel.classList.add('collapsed');
            setTimeout(() => {
              if (document.body.contains(panel)) {
                document.body.removeChild(panel);
              }
            }, 300);
          };
          
          header.appendChild(title);
          header.appendChild(closeButton);
          
          // Create panel body
          const body = document.createElement('div');
          body.className = 'formmaster-panel-body';
          
          // Add controls section
          const controlsSection = document.createElement('div');
          controlsSection.className = 'formmaster-controls-section';
          
          // Add a development mode toggle
          const devModeToggle = document.createElement('div');
          devModeToggle.className = 'formmaster-toggle-container';
          devModeToggle.innerHTML = `
            <label for="dev-mode-toggle">Development Mode</label>
            <input type="checkbox" id="dev-mode-toggle" checked>
          `;
          
          // Add event listener for the toggle
          devModeToggle.querySelector('input').addEventListener('change', function(e) {
            // Send message to toggle dev mode
            const message = {
              action: 'toggleDevMode',
              enabled: e.target.checked
            };
            
            // This would normally send a message to the background script
            console.log('Toggle dev mode:', message);
            
            // Toggle highlight visibility
            document.querySelectorAll('.fm-container-highlight, .fm-label-highlight, .fm-option-highlight, .fm-input-highlight')
              .forEach(el => {
                el.style.display = e.target.checked ? 'block' : 'none';
              });
          });
          
          controlsSection.appendChild(devModeToggle);
          body.appendChild(controlsSection);
          
          // Create the table
          const table = document.createElement('table');
          table.className = 'formmaster-fields-table';
          
          // Create table header
          const thead = document.createElement('thead');
          const headerRow = document.createElement('tr');
          
          // Define columns
          const columns = ['Label', 'Type', 'ID/Name', 'Value', 'Options', 'Container'];
          
          columns.forEach(headerText => {
            const th = document.createElement('th');
            th.textContent = headerText;
            headerRow.appendChild(th);
          });
          
          thead.appendChild(headerRow);
          table.appendChild(thead);
          
          // Create table body
          const tbody = document.createElement('tbody');
          
          // Helper function to truncate text
          function truncateText(text, maxLength = 25) {
            if (!text) return '';
            text = String(text);
            return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
          }
          
          // Populate table with form fields data
          formFields.forEach((field, index) => {
            const row = document.createElement('tr');
            row.setAttribute('data-field-id', field.id || '');
            row.setAttribute('data-field-name', field.name || '');
            row.setAttribute('data-field-type', field.type || '');
            
            // Add hover effect to highlight corresponding elements on the page
            row.addEventListener('mouseenter', function() {
              // Send message to highlight this specific field
              console.log('Highlight field:', field.id || field.name);
              this.classList.add('highlight-row');
            });
            
            row.addEventListener('mouseleave', function() {
              this.classList.remove('highlight-row');
            });
            
            // Label cell
            const labelCell = document.createElement('td');
            const labelText = field.labels && field.labels.length > 0 
              ? field.labels[0].text 
              : (field.name || field.id || 'Unnamed');
            labelCell.textContent = truncateText(labelText);
            labelCell.title = labelText; // Full text on hover
            row.appendChild(labelCell);
            
            // Type cell
            const typeCell = document.createElement('td');
            typeCell.textContent = field.type || '';
            row.appendChild(typeCell);
            
            // ID/Name cell
            const idNameCell = document.createElement('td');
            const idNameText = field.id || field.name || '-';
            idNameCell.textContent = truncateText(idNameText);
            idNameCell.title = idNameText; // Full text on hover
            row.appendChild(idNameCell);
            
            // Value cell
            const valueCell = document.createElement('td');
            let valueText = '';
            if (field.type === 'checkbox') {
              valueText = field.checked ? 'Checked' : 'Unchecked';
            } else if (field.type === 'radio' || field.type === 'select') {
              // For select/radio, show selected option
              const selectedOpt = field.options && field.options.find(opt => opt.selected);
              valueText = selectedOpt ? selectedOpt.value || selectedOpt.text : '-';
            } else {
              valueText = field.value || '-';
            }
            valueCell.textContent = truncateText(valueText);
            valueCell.title = valueText; // Full value on hover
            row.appendChild(valueCell);
            
            // Options cell
            const optionsCell = document.createElement('td');
            if (field.options && field.options.length > 0) {
              // Show first 3 options plus count
              const optionCount = field.options.length;
              const displayOptions = field.options.slice(0, 3);
              const optionTexts = displayOptions.map(opt => truncateText(opt.text || opt.value, 10));
              
              optionsCell.textContent = optionTexts.join(', ');
              if (optionCount > 3) {
                optionsCell.textContent += ` +${optionCount - 3} more`;
              }
              
              // Add full list to title
              optionsCell.title = field.options.map(opt => opt.text || opt.value).join(', ');
            } else {
              optionsCell.textContent = '-';
            }
            row.appendChild(optionsCell);
            
            // Container cell
            const containerCell = document.createElement('td');
            if (field.containerDesc) {
              const containerText = `${field.containerDesc.tagName}${field.containerDesc.id ? '#' + field.containerDesc.id : ''}`;
              containerCell.textContent = truncateText(containerText);
              containerCell.title = `${field.containerDesc.tagName}${field.containerDesc.id ? '#' + field.containerDesc.id : ''} ${field.containerDesc.className || ''}`;
            } else {
              containerCell.textContent = '-';
            }
            row.appendChild(containerCell);
            
            tbody.appendChild(row);
          });
          
          table.appendChild(tbody);
          body.appendChild(table);
          
          // Add a summary section
          const summary = document.createElement('div');
          summary.className = 'formmaster-summary';
          summary.innerHTML = `
            <h3>Form Analysis Summary</h3>
            <p>Total controls: <strong>${formFields.length}</strong></p>
            <p>Types: 
              <span class="formmaster-badge">${countTypes(formFields, 'text')} Text</span>
              <span class="formmaster-badge">${countTypes(formFields, 'checkbox')} Checkbox</span>
              <span class="formmaster-badge">${countTypes(formFields, 'radio')} Radio</span>
              <span class="formmaster-badge">${countTypes(formFields, 'select')} Select</span>
              <span class="formmaster-badge">${countTypes(formFields, 'textarea')} Textarea</span>
            </p>
          `;
          
          body.appendChild(summary);
          
          // Assemble the panel
          panel.appendChild(header);
          panel.appendChild(body);
          document.body.appendChild(panel);
          
          // Function to count control types
          function countTypes(fields, type) {
            return fields.filter(field => field.type === type).length;
          }
        }
        
        // Create the form analysis panel
        createFormAnalysisPanel(fieldsData);
      },
      args: [fields]
    });
  }
  
  /**
   * Toggle development mode
   * @param {boolean} enabled - Whether development mode should be enabled
   */
  function toggleDevMode(enabled) {
    devMode = enabled;
  }
  
  // Public API
  return {
    analyzeCurrentForm,
    displayFormFieldsInPageDialog,
    toggleDevMode
  };
})();

// Expose the module to the global scope
self.formAnalysisV2 = formAnalysisV2; 