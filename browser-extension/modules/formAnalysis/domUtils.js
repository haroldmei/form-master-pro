/**
 * Form Analysis V2 - DOM Utilities Module
 * Provides DOM manipulation and traversal utilities
 */
// Prevent redeclaration error by checking if the module already exists
if (typeof formAnalysisDomUtils === 'undefined') {
  const formAnalysisDomUtils = (() => {
    /**
     * Create a CSS selector path for an element
     * @param {HTMLElement} element - The DOM element
     * @returns {string} CSS selector path
     */
    function getElementPath(element) {
      if (!element || element === document.body) return '';
      
      let path = '';
      let current = element;
      
      while (current && current !== document.body) {
        let selector = current.tagName.toLowerCase();
        
        if (current.id) {
          selector += '#' + current.id;
        } else {
          // If no ID, use class or position among siblings
          if (current.className) {
            const classes = current.className.split(' ').filter(c => c.trim().length > 0);
            if (classes.length > 0) {
              selector += '.' + classes.join('.');
            }
          }
          
          // Add position if needed
          if (!current.id) {
            let index = 1;
            let sibling = current.previousElementSibling;
            
            while (sibling) {
              if (sibling.tagName === current.tagName) index++;
              sibling = sibling.previousElementSibling;
            }
            
            if (index > 1 || !current.className) {
              selector += `:nth-child(${index})`;
            }
          }
        }
        
        path = selector + (path ? ' > ' + path : '');
        current = current.parentElement;
      }
      
      return path;
    }
    
    /**
     * Get XPath for an element
     * @param {HTMLElement} element - The DOM element
     * @returns {string} XPath
     */
    function getElementXPath(element) {
      if (!element || element === document.body) return '';
      
      // Try to create a unique XPath using id
      if (element.id) {
        return `//*[@id="${element.id}"]`;
      }
      
      // Try to use other unique attributes if available
      if (element.name) {
        // For inputs, check if the name is unique
        const nameMatches = document.querySelectorAll(`*[name="${element.name}"]`);
        if (nameMatches.length === 1) {
          return `//*[@name="${element.name}"]`;
        }
      }
      
      // If element has a class, try to create a more specific XPath
      if (element.className && typeof element.className === 'string' && element.className.trim()) {
        const classes = element.className.trim().split(/\s+/);
        if (classes.length > 0) {
          // Use the first class as identifier and check if it's reasonably unique
          const classSelector = `//${element.nodeName}[contains(@class, "${classes[0]}")]`;
          try {
            const matches = document.evaluate(
              classSelector, 
              document, 
              null, 
              XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, 
              null
            );
            
            // If reasonably unique (fewer than 5 matches), use this class-based XPath
            if (matches.snapshotLength > 0 && matches.snapshotLength < 5) {
              // Add position if there are multiple elements with this class
              if (matches.snapshotLength > 1) {
                // Find our element's position
                for (let i = 0; i < matches.snapshotLength; i++) {
                  if (matches.snapshotItem(i) === element) {
                    return `(${classSelector})[${i + 1}]`;
                  }
                }
              }
              return classSelector;
            }
          } catch (e) {
            // If error, fall back to full path calculation
            console.error('XPath evaluation error:', e);
          }
        }
      }
      
      // Fall back to a relative path from a parent with ID or unique attribute
      let current = element;
      let path = '';
      
      while (current && current !== document.body) {
        if (current.id) {
          // Found ancestor with ID, create relative path from here
          return `//*[@id="${current.id}"]${path}`;
        }
        
        // Calculate position among siblings of same type
        let position = 1;
        let sibling = current.previousElementSibling;
        while (sibling) {
          if (sibling.nodeName === current.nodeName) {
            position++;
          }
          sibling = sibling.previousElementSibling;
        }
        
        // Append this node to the path
        const nodeName = current.nodeName;
        path = `/${nodeName}${position > 1 ? `[${position}]` : ''}${path}`;
        
        // Move up to parent
        current = current.parentElement;
      }
      
      // Return the relative path, not starting with / for document
      return `/${path}`;
    }
    
    /**
     * Find an element by XPath with fallbacks
     * @param {string} xpath - The XPath to evaluate
     * @param {Document} doc - The document context (defaults to current document)
     * @returns {HTMLElement|null} The found element or null
     */
    function findElementByXPath(xpath, doc = document) {
      if (!xpath) return null;
      
      // Try the exact XPath first
      try {
        const result = doc.evaluate(
          xpath,
          doc,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        );
        
        if (result.singleNodeValue) {
          return result.singleNodeValue;
        }
      } catch (e) {
        console.warn('Error evaluating exact XPath:', xpath, e);
      }
      
      // Try a case-insensitive version as fallback
      try {
        // Create a lowercase version of the XPath by replacing tag names
        const lowercaseXPath = xpath.replace(/\/([A-Z]+)(\[|\b|$)/g, function(match, p1, p2) {
          return '/' + p1.toLowerCase() + p2;
        });
        
        if (lowercaseXPath !== xpath) {
          const result = doc.evaluate(
            lowercaseXPath,
            doc,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
          );
          
          if (result.singleNodeValue) {
            console.log('Found element with lowercase XPath:', lowercaseXPath);
            return result.singleNodeValue;
          }
        }
      } catch (e) {
        console.warn('Error evaluating lowercase XPath fallback', e);
      }
      
      // If ID-based or attribute XPath, try to be more lenient with positioning
      if (xpath.includes('@id') || xpath.includes('@class')) {
        try {
          // Extract just the attribute part and create a more lenient selector
          const attrMatch = xpath.match(/@(\w+)="([^"]+)"/);
          if (attrMatch && attrMatch.length === 3) {
            const [_, attrName, attrValue] = attrMatch;
            const lenientXPath = `//*[@${attrName}="${attrValue}"]`;
            
            const result = doc.evaluate(
              lenientXPath,
              doc,
              null,
              XPathResult.FIRST_ORDERED_NODE_TYPE,
              null
            );
            
            if (result.singleNodeValue) {
              console.log('Found element with lenient attribute XPath:', lenientXPath);
              return result.singleNodeValue;
            }
          }
        } catch (e) {
          console.warn('Error evaluating lenient attribute XPath', e);
        }
      }
      
      return null;
    }
    
    /**
     * Find the common ancestor of multiple elements
     * @param {Array} elements - Array of DOM elements 
     * @returns {HTMLElement} The common ancestor element
     */
    function findCommonAncestor(elements) {
      // Validate input
      if (!elements || !Array.isArray(elements) || elements.length === 0) {
        console.warn('Invalid elements array provided to findCommonAncestor');
        return document.body;
      }

      // Filter out any null/undefined elements
      const validElements = elements.filter(el => el && el.nodeType === Node.ELEMENT_NODE);
      
      if (validElements.length === 0) {
        console.warn('No valid elements found in array');
        return document.body;
      }
      
      if (validElements.length === 1) {
        return validElements[0].parentElement || document.body;
      }
      
      // Get all ancestors of the first element
      const firstElementAncestors = [];
      let parent = validElements[0].parentElement;
      
      while (parent && parent !== document.body && parent !== document.documentElement) {
        firstElementAncestors.push(parent);
        parent = parent.parentElement;
      }
      
      if (firstElementAncestors.length === 0) {
        return document.body;
      }
      
      // Find the closest common ancestor
      for (let ancestor of firstElementAncestors) {
        let isCommonAncestor = true;
        
        // Check if this ancestor contains all other elements
        for (let i = 1; i < validElements.length; i++) {
          if (!ancestor.contains(validElements[i])) {
            isCommonAncestor = false;
            break;
          }
        }
        
        if (isCommonAncestor) {
          return ancestor;
        }
      }
      
      // Default to body if no common ancestor found
      return document.body;
    }
    
    return {
      getElementPath,
      getElementXPath,
      findElementByXPath,
      findCommonAncestor
    };
  })();

  // Expose the module to the global scope
  self.formAnalysisDomUtils = formAnalysisDomUtils;
} 