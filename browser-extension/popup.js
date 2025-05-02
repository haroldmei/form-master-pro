document.addEventListener('DOMContentLoaded', function() {
  // Wait for the DOM to be fully loaded before accessing elements
  
  // Initialize the formAnalysis module if available
  if (typeof self.formAnalysis !== 'undefined') {
    self.formAnalysis.init();
    console.log('Initialized FormAnalysis module');
  }
  
  // Auth-related elements
  const loginButton = document.getElementById('login-button');
  const logoutButton = document.getElementById('logout-button');
  const loggedOutView = document.getElementById('logged-out-view');
  const loggedInView = document.getElementById('logged-in-view');
  const userName = document.getElementById('user-name');
  const userPicture = document.getElementById('user-picture');

  // Button elements
  const toggleUiCheckbox = document.getElementById('toggle-ui-injector');
  
  // Email verification elements
  const verificationAlert = document.getElementById('verification-alert');
  const resendVerificationBtn = document.getElementById('resend-verification');
  const checkVerificationBtn = document.getElementById('check-verification');
  const verificationBadge = document.getElementById('verification-badge');
  
  // Subscription elements
  const subscriptionStatus = document.getElementById('subscription-status');
  const subscriptionLink = document.getElementById('subscription-link');
  
  // Check authentication/subscription status on popup open
  checkAuthState();
  
  // Add auth button listeners
  if (loginButton) loginButton.addEventListener('click', login);
  if (logoutButton) logoutButton.addEventListener('click', logout);

  // Set up UI toggle checkbox event listener and initialize state
  if (toggleUiCheckbox) {
    // Check current state when popup opens
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      const activeTab = tabs[0];
      if (activeTab) {
        // Send message to check if UI is visible
        chrome.tabs.sendMessage(activeTab.id, { action: 'checkUiInjectorState' }, function(response) {
          // If there's no response, the injector might not be loaded yet, so default to unchecked
          if (chrome.runtime.lastError || !response) {
            toggleUiCheckbox.checked = false;
            return;
          }
          
          // Set checkbox state based on current UI visibility
          toggleUiCheckbox.checked = response.isVisible;
        });
      }
    });
    
    // Add change event listener
    toggleUiCheckbox.addEventListener('change', function() {
      toggleUiInjector(this.checked);
    });
  }

  // Add verification-related event listeners
  if (resendVerificationBtn) resendVerificationBtn.addEventListener('click', resendVerificationEmail);
  if (checkVerificationBtn) checkVerificationBtn.addEventListener('click', relogin); // Check verification status on button click

  // Listen for auth state changes from background script
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'auth-state-changed') {
      console.log('Auth state changed:', message.isAuthenticated);
      checkAuthState();
    }
  });
  
  // Login function
  async function login() {
    if (loginButton) {
      loginButton.disabled = true;
      loginButton.textContent = 'Logging in...';
    }
    
    try {
      const response = await auth0Service.login();

      console.log('Login successful');
      checkAuthState();
    } catch (error) {
      console.error('Error during login:', error);
      showError('Login process failed');
    }
    
    if (loginButton) {
      loginButton.disabled = false;
      loginButton.textContent = 'Log In';
    }
  }
  
  // Logout function
  async function logout() {
    if (logoutButton) {
      logoutButton.disabled = true;
    }
    
    try {
      await chrome.runtime.sendMessage({ action: 'logout' });
      console.log('Logout successful');
      checkAuthState();
    } catch (error) {
      console.error('Error during logout:', error);
    }
    
    if (logoutButton) {
      logoutButton.disabled = false;
    }
  }
  

  async function relogin(){
    logout();
    login();
  }

  // Check authentication state
  async function checkAuthState() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'checkAuth' });
      
      if (response && response.isAuthenticated) {
        // User is authenticated, but we need to check email verification
        const isVerified = await checkEmailVerification(false); // false means don't show messages
        console.log('User is authenticated:', response.isAuthenticated, 'Verified:', isVerified);

        
        if (isVerified) {
          // Fully authenticated and verified
          showAuthenticatedUI(true);
          loadUserProfile();
          checkSubscriptionStatus(); // Check subscription when user is authenticated
        } else {
          // Authenticated but not verified
          showAuthenticatedUI(false);
          loadUserProfile();
          checkSubscriptionStatus(); // Check subscription when user is authenticated but not verified
        }
      } else {
        showUnauthenticatedUI();
        // Hide subscription information when not logged in
        if (subscriptionStatus) subscriptionStatus.parentElement.parentElement.classList.add('hidden');
      }
    } catch (error) {
      console.error('Error checking auth state:', error);
      showUnauthenticatedUI();
      // Hide subscription information on error
      if (subscriptionStatus) subscriptionStatus.parentElement.parentElement.classList.add('hidden');
    }
  }
  
  // Load user profile
  async function loadUserProfile() {
    try {
      // Use the background script to get user info
      const userInfo = await getUserInfo();
      
      if (userInfo) {
        if (userName) userName.textContent = userInfo.name || userInfo.email || 'User';
        if (userPicture && userInfo.picture) userPicture.src = userInfo.picture;
        
        // Update subscription link with email parameter if available
        const DEV_MODE = typeof API_BASE_URL === 'undefined' || API_BASE_URL.includes('localhost');
        const subscriptionLink = document.getElementById('subscription-link');
        if (subscriptionLink && userInfo.email) {
          const baseUrl = (DEV_MODE ? 'http://localhost:3002' : 'https://subscribe.formmasterpro.com/');
          subscriptionLink.href = `${baseUrl}?email=${encodeURIComponent(userInfo.email)}`;
        }
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  }
  
  // Get user info from ID token
  async function getUserInfo() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(['authState'], (result) => {
        if (!result.authState || !result.authState.idToken) {
          return reject(new Error('No ID token available'));
        }
        
        try {
          // Parse the ID token payload
          const payloadBase64 = result.authState.idToken.split('.')[1];
          const payload = JSON.parse(atob(payloadBase64));
          resolve(payload);
        } catch (error) {
          reject(error);
        }
      });
    });
  }
  
  // Show authenticated UI
  function showAuthenticatedUI(verified = true) {
    if (loggedOutView) loggedOutView.classList.add('hidden');
    if (loggedInView) loggedInView.classList.remove('hidden');
    
    // Only enable form features if the user is verified
    const ENABLE_FORM_FEATURES = true; // Set this based on your environment variable
    enableFormFeatures(verified && ENABLE_FORM_FEATURES);
    
    // Set verification badge
    if (verificationBadge) {
      if (verified) {
        verificationBadge.textContent = 'Verified';
        verificationBadge.className = 'user-badge badge-verified';
      } else {
        verificationBadge.textContent = 'Unverified';
        verificationBadge.className = 'user-badge badge-unverified';
      }
    }
    
    // Only show verification alert if the user is logged in but not verified
    if (verificationAlert) {
      verificationAlert.style.display = verified ? 'none' : 'block';
    }

    // Show subscription container ONLY for verified users
    const subscriptionContainer = document.getElementById('subscription-container');
    if (subscriptionContainer) {
      if (verified) {
        subscriptionContainer.classList.remove('hidden');
      } else {
        subscriptionContainer.classList.add('hidden');
      }
    }
  }
  
  // Show unauthenticated UI
  function showUnauthenticatedUI() {
    if (loggedOutView) loggedOutView.classList.remove('hidden');
    if (loggedInView) loggedInView.classList.add('hidden');
    
    // Always hide verification alert for logged out users
    if (verificationAlert) {
      verificationAlert.style.display = 'none';
    }
    
    // Disable buttons that require authentication
    enableFormFeatures(false);

    // Hide subscription container for unauthenticated users
    const subscriptionContainer = document.getElementById('subscription-container');
    if (subscriptionContainer) {
      subscriptionContainer.classList.add('hidden');
    }
  }
  
  // Check email verification status
  async function checkEmailVerification(showMessages = true) {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'checkEmailVerification' });
      
      if (response && response.success) {
        const isVerified = response.isVerified === true;
        
        if (isVerified && showMessages) {
          showToast('Email verified successfully!', 'success');
          showAuthenticatedUI(true);
        } else if (showMessages) {
          showToast('Email is not verified yet', 'warning');
        }
        
        return isVerified;
      }
      
      return false;
    } catch (error) {
      console.error('Error checking verification status:', error);
      if (showMessages) {
        showToast('Error checking verification status', 'error');
      }
      return false;
    }
  }
  
  // Resend verification email
  async function resendVerificationEmail() {
    try {
      resendVerificationBtn.disabled = true;
      resendVerificationBtn.textContent = 'Sending...';
      
      const response = await chrome.runtime.sendMessage({ action: 'resendVerificationEmail' });
      
      if (response && response.success) {
        showToast('Verification email sent!', 'success');
      } else {
        showToast(response?.error || 'Error sending verification email', 'error');
      }
    } catch (error) {
      console.error('Error sending verification email:', error);
      showToast('Error sending verification email', 'error');
    } finally {
      resendVerificationBtn.disabled = false;
      resendVerificationBtn.textContent = 'Resend Email';
    }
  }

  // Enable/disable form features based on auth state and verification
  function enableFormFeatures(enabled) {
    // Toggle UI button requires authentication
    if (toggleUiCheckbox) {
      toggleUiCheckbox.disabled = !enabled;
      if (!enabled && toggleUiCheckbox.title) {
        toggleUiCheckbox.title = 'Email verification required';
      }
    }
  }

  // Helper function to show toast messages
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

  // Helper function to show error messages
  function showError(message) {
    const errorContainer = document.createElement('div');
    errorContainer.className = 'error-message';
    errorContainer.textContent = message;

    // Append the error message to the body or a specific container
    document.body.appendChild(errorContainer);

    // Automatically remove the error message after 3 seconds
    setTimeout(() => {
      errorContainer.remove();
    }, 3000);
  }

  // Check subscription status
  async function checkSubscriptionStatus() {
    try {      
      // Use cached data if it exists and is less than 24 hours old
      let response;
      response = await chrome.runtime.sendMessage({ action: 'checkSubscription' });
      if (response && response.isSubscribed) {
        // User has an active subscription
        subscriptionStatus.textContent = 'Active';
        subscriptionStatus.className = 'subscription-badge subscription-active';
        
        // Display expiry date if available
        const expiryElem = document.getElementById('subscription-expiry');
        console.log('Expiry element:', expiryElem);
        if (expiryElem && response.expiresAt) {
          try {
            // Parse ISO date string directly
            const expiryDate = new Date(response.expiresAt);
            const now = new Date();
            
            // Check if subscription has expired
            if (expiryDate < now) {
              // Subscription has expired
              subscriptionStatus.textContent = 'Expired';
              subscriptionStatus.className = 'subscription-badge subscription-expired';
              expiryElem.textContent = `Expired on: ${expiryDate.toLocaleDateString()}`;
              expiryElem.style.color = '#dc3545';
              expiryElem.classList.remove('hidden'); // Make sure it's visible
              subscriptionLink.textContent = 'Renew Now';
              subscriptionLink.classList.remove('hidden');
              
              // Hide unsubscribe button for expired subscriptions
              hideUnsubscribeButton();
              return;
            }
            
            // Format the date in a user-friendly way
            const options = { year: 'numeric', month: 'short', day: 'numeric' };
            const formattedDate = expiryDate.toLocaleDateString(undefined, options);
            
            // Check if the subscription is already cancelled (but still active)
            const isCancelled = response.cancel_at_period_end === true;
            console.log('Subscription cancelled:', isCancelled);
            if (isCancelled) {
              // If cancelled, show in the status and expiry text
              subscriptionStatus.textContent = 'Cancelling';
              subscriptionStatus.className = 'subscription-badge subscription-cancelling';
              expiryElem.textContent = `Access until: ${formattedDate}`;
              expiryElem.style.color = '#dc3545';
              expiryElem.classList.remove('hidden');
              
              // Always show renew button for cancelled subscriptions
              subscriptionLink.textContent = 'Renew';
              subscriptionLink.classList.remove('hidden');
              
              // Don't show unsubscribe button since it's already cancelled
              hideUnsubscribeButton();
              return;
            }
            
            expiryElem.textContent = `Expires: ${formattedDate}`;
            expiryElem.classList.remove('hidden');
            expiryElem.style.color = ''; // Reset color
            
            // Check if subscription expires soon (within 7 days)
            const daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
            
            if (daysUntilExpiry <= 7) {
              // Change expiry text to red and show renewal link
              expiryElem.style.color = '#dc3545';
              subscriptionLink.textContent = 'Renew Now';
              subscriptionLink.classList.remove('hidden');
              
              // If very close to expiry (3 days), make it more noticeable
              if (daysUntilExpiry <= 3) {
                expiryElem.innerHTML = `<strong>Expires in ${daysUntilExpiry} days!</strong>`;
              }
            } else {
              // Not expiring soon, hide renewal link
              subscriptionLink.classList.add('hidden');
            }
            
            // Show unsubscribe button only for active, non-cancelled subscriptions
            if (!isCancelled) {
              showUnsubscribeButton();
            } else {
              hideUnsubscribeButton();
            }
          } catch (e) {
            console.error('Error formatting expiry date:', e, response.expiresAt);
            expiryElem.classList.add('hidden');
            hideUnsubscribeButton();
          }
        }
      } else {
        // User does not have an active subscription
        subscriptionStatus.textContent = 'Inactive';
        subscriptionStatus.className = 'subscription-badge subscription-inactive';
        subscriptionLink.textContent = 'Upgrade';
        subscriptionLink.classList.remove('hidden');
        
        // Hide expiry element for free users
        const expiryElem = document.getElementById('subscription-expiry');
        if (expiryElem) {
          expiryElem.classList.add('hidden');
        }
        
        // Hide unsubscribe button for non-subscribers
        hideUnsubscribeButton();
      }
    } catch (error) {
      console.error('Error checking subscription status:', error);
      subscriptionStatus.textContent = 'Unknown';
      subscriptionStatus.className = 'subscription-badge subscription-inactive';
      subscriptionLink.textContent = 'Upgrade';
      subscriptionLink.classList.remove('hidden');
      
      // Hide expiry element on error
      const expiryElem = document.getElementById('subscription-expiry');
      if (expiryElem) {
        expiryElem.classList.add('hidden');
      }
      
      // Hide unsubscribe button on error
      hideUnsubscribeButton();
    }
    
    // Helper function to show the unsubscribe button
    function showUnsubscribeButton() {
      let unsubscribeBtn = document.getElementById('unsubscribe-button');
      
      if (!unsubscribeBtn) {
        // Create the unsubscribe button if it doesn't exist
        unsubscribeBtn = document.createElement('a');
        unsubscribeBtn.id = 'unsubscribe-button';
        unsubscribeBtn.className = 'button-link text-danger';
        unsubscribeBtn.textContent = 'Unsubscribe';
        unsubscribeBtn.style.marginLeft = '10px';
        unsubscribeBtn.style.fontSize = '12px';
        unsubscribeBtn.target = "_blank"; // Open in new tab
        
        // Add it next to the subscription link
        if (subscriptionLink && subscriptionLink.parentNode) {
          subscriptionLink.parentNode.appendChild(unsubscribeBtn);
        }
      }
      
      // Get the subscription URL and add the unsubscribe parameter
      if (subscriptionLink && subscriptionLink.href) {
        const baseUrl = subscriptionLink.href;
        const separator = baseUrl.includes('?') ? '&' : '?';
        const fullUrl = `${baseUrl}${separator}action=unsubscribe`;
        unsubscribeBtn.href = fullUrl;
        
        // Add click event listener to open in new tab
        unsubscribeBtn.addEventListener('click', function(e) {
          e.preventDefault(); // Prevent default link behavior
          chrome.tabs.create({ url: fullUrl }); // Open in new tab
        });
      }
      
      unsubscribeBtn.classList.remove('hidden');
    }
    
    // Helper function to hide the unsubscribe button
    function hideUnsubscribeButton() {
      const unsubscribeBtn = document.getElementById('unsubscribe-button');
      if (unsubscribeBtn) {
        unsubscribeBtn.classList.add('hidden');
      }
    }
  }

  // Function to toggle the UI injector in the active tab
  async function toggleUiInjector(checked) {
    try {
      // First check if user is verified
      const isVerified = await checkEmailVerification(false);
      if (!isVerified) {
        showToast('Email verification required to use this feature', 'warning');
        return;
      }
      
      // Get the current active tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const activeTab = tabs[0];
      
      if (!activeTab) {
        showToast('No active tab found', 'error');
        return;
      }
      
      // Disable checkbox while processing
      if (toggleUiCheckbox) {
        toggleUiCheckbox.disabled = true;
        
        // Send message to the tab to toggle the UI injector
        chrome.tabs.sendMessage(activeTab.id, { action: 'toggleUiInjector', visible: checked }, (response) => {
          // Re-enable checkbox
          toggleUiCheckbox.disabled = false;
          
          // Handle response
          if (chrome.runtime.lastError) {
            console.error('Error toggling UI injector:', chrome.runtime.lastError);
            // The injector might not be ready yet, try to inject it first
            injectUiInjector(activeTab.id, checked);
          } else if (response && response.success) {
            // Show appropriate message based on whether we're showing or hiding the UI
            const actionText = checked ? 'shown' : 'hidden';
            showToast(`In-page tools ${actionText} successfully`, 'success');
            
            // Ensure checkbox state is still consistent with what we requested
            toggleUiCheckbox.checked = checked;
          } else {
            // If no response or error response, try to inject the injector first
            injectUiInjector(activeTab.id, checked);
          }
        });
      }
    } catch (error) {
      console.error('Error toggling UI injector:', error);
      showToast('Error toggling UI: ' + error.message, 'error');
    }
  }
  
  // Helper function to inject the UI injector if it's not already there
  async function injectUiInjector(tabId, visible) {
    try {
      // Inject the UI injector script if it's not already there
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['ui-injector.js']
      });
      
      // After injecting, send the toggle message again
      chrome.tabs.sendMessage(tabId, { action: 'toggleUiInjector', visible: visible }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Failed to toggle UI after injection:', chrome.runtime.lastError);
          showToast('Unable to toggle UI in this page', 'error');
        } else {
          // Show appropriate message based on whether we're showing or hiding the UI
          const actionText = visible ? 'shown' : 'hidden';
          showToast(`In-page tools ${actionText} successfully`, 'success');
          
          // Ensure checkbox state matches the UI visibility
          if (toggleUiCheckbox) {
            toggleUiCheckbox.checked = visible;
          }
        }
      });
    } catch (error) {
      console.error('Error injecting UI:', error);
      showToast('Error injecting UI: ' + error.message, 'error');
    }
  }
});
