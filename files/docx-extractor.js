const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const cheerio = require('cheerio');
const crypto = require('crypto');

/**
 * Extract content from a DOCX file with multilingual support
 * 
 * @param {string} docxPath - Path to the DOCX file
 * @returns {Object} Content structure with paragraphs, tables, etc.
 */
async function extractDocxContent(docxPath) {
  try {
    // Convert DOCX to HTML
    const result = await mammoth.convertToHtml({ path: docxPath });
    const $ = cheerio.load(result.value);
    
    const content = {
      filename: path.basename(docxPath),
      paragraphs: [],
      tables: []
    };
    
    // Dictionary to track seen paragraph content (for deduplication)
    const seenParagraphs = new Set();
    
    // Extract paragraphs
    $('p').each((i, para) => {
      const text = $(para).text().trim();
      if (text && !seenParagraphs.has(text)) {
        seenParagraphs.add(text);
        content.paragraphs.push({
          text: text,
          style: $(para).attr('class') || 'Normal'
        });
      }
    });
    
    // Extract tables
    $('table').each((i, table) => {
      const tableData = [];
      const seenCells = new Set();
      
      $(table).find('tr').each((j, row) => {
        const rowData = [];
        $(row).find('td, th').each((k, cell) => {
          const cellText = $(cell).text().trim();
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
      filename: path.basename(docxPath),
      paragraphs: [],
      tables: []
    };
  }
}

/**
 * Convert DOCX content to JSON and save to file
 * 
 * @param {string} docxPath - Path to the DOCX file
 * @param {string} outputPath - Path to save the JSON output
 * @returns {string} Path to the output JSON file
 */
async function docxToJson(docxPath, outputPath = null) {
  if (!outputPath) {
    const baseName = path.basename(docxPath, '.docx');
    outputPath = `${path.dirname(docxPath)}/${baseName}.json`;
  }
  
  const content = await extractDocxContent(docxPath);
  
  fs.writeFileSync(outputPath, JSON.stringify(content, null, 2), 'utf8');
  
  return outputPath;
}

/**
 * Process multiple DOCX files in a directory
 * 
 * @param {string} directoryPath - Path to directory containing DOCX files
 * @param {string} outputDirectory - Directory to save JSON files
 * @returns {Array} Paths to the output JSON files
 */
async function processMultipleDocx(directoryPath, outputDirectory = null) {
  if (!outputDirectory) {
    outputDirectory = directoryPath;
  }
  
  if (!fs.existsSync(outputDirectory)) {
    fs.mkdirSync(outputDirectory, { recursive: true });
  }
  
  const results = [];
  
  const files = fs.readdirSync(directoryPath);
  
  for (const filename of files) {
    if (filename.toLowerCase().endsWith('.docx')) {
      const docxPath = path.join(directoryPath, filename);
      const outputPath = path.join(outputDirectory, `${path.basename(filename, '.docx')}.json`);
      
      try {
        const resultPath = await docxToJson(docxPath, outputPath);
        results.push(resultPath);
        console.log(`Successfully processed: ${filename}`);
      } catch (err) {
        console.error(`Error processing ${filename}: ${err.message}`);
      }
    }
  }
  
  return results;
}

/**
 * Command line argument parsing and execution
 */
async function main() {
  const args = process.argv.slice(2);
  
  // Basic argument parsing
  if (args.length === 0) {
    console.log('Usage: node docx-extractor.js <input-file-or-directory> [--output <output-path>] [--batch]');
    process.exit(1);
  }
  
  const input = args[0];
  let output = null;
  let batch = false;
  
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--output' && i + 1 < args.length) {
      output = args[i + 1];
      i++;
    } else if (args[i] === '--batch') {
      batch = true;
    }
  }
  
  if (batch) {
    if (!fs.existsSync(input) || !fs.statSync(input).isDirectory()) {
      console.error(`Error: ${input} is not a directory`);
      process.exit(1);
    }
    
    const outputPaths = await processMultipleDocx(input, output);
    console.log(`Processed ${outputPaths.length} files. Output saved to: ${output || input}`);
  } else {
    if (!fs.existsSync(input) || !input.toLowerCase().endsWith('.docx')) {
      console.error(`Error: ${input} is not a valid DOCX file`);
      process.exit(1);
    }
    
    const outputPath = await docxToJson(input, output);
    console.log(`Output saved to: ${outputPath}`);
  }
}

// Run if script is executed directly
if (require.main === module) {
  main().catch(err => {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  });
}

module.exports = {
  extractDocxContent,
  docxToJson,
  processMultipleDocx
};
