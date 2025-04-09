// FormRadios.js

// Add function to check if an element is hidden
function isElementHidden(element) {
  if (!element) return true;
  
  // Check element's own visibility
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return true;
  }
  
  // Check if element has zero dimensions
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    return true;
  }
  
  // Check if element is detached from DOM
  if (!document.body.contains(element)) {
    return true;
  }
  
  // Check if any parent is hidden
  let parent = element.parentElement;
  while (parent) {
    const parentStyle = window.getComputedStyle(parent);
    if (parentStyle.display === 'none' || parentStyle.visibility === 'hidden' || parentStyle.opacity === '0') {
      return true;
    }
    parent = parent.parentElement;
  }
  
  return false;
}

function extractRadioGroups(container) {
  try {
    console.log('FormRadios.extractRadioGroups called with container:', container);
    
    // Create a map to group radio buttons by name
    const groups = {};
    const radioButtons = container.querySelectorAll('input[type="radio"]');
    
    console.log(`Found ${radioButtons.length} radio buttons in container`);
    
    // First pass: gather all radio buttons by name and find common container for each group
    radioButtons.forEach(radio => {
      const name = radio.name || '';
      if (!name) {
        console.log('Skipping radio button without name attribute:', radio);
        return;
      }
      
      // Skip hidden radio buttons
      if (isElementHidden(radio)) {
        console.log(`Skipping hidden radio button: ${radio.id || radio.name}`);
        return;
      }
      
      if (!groups[name]) {
        // Create new radio group and capture all identifying attributes
        groups[name] = {
          type: 'radio',
          name: name,
          id: `radio_group_${name}`, // Generate group ID from name
          label: getRadioGroupLabel(radio) || name,
          className: '', // Initialize className for the group
          class: '', // Initialize class attribute for the group
          hidden: false,
          options: []
        };
        console.log(`Created new radio group with name "${name}"`);
      }
      
      // Add this radio button to its group
      groups[name].options.push({
        type: 'radio', // Add explicit type
        id: radio.id || '',
        name: radio.name || '',
        value: radio.value || '',
        className: radio.className || '',
        class: radio.getAttribute('class') || '', // Add explicit class attribute
        checked: radio.checked,
        label: getRadioElementLabel(radio),
        hidden: false // It's visible since we're filtering hidden elements
      });
      
      // Update the group's classes - collect classes from all radio buttons
      if (radio.className && !groups[name].className.includes(radio.className)) {
        groups[name].className += (groups[name].className ? ' ' : '') + radio.className;
        groups[name].class += (groups[name].class ? ' ' : '') + (radio.getAttribute('class') || '');
      }
      
      console.log(`Added option "${radio.value}" to group "${name}", total options: ${groups[name].options.length}`);
    });
    
    // Only keep groups that have at least one visible radio button
    Object.keys(groups).forEach(name => {
      if (groups[name].options.length === 0) {
        delete groups[name];
      }
    });
    
    // Try to find a common container ID for each radio group
    for (const name in groups) {
      const group = groups[name];
      
      // Try to find common container for all radio buttons in this group
      const radios = Array.from(document.querySelectorAll(`input[type="radio"][name="${CSS.escape(name)}"]`));
      if (radios.length > 1) {
        // Find common ancestor element for these radio buttons
        let commonAncestor = radios[0].parentElement;
        let foundCommon = false;
        
        // Search up to 5 levels for a common container
        for (let level = 0; level < 5 && !foundCommon && commonAncestor; level++) {
          if (radios.every(radio => commonAncestor.contains(radio))) {
            foundCommon = true;
            // If common ancestor has ID, use it for the group
            if (commonAncestor.id) {
              group.id = commonAncestor.id;
            }
            
            // Add classes from the common container
            if (commonAncestor.className) {
              group.className += (group.className ? ' ' : '') + commonAncestor.className;
              group.class += (group.class ? ' ' : '') + (commonAncestor.getAttribute('class') || '');
            }
          } else {
            commonAncestor = commonAncestor.parentElement;
          }
        }
      }
    }
    
    // Convert the groups object to an array
    const result = Object.values(groups);
    console.log(`Extracted ${result.length} radio groups with options counts:`, 
                result.map(g => `${g.name}: ${g.options.length} options`));
    
    return result;
  } catch (error) {
    console.error('Error in FormRadios.extractRadioGroups:', error);
    return [];
  }
}

function getRadioElementLabel(element) {
  // Try to find a label by for attribute
  if (element.id) {
    const labelElement = document.querySelector(`label[for="${element.id}"]`);
    if (labelElement) {
      return labelElement.textContent.trim();
    }
  }
  
  // Try to find a parent label
  let parent = element.parentElement;
  while (parent) {
    if (parent.tagName === 'LABEL') {
      // Extract text but exclude the radio button's value
      let labelText = parent.textContent.trim();
      // if (element.value && labelText.includes(element.value)) {
      //   labelText = labelText.replace(element.value, '').trim();
      // }
      // return labelText;
      return element.value || labelText;
    }
    parent = parent.parentElement;
  }
  
  // Try to find adjacent label or text
  const nextSibling = element.nextSibling;
  if (nextSibling && nextSibling.nodeType === 3) { // Text node
    return nextSibling.textContent.trim();
  }
  
  const nextElement = element.nextElementSibling;
  if (nextElement && nextElement.tagName === 'LABEL') {
    return nextElement.textContent.trim();
  }
  
  return element.value || ''; // Fall back to value as last resort
}

function detectStructuredRadioGroup(radioElement) {
  try {
    if (!radioElement.name) return null;
    
    // Find all radio buttons with the same name
    const radioName = radioElement.name;
    const allRadios = Array.from(
      document.querySelectorAll(`input[type="radio"][name="${CSS.escape(radioName)}"]`)
    );
    
    if (allRadios.length === 0) return null;
    
    // Find common ancestor for all these radio buttons
    let commonAncestor = allRadios[0].parentElement;
    let foundCommon = false;
    
    // Search up to 6 levels for a common container
    for (let level = 0; level < 6 && !foundCommon && commonAncestor; level++) {
      // Check if this container contains all radio buttons
      if (allRadios.every(radio => commonAncestor.contains(radio))) {
        foundCommon = true;
      } else {
        commonAncestor = commonAncestor.parentElement;
      }
    }
    
    if (!commonAncestor) return null;
    
    console.log(`Found common ancestor for radio group "${radioName}":`, commonAncestor);
    
    // ENHANCEMENT: Look for parent with role="radiogroup" and aria-labelledby
    let currentAncestor = commonAncestor;
    for (let i = 0; i < 3 && currentAncestor; i++) { // Check up to 3 levels up
      if (currentAncestor.getAttribute('role') === 'radiogroup') {
        const labelledById = currentAncestor.getAttribute('aria-labelledby');
        if (labelledById) {
          const labelElement = document.getElementById(labelledById);
          if (labelElement) {
            const text = labelElement.textContent.trim();
            console.log(`Found role="radiogroup" with aria-labelledby element: "${text}"`);
            return text;
          }
        }
        
        // If no aria-labelledby but has aria-label
        const ariaLabel = currentAncestor.getAttribute('aria-label');
        if (ariaLabel) {
          console.log(`Found role="radiogroup" with aria-label: "${ariaLabel}"`);
          return ariaLabel;
        }
      }
      currentAncestor = currentAncestor.parentElement;
    }
    
    // Look for a direct child label that isn't associated with any specific radio
    const directLabels = Array.from(commonAncestor.children).filter(child => 
      child.tagName === 'LABEL' && 
      (!child.getAttribute('for') || 
       !allRadios.some(radio => radio.id === child.getAttribute('for')))
    );
    
    if (directLabels.length > 0) {
      const labelText = directLabels[0].textContent.trim();
      console.log(`Found direct label for structured radio group: "${labelText}"`);
      return labelText;
    }
    
    // NEW: Look for label in parent structure (for form groups with nested divs)
    // This handles cases like <div><label>Group Label</label><div><!-- radios here --></div></div>
    const parentElement = commonAncestor.parentElement;
    if (parentElement) {
      // Check for direct label children of the parent
      const parentLabelElements = Array.from(parentElement.children).filter(child => 
        child.tagName === 'LABEL' &&
        (!child.getAttribute('for') || 
         !allRadios.some(radio => radio.id === child.getAttribute('for')))
      );
      
      if (parentLabelElements.length > 0) {
        const labelText = parentLabelElements[0].textContent.trim();
        console.log(`Found parent-level label for structured radio group: "${labelText}"`);
        return labelText;
      }
      
      // Look for a grandparent container (handles double-nested inline radio groups)
      const grandParentElement = parentElement.parentElement;
      if (grandParentElement) {
        // Try to find labels that are siblings to the parent element
        const children = Array.from(grandParentElement.children);
        const parentIndex = children.indexOf(parentElement);
        
        if (parentIndex > 0) {
          // Check if any previous siblings are labels
          for (let i = 0; i < parentIndex; i++) {
            const sibling = children[i];
            if (sibling.tagName === 'LABEL' && 
                (!sibling.getAttribute('for') || 
                 !allRadios.some(radio => radio.id === sibling.getAttribute('for')))) {
              const labelText = sibling.textContent.trim();
              console.log(`Found grandparent-level label for structured radio group: "${labelText}"`);
              return labelText;
            }
          }
        }
      }
    }
    
    // Pattern: Look for a text node or element before the first container with a radio
    // This handles cases where the label is a sibling of the containers that hold radios
    const radioContainers = allRadios.map(radio => {
      let container = radio;
      // Find the immediate child of the common ancestor that contains this radio
      while (container.parentElement !== commonAncestor && container.parentElement) {
        container = container.parentElement;
      }
      return container;
    });
    
    // Get unique containers (might be the same for multiple radios)
    const uniqueContainers = [...new Set(radioContainers)];
    
    // Now check all children of the common ancestor
    const allChildren = Array.from(commonAncestor.children);
    for (let i = 0; i < allChildren.length; i++) {
      const child = allChildren[i];
      
      // If this child contains a radio, skip it
      if (uniqueContainers.includes(child)) continue;
      
      // If this child is a text element or label before the first radio container
      if (child.tagName === 'LABEL' || 
          child.tagName === 'SPAN' || 
          child.tagName === 'DIV' && !child.querySelector('input[type="radio"]')) {
        const text = child.textContent.trim();
        if (text && text.length < 150) {  // Limit to reasonable label length
          console.log(`Found potential label preceding radio containers: "${text}"`);
          return text;
        }
      }
      
      // If we've passed the first radio container, stop looking
      if (i > 0 && uniqueContainers.includes(allChildren[i])) break;
    }
    
    // NEW: Check if any element within the common ancestor has the role="radiogroup"
    const radioGroup = commonAncestor.querySelector('[role="radiogroup"]');
    if (radioGroup) {
      const labelledById = radioGroup.getAttribute('aria-labelledby');
      if (labelledById) {
        const labelElement = document.getElementById(labelledById);
        if (labelElement) {
          const text = labelElement.textContent.trim();
          console.log(`Found nested role="radiogroup" with aria-labelledby: "${text}"`);
          return text;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error in detectStructuredRadioGroup:', error);
    return null;
  }
}

function getRadioGroupLabel(radioElement) {
  try {
    console.log('Trying to find label for radio group:', radioElement.name);
    
    // First try to find a fieldset legend
    let parent = radioElement.parentElement;
    let depth = 0;
    const maxDepth = 5; // Limit how far up we search to avoid performance issues
    
    while (parent && depth < maxDepth) {
      if (parent.tagName === 'FIELDSET') {
        const legend = parent.querySelector('legend');
        if (legend) {
          const text = legend.textContent.trim();
          console.log(`Found fieldset legend: "${text}"`);
          return text;
        }
        break;
      }
      parent = parent.parentElement;
      depth++;
    }
    
    // ENHANCEMENT: Try to find ARIA labelledby directly on parent elements
    parent = radioElement.parentElement;
    depth = 0;
    while (parent && depth < 4) {
      // Check if this element or any parent has role="radiogroup"
      if (parent.getAttribute('role') === 'radiogroup') {
        const labelledById = parent.getAttribute('aria-labelledby');
        if (labelledById) {
          const labelElement = document.getElementById(labelledById);
          if (labelElement) {
            const text = labelElement.textContent.trim();
            console.log(`Found direct role="radiogroup" with aria-labelledby: "${text}"`);
            return text;
          }
        }
      }
      parent = parent.parentElement;
      depth++;
    }
    
    // Try to detect structured radio group (like the example)
    const structuredGroupLabel = detectStructuredRadioGroup(radioElement);
    if (structuredGroupLabel) {
      console.log(`Found structured group label: "${structuredGroupLabel}"`);
      return structuredGroupLabel;
    }
    
    // Look for Bootstrap form-group pattern with label preceding radio group
    parent = radioElement.parentElement;
    depth = 0;
    
    while (parent && depth < 6) {
      // Check for Bootstrap's form-group pattern
      if (parent.classList.contains('form-group')) {
        // Look for direct label child at the beginning of form-group
        const directLabel = parent.querySelector(':scope > label');
        if (directLabel) {
          const text = directLabel.textContent.trim();
          console.log(`Found Bootstrap form-group direct label: "${text}"`);
          return text;
        }
      }
      
      // 1. Check if this is any kind of form group container (regardless of class name)
      // Look for structural hints rather than specific classes
      const isFormGroup = 
        // Has label + control arrangement
        (parent.querySelector('label') && parent.querySelectorAll('input, select, textarea').length > 0) ||
        // Has typical form group structure (regardless of class names)
        (parent.children.length >= 2 && 
         Array.from(parent.children).some(el => el.tagName === 'LABEL' || 
                                         el.querySelector('label'))) ||
        // Has form group related classes (using partial matching for flexibility)
        Array.from(parent.classList).some(cls => 
          /form|group|field|control|row/i.test(cls)
        );
      
      if (isFormGroup) {
        console.log('Found potential form group container:', parent);
        
        // Enhanced: Look for standalone label that is direct child of form group
        const directLabels = Array.from(parent.children).filter(
          child => child.tagName === 'LABEL' && 
                  !child.querySelector('input[type="radio"]')
        );
        
        if (directLabels.length > 0) {
          const text = directLabels[0].textContent.trim();
          console.log(`Found direct label in form group: "${text}"`);
          return text;
        }
        
        // Look for standalone labels that could be group headers
        // Query all labels and filter out those that contain radio buttons
        const allLabels = Array.from(parent.querySelectorAll('label'));
        const standaloneLabels = allLabels.filter(label => !label.querySelector('input[type="radio"]'));
        
        // Among standalone labels, prioritize those that:
        // 1. Are direct children of the form group
        // 2. Appear before the radio buttons
        // 3. Have certain common structural patterns
        for (const criteria of [
          // Direct children with common label class patterns
          label => label.parentNode === parent && 
                  Array.from(label.classList).some(cls => /label|caption|header|title/i.test(cls)),
          // Any standalone label positioned before the first radio
          label => !radioElement.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING,
          // Any label without a "for" attribute (likely a group label)
          label => !label.hasAttribute('for'),
          // Any remaining standalone label
          label => true
        ]) {
          const matchedLabel = standaloneLabels.find(criteria);
          if (matchedLabel) {
            const text = matchedLabel.textContent.trim();
            console.log(`Found standalone label: "${text}"`);
            return text;
          }
        }
        
        // If no standalone labels found, try looking for heading elements or other descriptive text
        const descriptiveElements = parent.querySelectorAll('h1, h2, h3, h4, h5, h6, legend, caption, [aria-label]');
        for (const elem of descriptiveElements) {
          // Use aria-label if available, otherwise use text content
          const text = elem.getAttribute('aria-label') || elem.textContent.trim();
          if (text) {
            console.log(`Found descriptive element: "${text}"`);
            return text;
          }
        }
        
        // Look for any element with "label" or "title" in its class or role
        const potentialLabelElements = Array.from(parent.querySelectorAll('*')). filter(
          el => Array.from(el.classList).some(cls => /label|title|caption|head/i.test(cls)) ||
               el.getAttribute('role') === 'heading' ||
               el.getAttribute('aria-labelledby')
        );
        
        for (const elem of potentialLabelElements) {
          const text = elem.textContent.trim();
          if (text && !text.includes(radioElement.value)) {
            console.log(`Found element with label-like class: "${text}"`);
            return text;
          }
        }
      }
      
      parent = parent.parentElement;
      depth++;
    }
    
    // Try to find a common heading or label for the radio group
    const name = radioElement.name;
    if (!name) {
      console.log('Radio button has no name attribute');
      return '';
    }
    
    // Get all radio buttons with the same name
    const selector = `input[type="radio"][name="${CSS.escape(name)}"]`;
    console.log(`Looking for radio buttons with selector: ${selector}`);
    const radioGroup = Array.from(document.querySelectorAll(selector));
    console.log(`Found ${radioGroup.length} radio buttons in group "${name}"`);
    
    if (radioGroup.length > 0) {
      // Try these approaches in sequence:
      
      // 1. Look for aria-labelledby attribute
      for (const radio of radioGroup) {
        const labelledBy = radio.getAttribute('aria-labelledby');
        if (labelledBy) {
          const labelElement = document.getElementById(labelledBy);
          if (labelElement) {
            const text = labelElement.textContent.trim();
            console.log(`Found aria-labelledby label: "${text}"`);
            return text;
          }
        }
      }
      
      // 2. Look for a parent element with role="radiogroup" and aria-label
      for (const radio of radioGroup) {
        let el = radio.parentElement;
        let searchDepth = 0;
        while (el && searchDepth < 4) {
          if (el.getAttribute('role') === 'radiogroup') {
            const ariaLabel = el.getAttribute('aria-label');
            if (ariaLabel) {
              console.log(`Found role="radiogroup" with aria-label: "${ariaLabel}"`);
              return ariaLabel;
            }
            break;
          }
          el = el.parentElement;
          searchDepth++;
        }
      }
      
      // 3. Find the first radio button in the DOM
      const firstRadio = radioGroup.reduce((first, current) => {
        try {
          return document.compareDocumentPosition(current) & Node.DOCUMENT_POSITION_PRECEDING ? current : first;
        } catch (e) {
          console.error('Error comparing DOM positions:', e);
          return first;
        }
      }, radioGroup[0]);
      
      // 4. Look for a heading, label, or emphasized text above the first radio
      if (firstRadio) {
        console.log('Searching above first radio button for labels');
        
        // Check for a heading above the group
        let element = firstRadio;
        while (element && element.previousElementSibling) {
          const prev = element.previousElementSibling;
          
          // Check if it's a heading
          if (/^H[1-6]$/.test(prev.tagName)) {
            const text = prev.textContent.trim();
            console.log(`Found heading above group: "${text}"`);
            return text;
          }
          
          // Check for label/div with strong/b elements
          if (['DIV', 'P', 'LABEL', 'SPAN'].includes(prev.tagName)) {
            // Check for emphasized text
            const emphasized = prev.querySelector('strong, b, label, .form-label, .control-label');
            if (emphasized) {
              const text = emphasized.textContent.trim();
              console.log(`Found emphasized text above group: "${text}"`);
              return text;
            }
            
            // If close to radio and has text but no child inputs, might be a label
            const hasInputs = prev.querySelector('input, select, textarea, button');
            if (!hasInputs && prev.textContent.trim().length > 0) {
              const text = prev.textContent.trim();
              console.log(`Found potential text label above group: "${text}"`);
              return text;
            }
          }
          
          element = prev;
        }
        
        // 5. Look for a common parent with a label-like child
        parent = firstRadio.parentElement;
        depth = 0;
        while (parent && depth < 3) {
          // Check if any children might be labels
          const labelCandidates = parent.querySelectorAll('label, .form-label, .control-label, legend');
          for (const labelEl of labelCandidates) {
            // Make sure this label doesn't belong to a specific radio button
            const forAttr = labelEl.getAttribute('for');
            if (!forAttr || !document.getElementById(forAttr)) {
              const text = labelEl.textContent.trim();
              if (text) {
                console.log(`Found potential parent label: "${text}"`);
                return text;
              }
            }
          }
          parent = parent.parentElement;
          depth++;
        }
      }
    }
    
    // Handle Bootstrap inline radio case with shared parent div
    const radioName = radioElement.name;
    if (radioName) {
      // Get parent container of all radios with this name
      const allRadiosWithSameName = document.querySelectorAll(`input[type="radio"][name="${CSS.escape(radioName)}"]`);
      if (allRadiosWithSameName.length > 0) {
        // Find common ancestor that contains all radio buttons
        let commonParent = allRadiosWithSameName[0].parentElement;
        let foundCommon = false;
        
        while (commonParent && !foundCommon) {
          const containsAll = Array.from(allRadiosWithSameName).every(radio => 
            commonParent.contains(radio)
          );
          
          if (containsAll) {
            foundCommon = true;
            // Look for a label that is a sibling or direct child of the parent
            const parentContainer = commonParent.parentElement;
            if (parentContainer) {
              // Try to find label as a direct child of parent container
              const containerLabels = Array.from(parentContainer.children). filter(
                child => child.tagName === 'LABEL'
              );
              
              if (containerLabels.length > 0) {
                const text = containerLabels[0].textContent.trim();
                console.log(`Found label in common parent container: "${text}"`);
                return text;
              }
            }
          } else {
            commonParent = commonParent.parentElement;
          }
        }
      }
    }

    // Default: if no label found, use the name attribute with formatting
    const formattedName = name
      .replace(/([A-Z])/g, ' $1') // Add spaces before capital letters
      .replace(/[-_]/g, ' ')      // Replace dashes and underscores with spaces
      .replace(/^\w/, c => c.toUpperCase()); // Capitalize first letter
      
    console.log(`No label found, using formatted name: "${formattedName}"`);
    return formattedName;
  } catch (error) {
    console.error('Error in getRadioGroupLabel:', error);
    return radioElement.name || '';
  }
}

function getRadioGroupValues(container = document.body) {
  const values = {};
  const radioGroups = extractRadioGroups(container);
  
  radioGroups.forEach(group => {
    const selectedOption = group.options.find(opt => opt.checked);
    values[group.name] = selectedOption ? selectedOption.value : null;
  });
  
  return values;
}

// Export functions in a way that works in browser context
self.FormRadios = {
  extractRadioGroups,
  getRadioElementLabel,
  getRadioGroupLabel,
  getRadioGroupValues,
  isElementHidden // Export the visibility check function for potential reuse
};
