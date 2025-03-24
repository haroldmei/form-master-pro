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
 * Extract content from a DOCX file in a browser environment
 * @param {Blob} docxFile - The DOCX file as a Blob
 * @param {string} filename - The name of the file
 * @returns {Promise<Object>} Raw content from the document
 */
async function extractDocxContent(docxFile, filename) {
  try {
    console.log('DOCX file loaded:', docxFile);

    // Check if mammoth is defined and try to load it if not
    if (typeof mammoth === 'undefined') {
      console.log('Mammoth.js not found. Attempting to load...');
      try {
        // Try to load from various local paths first
        const possiblePaths = [
          './libs/mammoth.browser.min.js'
        ];
        
        let loaded = false;
        for (const path of possiblePaths) {
          try {
            await loadScript(path);
            console.log(`Mammoth.js loaded successfully from ${path}`);
            loaded = true;
            break;
          } catch (pathError) {
            console.log(`Failed to load from ${path}, trying next option...`);
          }
        }
        
        if (!loaded) {
          console.error('All loading attempts failed.');
          throw new Error('Could not load Mammoth.js from any location');
        }
      } catch (loadErr) {
        console.error('Failed to load Mammoth.js:', loadErr);
        console.error('CSP may be blocking external scripts. Please ensure mammoth.js is available locally.');
        return {
          filename: filename,
          rawText: "",
          paragraphs: [],
          tables: []
        };
      }
      
      if (typeof mammoth === 'undefined') {
        console.error('Mammoth.js is still not available after loading attempts.');
        return {
          filename: filename,
          rawText: "",
          paragraphs: [],
          tables: []
        };
      }
    }

    // Extract raw text content without any filtering
    const textResult = await mammoth.extractRawText({ arrayBuffer: await docxFile.arrayBuffer() });
    console.log('Raw text extraction completed');
    
    // Also extract HTML for structure preservation (tables, etc.)
    const htmlResult = await mammoth.convertToHtml({ arrayBuffer: await docxFile.arrayBuffer() });
    console.log('HTML conversion completed');

    // Use DOMParser to work with the HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlResult.value, 'text/html');

    // Simple content object with raw text and basic structure
    const content = {
      filename: filename,
      rawText: textResult.value, // Complete raw text of the document
      paragraphs: [], // All paragraphs without filtering
      tables: [] // All tables without filtering
    };

    // Extract all paragraphs without filtering
    doc.querySelectorAll('p, h1, h2, h3, h4, h5, h6').forEach(para => {
      const text = para.textContent.trim();
      if (text) {
        content.paragraphs.push({
          text: text
        });
      }
    });

    // Extract all tables without filtering
    doc.querySelectorAll('table').forEach((table) => {
      const tableData = [];
      
      table.querySelectorAll('tr').forEach(row => {
        const rowData = [];
        
        row.querySelectorAll('td, th').forEach(cell => {
          rowData.push(cell.textContent.trim());
        });

        if (rowData.length > 0) {
          tableData.push(rowData);
        }
      });

      if (tableData.length > 0) {
        content.tables.push({
          data: tableData
        });
      }
    });

    return content;
  } catch (err) {
    console.error(`Error extracting content: ${err.message}`, err);
    return {
      filename: filename,
      rawText: "",
      paragraphs: [],
      tables: []
    };
  }
}

export { // ES module export
  extractDocxContent
};
