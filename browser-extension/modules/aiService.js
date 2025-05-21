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
      console.log("User profile JSON (first 100 bytes):", profileJson.substring(0, 100));
      
      // Make the API call using the API_BASE_URL constant with fallback to local development URL
      const response = await fetch(`${typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : 'http://localhost:3001'}/api/formmaster`, {
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

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const responseData = await response.json();
        //console.log("FromMasterPro API response:", responseData);
        if (!response.ok) {
          if (response.status === 403) {
            throw {
              status: response.status,
              message: responseData.message || 'Forbidden',
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
          throw new Error("Error parsing FromMasterPro response as JSON:", parseError, content);
        }
      } else {
        // Not JSON, get as text instead
        const errorText = await response.text();
        
        // Check for rate limit text
        if (errorText.includes("Too many requests") || errorText.includes("rate limit")) {
          throw new Error(`Rate limit exceeded. Please try again later.`);
        } else {
          throw new Error(`API error (${response.status}): ${errorText.substring(0, 100)}`);
        }
      }
    } catch (error) {
      console.error("Error calling FromMasterPro API:", error);
      throw error;
    }
  }
  
  /**
   * Generate AI code for a single container
   * @param {string} containerHtml - The HTML of the container
   * @param {string} url - URL of the page containing the form
   * @returns {Promise<string>} The generated AI code
   */
  async function generateAiCodeForContainer(containerHtml, url) {
    try {
      // Get the access token from the auth service
      const accessToken = await auth0Service.getAccessToken();
      if (!accessToken) {
        throw new Error("Authentication required to use AI code generation");
      }

      // Make the API call to generate code for this container
      const response = await fetch(`${typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : 'http://localhost:3001'}/api/aicode`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          container: containerHtml,
          url: url
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`AI code generation error: ${response.status} ${response.statusText} - ${errorData.message || ''}`);
      }

      // Get the JavaScript function as a string
      const responseData = await response.json();
      return responseData.code;
    } catch (error) {
      console.error("Error generating AI code for container:", error);
      throw error;
    }
  }

  /**
   * Get AI-generated code for form fields
   * @param {Array} fields - Array of form field objects
   * @param {string} url - URL of the page containing the form
   * @returns {Object} Generated code for the form fields
   */
  async function getAiCode(fields, url) {
    try {
      if (!fields || !fields.length) {
        throw new Error('No form fields provided');
      }

      // Process each field
      const processedFields = await Promise.all(fields.map(async field => {
        try {
          // Generate AI code for this field
          const codeString = await generateAiCodeForField(field, url);
          
          // Parse the AI code
          const aiCode = parseAiCode(codeString);
          
          return {
            ...field,
            aiCode
          };
        } catch (error) {
          console.error(`Error processing field ${field.id || field.name}:`, error);
          return {
            ...field,
            aiCode: null,
            error: error.message
          };
        }
      }));

      return {
        url,
        fields: processedFields,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error generating AI code:', error);
      throw error;
    }
  }

  // Helper function to generate AI code for a single field
  async function generateAiCodeForField(field, url) {
    // Add a delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Generate code based on field properties
    const code = {
      id: field.id,
      name: field.name,
      type: field.type,
      tagName: field.tagName,
      className: field.className,
      placeholder: field.placeholder,
      options: field.options,
      selectors: {
        id: field.id ? `#${field.id}` : null,
        name: field.name ? `[name="${field.name}"]` : null,
        className: field.className ? `.${field.className.split(' ').join('.')}` : null,
        type: field.type ? `[type="${field.type}"]` : null
      }
    };

    return JSON.stringify(code, null, 2);
  }

  // Helper function to parse AI code
  function parseAiCode(codeString) {
    try {
      // Extract JSON content from markdown-formatted response
      const jsonMatch = codeString.match(/```json\n([\s\S]*?)\n```/) || 
                       codeString.match(/```([\s\S]*?)```/) || 
                       [null, codeString];
      const jsonContent = jsonMatch[1] || codeString;

      // Parse the extracted JSON content
      return JSON.parse(jsonContent);
    } catch (error) {
      console.error('Error parsing AI code:', error);
      throw new Error('Invalid AI code format');
    }
  }

  // Return public API
  return {
    getAiSuggestions,
    getAiCode,
    generateAiCodeForContainer
  };
})();

self.aiService = aiService;