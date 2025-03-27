/**
 * Dynamically load a script
 * @param {string} src - The script source URL
 * @returns {Promise} - Resolves when the script is loaded
 */
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = (e) => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

/**
 * Extract content from a DOCX file in a browser environment using JSZip
 * @param {Blob} docxFile - The DOCX file as a Blob
 * @param {string} filename - The name of the file
 * @returns {Promise<Object>} Raw content from the document
 */
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
            await loadScript(path);
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
        const cleanText = removeAllWhitespace(paragraphText.trim());
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
            const cleanText = removeAllWhitespace(cellText.trim());
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

/**
 * Determine if content is important enough to include
 * @param {string} text - The text to check
 * @returns {boolean} - Whether the content is important
 */
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

/**
 * Remove all whitespace including spaces and line breaks from text
 * @param {string} text - The text to process
 * @returns {string} - Text with all whitespace removed
 */
function removeAllWhitespace(text) {
  if (!text) return "";
  
  // Remove all spaces, tabs, line breaks, and other whitespace characters
  return text.replace(/\s/g, '');
}

export { // ES module export
  extractDocxContent
};
