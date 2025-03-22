/**
 * Extraction utilities for select dropdown controls.
 */
const { findLabelFor } = require('./form_common');
const { getLogger } = require('../utils/logger');

const logger = getLogger('form_extract_selects');

/**
 * Extract select dropdowns and their options
 * @param {Object} $ - Cheerio instance
 * @param {Object} container - Container element
 * @returns {Array} Array of select objects
 */
function extractSelects($, container) {
  const selects = [];
  
  $(container).find('select').each((i, select) => {
    const options = [];
    
    $(select).find('option').each((j, option) => {
      options.push({
        value: $(option).attr('value') || '',
        text: $(option).text().trim(),
        selected: $(option).attr('selected') !== undefined
      });
    });
    
    const selectInfo = {
      id: $(select).attr('id') || '',
      name: $(select).attr('name') || '',
      required: $(select).attr('required') !== undefined,
      disabled: $(select).attr('disabled') !== undefined,
      options: options
    };
    
    // Try to find label
    selectInfo.label = findLabelFor($, select);
    
    // Check for Chosen enhancement
    const selectId = $(select).attr('id');
    if (selectId) {
      try {
        // Use a safer approach to find the chosen container
        const chosenClass = `${selectId}_chosen`;
        const chosenElements = $(container).find(`#${chosenClass}`);
        selectInfo.has_chosen = chosenElements.length > 0;
      } catch (e) {
        logger.warning(`Error checking for chosen enhancement for ${selectId}: ${e.message}`);
        selectInfo.has_chosen = false;
      }
    } else {
      selectInfo.has_chosen = false;
    }
    
    selects.push(selectInfo);
  });
  
  return selects;
}

module.exports = { extractSelects };
