document.addEventListener('DOMContentLoaded', function() {
  const actionButton = document.getElementById('actionButton');
  const statusDiv = document.getElementById('status');
  
  // Left-click handler - Print content to console
  actionButton.addEventListener('click', function() {
    chrome.storage.local.get(['jsonData'], function(result) {
      if (result.jsonData) {
        console.log('Stored JSON Data:', result.jsonData);
        statusDiv.textContent = 'Data printed to console';
        setTimeout(() => {
          statusDiv.textContent = '';
        }, 2000);
      } else {
        statusDiv.textContent = 'No data loaded yet. Right-click to load a file.';
        setTimeout(() => {
          statusDiv.textContent = '';
        }, 2000);
      }
    });
  });
  
  // Right-click handler - Open file selector
  actionButton.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    
    // Create file input element
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';
    
    fileInput.addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        
        reader.onload = function(event) {
          try {
            const jsonData = JSON.parse(event.target.result);
            // Store the data in Chrome's storage
            chrome.storage.local.set({ jsonData: jsonData }, function() {
              statusDiv.textContent = `Loaded: ${file.name}`;
              setTimeout(() => {
                statusDiv.textContent = '';
              }, 2000);
            });
          } catch (error) {
            statusDiv.textContent = 'Error: Invalid JSON file';
            setTimeout(() => {
              statusDiv.textContent = '';
            }, 2000);
          }
        };
        
        reader.readAsText(file);
      }
    });
    
    fileInput.click();
    return false;
  });
});
