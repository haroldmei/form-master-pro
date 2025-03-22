// Ensure mammoth is available in the browser, e.g., via a CDN or bundling
// For example: <script src="https://cdn.jsdelivr.net/npm/mammoth@1.4.21/mammoth.browser.min.js"></script>

// const cheerio = require('cheerio'); // Make sure cheerio is also browser compatible

/**
 * Extract content from a DOCX file in a browser environment
 * @param {Blob} docxFile - The DOCX file as a Blob
 * @param {string} filename - The name of the file
 * @returns {Promise<Object>} Content structure with paragraphs, tables, etc.
 */
async function extractDocxContent(docxFile, filename) {
  try {
    // Use mammoth to convert the DOCX file to HTML
    const result = await mammoth.convertToHtml({ arrayBuffer: await docxFile.arrayBuffer() });

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
    console.error(`Error extracting content: ${err.message}`);
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
