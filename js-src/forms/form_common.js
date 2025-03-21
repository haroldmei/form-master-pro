/**
 * Common utilities for form control extraction.
 */
const { getLogger } = require('../utils/logger');

const logger = getLogger('form_extract');

/**
 * Find label text for an input element
 * @param {Object} $ - Cheerio instance
 * @param {Object} element - Element to find label for
 * @returns {string|null} Label text or null if not found
 */
function findLabelFor($, element) {
  const elementId = $(element).attr('id');
  if (!elementId) {
    return null;
  }
  
  // Look for a label with matching 'for' attribute
  const label = $(`label[for="${elementId}"]`);
  if (label.length > 0) {
    // Clone the label to avoid modifying original
    const labelClone = label.clone();
    // Remove any child elements
    labelClone.find('*').remove();
    return labelClone.text().trim();
  }
  
  // If no direct label found, look for wrapping label
  const parent = $(element).parent('label');
  if (parent.length > 0) {
    try {
      // Clone label to avoid modifying original
      const parentClone = parent.clone();
      // Remove the input element from cloned label
      parentClone.find(`#${elementId}`).remove();
      return parentClone.text().trim();
    } catch (e) {
      // Log the error and continue with alternative approach
      logger.warning(`Error copying parent tag: ${e.message}`);
      // Alternative: extract text directly from parent
      const originalHtml = parent.html();
      const elementHtml = $(element).prop('outerHTML');
      if (originalHtml && originalHtml.includes(elementHtml)) {
        return parent.text().trim();
      }
    }
  }
  
  return null;
}

/**
 * Try to find a label for a group of form controls (like radio buttons)
 * @param {Object} $ - Cheerio instance
 * @param {string} groupName - Name of the control group
 * @returns {string|null} Group label or null if not found
 */
function findGroupLabel($, groupName) {
  // First try to find any element with the group name in title attributes
  const titleElements = $(`[title*="${groupName}" i]`);
  if (titleElements.length > 0) {
    return $(titleElements[0]).text().trim();
  }
  
  // Next look for legends in fieldsets
  const radios = $(`input[name="${groupName}"]`);
  for (let i = 0; i < radios.length; i++) {
    const fieldset = findParentByTag($, radios[i], 'fieldset');
    if (fieldset && fieldset.length > 0) {
      const legend = fieldset.find('legend');
      if (legend.length > 0) {
        return legend.text().trim();
      }
    }
  }
  
  // Finally, look for nearby labels or headings
  if (radios.length > 0) {
    const radio = $(radios[0]);
    const parent = radio.parent();
    if (parent.length > 0) {
      const prevSibling = parent.prev('label, h1, h2, h3, h4, h5, h6, p, div');
      if (prevSibling.length > 0 && ['label', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p'].includes(prevSibling.prop('tagName').toLowerCase())) {
        return prevSibling.text().trim();
      }
    }
  }
  
  return null;
}

/**
 * Find parent element with specific tag name
 * @param {Object} $ - Cheerio instance
 * @param {Object} element - Element to find parent for
 * @param {string} tagName - Tag name to look for
 * @returns {Object|null} Parent element or null if not found
 */
function findParentByTag($, element, tagName) {
  if (!element) {
    return null;
  }
  
  let parent = $(element).parent();
  while (parent.length > 0) {
    if (parent.prop('tagName') && parent.prop('tagName').toLowerCase() === tagName.toLowerCase()) {
      return parent;
    }
    parent = parent.parent();
  }
  
  return null;
}

/**
 * Get text that's associated with a form control but might not be in a formal label
 * @param {Object} $ - Cheerio instance
 * @param {Object} element - Element to find associated text for
 * @returns {string|null} Associated text or null if not found
 */
function getAssociatedText($, element) {
  const $element = $(element);
  
  // Check if there's a wrapping label that contains text directly
  const parent = $element.parent('label');
  if (parent.length > 0) {
    // Extract text but exclude nested elements
    const contents = parent.contents().filter(function() {
      return this.type === 'text';
    });
    
    if (contents.length > 0) {
      const textContent = contents.map((i, el) => $(el).text().trim()).get().join(' ');
      if (textContent) {
        return textContent.trim();
      }
    }
  }
  
  // Check for next sibling that might contain the text
  const nextSibling = $element.next();
  if (nextSibling.length > 0 && nextSibling[0].type === 'text' && nextSibling.text().trim()) {
    return nextSibling.text().trim();
  }
  
  // Look at parent's siblings for text
  if (parent.length > 0) {
    const nextSiblings = parent.nextAll('span, div, p');
    if (nextSiblings.length > 0) {
      const text = $(nextSiblings[0]).text().trim();
      if (text) {
        return text;
      }
    }
    
    const prevSiblings = parent.prevAll('span, div, p');
    if (prevSiblings.length > 0) {
      const text = $(prevSiblings[0]).text().trim();
      if (text) {
        return text;
      }
    }
  }
  
  // As a last resort, check parent for other text nodes
  if (parent.length > 0 && parent.parent().length > 0) {
    const textNodes = parent.parent().contents().filter(function() {
      return this.type === 'text' && $(this).text().trim();
    });
    
    if (textNodes.length > 0) {
      return $(textNodes[0]).text().trim();
    }
  }
  
  return null;
}

module.exports = {
  findLabelFor,
  findGroupLabel,
  findParentByTag,
  getAssociatedText
};
