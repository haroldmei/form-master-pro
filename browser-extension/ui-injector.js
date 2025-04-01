/**
 * UI Injector for FormMasterPro
 * This script injects the floating UI elements into the current page
 */

(function() {
  // Version information - should match manifest.json
  const VERSION = "0.1.8";
  
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
    
    // Create the container with Shadow DOM to isolate CSS
    const container = document.createElement('div');
    container.id = 'formmaster-ui';
    document.body.appendChild(container);
    
    // Create shadow root
    const shadow = container.attachShadow({ mode: 'closed' });
    
    // Add styles for the injected UI
    const style = document.createElement('style');
    style.textContent = `
      .formmaster-container {
        position: fixed;
        bottom: 20px;
        left: 20px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        font-family: Arial, sans-serif;
      }
      
      .formmaster-toggle {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background-color: rgba(66, 133, 244, 0.9);
        color: white;
        display: flex;
        justify-content: center;
        align-items: center;
        cursor: pointer;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
        transition: all 0.3s;
        margin-bottom: 10px;
      }
      
      .formmaster-toggle:hover {
        transform: scale(1.1);
      }
      
      .formmaster-panel {
        background-color: rgba(255, 255, 255, 0.9);
        border-radius: 8px;
        padding: 10px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
        display: none;
        flex-direction: column;
        width: 200px;
        margin-bottom: 10px;
        backdrop-filter: blur(5px);
      }
      
      .formmaster-panel.show {
        display: flex;
      }
      
      .formmaster-button {
        background-color: rgba(66, 133, 244, 0.9);
        color: white;
        border: none;
        border-radius: 4px;
        padding: 8px 10px;
        margin: 5px 0;
        cursor: pointer;
        transition: background-color 0.3s, transform 0.1s;
        text-align: left;
        display: flex;
        align-items: center;
        width: 100%;
        position: relative;
        z-index: 1;
        overflow: visible; /* Ensure content doesn't clip */
      }
      
      .formmaster-button:hover {
        background-color: rgba(66, 133, 244, 1);
        transform: translateY(-1px);
      }
      
      .formmaster-button:active {
        transform: translateY(1px);
      }
      
      .formmaster-icon {
        display: inline-block;
        width: 16px;
        height: 16px;
        margin-right: 8px;
        background-size: contain;
        background-repeat: no-repeat;
        background-position: center;
        pointer-events: none; /* Ensure icon doesn't capture clicks */
      }
      
      .formmaster-button span, 
      .formmaster-button::after {
        pointer-events: none; /* Prevent child elements from capturing clicks */
      }
      
      .formmaster-toast {
        position: fixed;
        bottom: 80px;
        left: 20px;
        background-color: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 8px 16px;
        border-radius: 4px;
        opacity: 0;
        transition: opacity 0.3s;
        z-index: 10000;
      }
      
      .formmaster-toast.show {
        opacity: 1;
      }
      
      /* Loading animation for buttons */
      .formmaster-button.loading {
        position: relative;
        color: transparent;
        pointer-events: none;
      }
      
      .formmaster-button.loading::after {
        content: '';
        position: absolute;
        width: 16px;
        height: 16px;
        top: calc(50% - 8px);
        left: calc(50% - 8px);
        border-radius: 50%;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top-color: white;
        animation: formmaster-spin 0.8s linear infinite;
      }
      
      @keyframes formmaster-spin {
        to { transform: rotate(360deg); }
      }
      
      /* Keep the icon visible when loading */
      .formmaster-button.loading .formmaster-icon {
        visibility: hidden;
      }
      
      /* Status bar styles */
      .formmaster-status-bar {
        font-size: 11px;
        padding: 5px 0;
        margin-top: 5px;
        border-top: 1px solid rgba(0, 0, 0, 0.1);
        color: #555;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 100%;
      }
      
      .formmaster-status-bar.no-profile {
        color: #999;
        font-style: italic;
      }
    `;
    shadow.appendChild(style);
    
    // Create the main container
    const mainContainer = document.createElement('div');
    mainContainer.className = 'formmaster-container';
    
    // Create toggle button
    const toggleButton = document.createElement('div');
    toggleButton.className = 'formmaster-toggle';
    toggleButton.textContent = 'FM';
    toggleButton.title = `FormMasterPro v${VERSION}`; // Add version to title
    toggleButton.addEventListener('click', togglePanel);
    
    // Create panel for buttons
    const panel = document.createElement('div');
    panel.className = 'formmaster-panel';
    
    // Add buttons to panel - remove 'analyze-form' and 'data-mappings'
    const buttons = [
      // { id: 'analyze-form', text: 'Analyze Form', icon: '🔍' }, // Removed
      { id: 'load-data', text: 'Load Data', icon: '📂' },
      // { id: 'data-mappings', text: 'Mappings', icon: '🔗' }, // Removed
      { id: 'auto-fill', text: 'Auto Fill', icon: '✏️' }
    ];
    
    // Make sure buttons are added with the correct structure
    buttons.forEach(button => {
      const btnElement = document.createElement('button');
      btnElement.className = 'formmaster-button';
      btnElement.id = `formmaster-${button.id}`;
      
      // Use innerHTML directly to avoid multiple nested spans causing issues
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
    statusBar.textContent = 'No profile loaded';
    panel.appendChild(statusBar);
    
    // Add all elements to the shadow DOM
    mainContainer.appendChild(panel);
    mainContainer.appendChild(toggleButton);
    shadow.appendChild(mainContainer);
    
    // Create toast element for notifications
    const toast = document.createElement('div');
    toast.className = 'formmaster-toast';
    shadow.appendChild(toast);
    
    function togglePanel() {
      panel.classList.toggle('show');
      
      // Refresh profile info when panel is opened
      if (panel.classList.contains('show')) {
        loadProfileInfo();
      }
    }
    
    function handleButtonClick(action, buttonElement) {
      // Special handling for load-data action - directly open file dialog
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
          input.accept = '.json,.docx'; // Accept both JSON and DOCX files
          
          // Handle file selection
          input.onchange = async e => {
            const file = e.target.files[0];
            if (!file) return;
            
            // Show loading state
            buttonElement.classList.add('loading');
            buttonElement.disabled = true;
            buttonElement._originalHTML = buttonElement.innerHTML;
            
            try {
              const fileExtension = file.name.split('.').pop().toLowerCase();
              
              if (fileExtension === 'json') {
                // Process JSON file
                await processJsonFile(file);
              } else if (fileExtension === 'docx') {
                // Process DOCX file
                await processDocxFile(file);
              } else {
                showToast('Unsupported file type. Please use JSON or DOCX files.', 'error');
              }
              
              // Refresh profile info
              loadProfileInfo();
            } catch (error) {
              showToast(`Error processing file: ${error.message}`, 'error');
              console.error('File processing error:', error);
            } finally {
              // Reset button state
              buttonElement.classList.remove('loading');
              buttonElement.disabled = false;
              if (buttonElement._originalHTML) {
                buttonElement.innerHTML = buttonElement._originalHTML;
                delete buttonElement._originalHTML;
              }
            }
          };
          
          // Trigger the file dialog
          input.click();
        });
        return; // Exit the function early
      }
      
      // Add loading state for auto-fill since it's potentially slow
      if (action === 'auto-fill') {
        // First check email verification
        chrome.runtime.sendMessage({ action: 'checkEmailVerification' }, function(response) {
          if (!response || !response.isVerified) {
            showToast('Email verification required to use this feature', 'error');
            return;
          }
          
          buttonElement.classList.add('loading');
          buttonElement.disabled = true; // Explicitly disable button
          
          // Store original button content for restoration later
          buttonElement._originalHTML = buttonElement.innerHTML;
          
          // Check if Chrome extension API is available
          if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            // Send message to the extension's background script
            chrome.runtime.sendMessage({ 
              action: action,
              url: self.location.href
            }, response => {
              // Remove loading state regardless of success or failure
              buttonElement.classList.remove('loading');
              buttonElement.disabled = false; // Explicitly re-enable button
              
              // Complete button reset: if we stored original HTML, restore it
              if (buttonElement._originalHTML) {
                buttonElement.innerHTML = buttonElement._originalHTML;
                delete buttonElement._originalHTML;
              }
              
              if (response && response.success) {
                showToast(response.message || 'Action completed successfully');
              } else if (response && response.requiresVerification) {
                showToast('Email verification required to use this feature', 'error');
              } else {
                showToast(response?.error || 'Error performing action', 'error');
              }
            });
          } else {
            // Chrome API not available - show error and remove loading state
            console.error('Chrome extension API not available');
            buttonElement.classList.remove('loading');
            buttonElement.disabled = false; // Explicitly re-enable button
            
            // Also restore original content
            if (buttonElement._originalHTML) {
              buttonElement.innerHTML = buttonElement._originalHTML;
              delete buttonElement._originalHTML;
            }
            showToast('Extension API not available. Please refresh the page.', 'error');
          }
        });
        return;
      }
      
      // For all other actions, check verification first
      chrome.runtime.sendMessage({ action: 'checkEmailVerification' }, function(response) {
        if (!response || !response.isVerified) {
          showToast('Email verification required to use this feature', 'error');
          return;
        }
        
        // The rest of the original function for other actions
        chrome.runtime.sendMessage({ 
          action: action,
          url: self.location.href
        }, response => {
          if (response && response.success) {
            showToast(response.message || 'Action completed successfully');
          } else {
            showToast(response?.error || 'Error performing action', 'error');
          }
        });
      });
    }
    
    /**
     * Process JSON file
     */
    function processJsonFile(file) {
      const reader = new FileReader();
      reader.onload = event => {
        try {
          const userProfile = JSON.parse(event.target.result);

          // Update UI with profile data
          const profileContainer = document.getElementById('profile-container');

          // Clear existing content
          profileContainer.innerHTML = '';

          // Generate dynamic HTML for the profile
          const profileHtml = generateProfileHtml(userProfile);
          profileContainer.innerHTML = profileHtml;

          // Check profile size (just informational now, no storage limits)
          const jsonSize = new Blob([JSON.stringify(userProfile)]).size;
          if (jsonSize > 5000000) {
            console.warn(`Profile size ${jsonSize} bytes is large`);
            //showStatusMessage('Large profile may impact performance', 'warning');
          }

          // Update global memory only (no storage)
          chrome.runtime.sendMessage({ 
            action: 'updateUserProfile', 
            profile: userProfile 
          }, function(response) {
            if (chrome.runtime.lastError || !response || !response.success) {
              console.error('Error saving profile:', chrome.runtime.lastError || 'Background update failed');
              //showStatusMessage('Error saving profile. Please try again.', 'error');
              return;
            }

            console.log('Profile saved successfully to global memory');
            //showStatusMessage('Profile imported successfully!', 'success');
          });
        } catch (error) {
          //showStatusMessage('Error importing profile: ' + error.message, 'error');
          console.error('JSON parsing error:', error);
        }
      };

      reader.onerror = () => {
        //showStatusMessage('Error reading file', 'error');
        console.error('FileReader error:', reader.error);
      };

      reader.readAsText(file);
    }

    /**
     * Process DOCX file
     */
    async function processDocxFile(file) {
      try {
        // Load the docx-extractor.js module
        try {
          // Extract content from DOCX
          const docxContent = await extractDocxContent(file, file.name);
          console.log('Extracted DOCX content:', JSON.stringify(docxContent));

          // Check if docxContent has the expected structure
          if (!docxContent) {
            throw new Error('DOCX extraction returned empty result');
          }

          // Create a user profile structure from the DOCX content
          const userProfile = {
            source: 'docx',
            filename: file.name,
            extractedContent: docxContent,
            // Create a simple representation for display - safely handle both old and new formats
            docxData: {
              paragraphs: Array.isArray(docxContent.paragraphs) ? docxContent.paragraphs.map(p => p.text || p) : 
                         Array.isArray(docxContent.strings) ? docxContent.strings : [],
              tables: Array.isArray(docxContent.tables) ? docxContent.tables : []
            }
          };

          // Check if the profile data is too large for Chrome storage
          const jsonSize = new Blob([JSON.stringify(userProfile)]).size;
          if (jsonSize > 5000000) { // Local storage recommended limit is 5MB
            console.warn(`Profile size ${jsonSize} bytes exceeds Chrome local storage recommended limits`);

            // Create a simplified version of the profile for storage
            const simplifiedProfile = {
              source: 'docx',
              filename: file.name,
              docxData: {
                // Safely handle both old and new formats
                paragraphs: Array.isArray(userProfile.docxData.paragraphs) ? 
                           userProfile.docxData.paragraphs.slice(0, 50) : [],
                tables: Array.isArray(userProfile.docxData.tables) ? 
                       userProfile.docxData.tables.slice(0, 5) : []
              }
            };

            //showStatusMessage('Profile too large. Saving simplified version.', 'warning');

            // Save the simplified profile
            saveProfile(simplifiedProfile);
          } else {
            // Save the full profile
            saveProfile(userProfile);
          }
        } catch (moduleError) {
          console.error("Error loading DOCX extractor module:", moduleError);
          throw new Error(`Could not load DOCX extractor: ${moduleError.message}`);
        }
      } catch (error) {
        throw new Error(`Error processing DOCX: ${error.message}`);
      }
    }
  
    
    /**
     * Save profile to global memory
     */
    function saveProfile(userProfile) {
      chrome.runtime.sendMessage({ 
        action: 'updateUserProfile', 
        profile: userProfile 
      }, function(response) {
        if (chrome.runtime.lastError || !response || !response.success) {
          console.error('Error saving profile:', chrome.runtime.lastError || 'Background update failed');
          //showStatusMessage('Error saving profile. Please try again.', 'error');
          return;
        }

        console.log('Profile saved successfully to global memory');
        //showStatusMessage('Profile imported successfully!', 'success');
      });
    }

    function showToast(message, type = 'info') {
      toast.textContent = message;
      toast.className = `formmaster-toast ${type}`;
      toast.classList.add('show');
      
      setTimeout(() => {
        toast.classList.remove('show');
      }, 3000);
    }
    
    /**
     * Load profile information from global memory via message passing
     */
    function loadProfileInfo() {
      chrome.runtime.sendMessage({ action: 'getUserProfile' }, function(response) {
        if (chrome.runtime.lastError) {
          console.error('Error accessing profile:', chrome.runtime.lastError);
          return;
        }
        
        if (response && response.success && response.profile) {
          const userProfile = response.profile;
          const statusBar = shadow.getElementById('formmaster-status-bar');
          
          // Update UI with profile data
          if (userProfile) {
            // Extract profile name information
            let profileName = '';
            
            if (userProfile.source && userProfile.filename) {
              // If it's a file-based profile
              profileName = `Profile: ${userProfile.filename}`;
            } else if (userProfile.personal && userProfile.personal.firstName) {
              // If it has personal info
              const firstName = userProfile.personal.firstName;
              const lastName = userProfile.personal.lastName || '';
              profileName = `Profile: ${firstName} ${lastName}`.trim();
            } else {
              // Generic profile info
              profileName = 'Custom profile loaded';
            }
            
            statusBar.textContent = profileName;
            statusBar.classList.remove('no-profile');
          } else {
            statusBar.textContent = 'No profile loaded';
            statusBar.classList.add('no-profile');
          }
        }
      });
    }

    /**
     * Dynamically load a script
     * @param {string} src - The script source URL
     * @returns {Promise} - Resolves when the script is loaded
     */
    function loadScript(src) {
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => resolve();
        script.onerror = (e) => reject(new Error(`Failed to load script: ${src}`));
        document.head.appendChild(script);
      });
    }
    
    /**
     * Extract content from a DOCX file in a browser environment using JSZip
     * @param {Blob} docxFile - The DOCX file as a Blob
     * @param {string} filename - The name of the file
     * @returns {Promise<Object>} Raw content from the document
     */
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
            const cleanText = removeAllWhitespace(paragraphText.trim());
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
                const cleanText = removeAllWhitespace(cellText.trim());
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
    
    /**
     * Determine if content is important enough to include
     * @param {string} text - The text to check
     * @returns {boolean} - Whether the content is important
     */
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
    
    /**
     * Remove all whitespace including spaces and line breaks from text
     * @param {string} text - The text to process
     * @returns {string} - Text with all whitespace removed
     */
    function removeAllWhitespace(text) {
      if (!text) return "";
      
      // Remove all spaces, tabs, line breaks, and other whitespace characters
      return text.replace(/\s/g, '');
    }
  }
})();
