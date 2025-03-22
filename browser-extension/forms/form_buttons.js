/**
 * Extraction utilities for button controls.
 */

/**
 * Extract button elements and input elements with type button/submit/reset
 * @param {Object} $ - Cheerio instance
 * @param {Object} container - Container element
 * @returns {Array} Array of button objects
 */
function extractButtons($, container) {
  const buttons = [];
  
  // Get standard buttons
  $(container).find('button').each((i, button) => {
    buttons.push({
      id: $(button).attr('id') || '',
      name: $(button).attr('name') || '',
      type: $(button).attr('type') || 'button',
      text: $(button).text().trim(),
      disabled: $(button).attr('disabled') !== undefined
    });
  });
  
  // Get input buttons
  $(container).find('input[type="button"], input[type="submit"], input[type="reset"]').each((i, button) => {
    buttons.push({
      id: $(button).attr('id') || '',
      name: $(button).attr('name') || '',
      type: $(button).attr('type') || 'button',
      value: $(button).attr('value') || '',
      disabled: $(button).attr('disabled') !== undefined
    });
  });
  
  return buttons;
}

module.exports = { extractButtons };
