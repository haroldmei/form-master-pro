document.addEventListener('DOMContentLoaded', function() {
  // DOM elements
  const urlContainer = document.getElementById('url-container');
  const addUrlButton = document.getElementById('add-url');
  const saveMappingsButton = document.getElementById('save-mappings');
  
  // Templates
  const urlSectionTemplate = document.getElementById('url-section-template');
  const mappingRowTemplate = document.getElementById('mapping-row-template');
  
  // Load existing mappings
  loadMappings();
  
  // Event listeners
  addUrlButton.addEventListener('click', addUrlSection);
  saveMappingsButton.addEventListener('click', saveMappings);
  
  /**
   * Load mappings from storage
   */
  function loadMappings() {
    chrome.runtime.sendMessage({ action: 'getMappings' }, response => {
      if (response && response.mappings) {
        const mappings = response.mappings;
        
        for (const url in mappings) {
          const urlSection = addUrlSection();
          const urlInput = urlSection.querySelector('.url-input');
          urlInput.value = url;
          
          const fieldMappings = mappings[url];
          const mappingsContainer = urlSection.querySelector('.mappings-container');
          
          for (const fieldId in fieldMappings) {
            const mapping = fieldMappings[fieldId];
            const mappingRow = addMappingRow(mappingsContainer);
            
            const fieldIdInput = mappingRow.querySelector('.field-id');
            fieldIdInput.value = fieldId;
            
            const mappingTypeSelect = mappingRow.querySelector('.mapping-type');
            const mappingValueInput = mappingRow.querySelector('.mapping-value');
            
            if (typeof mapping === 'string') {
              mappingTypeSelect.value = 'direct';
              mappingValueInput.value = mapping;
            } else if (typeof mapping === 'object') {
              if (mapping.type === 'table') {
                mappingTypeSelect.value = 'table';
                mappingValueInput.value = `${mapping.table},${mapping.row},${mapping.col}`;
              } else if (mapping.type === 'regex') {
                mappingTypeSelect.value = 'regex';
                mappingValueInput.value = mapping.pattern;
              }
            }
          }
        }
      }
    });
  }
  
  /**
   * Add a new URL section
   */
  function addUrlSection() {
    const urlSection = document.importNode(urlSectionTemplate.content, true).firstElementChild;
    urlSection.dataset.urlId = Date.now().toString();
    
    // Add event listeners
    const removeBtn = urlSection.querySelector('.url-header .remove-btn');
    removeBtn.addEventListener('click', () => {
      urlSection.remove();
    });
    
    const addMappingBtn = urlSection.querySelector('.add-mapping-btn');
    addMappingBtn.addEventListener('click', () => {
      const mappingsContainer = urlSection.querySelector('.mappings-container');
      addMappingRow(mappingsContainer);
    });
    
    // Add initial mapping row
    const mappingsContainer = urlSection.querySelector('.mappings-container');
    addMappingRow(mappingsContainer);
    
    urlContainer.appendChild(urlSection);
    return urlSection;
  }
  
  /**
   * Add a new mapping row
   */
  function addMappingRow(container) {
    const mappingRow = document.importNode(mappingRowTemplate.content, true).firstElementChild;
    
    // Add event listeners
    const removeBtn = mappingRow.querySelector('.remove-btn');
    removeBtn.addEventListener('click', () => {
      mappingRow.remove();
    });
    
    container.appendChild(mappingRow);
    return mappingRow;
  }
  
  /**
   * Save mappings to storage
   */
  function saveMappings() {
    const mappings = {};
    
    const urlSections = urlContainer.querySelectorAll('.url-section');
    urlSections.forEach(section => {
      const url = section.querySelector('.url-input').value.trim();
      if (!url) return;
      
      mappings[url] = {};
      
      const mappingRows = section.querySelectorAll('.mapping-row');
      mappingRows.forEach(row => {
        const fieldId = row.querySelector('.field-id').value.trim();
        if (!fieldId) return;
        
        const mappingType = row.querySelector('.mapping-type').value;
        const mappingValue = row.querySelector('.mapping-value').value.trim();
        
        if (mappingType === 'direct') {
          mappings[url][fieldId] = mappingValue;
        } else if (mappingType === 'table') {
          const [table, rowIdx, colIdx] = mappingValue.split(',').map(v => parseInt(v.trim()));
          mappings[url][fieldId] = {
            type: 'table',
            table: table || 0,
            row: rowIdx || 0,
            col: colIdx || 0
          };
        } else if (mappingType === 'regex') {
          mappings[url][fieldId] = {
            type: 'regex',
            pattern: mappingValue,
            source: 'text'
          };
        }
      });
    });
    
    chrome.runtime.sendMessage({ 
      action: 'saveMappings', 
      mappings: mappings 
    }, response => {
      if (response && response.success) {
        showToast('Mappings saved successfully', 'success');
      } else {
        showToast('Error saving mappings', 'error');
      }
    });
  }
  
  /**
   * Show a toast message
   */
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('show');
      
      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    }, 10);
  }
});
