document.addEventListener('DOMContentLoaded', function() {
  // Set up tab switching
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active class from all tabs
      tabs.forEach(t => t.classList.remove('active'));
      
      // Add active class to clicked tab
      tab.classList.add('active');
      
      // Hide all tab content
      const tabContents = document.querySelectorAll('.tab-content');
      tabContents.forEach(content => content.classList.remove('active'));
      
      // Show the content for the active tab
      const tabId = tab.getAttribute('data-tab');
      document.getElementById(tabId).classList.add('active');
    });
  });

  // Get the form data passed from the background script
  chrome.storage.local.get(['formAnalysisData'], function(result) {
    if (!result.formAnalysisData) {
      showError('No form analysis data found.');
      return;
    }
    
    const formData = result.formAnalysisData;
    displayFormAnalysis(formData);
  });

  /**
   * Display form analysis data on the page
   */
  function displayFormAnalysis(formData) {
    // Update summary information
    document.getElementById('form-url').textContent = `URL: ${formData.url || 'Unknown'}`;
    
    // Count total fields
    let totalFields = 0;
    if (formData.data) {
      if (formData.data.inputs) totalFields += formData.data.inputs.length;
      if (formData.data.selects) totalFields += formData.data.selects.length;
      if (formData.data.textareas) totalFields += formData.data.textareas.length;
      if (formData.data.radios) totalFields += formData.data.radios.length;
      if (formData.data.checkboxes) totalFields += formData.data.checkboxes.length;
    }
    
    document.getElementById('field-count').textContent = `Fields detected: ${totalFields}`;
    
    // Add timestamp
    const timestamp = new Date().toLocaleString();
    document.getElementById('form-timestamp').textContent = `Analysis performed: ${timestamp}`;
    
    // Display raw JSON data
    const jsonContent = document.getElementById('json-content');
    jsonContent.textContent = JSON.stringify(formData.data, null, 2);
    
    // Create a flattened array of all form fields
    const allFields = [];
    
    if (formData.data.inputs) allFields.push(...formData.data.inputs);
    if (formData.data.selects) allFields.push(...formData.data.selects);
    if (formData.data.textareas) allFields.push(...formData.data.textareas);
    if (formData.data.radios) allFields.push(...formData.data.radios);
    if (formData.data.checkboxes) allFields.push(...formData.data.checkboxes);
    
    // Display the flattened fields in the table
    const tbody = document.getElementById('fields-tbody');
    tbody.innerHTML = '';
    
    if (allFields.length === 0) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 5;
      cell.textContent = 'No form fields detected';
      row.appendChild(cell);
      tbody.appendChild(row);
    } else {
      allFields.forEach(field => {
        const row = document.createElement('tr');
        
        // Label/Name cell
        const labelCell = document.createElement('td');
        labelCell.textContent = field.label || field.name || field.id || 'Unnamed Field';
        row.appendChild(labelCell);
        
        // Type cell
        const typeCell = document.createElement('td');
        typeCell.textContent = field.type;
        row.appendChild(typeCell);
        
        // ID cell
        const idCell = document.createElement('td');
        idCell.textContent = field.id || '-';
        row.appendChild(idCell);
        
        // Value cell
        const valueCell = document.createElement('td');
        if (field.type === 'select' || field.type === 'radio') {
          // For select/radio, show selected option
          const selectedOpt = field.options?.find(opt => opt.selected || opt.checked);
          valueCell.textContent = selectedOpt ? selectedOpt.value || selectedOpt.text : '-';
        } else if (field.type === 'checkbox') {
          valueCell.textContent = field.checked ? 'Checked' : 'Unchecked';
        } else {
          valueCell.textContent = field.value || '-';
        }
        row.appendChild(valueCell);
        
        // Options cell
        const optionsCell = document.createElement('td');
        if (field.options && field.options.length > 0) {
          const optionsList = document.createElement('ul');
          optionsList.className = 'options-list';
          
          field.options.forEach(option => {
            const optItem = document.createElement('li');
            if (option.selected || option.checked) {
              optItem.className = 'selected-option';
            }
            
            const optionText = option.text || option.value || option.label || '-';
            optItem.textContent = optionText;
            optionsList.appendChild(optItem);
          });
          
          optionsCell.appendChild(optionsList);
        } else {
          optionsCell.textContent = '-';
        }
        row.appendChild(optionsCell);
        
        tbody.appendChild(row);
      });
    }
  }

  /**
   * Show an error message on the page
   */
  function showError(message) {
    const summaryDiv = document.querySelector('.summary');
    summaryDiv.innerHTML = `<h2>Error</h2><p>${message}</p>`;
    summaryDiv.style.backgroundColor = '#f8d7da';
    summaryDiv.style.color = '#721c24';
  }
});
