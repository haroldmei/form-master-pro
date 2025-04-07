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
            
            // Identify the control type using patterns from form_extract.js and other modules
            const controlType = determineControlType(field);
            
            switch(controlType) {
                case 'enhancedSelect':
                case 'select':
                    input = createSelectControl(field);
                    break;
                
                case 'radio':
                case 'radioGroup':
                    input = createRadioGroupControl(field);
                    break;
                
                case 'checkbox':
                    input = createCheckboxControl(field);
                    break;
                
                case 'checkboxGroup':
                    input = createCheckboxGroupControl(field);
                    break;
                
                case 'date':
                    input = createDateControl(field);
                    break;
                
                case 'textarea':
                    input = createTextareaControl(field);
                    break;
                
                default:
                    input = createTextInputControl(field);
            }
            
            // Add common input attributes if the created control isn't already a container
            if (input.tagName !== 'DIV') {
                input.className = 'field-input';
                if (field.mandatory) {
                    input.classList.add('mandatory-input');
                }
            }
            
            row.appendChild(input);
            fieldsContainer.appendChild(row);
        });
        
        // Set up button event listeners
        document.getElementById('save-btn').addEventListener('click', saveValues);
        document.getElementById('cancel-btn').addEventListener('click', cancel);
    }
    
    /**
     * Determine the most appropriate control type based on field properties
     * @param {Object} field - The field object
     * @return {string} The control type
     */
    function determineControlType(field) {
        // Handle enhancedSelect fields (like Chosen dropdowns)
        if (field.isEnhanced || field.enhancedType || 
            (field.enhancedData && field.enhancedData.type) || 
            field.type === 'enhancedSelect') {
            return 'enhancedSelect';
        }
        
        // Handle date inputs
        if (field.type === 'date' || field.isDateInput) {
            return 'date';
        }
        
        // Handle radio groups
        if (field.type === 'radio' && field.options && field.options.length > 0) {
            return 'radioGroup';
        }
        
        // Handle checkbox groups
        if (field.type === 'checkboxGroup' || 
            (field.options && field.options.length > 0 && field.type === 'checkbox')) {
            return 'checkboxGroup';
        }
        
        // Handle individual checkbox (single boolean value)
        if (field.type === 'checkbox') {
            return 'checkbox';
        }
        
        // Handle selects
        if (field.type === 'select' && field.options) {
            return 'select';
        }
        
        // Handle textareas
        if (field.type === 'textarea') {
            return 'textarea';
        }
        
        // Default to text input
        return field.type || 'text';
    }
    
    /**
     * Create a select dropdown control
     * @param {Object} field - The field data
     * @return {HTMLElement} The created control
     */
    function createSelectControl(field) {
        const select = document.createElement('select');
        
        // Add blank option
        const blankOption = document.createElement('option');
        blankOption.value = '';
        blankOption.textContent = '-- Select --';
        select.appendChild(blankOption);
        
        // Add options from field
        if (field.options && Array.isArray(field.options)) {
            field.options.forEach(option => {
                const optElement = document.createElement('option');
                
                // Get option value and text using the different possible formats
                optElement.value = option.value || '';
                optElement.textContent = option.text || option.label || option.value || '';
                
                // Check if this option is selected
                if (option.selected || (field.value && field.value === option.value)) {
                    optElement.selected = true;
                }
                
                select.appendChild(optElement);
            });
        } else if (field.enhancedData && field.enhancedData.options) {
            // Support enhanced select options
            field.enhancedData.options.forEach(option => {
                const optElement = document.createElement('option');
                optElement.value = option.value || '';
                optElement.textContent = option.text || option.label || option.value || '';
                select.appendChild(optElement);
            });
        }
        
        return select;
    }
    
    /**
     * Create a radio button group control
     * @param {Object} field - The field data
     * @return {HTMLElement} The created control container
     */
    function createRadioGroupControl(field) {
        // Create a container for the radio options
        const container = document.createElement('div');
        container.className = 'radio-group field-input';
        
        if (field.mandatory) {
            container.classList.add('mandatory-input');
        }
        
        if (field.options && Array.isArray(field.options)) {
            field.options.forEach((option, index) => {
                const wrapper = document.createElement('div');
                wrapper.className = 'radio-option';
                
                const radio = document.createElement('input');
                radio.type = 'radio';
                radio.name = `radio_${field.id || field.name || index}`;
                radio.value = option.value || '';
                radio.id = `radio_${field.id || field.name || ''}_${index}`;
                
                if (option.checked || (field.value && field.value === option.value)) {
                    radio.checked = true;
                }
                
                const optionLabel = document.createElement('label');
                optionLabel.htmlFor = radio.id;
                optionLabel.textContent = option.text || option.label || option.value || '';
                
                wrapper.appendChild(radio);
                wrapper.appendChild(optionLabel);
                container.appendChild(wrapper);
            });
        }
        
        return container;
    }
    
    /**
     * Create a checkbox control
     * @param {Object} field - The field data
     * @return {HTMLElement} The created control
     */
    function createCheckboxControl(field) {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        
        if (field.checked || field.value === true || field.value === 'true' || field.value === '1') {
            checkbox.checked = true;
        }
        
        return checkbox;
    }
    
    /**
     * Create a checkbox group control
     * @param {Object} field - The field data
     * @return {HTMLElement} The created control container
     */
    function createCheckboxGroupControl(field) {
        const container = document.createElement('div');
        container.className = 'checkbox-group field-input';
        
        if (field.mandatory) {
            container.classList.add('mandatory-input');
        }
        
        if (field.options && Array.isArray(field.options)) {
            field.options.forEach((option, index) => {
                const wrapper = document.createElement('div');
                wrapper.className = 'checkbox-option';
                
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = option.value || '';
                checkbox.id = `checkbox_${field.id || field.name || ''}_${index}`;
                
                if (option.checked || 
                    (field.value && Array.isArray(field.value) && field.value.includes(option.value))) {
                    checkbox.checked = true;
                }
                
                const optionLabel = document.createElement('label');
                optionLabel.htmlFor = checkbox.id;
                optionLabel.textContent = option.text || option.label || option.value || '';
                
                wrapper.appendChild(checkbox);
                wrapper.appendChild(optionLabel);
                container.appendChild(wrapper);
            });
        }
        
        return container;
    }
    
    /**
     * Create a date input control
     * @param {Object} field - The field data
     * @return {HTMLElement} The created control
     */
    function createDateControl(field) {
        const input = document.createElement('input');
        input.type = 'date';
        
        // If field has a value, try to format it as YYYY-MM-DD for the input
        if (field.value) {
            // Try to parse the date from various formats
            try {
                const dateValue = new Date(field.value);
                if (!isNaN(dateValue)) {
                    const yyyy = dateValue.getFullYear();
                    const mm = String(dateValue.getMonth() + 1).padStart(2, '0');
                    const dd = String(dateValue.getDate()).padStart(2, '0');
                    input.value = `${yyyy}-${mm}-${dd}`;
                }
            } catch (e) {
                // If parsing fails, ignore and use default
                console.warn('Could not parse date:', field.value);
            }
        }
        
        // If no valid date value, default to today
        if (!input.value) {
            const today = new Date();
            const yyyy = today.getFullYear();
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            const dd = String(today.getDate()).padStart(2, '0');
            input.value = `${yyyy}-${mm}-${dd}`;
        }
        
        return input;
    }
    
    /**
     * Create a textarea control
     * @param {Object} field - The field data
     * @return {HTMLElement} The created control
     */
    function createTextareaControl(field) {
        const textarea = document.createElement('textarea');
        textarea.placeholder = `Enter value for ${field.label || field.name || field.id}`;
        
        if (field.value) {
            textarea.value = field.value;
        }
        
        if (field.rows) {
            textarea.rows = field.rows;
        } else {
            textarea.rows = 3; // Default rows
        }
        
        return textarea;
    }
    
    /**
     * Create a basic text input control
     * @param {Object} field - The field data
     * @return {HTMLElement} The created control
     */
    function createTextInputControl(field) {
        const input = document.createElement('input');
        input.type = field.type || 'text';
        
        if (field.placeholder) {
            input.placeholder = field.placeholder;
        } else {
            input.placeholder = `Enter value for ${field.label || field.name || field.id}`;
        }
        
        if (field.value) {
            input.value = field.value;
        }
        
        if (field.maxLength) {
            input.maxLength = field.maxLength;
        }
        
        return input;
    }
    
    function saveValues() {
        // Collect values from all inputs
        const values = {};
        const fieldRows = document.querySelectorAll('.field-row');
        
        fieldRows.forEach(row => {
            const keyName = row.dataset.keyName;
            
            // Handle different control types
            const radioGroup = row.querySelector('.radio-group');
            if (radioGroup) {
                const checkedRadio = radioGroup.querySelector('input[type="radio"]:checked');
                values[keyName] = checkedRadio ? checkedRadio.value : '';
                return;
            }
            
            const checkboxGroup = row.querySelector('.checkbox-group');
            if (checkboxGroup) {
                const checkedBoxes = checkboxGroup.querySelectorAll('input[type="checkbox"]:checked');
                values[keyName] = Array.from(checkedBoxes).map(cb => cb.value);
                return;
            }
            
            // Standard input handling
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
