// Ensure mammoth is available in the browser, e.g., via a CDN or bundling
// For example: <script src="https://cdn.jsdelivr.net/npm/mammoth@1.4.21/mammoth.browser.min.js"></script>

// const cheerio = require('cheerio'); // Make sure cheerio is also browser compatible

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
      
      // Check again if mammoth is defined after attempting to load it
      if (typeof mammoth === 'undefined') {
        console.error('Mammoth.js is still not available after loading attempts.');
        return {
          filename: filename,
          paragraphs: [],
          tables: []
        };
      }
    }

    // Use mammoth to convert the DOCX file to HTML
    const result = await mammoth.convertToHtml({ arrayBuffer: await docxFile.arrayBuffer() });

    console.log('Mammoth conversion result:', result);

    // Log the generated HTML to inspect its structure
    console.log('Generated HTML:', result.value);

    // Use DOMParser instead of cheerio
    const parser = new DOMParser();
    const doc = parser.parseFromString(result.value, 'text/html');

    const content = {
      filename: filename,
      paragraphs: [],
      tables: []
    };

    // Dictionary to track seen paragraph content (for deduplication)
    const seenParagraphs = new Set();

    // Extract paragraphs
    doc.querySelectorAll('p').forEach(para => {
      const text = para.textContent.trim();
      if (text && !seenParagraphs.has(text)) {
        seenParagraphs.add(text);
        content.paragraphs.push({
          text: text,
          style: para.className || 'Normal'
        });
      }
    });

    // Extract tables
    doc.querySelectorAll('table').forEach((table, i) => {
      const tableData = [];
      const seenCells = new Set();

      table.querySelectorAll('tr').forEach(row => {
        const rowData = [];
        row.querySelectorAll('td, th').forEach(cell => {
          const cellText = cell.textContent.trim();
          // Only add non-empty cells that haven't been seen before within this table
          if (cellText && !seenCells.has(cellText)) {
            seenCells.add(cellText);
            rowData.push(cellText);
          }
        });

        if (rowData.length > 0) {
          tableData.push(rowData);
        }
      });

      if (tableData.length > 0) {
        content.tables.push({
          id: i + 1,
          data: tableData
        });
      }
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
