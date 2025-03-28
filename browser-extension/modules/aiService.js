/**
 * AI Service for form suggestions
 */
const aiService = (() => {
  /**
   * Process user profile to optimize size by removing spaces and line breaks
   * 
   * @param {Object} userProfile - The original user profile
   * @returns {Object} - Processed user profile with reduced size
   */
  function processUserProfile(userProfile) {
    if (!userProfile) return {};
    
    // Create a deep copy to avoid modifying the original
    const processedProfile = JSON.parse(JSON.stringify(userProfile));
    
    // Process docxData if it exists
    if (processedProfile.extractedContent) {
      // Convert paragraphs to list of strings without spaces or line breaks
      if (Array.isArray(processedProfile.extractedContent.paragraphs)) {
        const cleanStrings = processedProfile.extractedContent.paragraphs.map(p => {
          const text = typeof p === 'object' && p.text ? p.text : String(p);
          // Remove all whitespace (spaces, tabs, line breaks)
          return text.replace(/\s/g, '');
        }).filter(str => str.length > 0); // Remove empty strings
        
        // Replace paragraphs with the cleaned strings
        processedProfile.extractedContent.paragraphs = cleanStrings;
      }
      
      // Also process the strings array if it exists
      if (Array.isArray(processedProfile.extractedContent.strings)) {
        processedProfile.extractedContent.strings = processedProfile.extractedContent.strings
          .map(text => String(text).replace(/\s/g, ''))
          .filter(str => str.length > 0);
      }
      
      // Clean up rawText if it exists
      if (processedProfile.extractedContent.rawText) {
        processedProfile.extractedContent.rawText = 
          processedProfile.extractedContent.rawText.replace(/\s/g, '');
      }
    }
    
    // Also process docxData directly if it exists at root level
    if (processedProfile.docxData) {
      if (Array.isArray(processedProfile.docxData.paragraphs)) {
        processedProfile.docxData.paragraphs = processedProfile.docxData.paragraphs
          .map(p => typeof p === 'string' ? p.replace(/\s/g, '') : 
               (p && p.text) ? p.text.replace(/\s/g, '') : '')
          .filter(str => str.length > 0);
      }
    }
    
    return processedProfile;
  }

  /**
   * Make an API call to bargain4me.com API to get suggestions for form fields
   * 
   * @param {Array} fieldKeywords - List of field labels/names
   * @param {Object} userProfile - User profile data
   * @param {string} url - URL of the page containing the form
   * @returns {Object} Mapping of field IDs/names to suggested values
   */
  async function getAiSuggestions(fieldKeywords, userProfile, url) {
    try {
      // Get the access token from the auth service
      const accessToken = await auth0Service.getAccessToken();
      if (!accessToken) {
        throw new Error("Authentication required to use AI suggestions");
      }
      
      // Process user profile to reduce size before sending to API
      const processedProfile = processUserProfile(userProfile);
      
      // Format processed profile data for the prompt
      const profileJson = JSON.stringify(processedProfile);
      console.log("User profile JSON:", profileJson.length, "bytes (optimized from original)");
      
      // Make the API call to bargain4me.com
      const response = await fetch("https://bargain4me.com/api/formmaster", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          profileJson: profileJson,
          fieldKeywords: fieldKeywords,
          url: url
        })
      });

      const responseData = await response.json();
      console.log("FromMasterPro API response:", responseData);
      if (!response.ok) {
        if (response.status === 403 && responseData.error === 'email_not_verified') {
          throw {
            status: response.status,
            message: responseData.message || 'Email verification required',
            error: responseData.error,
            isVerificationError: true
          };
        }
        else{
          throw new Error(`FromMasterPro API error: ${response.status} ${response.statusText}`);
        }
      }
      
      // Extract the content from the response
      // Adjust based on the actual response structure from bargain4me.com API
      const content = responseData.reply;
      if (!content) {
        throw new Error("Invalid response format from FromMasterPro API");
      }
      
      // Parse the JSON content
      // First, we need to extract JSON from the response which might contain markdown formatting
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || 
                       content.match(/```([\s\S]*?)```/) || 
                       [null, content];
      
      const jsonContent = jsonMatch[1] || content;
      
      try {
        return JSON.parse(jsonContent);
      } catch (parseError) {
        console.error("Error parsing FromMasterPro response as JSON:", parseError);
        console.log("Response content:", content);
        return {};
      }
    } catch (error) {
      console.error("Error calling FromMasterPro API:", error);
      throw error;
    }
  }
  
  // Return public API
  return {
    getAiSuggestions
  };
})();

self.aiService = aiService;