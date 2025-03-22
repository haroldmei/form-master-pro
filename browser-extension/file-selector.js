// Remember to add type="module" to the script tag in your HTML file:
// <script src="file-selector.js" type="module"></script>
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
        convertDocxToJson(file);
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

  async function convertDocxToJson(file) {
    try {
      // Import extractDocxContent
      import('./files/docx-extractor.js')
        .then(module => {
          const extractDocxContent = module.extractDocxContent;

          // Use extractDocxContent to convert the DOCX file to JSON
          extractDocxContent(file, file.name)
            .then(content => {
              const jsonString = JSON.stringify(content);

              statusDiv.textContent = 'DOCX converted to JSON. ' + jsonString.substring(0, 100) + '...'; // Display first 100 characters

              // Store content in chrome.storage
              chrome.storage.local.set({ jsonData: jsonString }, function() {
                statusDiv.textContent += ' (Content stored in chrome.storage)';
              });
            })
            .catch(error => {
              statusDiv.textContent = `Error converting DOCX to JSON: ${error.message}`;
              console.error(error);
            });
        })
        .catch(error => {
          statusDiv.textContent = `Error importing DOCX extractor: ${error.message}`;
          console.error(error);
        });
    } catch (error) {
      statusDiv.textContent = `Error converting DOCX to JSON: ${error.message}`;
      console.error(error);
    }
  }
});
