/**
 * Default values dialog popup handler
 */
(function() {
    let missingFields = [];
    let rootUrl = '';
    
    // Listen for message from the opener with field data
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'init-defaults-dialog') {
            missingFields = message.missingFields || [];
            rootUrl = message.rootUrl || '';
            
            initializeDialog(missingFields, rootUrl);
            sendResponse({ success: true });
        }
    });
    
    // Request data from background script on page load
    document.addEventListener('DOMContentLoaded', () => {
        chrome.runtime.sendMessage({ 
            action: 'get-defaults-dialog-data' 
        }, (response) => {
            if (response && response.missingFields && response.rootUrl) {
                missingFields = response.missingFields;
                rootUrl = response.rootUrl;
                initializeDialog(missingFields, rootUrl);
            }
        });
    });
    
    function initializeDialog(missingFields, rootUrl) {
        // Update title and description
        document.querySelector('.title').textContent = `Missing Field Values (${missingFields.length})`;
        //document.getElementById('message-description').textContent = 
        //    `We couldn't automatically determine values for ${missingFields.length} fields on this form on ${rootUrl}.`;
        
        // Count mandatory fields
        const mandatoryCount = missingFields.filter(f => f.mandatory).length;
        const mandatoryMsg = document.getElementById('mandatory-message');
        
        if (mandatoryCount > 0) {
            mandatoryMsg.innerHTML = `${mandatoryCount} fields marked with * are required and need non empty value, the rest are optional and can be left empty.`;
        } else {
            mandatoryMsg.textContent = 'None of these fields are mandatory, but providing values will help complete the form.';
        }
        
        // Create form fields
        const fieldsContainer = document.getElementById('fields-container');
        fieldsContainer.innerHTML = ''; // Clear container
        
        missingFields.forEach(field => {
            // Create field row
            const row = document.createElement('div');
            row.className = 'field-row';
            row.dataset.fieldId = field.id || field.name;
            row.dataset.keyName = field.label || field.name || field.id;
            
            // Create label
            const label = document.createElement('label');
            label.className = 'field-label';
            if (field.mandatory) {
                label.classList.add('mandatory-field');
            }
            
            // Set label text
            label.textContent = field.label || field.name || field.id;
            
            // Add mandatory indicator
            if (field.mandatory) {
                const indicator = document.createElement('span');
                indicator.className = 'mandatory-indicator';
                indicator.textContent = ' *';
                label.appendChild(indicator);
            }
            
            row.appendChild(label);
            
            // Create input based on field type
            let input;
            
            if (field.type === 'select' || (field.type === 'radio' && field.options && field.options.length > 0)) {
                input = document.createElement('select');
                
                // Add blank option
                const blankOption = document.createElement('option');
                blankOption.value = '';
                blankOption.textContent = '-- Select --';
                input.appendChild(blankOption);
                
                // Add options from field
                if (field.options && Array.isArray(field.options)) {
                    field.options.forEach(option => {
                        const optElement = document.createElement('option');
                        optElement.value = option.value || '';
                        optElement.textContent = option.text || option.label || option.value || '';
                        input.appendChild(optElement);
                    });
                }
            } else if (field.type === 'checkbox') {
                input = document.createElement('input');
                input.type = 'checkbox';
            } else if (field.type === 'date') {
                input = document.createElement('input');
                input.type = 'date';
                
                // Default to today's date
                const today = new Date();
                const yyyy = today.getFullYear();
                const mm = String(today.getMonth() + 1).padStart(2, '0');
                const dd = String(today.getDate()).padStart(2, '0');
                input.value = `${yyyy}-${mm}-${dd}`;
            } else {
                input = document.createElement('input');
                input.type = field.type || 'text';
                input.placeholder = `Enter value for ${field.label || field.name || field.id}, ${field.options}`;
            }
            
            // Add common input attributes
            input.className = 'field-input';
            if (field.mandatory) {
                input.classList.add('mandatory-input');
            }
            
            row.appendChild(input);
            fieldsContainer.appendChild(row);
        });
        
        // Set up button event listeners
        document.getElementById('save-btn').addEventListener('click', saveValues);
        document.getElementById('cancel-btn').addEventListener('click', cancel);
    }
    
    function saveValues() {
        // Collect values from all inputs
        const values = {};
        const fieldRows = document.querySelectorAll('.field-row');
        
        fieldRows.forEach(row => {
            const keyName = row.dataset.keyName;
            const input = row.querySelector('.field-input');
            
            if (!input) return;
            
            if (input.type === 'checkbox') {
                values[keyName] = input.checked;
            } else {
                values[keyName] = input.value;
            }
        });
        
        // Send values back to the background script
        chrome.runtime.sendMessage({
            action: 'defaults-dialog-submit',
            values: values,
            rootUrl: rootUrl,
            result: 'save'
        }, () => {
            window.close();
        });
    }
    
    function cancel() {
        // Send cancel message to background script
        chrome.runtime.sendMessage({
            action: 'defaults-dialog-submit',
            values: {},
            rootUrl: rootUrl,
            result: 'cancel'
        }, () => {
            window.close();
        });
    }
})();
