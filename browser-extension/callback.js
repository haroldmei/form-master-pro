// Extract tokens from URL and send to background script
(function() {
    const params = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = params.get('access_token');
    const idToken = params.get('id_token');
    const error = params.get('error');
    
    if (error) {
      chrome.runtime.sendMessage({
        type: 'auth-error',
        error: error,
        errorDescription: params.get('error_description')
      });
    } else if (accessToken && idToken) {
      chrome.runtime.sendMessage({
        type: 'auth-callback',
        accessToken: accessToken,
        idToken: idToken,
        expiresIn: params.get('expires_in'),
        state: params.get('state')
      });
    }
    
    // Close this tab
    window.close();
  })();