/**
 * UI Injector for FormMasterPro
 * This script injects the floating UI elements into the current page
 */

(function() {
  // Version information - should match manifest.json
  const VERSION = "1.1.0";
  
  // Determine development mode based on API_BASE_URL which is set by webpack.DefinePlugin
  // In development mode it will be http://localhost:3001, in production it will be https://bargain4me.com
  const DEV_MODE = typeof API_BASE_URL === 'undefined' || API_BASE_URL.includes('localhost');
  
  // Check if we're in a frame - only inject in the main frame
  if (self !== self.top) return;

  // Create and inject the UI when the page is ready
  self.addEventListener('DOMContentLoaded', injectUI);
  
  // If page is already loaded, inject UI immediately
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    injectUI();
  }
  
  function injectUI() {
    // Avoid duplicate injection
    if (document.getElementById('formmaster-ui')) return;
    
    // Track API call status to prevent duplicate calls
    let isApiCallInProgress = false;
    
    // Create the container with Shadow DOM to isolate CSS
    const container = document.createElement('div');
    container.id = 'formmaster-ui';
    document.body.appendChild(container);
    
    // Create shadow root
    const shadow = container.attachShadow({ mode: 'closed' });
    
    // Load CSS from external file
    loadCSS(shadow);
    
    // Create the main container
    const mainContainer = document.createElement('div');
    mainContainer.className = 'formmaster-container';
    
    // Create toggle button
    const toggleButton = document.createElement('div');
    toggleButton.className = 'formmaster-toggle';
    toggleButton.textContent = 'FM';
    toggleButton.title = `FormMasterPro v${VERSION}`;
    
    // Change from hover to click toggle
    toggleButton.addEventListener('click', togglePanel);
    
    // Create panel for buttons
    const panel = document.createElement('div');
    panel.className = 'formmaster-panel';
    
    // Prevent panel clicks from closing the panel
    panel.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    
    // Add panel header
    const panelHeader = document.createElement('div');
    panelHeader.className = 'panel-header';
    
    const panelTitle = document.createElement('div');
    panelTitle.className = 'panel-title';
    panelTitle.textContent = 'FormMaster Pro';
    
    const panelVersion = document.createElement('div');
    panelVersion.className = 'panel-version';
    panelVersion.textContent = `v${VERSION}`;
    
    panelHeader.appendChild(panelTitle);
    panelHeader.appendChild(panelVersion);
    panel.appendChild(panelHeader);
    
    // Add buttons to panel
    const buttons = [
      { id: 'load-data', text: 'Load File', icon: '📂' }
    ];
    
    // Add 'Load Folder' button only in development mode
    if (DEV_MODE) {
      buttons.push({ id: 'load-folder', text: 'Load Folder', icon: '📁' });
    }
    
    // Add Auto Fill button (always visible)
    buttons.push({ id: 'auto-fill', text: 'Auto Fill', icon: '✏️' });
    
    // Make sure buttons are added with the correct structure
    buttons.forEach(button => {
      const btnElement = document.createElement('button');
      btnElement.className = 'formmaster-button';
      btnElement.id = `formmaster-${button.id}`;
      
      btnElement.innerHTML = `
        <span class="formmaster-icon">${button.icon}</span>
        <span class="formmaster-text">${button.text}</span>
      `;
      
      // Make sure the entire button is clickable
      btnElement.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        handleButtonClick(button.id, btnElement);
      });
      
      panel.appendChild(btnElement);
    });
    
    // Add status bar to display profile info
    const statusBar = document.createElement('div');
    statusBar.className = 'formmaster-status-bar no-profile';
    statusBar.id = 'formmaster-status-bar';
    
    // Create file info container
    const fileInfo = document.createElement('div');
    fileInfo.className = 'file-info';
    
    // Create file name and size elements
    const fileName = document.createElement('div');
    fileName.className = 'file-name';
    fileName.textContent = 'No profile loaded';
    
    const fileSize = document.createElement('div');
    fileSize.className = 'file-size';
    fileSize.textContent = '';
    fileSize.style.display = 'none';
    
    fileInfo.appendChild(fileName);
    fileInfo.appendChild(fileSize);
    statusBar.appendChild(fileInfo);
    
    panel.appendChild(statusBar);
    
    // Add all elements to the shadow DOM
    mainContainer.appendChild(panel);
    mainContainer.appendChild(toggleButton);
    shadow.appendChild(mainContainer);
    
    // Create toast element for notifications
    const toast = document.createElement('div');
    toast.className = 'formmaster-toast';
    shadow.appendChild(toast);
    
    // Add document click handler to close panel when clicking outside
    document.addEventListener('click', (e) => {
      // Close panel if it's open and the click is outside the panel
      if (panel.classList.contains('show') && e.target !== toggleButton) {
        panel.classList.remove('show');
        toggleButton.classList.remove('active');
      }
    });
    
    // Prevent clicks on the container from closing the panel
    mainContainer.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    
    // Helper function to load CSS from external file
    function loadCSS(shadowRoot) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.type = 'text/css';
      link.href = chrome.runtime.getURL('styles/injector-ui.css');
      shadowRoot.appendChild(link);
    }
    
    // Replace hover functions with toggle function
    function togglePanel(e) {
      e.stopPropagation(); // Prevent document click handler from firing
      
      if (panel.classList.contains('show')) {
        // Hide panel
        panel.classList.remove('show');
        toggleButton.classList.remove('active');
      } else {
        // Show panel
        panel.classList.add('show');
        toggleButton.classList.add('active');
        loadProfileInfo();
        
        // Reset animation for panel border glow
        panel.style.animation = 'none';
        panel.offsetHeight; // Trigger reflow
        panel.style.animation = null;
      }
    }
    
    // Remove the showPanel and hidePanel functions as they're replaced by togglePanel
    
    function handleButtonClick(action, buttonElement) {
      // Don't proceed if an API call is already in progress
      if (isApiCallInProgress) {
        showToast('Please wait, an operation is in progress', 'info');
        return;
      }
      
      // Special handling for clear-data action
      if (action === 'clear-data') {
        // Store original HTML before showing loading state
        const originalHTML = buttonElement.innerHTML;
        
        // Show loading state
        buttonElement.classList.add('loading');
        buttonElement.disabled = true;
        setToggleBusy(true);
        
        // Send message to clear suggestions data
        chrome.runtime.sendMessage({ action: 'clearSuggestions' }, function(response) {
          // Reset button state
          buttonElement.classList.remove('loading');
          buttonElement.disabled = false;
          buttonElement.innerHTML = originalHTML;
          setToggleBusy(false);
          
          if (response && response.success) {
            showToast('Form data cleared successfully', 'success');
          } else {
            showToast(response?.error || 'Error clearing form data', 'error');
          }
        });
        return;
      }
      
      // Special handling for load-data action (single file)
      if (action === 'load-data') {
        // First check email verification
        chrome.runtime.sendMessage({ action: 'checkEmailVerification' }, function(response) {
          if (!response || !response.isVerified) {
            showToast('Email verification required to use this feature', 'error');
            return;
          }
          
          // Create a file input element
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.pdf,.docx'; // Accept both PDF and DOCX files
          
          // Store original HTML before showing loading state
          const originalHTML = buttonElement.innerHTML;
          
          // Handle file selection
          input.onchange = async e => {
            const file = e.target.files[0];
            if (!file) return;
            
            // Show loading state on both button and toggle
            buttonElement.classList.add('loading');
            buttonElement.disabled = true;
            setToggleBusy(true);
            
            try {
              const fileExtension = file.name.split('.').pop().toLowerCase();
              
              if (fileExtension === 'pdf') {
                // Process PDF file
                await processPDFFile(file);
                showToast(`PDF loaded: ${file.name}`, 'success');
              } else if (fileExtension === 'docx') {
                // Process DOCX file
                await processDocxFile(file);
                showToast(`DOCX loaded: ${file.name}`, 'success');
              } else {
                showToast('Unsupported file type. Please use PDF or DOCX files.', 'error');
              }
              
              // Refresh profile info
              loadProfileInfo();
            } catch (error) {
              showToast(`Error processing file: ${error.message}`, 'error');
              console.error('File processing error:', error);
            } finally {
              // Reset button state using the stored original HTML
              buttonElement.classList.remove('loading');
              buttonElement.disabled = false;
              buttonElement.innerHTML = originalHTML;
              setToggleBusy(false); // Ensure toggle is reset
            }
          };
          
          // Trigger the file dialog
          input.click();
        });
        return; // Exit the function early
      }
      
      // Special handling for load-folder action
      if (action === 'load-folder') {
        // First check email verification
        chrome.runtime.sendMessage({ action: 'checkEmailVerification' }, function(response) {
          if (!response || !response.isVerified) {
            showToast('Email verification required to use this feature', 'error');
            return;
          }
          
          // Create a file input element with directory attribute
          const input = document.createElement('input');
          input.type = 'file';
          input.webkitdirectory = true; // Allow selecting directories
          input.multiple = true; // Allow selecting multiple files
          
          // Store original HTML before showing loading state
          const originalHTML = buttonElement.innerHTML;
          
          // Handle folder selection
          input.onchange = async e => {
            const files = Array.from(e.target.files || []);
            if (!files.length) return;
            
            // Filter for supported file types
            const supportedFiles = files.filter(file => {
              const ext = file.name.split('.').pop().toLowerCase();
              return ext === 'pdf' || ext === 'docx';
            });
            
            if (!supportedFiles.length) {
              showToast('No supported files found in folder. Please use PDF or DOCX files.', 'error');
              return;
            }
            
            // Show loading state on both button and toggle
            buttonElement.classList.add('loading');
            buttonElement.disabled = true;
            setToggleBusy(true);
            
            try {
              // Process the files in the folder
              await processFilesFromFolder(supportedFiles);
              showToast(`Loaded ${supportedFiles.length} files from folder`, 'success');
              
              // Refresh profile info
              loadProfileInfo();
            } catch (error) {
              showToast(`Error processing folder: ${error.message}`, 'error');
              console.error('Folder processing error:', error);
            } finally {
              // Reset button state using the stored original HTML
              buttonElement.classList.remove('loading');
              buttonElement.disabled = false;
              buttonElement.innerHTML = originalHTML;
              setToggleBusy(false); // Ensure toggle is reset
            }
          };
          
          // Trigger the file dialog
          input.click();
        });
        return; // Exit the function early
      }
      
      // For all other actions, show toggle loading state
      setToggleBusy(true);
      
      chrome.runtime.sendMessage({ action: 'checkEmailVerification' }, function(response) {
        if (!response || !response.isVerified) {
          setToggleBusy(false); // Clear loading state
          showToast('Email verification required to use this feature', 'error');
          return;
        }
        
        // The rest of the original function for other actions
        chrome.runtime.sendMessage({ 
          action: action,
          url: self.location.href
        }, response => {
          setToggleBusy(false); // Clear loading state when response received
          
          if (response && response.success) {
            showToast(response.message || 'Action completed successfully', 'success');
          } else {
            showToast(response?.error || 'Error performing action', 'error');
          }
        });
      });
    }
    
    // Helper function to set the toggle button to busy/loading state
    function setToggleBusy(isBusy) {
      if (isBusy) {
        toggleButton.classList.add('fm-loading');
        
        // Store original text
        if (!toggleButton.dataset.originalText) {
          toggleButton.dataset.originalText = toggleButton.textContent;
        }
        
        // Create spinner element if it doesn't exist
        if (!toggleButton.querySelector('.fm-spinner')) {
          const spinner = document.createElement('div');
          spinner.className = 'fm-spinner';
          toggleButton.textContent = '';
          toggleButton.appendChild(spinner);
        }
        
        // Set the busy flag to prevent concurrent operations
        isApiCallInProgress = true;
      } else {
        toggleButton.classList.remove('fm-loading');
        
        // Restore original text
        if (toggleButton.dataset.originalText) {
          toggleButton.textContent = toggleButton.dataset.originalText;
          delete toggleButton.dataset.originalText;
        }
        
        // Remove loading state
        isApiCallInProgress = false;
      }
    }
    
    // Process PDF file - Now sends to background script
    function processPDFFile(file) {
      return new Promise((resolve, reject) => {
        try {
          const reader = new FileReader();
          reader.onload = function(event) {
            const arrayBuffer = event.target.result;
            
            // Convert ArrayBuffer to base64 string before sending
            const base64 = arrayBufferToBase64(arrayBuffer);
            
            // Set a timeout to handle potential message timeout errors
            const timeoutId = setTimeout(() => {
              setToggleBusy(false); // Clear busy state if timeout occurs
              reject(new Error('Request timed out - background process may be busy'));
            }, 30000); // 30-second timeout
                    
            // Show the toggle in loading state
            setToggleBusy(true);
            
            // Send as base64 string which survives message passing
            chrome.runtime.sendMessage({ 
              action: 'processPDF', 
              pdfData: base64,
              isBase64: true,
              fileName: file.name,
              size: arrayBuffer.byteLength
            }, (response) => {
              // Clear the timeout since we received a response
              clearTimeout(timeoutId);
              
              // Clear loading state
              setToggleBusy(false);
              
              // Check for errors with the Chrome runtime first
              if (chrome.runtime.lastError) {
                console.error('Chrome runtime error:', chrome.runtime.lastError);
                reject(new Error(chrome.runtime.lastError.message || 'Chrome runtime error'));
                return;
              }
              
              // Now check the response content
              if (!response || !response.success) {
                reject(new Error(response?.error || 'Failed to process PDF file'));
              } else {
                resolve(response);
              }
            });
          };
          reader.onerror = function(error) {
            setToggleBusy(false); // Clear loading state on error
            reject(new Error(`Error reading file: ${error}`));
          };
          reader.readAsArrayBuffer(file);
        } catch (error) {
          setToggleBusy(false); // Clear loading state on error
          reject(error);
        }
      });
    }

    // Helper function to convert ArrayBuffer to Base64
    function arrayBufferToBase64(buffer) {
      let binary = '';
      const bytes = new Uint8Array(buffer);
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return window.btoa(binary);
    }

    // Process DOCX file - Updated to send data to background script
    async function processDocxFile(file) {
      try {
        // Show the toggle in loading state
        setToggleBusy(true);
        
        // Extract content from DOCX
        const docxContent = await extractDocxContent(file, file.name);
        console.log('Extracted DOCX content:', docxContent);

        // Check if docxContent has the expected structure
        if (!docxContent) {
          throw new Error('DOCX extraction returned empty result');
        }
        
        // Set a timeout to handle potential message timeout errors
        const timeoutId = setTimeout(() => {
          setToggleBusy(false); // Clear busy state if timeout occurs
          throw new Error('Request timed out - background process may be busy');
        }, 30000); // 30-second timeout
        
        // Send to background script for processing, similar to PDF handling
        chrome.runtime.sendMessage({ 
          action: 'processDocx', 
          docxContent: docxContent,
          fileName: file.name
        }, (response) => {
          // Clear the timeout since we received a response
          clearTimeout(timeoutId);
          
          // Clear loading state
          setToggleBusy(false);
          
          // Check for errors with the Chrome runtime first
          if (chrome.runtime.lastError) {
            console.error('Chrome runtime error:', chrome.runtime.lastError);
            throw new Error(chrome.runtime.lastError.message || 'Chrome runtime error');
          }
          
          // Now check the response content
          if (!response || !response.success) {
            throw new Error(response?.error || 'Failed to process DOCX file');
          }
          
          // Return the response data
          return response;
        });
      } catch (error) {
        setToggleBusy(false); // Clear loading state on error
        throw error;
      }
    }
    
    // Process multiple files from a folder
    async function processFilesFromFolder(files) {
      // Group files by type for better processing
      const pdfFiles = files.filter(file => file.name.toLowerCase().endsWith('.pdf'));
      const docxFiles = files.filter(file => file.name.toLowerCase().endsWith('.docx'));
      
      console.log(`Processing folder with ${pdfFiles.length} PDF and ${docxFiles.length} DOCX files`);
      
      // Extract content from all files
      const fileContents = [];
      let folderName = "";
      
      // First, try to extract common folder path from files
      if (files.length > 0 && files[0].webkitRelativePath) {
        const parts = files[0].webkitRelativePath.split('/');
        if (parts.length >= 2) {
          folderName = parts[0]; // Get the top-level folder name
        }
      }
      
      if (!folderName) {
        folderName = "Combined Files"; // Fallback name if folder structure not found
      }
      
      // Create progress indicators
      const progressToast = document.createElement('div');
      progressToast.className = 'formmaster-progress-toast';
      progressToast.innerHTML = `<div>Processing 0/${files.length} files...</div><div class="progress-bar"><div class="progress"></div></div>`;
      document.body.appendChild(progressToast);
      
      // Process each file and gather content
      let processedCount = 0;
      
      // Process PDF files - using processPDFFile for consistency
      for (const file of pdfFiles) {
        try {
          // Use the same processing function as single file upload
          const result = await processPDFFileForFolder(file);
          fileContents.push({
            filename: file.name,
            content: result.base64Data,
            isBase64: true,
            type: 'pdf'
          });
        } catch (error) {
          console.error(`Error processing PDF file ${file.name}:`, error);
          // Continue with other files
        }
        
        // Update progress
        processedCount++;
        updateProgress(processedCount, files.length, progressToast);
      }
      
      // Process DOCX files
      for (const file of docxFiles) {
        try {
          const result = await extractDocxContent(file, file.name);
          fileContents.push({
            filename: file.name,
            content: result,
            type: 'docx'
          });
        } catch (error) {
          console.error(`Error processing DOCX file ${file.name}:`, error);
          // Continue with other files
        }
        
        // Update progress
        processedCount++;
        updateProgress(processedCount, files.length, progressToast);
      }
      
      // Remove progress indicator
      document.body.removeChild(progressToast);
      
      // Send the combined content to background script
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Request timed out - background process may be busy'));
        }, 30000); // 30-second timeout
        
        chrome.runtime.sendMessage({
          action: 'processFolderFiles',
          folderName: folderName,
          files: fileContents
        }, (response) => {
          clearTimeout(timeoutId);
          
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message || 'Chrome runtime error'));
            return;
          }
          
          if (!response || !response.success) {
            reject(new Error(response?.error || 'Failed to process files from folder'));
          } else {
            resolve(response);
          }
        });
      });
    }
    
    // Helper function to process PDF for folder - adapted from processPDFFile
    async function processPDFFileForFolder(pdfFile) {
      return new Promise((resolve, reject) => {
        try {
          const reader = new FileReader();
          reader.onload = function(event) {
            const arrayBuffer = event.target.result;
            
            // Convert ArrayBuffer to base64 string just like processPDFFile does
            const base64 = arrayBufferToBase64(arrayBuffer);
            
            // Return the base64 data and size directly without sending to background
            resolve({
              base64Data: base64,
              size: arrayBuffer.byteLength
            });
          };
          reader.onerror = function(error) {
            reject(new Error(`Error reading file: ${error}`));
          };
          reader.readAsArrayBuffer(pdfFile);
        } catch (error) {
          reject(error);
        }
      });
    }
    
    // Update progress indicator helper
    function updateProgress(current, total, toastElement) {
      const percent = (current / total) * 100;
      toastElement.querySelector('.progress').style.width = `${percent}%`;
      toastElement.querySelector('div:first-child').textContent = `Processing ${current}/${total} files...`;
    }
    
    // Keep the extractDocxContent function in ui-injector.js as it handles DOM operations
    async function extractDocxContent(docxFile, filename) {
      try {
        console.log('DOCX file loaded:', docxFile);
      
        // Check if JSZip is defined and try to load it if not
        if (typeof JSZip === 'undefined') {
          console.log('JSZip not found. Attempting to load...');
          try {
            // Try to load from various local paths
            const possiblePaths = [
              './libs/jszip.min.js'
            ];
            
            let loaded = false;
            for (const path of possiblePaths) {
              try {
                await loadScript(chrome.runtime.getURL(path));
                console.log(`JSZip loaded successfully from ${path}`);
                loaded = true;
                break;
              } catch (pathError) {
                console.log(`Failed to load from ${path}, trying next option...`);
              }
            }
            
            if (!loaded) {
              console.error('All loading attempts failed.');
              throw new Error('Could not load JSZip from any location');
            }
          } catch (loadErr) {
            console.error('Failed to load JSZip:', loadErr);
            return {
              strings: [],
              filename: filename
            };
          }
        }
      
        // Load the docx file into JSZip
        const zip = new JSZip();
        const docxContent = await zip.loadAsync(await docxFile.arrayBuffer());
        
        // Get the main document.xml file
        const documentXml = await docxContent.file("word/document.xml").async("text");
        
        // Parse XML
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(documentXml, "text/xml");
        
        // Function to extract all elements of a specific name regardless of namespace
        function getElementsByTagName(doc, name) {
          const elements = [];
          const allElements = doc.getElementsByTagName('*');
          
          for (let i = 0; i < allElements.length; i++) {
            const element = allElements[i];
            const localName = element.localName || element.baseName || element.nodeName.split(':').pop();
            
            if (localName === name) {
              elements.push(element);
            }
          }
          
          return elements;
        }
        
        // Initialize the content structure - simplified to just a list of strings
        const extractedStrings = [];
        
        // Extract paragraphs with filtering for important content
        const paragraphs = getElementsByTagName(xmlDoc, 'p');
        for (const paragraph of paragraphs) {
          // Extract text from all text elements (t) within this paragraph
          const textElements = getElementsByTagName(paragraph, 't');
          let paragraphText = "";
          
          for (const textEl of textElements) {
            paragraphText += textEl.textContent;
          }
          
          // Only include paragraph if it contains significant content
          if (paragraphText.trim() && isImportantContent(paragraphText)) {
            // Remove spaces and line breaks
            const cleanText = paragraphText.trim(); 
            if (cleanText) {
              extractedStrings.push(cleanText);
            }
          }
        }
        
        // Extract tables with filtering for important content (still as strings)
        const tables = getElementsByTagName(xmlDoc, 'tbl');
        for (const table of tables) {
          // Get all rows
          const rows = getElementsByTagName(table, 'tr');
          for (const row of rows) {
            // Get all cells
            const cells = getElementsByTagName(row, 'tc');
            for (const cell of cells) {
              // Get all paragraphs in the cell
              const cellParagraphs = getElementsByTagName(cell, 'p');
              let cellText = "";
              
              for (const para of cellParagraphs) {
                // Extract text from all text elements in this paragraph
                const textElements = getElementsByTagName(para, 't');
                
                for (const textEl of textElements) {
                  cellText += textEl.textContent;
                }
              }
              
              if (cellText.trim() && isImportantContent(cellText)) {
                // Remove spaces and line breaks
                const cleanText = cellText.trim();
                if (cleanText) {
                  extractedStrings.push(cleanText);
                }
              }
            }
          }
        }
        
        // Return in a format compatible with profile.js expectations
        return {
          filename: filename,
          rawText: extractedStrings.join(''),
          paragraphs: extractedStrings.map(text => ({ text })),
          tables: [],
          // Also include the new format for future use
          strings: extractedStrings
        };
      } catch (err) {
        console.error(`Error extracting content: ${err.message}`, err);
        return {
          filename: filename,
          rawText: "",
          paragraphs: [],
          tables: [],
          strings: []
        };
      }
    }
    
    function isImportantContent(text) {
      if (!text || text.length === 0) return false;
      
      // Skip very short text that isn't likely to be important
      if (text.length <= 1) return false;
      
      // Patterns that indicate unimportant content
      const unimportantPatterns = [
        /^page\s+\d+(\s+of\s+\d+)?$/i,             // Page numbers
        /^confidential$/i,                          // Confidentiality markers
        /^draft$/i,                                 // Draft markers
        /^internal use only$/i,                     // Internal use markers
        /^(created|modified|updated) (by|on|at)/i,  // Document metadata
        /^document ID:/i,                           // Document IDs
        /^version:/i,                               // Version information
        /^copyright/i,                              // Copyright text
        /^all rights reserved$/i,                   // Rights reserved text
        /^last (updated|modified):/i,               // Last updated info
        /^do not (copy|distribute|share)$/i,        // Distribution restrictions
      ];
      
      // Check if text matches any unimportant pattern
      for (const pattern of unimportantPatterns) {
        if (pattern.test(text.trim())) {
          return false;
        }
      }
      
      return true;
    }

    // Show toast notification
    function showToast(message, type = 'info') {
      toast.textContent = message;
      toast.className = `formmaster-toast ${type}`;
      toast.classList.add('show');
      
      setTimeout(() => {
        toast.classList.remove('show');
      }, 3000);
    }
    
    // Load profile info from background script
    function loadProfileInfo() {
      chrome.runtime.sendMessage({ action: 'getUserProfile' }, function(response) {
        if (chrome.runtime.lastError) {
          console.error('Error accessing profile:', chrome.runtime.lastError);
          return;
        }
        
        if (response && response.success && response.profile) {
          const userProfile = response.profile;
          const statusBar = shadow.getElementById('formmaster-status-bar');
          const fileName = statusBar.querySelector('.file-name');
          const fileSize = statusBar.querySelector('.file-size');
          
          // Update UI with profile data
          if (userProfile) {
            // Extract profile name information
            let profileName = '';
            let profileSize = userProfile.fileSize || userProfile.size || 0;
            
            if (userProfile.source && userProfile.filename) {
              // If it's a file-based profile
              profileName = userProfile.filename;
            } else if (userProfile.personal && userProfile.personal.firstName) {
              // If it has personal info
              const firstName = userProfile.personal.firstName;
              const lastName = userProfile.personal.lastName || '';
              profileName = `${firstName} ${lastName}`.trim();
            } else {
              // Generic profile info
              profileName = 'Custom profile';
            }
            
            // Update file name
            fileName.textContent = profileName;
            
            // Get formatted file size from background script
            if (profileSize > 0) {
              chrome.runtime.sendMessage({ action: 'formatFileSize', size: profileSize }, response => {
                if (response && response.success) {
                  fileSize.textContent = response.formattedSize;
                  fileSize.style.display = 'block';
                } else {
                  fileSize.style.display = 'none';
                }
              });
            } else {
              fileSize.style.display = 'none';
            }
            
            statusBar.classList.remove('no-profile');
          } else {
            fileName.textContent = 'No profile loaded';
            fileSize.style.display = 'none';
            statusBar.classList.add('no-profile');
          }
        }
      });
    }
  }
})();
