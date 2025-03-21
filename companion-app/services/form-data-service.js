const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const { getLogger } = require('../utils/logger');

const logger = getLogger('form-data-service');

class FormDataService {
  constructor() {
    this.dataCache = {};
    this.currentFile = null;
  }

  /**
   * Load data from a file
   * @param {string} filePath - Path to the data file
   */
  async loadFile(filePath) {
    try {
      logger.info(`Loading data from file: ${filePath}`);
      const extension = path.extname(filePath).toLowerCase();
      
      if (extension === '.docx') {
        await this.loadDocxFile(filePath);
      } else if (extension === '.json') {
        await this.loadJsonFile(filePath);
      } else {
        throw new Error(`Unsupported file type: ${extension}`);
      }
      
      this.currentFile = filePath;
      return true;
    } catch (error) {
      logger.error(`Error loading file: ${error.message}`);
      throw error;
    }
  }

  /**
   * Load data from a DOCX file
   * @param {string} filePath - Path to the DOCX file
   */
  async loadDocxFile(filePath) {
    try {
      // Use mammoth to extract text content from the DOCX file
      const result = await mammoth.extractRawText({ path: filePath });
      const text = result.value;
      
      // Extract tables from the DOCX file using HTML conversion
      const htmlResult = await mammoth.convertToHtml({ path: filePath });
      const tables = this.extractTablesFromHtml(htmlResult.value);
      
      // Store the extracted data in the cache
      this.dataCache = {
        text,
        tables,
        type: 'docx',
        fileName: path.basename(filePath)
      };
      
      logger.info(`Successfully loaded DOCX file: ${filePath}`);
      return true;
    } catch (error) {
      logger.error(`Error loading DOCX file: ${error.message}`);
      throw error;
    }
  }

  /**
   * Extract tables from HTML content
   * @param {string} html - HTML content
   * @returns {Array} Array of tables
   */
  extractTablesFromHtml(html) {
    const cheerio = require('cheerio');
    const $ = cheerio.load(html);
    const tables = [];
    
    $('table').each((i, table) => {
      const tableData = [];
      $(table).find('tr').each((j, row) => {
        const rowData = [];
        $(row).find('td, th').each((k, cell) => {
          rowData.push($(cell).text().trim());
        });
        if (rowData.length > 0) {
          tableData.push(rowData);
        }
      });
      
      if (tableData.length > 0) {
        tables.push(tableData);
      }
    });
    
    return tables;
  }

  /**
   * Load data from a JSON file
   * @param {string} filePath - Path to the JSON file
   */
  async loadJsonFile(filePath) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      this.dataCache = {
        ...data,
        type: 'json',
        fileName: path.basename(filePath)
      };
      
      logger.info(`Successfully loaded JSON file: ${filePath}`);
      return true;
    } catch (error) {
      logger.error(`Error loading JSON file: ${error.message}`);
      throw error;
    }
  }

  /**
   * Map form fields to data based on mappings
   * @param {Array} formFields - Form fields from the web page
   * @param {Object} mappings - Field mappings configuration
   * @param {string} url - URL of the page with the form
   * @returns {Object} Mapped field values
   */
  async getFormData(formFields, mappings, url) {
    if (!this.currentFile || Object.keys(this.dataCache).length === 0) {
      throw new Error("No data file has been loaded");
    }
    
    const urlMappings = this.findMappingsForUrl(mappings, url);
    if (!urlMappings) {
      logger.warning(`No mappings found for URL: ${url}`);
      return {};
    }
    
    const fieldValues = {};
    
    // Process each form field
    for (const field of formFields) {
      const fieldId = field.id || field.name;
      if (!fieldId) continue;
      
      // Check if we have a mapping for this field
      const mapping = urlMappings[fieldId] || urlMappings[field.label];
      if (!mapping) continue;
      
      // Get the value based on the mapping
      const value = this.extractValueFromData(mapping);
      if (value !== undefined && value !== null) {
        fieldValues[fieldId] = value;
      }
    }
    
    logger.info(`Mapped ${Object.keys(fieldValues).length} fields for form`);
    return fieldValues;
  }

  /**
   * Find mappings for a specific URL
   * @param {Object} mappings - All mappings
   * @param {string} url - URL to find mappings for
   * @returns {Object} Mappings for the URL
   */
  findMappingsForUrl(mappings, url) {
    // First try exact match
    if (mappings[url]) {
      return mappings[url];
    }
    
    // Try to match by domain or partial URL
    for (const key in mappings) {
      if (url.includes(key)) {
        return mappings[key];
      }
    }
    
    // Return default mappings if available
    return mappings.default;
  }

  /**
   * Extract a value from the loaded data based on a mapping
   * @param {string|Object} mapping - Data mapping
   * @returns {any} Extracted value
   */
  extractValueFromData(mapping) {
    if (!mapping) return null;
    
    // Handle different mapping types
    if (typeof mapping === 'string') {
      return this.extractValueByPath(mapping);
    } else if (typeof mapping === 'object') {
      if (mapping.type === 'table') {
        return this.extractValueFromTable(mapping.table, mapping.row, mapping.col);
      } else if (mapping.type === 'regex') {
        return this.extractValueWithRegex(mapping.pattern, mapping.source || 'text');
      } else if (mapping.type === 'constant') {
        return mapping.value;
      }
    }
    
    return null;
  }

  /**
   * Extract a value using a dot-notation path
   * @param {string} path - Dot-notation path
   * @returns {any} Extracted value
   */
  extractValueByPath(path) {
    const parts = path.split('.');
    let value = this.dataCache;
    
    for (const part of parts) {
      if (!value || typeof value !== 'object') return null;
      value = value[part];
    }
    
    return value;
  }

  /**
   * Extract a value from a specific table cell
   * @param {number} tableIndex - Table index
   * @param {number} rowIndex - Row index
   * @param {number} colIndex - Column index
   * @returns {string} Cell value
   */
  extractValueFromTable(tableIndex, rowIndex, colIndex) {
    const tables = this.dataCache.tables;
    if (!tables || tableIndex >= tables.length) return null;
    
    const table = tables[tableIndex];
    if (!table || rowIndex >= table.length) return null;
    
    const row = table[rowIndex];
    if (!row || colIndex >= row.length) return null;
    
    return row[colIndex];
  }

  /**
   * Extract a value using a regular expression
   * @param {string} pattern - Regular expression pattern
   * @param {string} source - Source to extract from
   * @returns {string} Extracted value
   */
  extractValueWithRegex(pattern, source) {
    let text;
    
    if (source === 'text' && this.dataCache.text) {
      text = this.dataCache.text;
    } else if (source === 'fileName') {
      text = this.dataCache.fileName || '';
    } else {
      return null;
    }
    
    const regex = new RegExp(pattern);
    const match = regex.exec(text);
    
    if (match && match.length > 1) {
      return match[1]; // Return the first capture group
    } else if (match) {
      return match[0]; // Return the full match if no capture groups
    }
    
    return null;
  }
}

module.exports = new FormDataService();
