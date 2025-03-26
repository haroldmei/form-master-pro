/**
 * AI Service for form suggestions
 */
const aiService = (() => {
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
      
      // Format user profile data for the prompt
      const profileJson = JSON.stringify(userProfile, null, 2);
      console.log("User profile JSON:", profileJson.length, "bytes");
      
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
      
      if (!response.ok) {
        throw new Error(`Bargain4me API error: ${response.status} ${response.statusText}`);
      }
      
      const responseData = await response.json();
      console.log("Bargain4me API response:", responseData);
      
      // Extract the content from the response
      // Adjust based on the actual response structure from bargain4me.com API
      const content = responseData.reply;
      if (!content) {
        throw new Error("Invalid response format from Bargain4me API");
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
        console.error("Error parsing Bargain4me response as JSON:", parseError);
        console.log("Response content:", content);
        return {};
      }
    } catch (error) {
      console.error("Error calling Bargain4me API:", error);
      throw error;
    }
  }
  
  // Return public API
  return {
    getAiSuggestions
  };
})();

self.aiService = aiService;