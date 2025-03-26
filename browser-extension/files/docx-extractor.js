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
          filename: filename,
          rawText: "",
          paragraphs: [],
          tables: []
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
    
    // Initialize the content structure
    const content = {
      filename: filename,
      rawText: "",
      paragraphs: [],
      tables: []
    };
    
    // Extract paragraphs
    const paragraphs = getElementsByTagName(xmlDoc, 'p');
    for (const paragraph of paragraphs) {
      // Extract text from all text elements (t) within this paragraph
      const textElements = getElementsByTagName(paragraph, 't');
      let paragraphText = "";
      
      for (const textEl of textElements) {
        paragraphText += textEl.textContent;
      }
      
      if (paragraphText.trim()) {
        content.paragraphs.push({
          text: paragraphText.trim()
        });
        content.rawText += paragraphText.trim() + "\n";
      }
    }
    
    // Extract tables
    const tables = getElementsByTagName(xmlDoc, 'tbl');
    for (const table of tables) {
      const tableData = [];
      
      // Get all rows
      const rows = getElementsByTagName(table, 'tr');
      for (const row of rows) {
        const rowData = [];
        
        // Get all cells
        const cells = getElementsByTagName(row, 'tc');
        for (const cell of cells) {
          // Get all paragraphs in the cell
          const cellParagraphs = getElementsByTagName(cell, 'p');
          let cellText = "";
          
          for (let i = 0; i < cellParagraphs.length; i++) {
            const para = cellParagraphs[i];
            // Extract text from all text elements in this paragraph
            const textElements = getElementsByTagName(para, 't');
            
            for (const textEl of textElements) {
              cellText += textEl.textContent;
            }
            
            // Add space between paragraphs in the same cell
            if (i < cellParagraphs.length - 1) {
              cellText += " ";
            }
          }
          
          rowData.push(cellText.trim());
        }
        
        if (rowData.length > 0) {
          tableData.push(rowData);
        }
      }
      
      if (tableData.length > 0) {
        content.tables.push({
          data: tableData
        });
      }
    }

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
