/**
 * UI Injector for FormMasterPro
 * This script injects the floating UI elements into the current page
 */

(function() {
  // Version information - should match manifest.json
  const VERSION = "0.1.11";
  
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
    
    // Track if we've already added the mouseleave handler to avoid duplicates
    let mouseLeaveHandlerAdded = false;
    
    // Replace click event with hover events
    toggleButton.addEventListener('mouseenter', showPanel);
    
    // Create panel for buttons
    const panel = document.createElement('div');
    panel.className = 'formmaster-panel';
    
    // Add mouse enter/leave events to keep panel open when hovering
    panel.addEventListener('mouseenter', () => {
      clearTimeout(panel.hideTimeout);
    });
    panel.addEventListener('mouseleave', hidePanel);
    
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
      { id: 'load-data', text: 'Load Data', icon: '📂' },
      { id: 'auto-fill', text: 'Auto Fill', icon: '✏️' }
    ];
    
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
    
    // Helper function to load CSS from external file
    function loadCSS(shadowRoot) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.type = 'text/css';
      link.href = chrome.runtime.getURL('styles/injector-ui.css');
      shadowRoot.appendChild(link);
    }
    
    // Replace toggle function with show/hide functions
    function showPanel() {
      panel.classList.add('show');
      toggleButton.classList.add('active');
      loadProfileInfo();
      
      // Reset animation for panel border glow
      panel.style.animation = 'none';
      panel.offsetHeight; // Trigger reflow
      panel.style.animation = null;
      
      // Clear any existing hide timeout when showing the panel
      clearTimeout(panel.hideTimeout);
      
      // Only add the mouseleave handler once to prevent multiple bindings
      if (!mouseLeaveHandlerAdded) {
        toggleButton.addEventListener('mouseleave', function(e) {
          // Check if the mouse is moving toward the panel
          const toElement = e.relatedTarget;
          if (toElement && (toElement === panel || panel.contains(toElement))) {
            // Mouse moved directly to the panel, no need to set timeout
            return;
          }
          
          // Set a delay before hiding to allow mouse movement to the panel
          panel.hideTimeout = setTimeout(hidePanel, 400); // Increased delay for smoother experience
        });
        mouseLeaveHandlerAdded = true;
      }
    }
    
    function hidePanel() {
      // Add a small delay to allow moving between elements
      panel.hideTimeout = setTimeout(() => {
        // Check if mouse is over panel or toggle before hiding
        const isMouseOverPanel = panel.matches(':hover');
        const isMouseOverToggle = toggleButton.matches(':hover');
        
        if (!isMouseOverPanel && !isMouseOverToggle) {
          panel.classList.remove('show');
          toggleButton.classList.remove('active');
        }
      }, 400); // Increased delay for smoother experience
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
          input.accept = '.pdf,.docx'; // Accept both PDF and DOCX files
          
          // Store original HTML before showing loading state
          const originalHTML = buttonElement.innerHTML;
          
          // Handle file selection
          input.onchange = async e => {
            const file = e.target.files[0];
            if (!file) return;
            
            // Show loading state
            buttonElement.classList.add('loading');
            buttonElement.disabled = true;
            
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
          
          // Store original HTML before applying loading state
          const originalHTML = buttonElement.innerHTML;
          
          buttonElement.classList.add('loading');
          buttonElement.disabled = true;
          
          // Check if Chrome extension API is available
          if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            // Send message to the extension's background script
            chrome.runtime.sendMessage({ 
              action: action,
              url: self.location.href
            }, response => {
              // Remove loading state regardless of success or failure
              buttonElement.classList.remove('loading');
              buttonElement.disabled = false;
              
              // Restore original HTML
              buttonElement.innerHTML = originalHTML;
              
              if (response && response.success) {
                showToast(response.message || 'Action completed successfully', 'success');
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
            buttonElement.disabled = false;
            
            // Restore original HTML
            buttonElement.innerHTML = originalHTML;
            
            showToast('Extension API not available. Please refresh the page.', 'error');
          }
        });
        return;
      }
      
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
            showToast(response.message || 'Action completed successfully', 'success');
          } else {
            showToast(response?.error || 'Error performing action', 'error');
          }
        });
      });
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
              reject(new Error('Request timed out - background process may be busy'));
            }, 30000); // 30-second timeout
                    
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
            reject(new Error(`Error reading file: ${error}`));
          };
          reader.readAsArrayBuffer(file);
        } catch (error) {
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

    // Process DOCX file - Simplified to send data to background
    async function processDocxFile(file) {
      try {
        const userProfile = {
          source: 'docx',
          filename: file.name,
          fileSize: file.size,
          timeLoaded: new Date().toISOString()
        };

        // Save the profile via background script
        await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({ 
            action: 'updateUserProfile', 
            profile: userProfile 
          }, function(response) {
            if (chrome.runtime.lastError || !response || !response.success) {
              reject(chrome.runtime.lastError || new Error('Failed to save profile'));
            } else {
              resolve();
            }
          });
        });
        
        return userProfile;
      } catch (error) {
        throw new Error(`Error processing DOCX: ${error.message}`);
      }
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
