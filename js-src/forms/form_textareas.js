/**
 * Extraction utilities for textarea controls.
 */
const { findLabelFor } = require('./form_common');

/**
 * Extract textarea elements
 * @param {Object} $ - Cheerio instance
 * @param {Object} container - Container element
 * @returns {Array} Array of textarea objects
 */
function extractTextareas($, container) {
  const textareas = [];
  
  $(container).find('textarea').each((i, textarea) => {
    const textareaInfo = {
      id: $(textarea).attr('id') || '',
      name: $(textarea).attr('name') || '',
      value: $(textarea).text(),
      required: $(textarea).attr('required') !== undefined,
      placeholder: $(textarea).attr('placeholder') || '',
      rows: $(textarea).attr('rows') || '',
      cols: $(textarea).attr('cols') || '',
      disabled: $(textarea).attr('disabled') !== undefined,
      readonly: $(textarea).attr('readonly') !== undefined
    };
    
    // Try to find label
    textareaInfo.label = findLabelFor($, textarea);
    
    textareas.push(textareaInfo);
  });
  
  return textareas;
}

module.exports = { extractTextareas };
