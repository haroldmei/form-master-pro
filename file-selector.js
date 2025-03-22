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
  
  fileInput.addEventListener('change', async function(e) {
    const file = e.target.files[0];
    if (file) {
      statusDiv.textContent = `File selected: ${file.name}`;
      const fileType = file.name.split('.').pop().toLowerCase();

      if (fileType === 'json') {
        try {
          const content = await readFileContent(file);
          displayContent(content);
        } catch (error) {
          statusDiv.textContent = `Error reading JSON file: ${error.message}`;
        }
      } else if (fileType === 'docx') {
        statusDiv.textContent = 'Converting DOCX to JSON...';
        // Simulate DOCX to JSON conversion using a browser-compatible method
        simulateDocxToJson(file);
      } else {
        statusDiv.textContent = 'Unsupported file type.';
      }
    } else {
      statusDiv.textContent = 'No file selected.';
    }
  });

  function readFileContent(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve(event.target.result);
      reader.onerror = (error) => reject(error);
      reader.readAsText(file);
    });
  }

  function displayContent(content) {
    // Display the content (for JSON)
    statusDiv.textContent = 'File content: ' + content.substring(0, 100) + '...'; // Display first 100 characters
    
    // Store content in chrome.storage
    chrome.storage.local.set({ jsonData: content }, function() {
      statusDiv.textContent += ' (Content stored in chrome.storage)';
    });
  }

  function simulateDocxToJson(file) {
    // Simulate the DOCX to JSON conversion
    setTimeout(() => {
      const mockJson = {
        filename: file.name,
        content: 'This is simulated JSON content from DOCX file.'
      };
      const jsonString = JSON.stringify(mockJson);
      statusDiv.textContent = 'DOCX converted to JSON (simulated): ' + jsonString.substring(0, 100) + '...';
      
      // Store content in chrome.storage
      chrome.storage.local.set({ jsonData: jsonString }, function() {
        statusDiv.textContent += ' (Content stored in chrome.storage)';
      });
    }, 1500); // Simulate a 1.5 second conversion
  }
});
