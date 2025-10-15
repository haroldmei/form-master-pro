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
          return text;
        }).filter(str => str.length > 0); // Remove empty strings
        
        // Replace paragraphs with the cleaned strings
        processedProfile.extractedContent.paragraphs = cleanStrings;
      }
      
      // Also process the strings array if it exists
      if (Array.isArray(processedProfile.extractedContent.strings)) {
        processedProfile.extractedContent.strings = processedProfile.extractedContent.strings
          .map(text => String(text))
          .filter(str => str.length > 0);
      }
      
      // Clean up rawText if it exists
      if (processedProfile.extractedContent.rawText) {
        processedProfile.extractedContent.rawText = 
          processedProfile.extractedContent.rawText;
      }
    }
    
    // Also process docxData directly if it exists at root level
    if (processedProfile.docxData) {
      if (Array.isArray(processedProfile.docxData.paragraphs)) {
        processedProfile.docxData.paragraphs = processedProfile.docxData.paragraphs
          .map(p => typeof p === 'string' ? p : 
               (p && p.text) ? p.text : '')
          .filter(str => str.length > 0);
      }
    }
    
    return processedProfile;
  }

  /**
   * Make an API call to Claude API to get suggestions for form fields
   * 
   * @param {Array} fieldKeywords - List of field labels/names
   * @param {Object} userProfile - User profile data
   * @param {string} url - URL of the page containing the form
   * @returns {Object} Mapping of field IDs/names to suggested values
   */
  async function getAiSuggestions(fieldKeywords, userProfile, url) {
    try {
      // Get Claude API key from storage
      let claudeApiKey;
      
      try {
        claudeApiKey = await new Promise((resolve, reject) => {
          chrome.storage.local.get(['claudeApiKey'], (result) => {
            if (chrome.runtime.lastError) {
              console.error("Chrome storage error:", chrome.runtime.lastError);
              reject(chrome.runtime.lastError);
            } else {
              console.log("Retrieved Claude API key:", result.claudeApiKey ? "Key found" : "No key found");
              resolve(result.claudeApiKey);
            }
          });
        });
      } catch (storageError) {
        console.error("Failed to access chrome storage:", storageError);
        throw new Error("Unable to access extension storage. Please reload the extension and try again.");
      }

      if (!claudeApiKey) {
        throw new Error("Claude API key not found. Please configure it in the extension popup.");
      }
      
      // Process user profile to reduce size before sending to API
      const processedProfile = processUserProfile(userProfile);
      
      // Format processed profile data for the prompt
      const profileJson = JSON.stringify(processedProfile);
      console.log("User profile JSON (first 100 bytes):", profileJson.substring(0, 100));
      
      // Categorize fields based on whether they have options
      const fieldsWithoutOptions = {};
      const fieldsWithOptions = {};
      
      Object.entries(fieldKeywords).forEach(([field, options]) => {
        if (!options || (Array.isArray(options) && options.length === 0) || 
            (typeof options === 'object' && Object.keys(options).length === 0)) {
          fieldsWithoutOptions[field] = null;
        } else {
          fieldsWithOptions[field] = options;
        }
      });
      
      console.log(`Fields without options: ${Object.keys(fieldsWithoutOptions).length}`);
      console.log(`Fields with options: ${Object.keys(fieldsWithOptions).length}`);
      
      // Create the prompt for Claude
      const systemPrompt = `You are an advanced form filling assistant that extracts information from user profiles and selects appropriate options for form fields.`;
      const prompt = `User's profile data: 
${profileJson}

I need to fill out a form with the following fields. There are two types of fields:


1. EXTRACTION FIELDS: Fields where I need you to extract information directly from the profile.
These fields have no predefined options:
${JSON.stringify(fieldsWithoutOptions, null, 2)}


2. SELECTION FIELDS: Fields where you must select the most appropriate option from a list, you answer must be exactly the same as one of the options.
These fields have predefined options:
${JSON.stringify(fieldsWithOptions, null, 2)}


INSTRUCTIONS:
- For EXTRACTION FIELDS, find relevant information in the profile and provide the appropriate value.
- For SELECTION FIELDS, select the MOST APPROPRIATE OPTION from the given options based on the profile.
- Return a SINGLE JSON object containing both types of fields.
- If you don't have enough information for a field, omit it from the response.


FORMAT:
Return your response as a valid JSON object where keys are field names and values are either:
1. Extracted values from the profile (for extraction fields)
2. The selected option (for selection fields)

DO NOT include explanations or markdown formatting - ONLY return the JSON object.`;
      
      console.log("Prompt:", prompt);
      console.log("Making Claude API call with key:", claudeApiKey.substring(0, 10) + "...");
      
      // Make the API call to Claude
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": claudeApiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({
          model: "claude-3-haiku-20240307",
          max_tokens: 1000,
          system: systemPrompt,
          messages: [
            {
              role: "user",
              content: prompt
            }
          ]
        })
      });

      console.log("Claude API response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Claude API error response:", errorText);
        
        if (response.status === 401) {
          throw new Error("Invalid Claude API key. Please check your API key in the extension settings.");
        } else if (response.status === 429) {
          throw new Error("Rate limit exceeded. Please try again later.");
        } else {
          throw new Error(`Claude API error: ${response.status} ${response.statusText} - ${errorText}`);
        }
      }

      const responseData = await response.json();
      console.log("Claude API response:", responseData);
      
      // Extract the content from the response
      const content = responseData.content?.[0]?.text;
      if (!content) {
        throw new Error("Invalid response format from Claude API");
      }

      // Parse the JSON content
      try {
        // Clean the content to extract JSON
        const cleanContent = content.trim();
        return JSON.parse(cleanContent);
      } catch (parseError) {
        console.error("Error parsing Claude response as JSON:", parseError);
        console.log("Response content:", content);
        throw new Error("Error parsing Claude response as JSON");
      }
    } catch (error) {
      console.error("Error calling Claude API:", error);
      throw error;
    }
  }
  
  /**
   * Test Claude API key validity
   * @param {string} apiKey - The API key to test
   * @returns {Promise<boolean>} - True if valid, false otherwise
   */
  async function testClaudeApiKey(apiKey) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({
          model: "claude-3-haiku-20240307",
          max_tokens: 10,
          messages: [
            {
              role: "user",
              content: "Hello"
            }
          ]
        })
      });

      return response.ok;
    } catch (error) {
      console.error("Error testing Claude API key:", error);
      return false;
    }
  }

  // Return public API
  return {
    getAiSuggestions,
    testClaudeApiKey
  };
})();

self.aiService = aiService;