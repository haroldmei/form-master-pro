/**
 * UI Injector for FormMaster Pro
 * This script injects the floating UI elements into the current page
 */

(function() {
  // Check if we're in a frame - only inject in the main frame
  if (window !== window.top) return;

  // Create and inject the UI when the page is ready
  window.addEventListener('DOMContentLoaded', injectUI);
  
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
        transition: background-color 0.3s;
        text-align: left;
        display: flex;
        align-items: center;
      }
      
      .formmaster-button:hover {
        background-color: rgba(66, 133, 244, 1);
      }
      
      .formmaster-icon {
        display: inline-block;
        width: 16px;
        height: 16px;
        margin-right: 8px;
        background-size: contain;
        background-repeat: no-repeat;
        background-position: center;
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
    `;
    shadow.appendChild(style);
    
    // Create the main container
    const mainContainer = document.createElement('div');
    mainContainer.className = 'formmaster-container';
    
    // Create toggle button
    const toggleButton = document.createElement('div');
    toggleButton.className = 'formmaster-toggle';
    toggleButton.textContent = 'FM';
    toggleButton.title = 'FormMaster Pro';
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
    
    buttons.forEach(button => {
      const btnElement = document.createElement('button');
      btnElement.className = 'formmaster-button';
      btnElement.id = `formmaster-${button.id}`;
      
      const iconSpan = document.createElement('span');
      iconSpan.className = 'formmaster-icon';
      iconSpan.textContent = button.icon;
      
      btnElement.appendChild(iconSpan);
      btnElement.appendChild(document.createTextNode(button.text));
      
      btnElement.addEventListener('click', () => {
        handleButtonClick(button.id, btnElement);
      });
      
      panel.appendChild(btnElement);
    });
    
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
    }
    
    function handleButtonClick(action, buttonElement) {
      // Add loading state for auto-fill since it's potentially slow
      if (action === 'auto-fill') {
        buttonElement.classList.add('loading');
        buttonElement.disabled = true; // Explicitly disable button
      }
      
      // Check if Chrome extension API is available
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        // Send message to the extension's background script
        chrome.runtime.sendMessage({ 
          action: action,
          url: window.location.href
        }, response => {
          // Remove loading state regardless of success or failure
          if (action === 'auto-fill') {
            buttonElement.classList.remove('loading');
            buttonElement.disabled = false; // Explicitly re-enable button
          }
          
          if (response && response.success) {
            showToast(response.message || 'Action completed successfully');
          } else {
            showToast(response?.error || 'Error performing action', 'error');
          }
        });
      } else {
        // Chrome API not available - show error and remove loading state
        console.error('Chrome extension API not available');
        if (action === 'auto-fill') {
          buttonElement.classList.remove('loading');
          buttonElement.disabled = false; // Explicitly re-enable button
        }
        showToast('Extension API not available. Please refresh the page.', 'error');
      }
    }
    
    function showToast(message, type = 'info') {
      toast.textContent = message;
      toast.className = `formmaster-toast ${type}`;
      toast.classList.add('show');
      
      setTimeout(() => {
        toast.classList.remove('show');
      }, 3000);
    }
  }
})();
