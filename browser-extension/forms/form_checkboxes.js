/**
 * Extraction utilities for checkbox controls.
 */
const { findLabelFor, findParentByTag } = require('./form_common');
const { getLogger } = require('../utils/logger');

const logger = getLogger('form_extract_checkboxes');

/**
 * Extract checkbox inputs
 * @param {Object} $ - Cheerio instance
 * @param {Object} container - Container element
 * @returns {Array} Array of checkbox objects
 */
function extractCheckboxes($, container) {
  if (!container) {
    logger.error("Container is None in extract_checkboxes");
    return [];
  }
  
  try {
    const checkboxes = [];
    
    $(container).find('input[type="checkbox"]').each((i, checkbox) => {
      const checkboxInfo = {
        id: $(checkbox).attr('id') || '',
        name: $(checkbox).attr('name') || '',
        value: $(checkbox).attr('value') || '',
        checked: $(checkbox).attr('checked') !== undefined,
        disabled: $(checkbox).attr('disabled') !== undefined
      };
      
      // Try to find formal label with 'for' attribute
      checkboxInfo.label = findLabelFor($, checkbox);
      
      // Try to find associated text through various methods
      try {
        const textContent = getCheckboxText($, checkbox);
        if (textContent) {
          checkboxInfo.text = textContent;
        }
      } catch (e) {
        logger.error(`Error getting checkbox text: ${e.message}`);
      }
      
      checkboxes.push(checkboxInfo);
    });
    
    return checkboxes;
  } catch (e) {
    logger.error(`Error in extract_checkboxes: ${e.message}`);
    return [];
  }
}

/**
 * Get text associated with a checkbox through multiple approaches
 * @param {Object} $ - Cheerio instance
 * @param {Object} checkbox - Checkbox element
 * @returns {string|null} Associated text or null if not found
 */
function getCheckboxText($, checkbox) {
  if (!$ || !checkbox) {
    return null;
  }
  
  const texts = [];
  
  // Method 1: Check for span element within the same label as checkbox
  const parent = $(checkbox).parent('label');
  if (parent.length > 0) {
    // Look for span elements inside the label
    const spans = parent.find('span');
    if (spans.length > 0) {
      spans.each((i, span) => {
        if ($(span).text().trim()) {
          texts.push($(span).text().trim());
        }
      });
    }
    
    // If no spans with text, extract text directly from the label
    if (texts.length === 0) {
      let labelText = "";
      parent.contents().each((i, content) => {
        if (content.type === 'text') {
          labelText += $(content).text().trim() + " ";
        } else if (content.type === 'tag' && content.name !== 'input') {
          labelText += $(content).text().trim() + " ";
        }
      });
      
      if (labelText.trim()) {
        texts.push(labelText.trim());
      }
    }
  }
  
  // Method 2: Check for immediately adjacent text nodes
  const nextSibling = $(checkbox).get(0).nextSibling;
  if (nextSibling && nextSibling.type === 'text' && nextSibling.data.trim()) {
    texts.push(nextSibling.data.trim());
  }
  
  // Method 3: Check for adjacent span, label or text elements
  if (parent.length > 0) {
    // Look for sibling elements that might contain label text
    const nextSiblings = parent.nextAll();
    if (nextSiblings.length > 0) {
      const firstSibling = $(nextSiblings[0]);
      if (firstSibling.is('span, label, div') && firstSibling.text().trim()) {
        texts.push(firstSibling.text().trim());
      }
    }
  }
  
  // Method 4: Look for elements with matching "for" attribute
  const checkboxId = $(checkbox).attr('id');
  if (checkboxId) {
    const label = $(container).find(`label[for="${checkboxId}"]`);
    if (label.length > 0 && label.text().trim()) {
      texts.push(label.text().trim());
    }
  }
  
  // Method 5: If within a table cell, look for text in adjacent cells
  const cell = findParentByTag($, checkbox, 'td');
  if (cell && cell.length > 0) {
    // Look for text in the next cell
    const nextCell = cell.next('td');
    if (nextCell.length > 0 && nextCell.text().trim()) {
      texts.push(nextCell.text().trim());
    }
  }
  
  // Method 6: If wrapped in a div with adjacent label/span, get that text
  const divParent = findParentByTag($, checkbox, 'div');
  if (divParent && divParent.length > 0) {
    // Look for nearby elements that might have label text
    const nextSiblings = divParent.nextAll();
    if (nextSiblings.length > 0) {
      const firstSibling = $(nextSiblings[0]);
      if ((firstSibling.is('label, span, div') && firstSibling.text().trim()) || 
          (firstSibling.get(0).type === 'text' && firstSibling.text().trim())) {
        texts.push(firstSibling.text().trim());
      }
    }
  }
  
  // Return the first non-empty text found
  for (const item of texts) {
    if (item) {
      return item;
    }
  }
  
  return null;
}

module.exports = { extractCheckboxes };
