/**
 * Extraction utilities for radio button controls.
 */
const { findLabelFor, findGroupLabel, getAssociatedText } = require('./form_common');

/**
 * Extract radio button groups
 * @param {Object} $ - Cheerio instance
 * @param {Object} container - Container element
 * @returns {Array} Array of radio group objects
 */
function extractRadioGroups($, container) {
  const radioGroups = {};
  
  $(container).find('input[type="radio"]').each((i, radio) => {
    const name = $(radio).attr('name');
    if (!name) {
      return;
    }
    
    if (!radioGroups[name]) {
      radioGroups[name] = {
        name: name,
        options: [],
        label: findGroupLabel($, name)
      };
    }
    
    const option = {
      id: $(radio).attr('id') || '',
      value: $(radio).attr('value') || '',
      checked: $(radio).attr('checked') !== undefined,
      disabled: $(radio).attr('disabled') !== undefined
    };
    
    // Try to find label for this specific radio button
    const optionLabel = findLabelFor($, radio);
    if (optionLabel) {
      option.label = optionLabel;
    }
    
    // Get associated text (might be different from label)
    const optionText = getAssociatedText($, radio);
    if (optionText && optionText !== option.label) {
      option.text = optionText;
    }
    
    radioGroups[name].options.push(option);
  });
  
  return Object.values(radioGroups);
}

module.exports = { extractRadioGroups };
