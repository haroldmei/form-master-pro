document.addEventListener('DOMContentLoaded', function() {
  const selectButton = document.getElementById('selectButton');
  const fileInput = document.getElementById('fileInput');
  const statusDiv = document.getElementById('status');
  
  // Add keyboard shortcut for opening DevTools (Ctrl+Shift+I or Cmd+Shift+I)
  document.addEventListener('keydown', function(e) {
    // Check for Ctrl+Shift+I or Cmd+Shift+I
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'I') {
      // This creates a connection to the background page to request DevTools
      if (chrome.runtime && chrome.runtime.connect) {
        chrome.runtime.connect({name: 'open-devtools-for-popup'});
        statusDiv.textContent = 'Opening DevTools...';
      }
    }
  });
  
  selectButton.addEventListener('click', function() {
    fileInput.click();
  });
  
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
              // Close this popup window after loading
              window.close();
            }, 1500);
          });
        } catch (error) {
          statusDiv.textContent = 'Error: Invalid JSON file';
        }
      };
      
      reader.readAsText(file);
    }
  });
});
