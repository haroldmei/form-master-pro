/**
 * UI Injector for FormMasterPro
 * This script injects the floating UI elements into the current page
 */

(function() {
  // Version information - should match manifest.json
  const VERSION = "0.1.26";
  
  // Determine development mode based on API_BASE_URL which is set by webpack.DefinePlugin
  // In development mode it will be http://localhost:3001, in production it will be https://bargain4me.com
  const DEV_MODE = typeof API_BASE_URL === 'undefined' || API_BASE_URL.includes('localhost');
  
  // Check if we're in a frame - only inject in the main frame
  if (self !== self.top) return;

  // Get the base URL for the current page
  const baseUrl = window.location.origin;
  
  // Early check of UI injector state in local storage before doing anything else
  chrome.storage.local.get('uiInjectorStates', function(result) {
    console.log('Checking uiInjectorStates for', baseUrl);
    const uiStates = result.uiInjectorStates || {};
    
    // If no state exists for this URL, create one with default false and exit
    if (!(baseUrl in uiStates)) {
      uiStates[baseUrl] = false;
      chrome.storage.local.set({ uiInjectorStates: uiStates }, () => {
        console.log(`Initialized UI state for ${baseUrl} to default (false)`);
      });
      // Only continue with message listeners - do not inject UI by default
      setupMessageListeners();
      return;
    }
    
    // Check if UI should be shown
    const shouldShow = uiStates[baseUrl] === true;
    console.log(`UI state for ${baseUrl}: ${shouldShow}`);
    
    // Only proceed with injection if state is explicitly true
    if (shouldShow) {
      // Set up message listeners
      setupMessageListeners();
      
      // Set up event listeners for UI injection
      self.addEventListener('DOMContentLoaded', () => injectUI(true));
      
      // If page is already loaded, inject UI immediately
      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        injectUI(true);
      }
    } else {
      // If state is false, only set up message listeners without injecting UI
      setupMessageListeners();
    }
  });

  // Add window message listener for field mappings storage
  window.addEventListener('message', function(event) {
    // Only accept messages from the same frame
    if (event.source !== window) return;
    
    // Check if it's our message
    if (event.data && event.data.type === 'FM_SAVE_FIELD_MAPPINGS') {
      // Forward to background script for storage
      chrome.runtime.sendMessage({
        type: 'FM_SAVE_FIELD_MAPPINGS',
        payload: event.data.payload
      }, function(response) {
        if (DEV_MODE) {
          console.log('Field mappings storage response:', response);
        }
      });
    }
  });

  function setupMessageListeners() {
    // Listen for messages from the popup to toggle the UI
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      // Check if UI is visible
      if (message.action === 'checkUiInjectorState') {
        const existingUI = document.getElementById('formmaster-ui');
        if (existingUI) {
          // Check if the UI is visible (not display:none)
          const isVisible = existingUI.style.display !== 'none';
          sendResponse({ isVisible: isVisible });
        } else {
          // UI hasn't been injected yet
          sendResponse({ isVisible: false });
        }
        return true;
      }
      
      // Toggle UI
      if (message.action === 'toggleUiInjector') {
        // Check if the UI is already injected
        const existingUI = document.getElementById('formmaster-ui');
        
        if (existingUI) {
          // If already injected, toggle visibility based on the visible parameter
          toggleUiVisibility(existingUI, message.visible);
          sendResponse({ success: true, message: 'UI toggled' });
        } else {
          // If not yet injected, inject it and set visibility
          injectUI(message.visible);
          sendResponse({ success: true, message: 'UI injected' });
        }
        return true;
      }
    });
  }

  // Remove the existing listeners since they're now handled in the initial state check

  // Helper function to toggle UI visibility
  function toggleUiVisibility(uiContainer, visible) {
    if (!uiContainer) return;
    
    // If visible parameter is provided, use it; otherwise toggle
    if (typeof visible === 'boolean') {
      uiContainer.style.display = visible ? 'block' : 'none';
    } else {
      // Toggle visibility
      const isVisible = uiContainer.style.display !== 'none';
      uiContainer.style.display = isVisible ? 'none' : 'block';
    }
    
    // Show/hide the panel directly
    const panel = uiContainer.shadowRoot?.querySelector('.formmaster-panel');
    
    if (panel) {
      if (uiContainer.style.display !== 'none') {
        // If the container is visible, show the panel
        panel.classList.add('show');
      } else {
        // If the container is hidden, hide the panel
        panel.classList.remove('show');
      }
    }
  }
  
  function injectUI(showUi = true) {
    // Avoid duplicate injection
    if (document.getElementById('fm-main-container')) {
      return;
    }

    // Listen for storage changes to update highlights
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && changes.fieldMappingsV2) {
        const newValue = changes.fieldMappingsV2.newValue;
        const oldValue = changes.fieldMappingsV2.oldValue;
        const currentUrl = window.location.origin;

        if (newValue && newValue[currentUrl]) {
          // Find containers that were updated
          newValue[currentUrl].forEach((container, index) => {
            if (container.containerDesc && container.containerDesc.aicode) {
              // Dispatch event for each updated container
              const event = new CustomEvent('fm-container-changed', {
                detail: {
                  controlIndex: index,
                  newContainer: {
                    tagName: container.containerDesc.tagName,
                    className: container.containerDesc.className,
                    id: container.containerDesc.id,
                    html: container.containerDesc.html,
                    attributes: container.containerDesc.attributes,
                    path: container.containerDesc.path,
                    xpath: container.containerDesc.xpath,
                    aicode: container.containerDesc.aicode
                  }
                }
              });
              document.dispatchEvent(event);
            }
          });
        }
      }
    });

    // Track API call status to prevent duplicate calls
    let isApiCallInProgress = false;
    
    // Create the container with Shadow DOM to isolate CSS
    const container = document.createElement('div');
    container.id = 'formmaster-ui';
    document.body.appendChild(container);
    
    // Set initial visibility based on parameter
    if (!showUi) {
      container.style.display = 'none';
    }
    
    // Create shadow root
    const shadow = container.attachShadow({ mode: 'closed' });
    
    // Load CSS from external file
    loadCSS(shadow);
    
    // Create the main container
    const mainContainer = document.createElement('div');
    mainContainer.className = 'formmaster-container';
    // Add styles to make it draggable and properly positioned
    mainContainer.style.position = 'fixed';
    mainContainer.style.top = '120px'; // Move much lower to ensure tooltips are visible (was 60px)
    mainContainer.style.right = '20px'; // Ensure it's on the right side
    mainContainer.style.zIndex = '9999';
    mainContainer.style.userSelect = 'none';
    
    // Track dragging state
    let isDragging = false;
    let dragOffsetX, dragOffsetY;
    
    // Create panel for buttons
    const panel = document.createElement('div');
    panel.className = 'formmaster-panel vertical';
    
    // Make panel visible or hidden based on showUi parameter
    if (showUi) {
      panel.classList.add('show'); // Make panel visible
    } else {
      panel.classList.remove('show'); // Make panel hidden
    }
    
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
    
    // Add the three buttons from popup.html
    buttons.push({ id: 'analyze-form', text: 'Analyze Form', icon: '🔍' });
    buttons.push({ id: 'fetch-code', text: 'Fetch Code', icon: '💻' });
    // buttons.push({ id: 'clear-data', text: 'Clear Saved Data', icon: '🗑️' });
    
    // Make sure buttons are added with the correct structure
    buttons.forEach(button => {
      const btnElement = document.createElement('button');
      btnElement.className = 'formmaster-button icon-only';
      btnElement.id = `formmaster-${button.id}`;
      
      // Determine the appropriate tooltip for each button
      let tooltipText = button.text;
      switch (button.id) {
        case 'load-data':
          tooltipText = 'Load PDF or DOCX file to extract information';
          break;
        case 'load-folder':
          tooltipText = 'Load multiple files from a folder';
          break;
        case 'auto-fill':
          tooltipText = 'Automatically fill forms with your data';
          break;
        case 'analyze-form':
          tooltipText = 'Analyze the current page form fields';
          break;
        case 'fetch-code':
          tooltipText = 'Generate AI-powered filling code for this site';
          break;
        case 'clear-data':
          tooltipText = 'Clear all saved form data and mappings';
          break;
      }
      
      btnElement.innerHTML = `
        <span class="formmaster-icon">${button.icon}</span>
      `;
      
      // Make sure the entire button is clickable
      btnElement.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        handleButtonClick(button.id, btnElement);
      });
      
      // Store tooltip text in a data attribute instead of title
      btnElement.dataset.tooltip = tooltipText;
      
      panel.appendChild(btnElement);
    });
    
    // Add compact status indicator
    const statusIndicator = document.createElement('div');
    statusIndicator.className = 'status-indicator no-profile';
    statusIndicator.id = 'formmaster-status-indicator';
    statusIndicator.title = 'No profile loaded';
    panel.appendChild(statusIndicator);
    
    // Add all elements to the shadow DOM
    mainContainer.appendChild(panel);
    shadow.appendChild(mainContainer);
    
    // Create toast element for notifications
    const toast = document.createElement('div');
    toast.className = 'formmaster-toast';
    shadow.appendChild(toast);
    
    // Remove document click handler that closes panel when clicking outside
    // Only the toggle button will now control the panel visibility
    
    // Add drag event handlers to document
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', stopDrag);
    
    // Helper function to load CSS from external file
    function loadCSS(shadowRoot) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.type = 'text/css';
      link.href = chrome.runtime.getURL('styles/injector-ui.css');
      shadowRoot.appendChild(link);
      
      // Add additional styles for vertical icon-only layout
      const style = document.createElement('style');
      style.textContent = `
        .formmaster-container {
          transition: none;
          margin-bottom: 10px;
          right: 20px !important; /* Force right alignment */
          left: auto !important; /* Prevent left positioning */
        }
        .formmaster-container.dragging {
          opacity: 0.8;
        }
        .formmaster-panel {
          position: relative;
          opacity: 1;
          transform: none;
          pointer-events: auto;
          display: block;
          border-radius: 8px;
          box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
          margin-bottom: 0;
          background-color: #fff;
          padding: 8px 4px;
        }
        .formmaster-panel.vertical {
          display: flex;
          flex-direction: column;
          gap: 8px;
          width: auto;
        }
        .formmaster-panel.show {
          opacity: 1;
          visibility: visible;
          transform: none;
          pointer-events: auto;
        }
        .formmaster-button.icon-only {
          padding: 8px;
          display: flex;
          justify-content: center;
          align-items: center;
          border-radius: 50%;
          width: 36px;
          height: 36px;
          background-color: transparent;
          border: none;
          cursor: pointer;
          position: relative; /* Required for custom tooltip positioning */
        }
        .formmaster-button.icon-only:hover {
          background-color: rgba(0, 0, 0, 0.05);
        }
        .formmaster-button.icon-only .formmaster-text {
          display: none;
        }
        .formmaster-button.icon-only .formmaster-icon {
          font-size: 20px;
        }
        /* Custom tooltip styling */
        .formmaster-button.icon-only:hover::after {
          content: attr(data-tooltip);
          position: absolute;
          bottom: 120%; /* Move lower than before (was 100%) */
          left: 50%;
          transform: translateX(-50%);
          background-color: #333;
          color: white;
          padding: 5px 10px;
          border-radius: 4px;
          font-size: 12px;
          white-space: nowrap;
          z-index: 10000;
          margin-bottom: 5px; /* Reduced margin (was 10px) */
          box-shadow: 0 2px 5px rgba(0,0,0,0.2);
          pointer-events: none;
          /* Ensure tooltip breaks out of any container boundaries */
          filter: none !important;
          clip: none !important;
          overflow: visible !important;
        }
        /* Modify the container and panel to ensure tooltips can escape */
        .formmaster-container, .formmaster-panel {
          overflow: visible !important;
          filter: none !important;
          clip: none !important;
        }
        /* Tooltip arrow */
        .formmaster-button.icon-only:hover::before {
          content: '';
          position: absolute;
          bottom: 120%; /* Match the tooltip position (was 100%) */
          left: 50%;
          transform: translateX(-50%);
          border-width: 5px;
          border-style: solid;
          border-color: #333 transparent transparent transparent;
          margin-bottom: 0px; /* Reduced margin (was 5px) */
          pointer-events: none;
          /* Ensure arrow breaks out of any container boundaries */
          filter: none !important;
          clip: none !important;
          overflow: visible !important;
        }
        .status-indicator {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          margin: 4px auto;
          background-color: #ccc;
        }
        .status-indicator.no-profile {
          background-color: #ccc;
        }
        .status-indicator:not(.no-profile) {
          background-color: #4CAF50;
        }
      `;
      shadowRoot.appendChild(style);
    }
    
    // Drag handler functions
    function startDrag(e) {
      // Only start drag on left mouse button
      if (e.button !== 0) return;
      
      e.preventDefault();
      e.stopPropagation();
      
      // Calculate offset from the click position to the top-left corner of the container
      const rect = mainContainer.getBoundingClientRect();
      dragOffsetX = e.clientX - rect.left;
      dragOffsetY = e.clientY - rect.top;
      
      isDragging = true;
      mainContainer.classList.add('dragging');
    }
    
    function onDrag(e) {
      if (!isDragging) return;
      
      e.preventDefault();
      
      // Calculate new position
      const x = e.clientX - dragOffsetX;
      const y = e.clientY - dragOffsetY;
      
      // Ensure the menu stays within viewport bounds
      const maxX = window.innerWidth - mainContainer.offsetWidth;
      const maxY = window.innerHeight - mainContainer.offsetHeight;
      
      // When dragging starts, convert from bottom positioning to top positioning
      if (mainContainer.style.bottom && !mainContainer.style.top) {
        // Calculate equivalent top position from bottom
        const currentBottom = parseInt(mainContainer.style.bottom, 10) || 20;
        mainContainer.style.top = `${window.innerHeight - currentBottom - mainContainer.offsetHeight}px`;
        mainContainer.style.bottom = 'auto';
      }
      
      // Set position using top/left coordinates
      mainContainer.style.left = `${Math.max(0, Math.min(x, maxX))}px`;
      mainContainer.style.top = `${Math.max(0, Math.min(y, maxY))}px`;
      
      // When dragging, use left/top positioning
      mainContainer.style.right = 'auto';
      mainContainer.style.bottom = 'auto';
    }
    
    function stopDrag() {
      if (isDragging) {
        isDragging = false;
        mainContainer.classList.remove('dragging');
      }
    }
    
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
          // Attempt to clear all saved form data (local storage)
          chrome.storage.local.get('fieldMappingsV2', function(result) {
            // Keep auth state but clear form mappings
            chrome.storage.local.set({ fieldMappingsV2: {} }, function() {
              // Reset button state
              buttonElement.classList.remove('loading');
              buttonElement.disabled = false;
              buttonElement.innerHTML = originalHTML;
              setToggleBusy(false);
              
              showToast('All saved form data has been cleared', 'success');
            });
          });
        });
        return;
      }
      
      // Handle analyze form action
      if (action === 'analyze-form') {
        // Store original HTML before showing loading state
        const originalHTML = buttonElement.innerHTML;
        
        // Show loading state
        buttonElement.classList.add('loading');
        buttonElement.disabled = true;
        buttonElement.textContent = 'Analyzing...';
        setToggleBusy(true);
        
        // Send message to background script to analyze the form
        // Use window.location instead of chrome.tabs which isn't available in content scripts
        chrome.runtime.sendMessage({ 
          action: 'analyzeFormInTab',
          url: window.location.href
        }, function(response) {
          // Reset button state
          buttonElement.classList.remove('loading');
          buttonElement.disabled = false;
          buttonElement.innerHTML = originalHTML;
          setToggleBusy(false);
          
          if (response && response.success) {
            const count = response.count || 0;
            showToast(`Analyzed ${count} form controls`, 'success');
          } else {
            showToast(response?.error || 'No form controls detected or error analyzing form', 'error');
          }
        });
        
        return;
      }
      
      // Handle fetch code action
      if (action === 'fetch-code') {
        // Store original HTML before showing loading state
        const originalHTML = buttonElement.innerHTML;
        
        // Show loading state
        buttonElement.classList.add('loading');
        buttonElement.disabled = true;
        buttonElement.textContent = 'Processing...';
        setToggleBusy(true);
        
        // Send message to background script to fetch AI code
        // Use window.location instead of chrome.tabs
        chrome.runtime.sendMessage({ 
          action: 'fetchAiCode',
          url: window.location.origin
        }, function(response) {
          // Reset button state
          buttonElement.classList.remove('loading');
          buttonElement.disabled = false;
          buttonElement.innerHTML = originalHTML;
          setToggleBusy(false);
          
          if (response && response.success) {
            showToast('AI code generated successfully!', 'success');
          } else {
            showToast(response?.error || 'Error generating code', 'error');
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
        // Store the busy flag to prevent concurrent operations
        isApiCallInProgress = true;
      } else {
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
          const statusIndicator = shadow.getElementById('formmaster-status-indicator');
          
          // Update UI with profile data
          if (userProfile) {
            // Extract profile name information
            let profileName = '';
            
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
            
            // Update status indicator
            statusIndicator.classList.remove('no-profile');
            statusIndicator.title = profileName;
          } else {
            statusIndicator.classList.add('no-profile');
            statusIndicator.title = 'No profile loaded';
          }
        }
      });
    }
  }
})();
