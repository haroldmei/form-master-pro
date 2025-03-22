/**
 * Extraction utilities for text input controls.
 */
const { findLabelFor } = require('./form_common');

/**
 * Extract text, email, password, date and number inputs
 * @param {Object} $ - Cheerio instance
 * @param {Object} container - Container element
 * @returns {Array} Array of input objects
 */
function extractInputs($, container) {
  const inputs = [];
  const inputTypes = ['text', 'email', 'password', 'date', 'number', 'tel', 'hidden'];
  
  $(container).find('input').each((i, input) => {
    const type = $(input).attr('type') || 'text';
    
    if (inputTypes.includes(type)) {
      const inputInfo = {
        id: $(input).attr('id') || '',
        name: $(input).attr('name') || '',
        type: type,
        value: $(input).attr('value') || '',
        placeholder: $(input).attr('placeholder') || '',
        required: $(input).attr('required') !== undefined,
        max_length: $(input).attr('maxlength') || '',
        disabled: $(input).attr('disabled') !== undefined,
        readonly: $(input).attr('readonly') !== undefined
      };
      
      // Try to find label
      inputInfo.label = findLabelFor($, input);
      
      inputs.push(inputInfo);
    }
  });
  
  return inputs;
}

module.exports = { extractInputs };
