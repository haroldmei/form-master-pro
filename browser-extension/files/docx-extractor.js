// Ensure mammoth is available in the browser, e.g., via a CDN or bundling

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
 * @returns {Promise<Object>} Content structure with paragraphs, tables, etc.
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
          paragraphs: [],
          tables: []
        };
      }
      
      if (typeof mammoth === 'undefined') {
        console.error('Mammoth.js is still not available after loading attempts.');
        return {
          filename: filename,
          paragraphs: [],
          tables: []
        };
      }
    }

    // Use mammoth with options to focus on content only
    const options = {
      styleMap: [
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        "p => p:fresh"
      ],
      // Ignore headers, footers and other non-content elements
      includeDefaultStyleMap: false,
      ignoreEmptyParagraphs: true
    };
    
    // Convert the DOCX file to HTML focusing only on main content
    const result = await mammoth.convertToHtml({ 
      arrayBuffer: await docxFile.arrayBuffer(),
      ignoreHeadersAndFooters: true, // Explicitly ignore headers and footers
    }, options);

    console.log('Conversion result:', result);

    // Use DOMParser to work with the HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(result.value, 'text/html');

    const content = {
      filename: filename,
      paragraphs: [],
      tables: []
    };

    // Set to track seen content and avoid duplication
    const seenContent = new Set();

    // Extract meaningful paragraphs (skip empty or whitespace-only paragraphs)
    doc.querySelectorAll('p, h1, h2, h3, h4, h5, h6').forEach(para => {
      const text = para.textContent.trim();
      
      // Only add non-empty text that hasn't been seen before and looks like actual content
      if (text && text.length > 1 && !seenContent.has(text) && !/^[\s\d.,:;_-]+$/.test(text)) {
        seenContent.add(text);
        content.paragraphs.push({
          text: text,
          // Tag type gives us hint about content importance (h1, h2, p, etc.)
          elementType: para.tagName.toLowerCase()
        });
      }
    });

    // Extract tables with meaningful data
    doc.querySelectorAll('table').forEach((table) => {
      const tableData = [];
      const tableContentSet = new Set(); // Track content within this table
      
      table.querySelectorAll('tr').forEach(row => {
        const rowData = [];
        let hasContent = false;
        
        row.querySelectorAll('td, th').forEach(cell => {
          const cellText = cell.textContent.trim();
          
          // Only include cells with meaningful content
          if (cellText && cellText.length > 1 && !/^[\s\d.,:;_-]+$/.test(cellText)) {
            rowData.push(cellText);
            tableContentSet.add(cellText);
            hasContent = true;
          } else {
            rowData.push(''); // Keep table structure intact
          }
        });

        if (hasContent && rowData.length > 0) {
          tableData.push(rowData);
        }
      });

      // Only include tables with actual content
      if (tableData.length > 0 && tableContentSet.size > 0) {
        content.tables.push({
          data: tableData
        });
      }
    });

    // Filter out any likely non-profile content
    content.paragraphs = content.paragraphs.filter(p => {
      const text = p.text.toLowerCase();
      // Skip common document elements that aren't profile content
      return !text.match(/^(page \d+|copyright|all rights reserved|confidential|draft|table of contents)$/);
    });

    return content;
  } catch (err) {
    console.error(`Error extracting content: ${err.message}`, err);
    return {
      filename: filename,
      paragraphs: [],
      tables: []
    };
  }
}

export { // ES module export
  extractDocxContent
};
