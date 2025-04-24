/**
 * Form analysis module
 */
const formAnalysis = (() => {

  // Function to analyze the current form
  function analyzeCurrentForm(analyzeFormBtn, showToastCallback) {
    analyzeFormBtn.disabled = true;
    analyzeFormBtn.textContent = 'Analyzing...';
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      // First inject both script files in the correct order
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        files: ['forms/form_radios.js', 'forms/form_checkboxgroup.js', 'forms/form_extract.js']
      }, () => {
        // Then execute a function that uses the injected scripts
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          function: () => {
            // Use the FormExtract object exposed by form_extract.js
            const formData = self.FormExtract.extractFormControls();

            // Flatten the structure to match what displayFormFields expects
            const fields = [];
            
            // Process inputs
            if (formData.inputs) {
              fields.push(...formData.inputs);
            }
            
            // Process selects
            if (formData.selects) {
              fields.push(...formData.selects);
            }
            
            // Process textareas
            if (formData.textareas) {
              fields.push(...formData.textareas);
            }
            
            // Process radio groups
            if (formData.radios) {
              fields.push(...formData.radios);
            }
            
            // Process checkboxes
            if (formData.checkboxGroups) {
              fields.push(...formData.checkboxGroups);
            }
            
            // Process checkboxes
            if (formData.checkboxes) {
              fields.push(...formData.checkboxes);
            }
            
            console.log('Extracted form data:', fields);
            return fields;
          }
        }, results => {
          if (results && results[0] && results[0].result) {
            displayFormFieldsInPageDialog(results[0].result, tabs[0].id, showToastCallback);
          } else {
            showToastCallback('No form detected or error analyzing form.', 'error');
          }
          
          analyzeFormBtn.disabled = false;
          analyzeFormBtn.textContent = 'Analyze Current Form';
        });
      });
    });
  }

  // Function to display form fields in a side panel on the page
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
        // Remove any existing panel first
        const existingPanel = document.querySelector('.formmaster-side-panel');
        if (existingPanel) {
          document.body.removeChild(existingPanel);
        }
        
        // Remove any existing highlight
        clearFormHighlights();
        
        const existingToggle = document.querySelector('.formmaster-toggle-panel');
        if (existingToggle) {
          document.body.removeChild(existingToggle);
        }
        
        // Create the toggle button for mobile view
        const toggleButton = document.createElement('button');
        toggleButton.className = 'formmaster-toggle-panel';
        toggleButton.innerHTML = '⟨';
        toggleButton.setAttribute('aria-label', 'Toggle form analysis panel');
        document.body.appendChild(toggleButton);
        
        // Create the side panel
        const panel = document.createElement('div');
        panel.className = 'formmaster-side-panel';
        panel.id = 'formmaster-side-panel';
        
        // Create drag handle for resizing
        const dragHandle = document.createElement('div');
        dragHandle.className = 'formmaster-drag-handle';
        panel.appendChild(dragHandle);
        
        // Create panel header
        const header = document.createElement('div');
        header.className = 'formmaster-panel-header';
        
        const title = document.createElement('h2');
        title.className = 'formmaster-panel-title';
        title.textContent = 'FormMasterPro Analysis';
        
        const closeButton = document.createElement('button');
        closeButton.className = 'formmaster-panel-close';
        closeButton.innerHTML = '&times;';
        closeButton.setAttribute('aria-label', 'Close form analysis panel');
        closeButton.onclick = () => {
          panel.classList.add('collapsed');
          clearFormHighlights(); // Clear any remaining highlights when closing
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
        
        // Create the table
        const table = document.createElement('table');
        table.className = 'formmaster-fields-table';
        
        // Create table header - Add PDF Field Name column
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        
        // Check if this is a PDF form (at least one field has rawFieldName property)
        const isPdfForm = fieldsData.some(field => field.rawFieldName);
        
        const columns = ['Label/Name', 'Type', 'ID'];
        
        // Add PDF Field Name column if it's a PDF form
        if (isPdfForm) {
          columns.push('PDF Field Name');
        }
        
        // Add Value and Options columns
        columns.push('Value', 'Options');
        
        columns.forEach(headerText => {
          const th = document.createElement('th');
          th.textContent = headerText;
          headerRow.appendChild(th);
        });
        
        thead.appendChild(headerRow);
        table.appendChild(thead);
        
        // Create table body
        const tbody = document.createElement('tbody');
        
        // Helper function to truncate text to 20 characters
        function truncateText(text, maxLength = 12) {
          if (!text) return '';
          text = String(text);
          return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
        }
        
        fieldsData.forEach((field, index) => {
          const row = document.createElement('tr');
          row.setAttribute('data-field-id', field.id || '');
          row.setAttribute('data-field-name', field.name || '');
          row.setAttribute('data-field-label', field.label || '');
          row.setAttribute('data-field-type', field.type || '');
          row.setAttribute('data-field-index', index);
          
          // Add hover handlers to highlight the corresponding form field
          row.addEventListener('mouseenter', function() {
            // Add hover styling to the row
            this.classList.add('formmaster-row-hover');
            
            // Find and highlight the form field
            highlightFormField(field);
          });
          
          row.addEventListener('mouseleave', function() {
            // Remove hover styling from the row
            this.classList.remove('formmaster-row-hover');
            
            // Remove highlight from the form field
            clearFormHighlights();
          });
          
          // Label/Name cell
          const labelCell = document.createElement('td');
          const labelText = field.label || field.name || field.id || 'Unnamed Field';
          labelCell.textContent = truncateText(labelText);
          labelCell.title = labelText; // Show full text on hover
          row.appendChild(labelCell);
          
          // Type cell
          const typeCell = document.createElement('td');
          typeCell.textContent = field.type;
          row.appendChild(typeCell);
          
          // ID cell
          const idCell = document.createElement('td');
          const idText = field.id || '-';
          idCell.textContent = truncateText(idText);
          idCell.title = idText; // Show full ID on hover
          row.appendChild(idCell);
          
          // Add PDF Field Name cell if it's a PDF form
          if (isPdfForm) {
            const pdfFieldNameCell = document.createElement('td');
            
            if (field.rawFieldName) {
              pdfFieldNameCell.className = 'formmaster-pdf-field-name';
              const pdfFieldText = field.rawFieldName;
              pdfFieldNameCell.textContent = truncateText(pdfFieldText);
              pdfFieldNameCell.title = pdfFieldText; // Show full name on hover
            } else {
              pdfFieldNameCell.textContent = '-';
            }
            
            row.appendChild(pdfFieldNameCell);
          }
          
          // Value cell
          const valueCell = document.createElement('td');
          
          let valueText = '';
          if (field.type === 'select' || field.type === 'radio') {
            // For select/radio, show selected option
            const selectedOpt = field.options?.find(opt => opt.selected || opt.checked);
            valueText = selectedOpt ? selectedOpt.value || selectedOpt.text : '-';
          } else if (field.type === 'checkbox') {
            valueText = field.checked ? 'Checked' : 'Unchecked';
          } else {
            valueText = field.value || '-';
          }
          
          valueCell.textContent = truncateText(valueText);
          valueCell.title = valueText; // Show full value on hover
          row.appendChild(valueCell);
          
          // Options cell
          const optionsCell = document.createElement('td');
          
          if (field.options && field.options.length > 0) {
            const optionsList = document.createElement('ul');
            optionsList.className = 'formmaster-options-list';
            
            // Limit to first 5 options
            const displayLimit = 5;
            const displayOptions = field.options.slice(0, displayLimit);
            
            displayOptions.forEach(option => {
              const optItem = document.createElement('li');
              optItem.className = 'formmaster-option-item';
              if (option.selected || option.checked) {
                optItem.className += ' formmaster-selected-option';
              }
              
              const optionText = option.text || option.value || option.label || '-';
              optItem.textContent = truncateText(optionText);
              optItem.title = optionText; // Show full option text on hover
              optionsList.appendChild(optItem);
            });
            
            // If there are more options than the display limit, add an indicator
            if (field.options.length > displayLimit) {
              const moreItem = document.createElement('li');
              moreItem.className = 'formmaster-option-item';
              moreItem.style.fontStyle = 'italic';
              moreItem.style.color = '#5f6368';
              moreItem.textContent = `...and ${field.options.length - displayLimit} more`;
              optionsList.appendChild(moreItem);
            }
            
            optionsCell.appendChild(optionsList);
          } else {
            optionsCell.textContent = '-';
          }
          
          row.appendChild(optionsCell);
          tbody.appendChild(row);
        });
        
        table.appendChild(tbody);
        body.appendChild(table);
        
        // Assemble the panel
        panel.appendChild(header);
        panel.appendChild(body);
        document.body.appendChild(panel);
        
        // Field highlighting functions
        function highlightFormField(field) {
          // Clear any existing highlights first
          clearFormHighlights();
          
          // Try to find the element in different ways
          let element = findFieldElement(field);
          console.log('Found element:', element);
          if (element) {
            scrollElementIntoView(element);
            applyHighlightToElement(element, field.type);
          }
        }
        
        function findFieldElement(field) {
          let element = null;
          
          // Try using ID first
          if (field.id) {
            element = document.getElementById(field.id);
            if (element) return element;
          }
          // Try label matching
          if (field.label) {
            const labels = Array.from(document.querySelectorAll('label'));
            for (const label of labels) {
              if (label.textContent.trim() === field.label) {
                if (label.htmlFor) {
                  element = document.getElementById(label.htmlFor);
                  if (element) return element;
                }
                
                // Check if the label contains the input
                const labeledElement = label.querySelector('input, select, textarea');
                if (labeledElement) return labeledElement;
              }
            }
          }
          
          if (field.ariaLabel){
            // Try using ARIA label
            element = document.querySelector(`[aria-label="${field.ariaLabel}"]`);
            if (element) return element;
          }
          
          
          // Try using name
          if (field.name) {
            const nameElements = document.getElementsByName(field.name);
            if (nameElements.length > 0) return nameElements[0];
            
            // For radio buttons and checkboxes, try a more specific selector
            if (field.type === 'radio' || field.type === 'checkbox') {
              element = document.querySelector(`input[type="${field.type}"][name="${field.name}"]`);
              if (element) return element;
            }
          }
          
          // Try selected options for select fields (when available)
          if (field.type === 'select' && field.options) {
            const selectElements = document.querySelectorAll('select');
            for (const select of selectElements) {
              if (select.options.length === field.options.length) {
                const optionText = Array.from(select.options).map(o => o.text.trim());
                const fieldOptionText = field.options.map(o => o.text?.trim() || '');
                if (optionText.join() === fieldOptionText.join()) {
                  return select;
                }
              }
            }
          }
          
          return null;
        }
        
        function applyHighlightToElement(element, fieldType) {
          // Different highlighting based on element type
          if (fieldType === 'checkbox' || fieldType === 'radio') {
            // For checkboxes/radios, highlight the parent container too
            const container = element.closest('label, .form-check, .checkbox, .radio, .custom-control');
            if (container) {
              container.classList.add('formmaster-checkbox-highlight');
            } else {
              element.parentElement?.classList.add('formmaster-checkbox-highlight');
            }
            
            // Also highlight any associated label
            if (element.id) {
              const label = document.querySelector(`label[for="${element.id}"]`);
              if (label) {
                label.classList.add('formmaster-checkbox-highlight');
              }
            }
            
            element.classList.add('formmaster-field-highlight');
          } else if (fieldType === 'select') {
            // For select fields, check if it's a hidden select with enhanced UI
            if (window.getComputedStyle(element).display === 'none') {
              // Try to find the enhanced select container (Chosen or Select2)
              let enhancedContainer = null;
              
              if (element.id) {
                // Check for Chosen
                enhancedContainer = document.getElementById(`${element.id}_chosen`);
                
                if (!enhancedContainer) {
                  // Check for Select2
                  enhancedContainer = document.querySelector(`[data-select2-id="${element.id}"]`);
                }
                
                if (!enhancedContainer) {
                  // Try other common patterns
                  const possibleContainers = Array.from(
                    document.querySelectorAll(`.select2-container[id$="-${element.id}"], .chosen-container[id$="-${element.id}"]`)
                  );
                  
                  if (possibleContainers.length > 0) {
                    enhancedContainer = possibleContainers[0];
                  }
                }
              }
              
              if (enhancedContainer) {
                enhancedContainer.classList.add('formmaster-field-highlight');
              } else {
                // Fall back to highlighting the original element
                element.classList.add('formmaster-field-highlight');
              }
            } else {
              element.classList.add('formmaster-field-highlight');
            }
          } else {
            element.classList.add('formmaster-field-highlight');
          }
        }
        
        function clearFormHighlights() {
          // Remove all highlight classes
          document.querySelectorAll('.formmaster-field-highlight, .formmaster-checkbox-highlight, .formmaster-radio-highlight')
            .forEach(el => {
              el.classList.remove('formmaster-field-highlight', 'formmaster-checkbox-highlight', 'formmaster-radio-highlight');
            });
        }
        
        function scrollElementIntoView(element) {
          // Only scroll if not already in viewport
          const rect = element.getBoundingClientRect();
          const isInView = (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
          );
          
          if (!isInView) {
            element.scrollIntoView({
              behavior: 'smooth',
              block: 'center'
            });
          }
        }
        
        // Implement panel resizing functionality
        let startX, startWidth;
        
        function initResize(e) {
          startX = e.clientX;
          startWidth = parseInt(document.defaultView.getComputedStyle(panel).width, 10);
          document.documentElement.addEventListener('mousemove', resizePanel);
          document.documentElement.addEventListener('mouseup', stopResize);
          e.preventDefault();
        }
        
        function resizePanel(e) {
          const width = startWidth - (e.clientX - startX);
          if (width > 300 && width < (window.innerWidth * 0.8)) {
            panel.style.width = `${width}px`;
          }
        }
        
        function stopResize() {
          document.documentElement.removeEventListener('mousemove', resizePanel);
          document.documentElement.removeEventListener('mouseup', stopResize);
        }
        
        dragHandle.addEventListener('mousedown', initResize);
        
        // Implement toggle button for mobile view
        toggleButton.addEventListener('click', () => {
          if (panel.classList.contains('collapsed')) {
            panel.classList.remove('collapsed');
            toggleButton.innerHTML = '⟨';
          } else {
            panel.classList.add('collapsed');
            toggleButton.innerHTML = '⟩';
          }
        });
        
        // Add event listener to close panel when pressing ESC key
        document.addEventListener('keydown', (event) => {
          if (event.key === 'Escape') {
            if (document.body.contains(panel)) {
              clearFormHighlights(); // Clear highlights
              panel.classList.add('collapsed');
              setTimeout(() => {
                if (document.body.contains(panel)) {
                  document.body.removeChild(panel);
                }
              }, 300);
            }
          }
        });
      },
      args: [fields]
    });
    
    // Show success message in the popup
    if (showToastCallback) {
      showToastCallback(`Analyzed ${fields.length} form fields`, 'success');
    }
  }

  // Public API
  return {
    analyzeCurrentForm,
    displayFormFieldsInPageDialog
  };
})();

// Expose the module to the global scope
self.formAnalysis = formAnalysis;
