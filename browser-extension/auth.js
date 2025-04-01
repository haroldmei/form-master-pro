/**
 * Auth0 service that works in both web app and browser extension environments
 */
class Auth0Service {
    constructor() {
      this.auth0Domain = 'dev-otc3dyzfpgcr275c.au.auth0.com';
      this.clientId = 'gQbfiwyJzVJMO43WeEwEuzJ8mdinYH4g';
      this.audience = 'http://localhost:3000/api'; // Optional
      this.scope = 'openid profile email offline_access';
      this.isExtension = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;
      
      // Set proper redirect URI based on environment
      if (this.isExtension) {
        // For extension
        this.redirectUri = chrome.identity ? 
                           chrome.identity.getRedirectURL('callback') : 
                           `chrome-extension://${chrome.runtime.id}/callback.html`;
      } else {
        // For web application
        this.redirectUri = self.location.origin + '/callback';
      }
    }
  
    /**
     * Initialize auth service
     */
    async init() {
      const authState = await this.getAuthState();
      if (authState && authState.accessToken) {
        if (this.isTokenExpired(authState.expiresAt)) {
          if (authState.refreshToken) {
            return await this.refreshToken(authState.refreshToken);
          }
          return false;
        }
        return true;
      }
      return false;
    }
  
    /**
     * Start login flow
     */
    async login() {
      try {
        // Generate PKCE challenge
        const state = this.generateRandomString();
        const codeVerifier = this.generateRandomString(64);
        const codeChallenge = await this.generateCodeChallenge(codeVerifier);
        
        // Store PKCE params for verification
        await this.storeAuthParams({
          state,
          codeVerifier,
          redirectUri: this.redirectUri
        });
        
        // Build auth URL
        const authUrl = new URL(`https://${this.auth0Domain}/authorize`);
        authUrl.searchParams.append('client_id', this.clientId);
        authUrl.searchParams.append('response_type', 'code');
        authUrl.searchParams.append('redirect_uri', this.redirectUri);
        authUrl.searchParams.append('scope', this.scope);
        authUrl.searchParams.append('state', state);
        authUrl.searchParams.append('code_challenge', codeChallenge);
        authUrl.searchParams.append('code_challenge_method', 'S256');
        
        if (this.audience) {
          authUrl.searchParams.append('audience', this.audience);
        }
        
        // Handle login differently in extension vs web app
        if (this.isExtension) {
          await this.handleExtensionLogin(authUrl.toString());
        } else {
          // For web application, redirect to Auth0
          self.location.href = authUrl.toString();
        }
        
        return true;
      } catch (error) {
        console.error('Login error:', error);
        throw error;
      }
    }
    
    /**
     * Handle login flow in browser extension
     */
    async handleExtensionLogin(authUrl) {
      return new Promise((resolve, reject) => {
        if (chrome.identity && chrome.identity.launchWebAuthFlow) {
          // Preferred method using chrome.identity API
          chrome.identity.launchWebAuthFlow(
            { url: authUrl, interactive: true },
            async (responseUrl) => {
              if (chrome.runtime.lastError) {
                return reject(new Error(chrome.runtime.lastError.message));
              }
              
              try {
                await this.handleAuthResponse(responseUrl);
                resolve(true);
              } catch (error) {
                reject(error);
              }
            }
          );
        } else {
          // Fallback to opening a tab
          chrome.tabs.create({ url: authUrl }, (tab) => {
            // The callback.js will handle sending the message to the background script
            // which will process the token
            const tabId = tab.id;
            
            // Listen for when this tab is closed or redirected
            const authTabListener = (updatedTabId, changeInfo) => {
              if (updatedTabId === tabId && changeInfo.url && changeInfo.url.startsWith(this.redirectUri)) {
                chrome.tabs.onUpdated.removeListener(authTabListener);
                this.handleAuthResponse(changeInfo.url)
                  .then(resolve)
                  .catch(reject);
              }
            };
            
            chrome.tabs.onUpdated.addListener(authTabListener);
          });
        }
      });
    }
    
    /**
     * Handle auth response from redirect
     */
    async handleAuthResponse(url) {
      // Parse URL to extract authorization code
      const urlParams = new URLSearchParams(new URL(url).search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      const error = urlParams.get('error');
      
      if (error) {
        throw new Error(`Authorization error: ${error}`);
      }
      
      if (!code) {
        throw new Error('No authorization code received');
      }
      
      // Get stored auth params
      const authParams = await this.getAuthParams();
      
      // Verify state parameter
      if (state !== authParams.state) {
        throw new Error('Invalid state parameter');
      }
      
      // Exchange code for tokens
      const tokenResponse = await this.exchangeCodeForToken(
        code,
        authParams.codeVerifier,
        authParams.redirectUri
      );
      
      // Calculate token expiration
      const expiresAt = Date.now() + (tokenResponse.expires_in * 1000);
      
      // Extract email verification status from ID token
      const emailVerified = this.extractEmailVerified(tokenResponse.id_token);
      
      // Store auth state with email verification status
      const authState = {
        accessToken: tokenResponse.access_token,
        idToken: tokenResponse.id_token,
        refreshToken: tokenResponse.refresh_token,
        expiresAt,
        emailVerified,
        lastChecked: Date.now()
      };
      
      await this.setAuthState(authState);
      
      // Clean up auth params
      await this.clearAuthParams();
      
      return true;
    }
    
    /**
     * Extract email verification status from ID token
     */
    extractEmailVerified(idToken) {
      try {
        const payload = JSON.parse(atob(idToken.split('.')[1]));
        return payload.email_verified === true;
      } catch (error) {
        console.error('Error extracting email verification status:', error);
        return false;
      }
    }
    
    /**
     * Check if email is verified
     */
    async isEmailVerified() {
      const authState = await this.getAuthState();
      
      if (!authState) {
        return false;
      }
      
      // If we have the status cached and it was checked recently, use that
      if (authState.emailVerified !== undefined && 
          authState.lastChecked && 
          Date.now() - authState.lastChecked < 5 * 60 * 1000) { // 5 minutes cache
        return authState.emailVerified;
      }
      
      // Otherwise, check from the user profile
      try {
        const userProfile = await this.getUserProfile();
        const emailVerified = userProfile.email_verified === true;
        
        // Update the cached value
        await this.setAuthState({
          ...authState,
          emailVerified,
          lastChecked: Date.now()
        });
        
        return emailVerified;
      } catch (error) {
        console.error('Error checking email verification:', error);
        return false;
      }
    }
    
    /**
     * Exchange authorization code for tokens
     */
    async exchangeCodeForToken(code, codeVerifier, redirectUri) {
      const tokenUrl = `https://${this.auth0Domain}/oauth/token`;
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          client_id: this.clientId,
          code_verifier: codeVerifier,
          code,
          redirect_uri: redirectUri
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error_description || 'Token exchange failed');
      }
      
      return await response.json();
    }
    
    /**
     * Refresh the access token
     */
    async refreshToken(refreshToken) {
      try {
        const tokenUrl = `https://${this.auth0Domain}/oauth/token`;
        const response = await fetch(tokenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            grant_type: 'refresh_token',
            client_id: this.clientId,
            refresh_token: refreshToken
          })
        });
        
        if (!response.ok) {
          // If refresh fails, clear auth state
          await this.clearAuthState();
          return false;
        }
        
        const tokenResponse = await response.json();
        
        // Calculate new expiration time
        const expiresAt = Date.now() + (tokenResponse.expires_in * 1000);
        
        // Extract email verification status from ID token if available
        let emailVerified = undefined;
        if (tokenResponse.id_token) {
          emailVerified = this.extractEmailVerified(tokenResponse.id_token);
        }
        
        // Store updated tokens
        const authState = {
          accessToken: tokenResponse.access_token,
          idToken: tokenResponse.id_token,
          refreshToken: tokenResponse.refresh_token || refreshToken,
          expiresAt,
          emailVerified,
          lastChecked: Date.now()
        };
        
        await this.setAuthState(authState);
        return true;
      } catch (error) {
        console.error('Token refresh error:', error);
        await this.clearAuthState();
        return false;
      }
    }
    
    /**
     * Logout user
     */
    async logout() {
      // Get current auth state
      const authState = await this.getAuthState();
      
      // Clear local auth state
      await this.clearAuthState();
      
      if (authState && authState.idToken) {
        // Build logout URL
        const logoutUrl = new URL(`https://${this.auth0Domain}/v2/logout`);
        logoutUrl.searchParams.append('client_id', this.clientId);
        
        // Set return-to URL based on environment
        if (this.isExtension) {
          logoutUrl.searchParams.append('returnTo', chrome.runtime.getURL('logged_out.html'));
          
          // For extension, open the logout URL
          if (chrome.identity && chrome.identity.launchWebAuthFlow) {
            try {
              await new Promise((resolve) => {
                chrome.identity.launchWebAuthFlow(
                  { url: logoutUrl.toString(), interactive: false },
                  resolve
                );
              });
            } catch (error) {
              console.log('Logout flow completed');
            }
          } else {
            chrome.tabs.create({ url: logoutUrl.toString() });
          }
        } else {
          // For web application, redirect to logout URL
          logoutUrl.searchParams.append('returnTo', self.location.origin);
          self.location.href = logoutUrl.toString();
        }
      }
      
      return true;
    }
    
    /**
     * Get user profile from the ID token
     */
    async getUserProfile() {
      const authState = await this.getAuthState();
      
      if (!authState || !authState.idToken) {
        throw new Error('No ID token available');
      }
      
      // Parse the ID token payload
      try {
        const payloadBase64 = authState.idToken.split('.')[1];
        const payload = JSON.parse(atob(payloadBase64));
        return payload;
      } catch (error) {
        console.error('Error parsing ID token:', error);
        throw new Error('Invalid ID token format');
      }
    }
    
    /**
     * Get user info from Auth0 userinfo endpoint
     */
    async getUserInfo() {
      const authState = await this.getAuthState();
      
      if (!authState || !authState.accessToken) {
        throw new Error('No access token available, please login first');
      }
      
      const userInfoUrl = `https://${this.auth0Domain}/userinfo`;
      const response = await fetch(userInfoUrl, {
        headers: {
          Authorization: `Bearer ${authState.accessToken}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch user info');
      }
      
      return await response.json();
    }
    
    /**
     * Check if user is authenticated
     */
    async isAuthenticated() {
      const authState = await this.getAuthState();
      return !!(authState && authState.accessToken && !this.isTokenExpired(authState.expiresAt));
    }
    
    /**
     * Get access token for API calls
     */
    async getAccessToken() {
      const authState = await this.getAuthState();
      
      if (!authState || !authState.accessToken) {
        throw new Error('No access token available, please login first');
      }
      
      if (this.isTokenExpired(authState.expiresAt)) {
        if (!authState.refreshToken) {
          throw new Error('Session expired and no refresh token available');
        }
        
        const refreshed = await this.refreshToken(authState.refreshToken);
        if (!refreshed) {
          throw new Error('Session expired. Please login again.');
        }
        
        return (await this.getAuthState()).accessToken;
      }
      
      return authState.accessToken;
    }
    
    /**
     * Check if token is expired
     */
    isTokenExpired(expiresAt) {
      return Date.now() >= expiresAt;
    }
    
    // Storage methods that work in both environments
    async getAuthState() {
      if (this.isExtension) {
        return new Promise((resolve) => {
          chrome.storage.local.get(['authState'], (result) => {
            resolve(result.authState || null);
          });
        });
      } else {
        // For web app, use localStorage with encryption if possible
        const authStateStr = localStorage.getItem('authState');
        return authStateStr ? JSON.parse(authStateStr) : null;
      }
    }
    
    async setAuthState(authState) {
      if (this.isExtension) {
        return new Promise((resolve) => {
          chrome.storage.local.set({ authState }, resolve);
        });
      } else {
        // For web app, use localStorage with encryption if possible
        localStorage.setItem('authState', JSON.stringify(authState));
        return Promise.resolve();
      }
    }
    
    async clearAuthState() {
      if (this.isExtension) {
        return new Promise((resolve) => {
          chrome.storage.local.remove(['authState'], resolve);
        });
      } else {
        localStorage.removeItem('authState');
        return Promise.resolve();
      }
    }
    
    async storeAuthParams(params) {
      if (this.isExtension) {
        return new Promise((resolve) => {
          chrome.storage.local.set({ authParams: params }, resolve);
        });
      } else {
        sessionStorage.setItem('authParams', JSON.stringify(params));
        return Promise.resolve();
      }
    }
    
    async getAuthParams() {
      if (this.isExtension) {
        return new Promise((resolve) => {
          chrome.storage.local.get(['authParams'], (result) => {
            resolve(result.authParams || {});
          });
        });
      } else {
        const paramsStr = sessionStorage.getItem('authParams');
        return paramsStr ? JSON.parse(paramsStr) : {};
      }
    }
    
    async clearAuthParams() {
      if (this.isExtension) {
        return new Promise((resolve) => {
          chrome.storage.local.remove(['authParams'], resolve);
        });
      } else {
        sessionStorage.removeItem('authParams');
        return Promise.resolve();
      }
    }
    
    // Helper methods for PKCE
    generateRandomString(length = 32) {
      let result = '';
      const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      const charactersLength = characters.length;
      
      for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
      }
      
      return result;
    }
    
    async generateCodeChallenge(codeVerifier) {
      const encoder = new TextEncoder();
      const data = encoder.encode(codeVerifier);
      const digest = await crypto.subtle.digest('SHA-256', data);
      
      return btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    }
  }
  
  // Export the service
  const auth0Service = new Auth0Service();
  
  // Make it available globally and as a module
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = auth0Service;
  } else if (typeof self !== 'undefined') {
    self.auth0Service = auth0Service;
  }
  
  // For Chrome extension background script, make sure it's exported
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
    self.auth0Service = auth0Service;
  }