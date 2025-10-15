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
      
      const isHidden = isElementHidden(radio);
      
      if (!groups[name]) {
        // Create new radio group and capture all identifying attributes
        groups[name] = {
          type: 'radio',
          name: name,
          id: `radio_group_${name}`, // Generate group ID from name
          label: getRadioGroupLabel(radio) || name,
          className: '', // Initialize className for the group
          class: '', // Initialize class attribute for the group
          ariaLabel: '',  // Initialize ariaLabel for the group
          ariaLabelledBy: '', // Initialize ariaLabelledBy for the group
          hidden: false, // Will be updated based on all radio buttons in the group
          options: []
        };
        console.log(`Created new radio group with name "${name}"`);
        
        // Check for common aria attributes on a parent radiogroup role
        let parent = radio.parentElement;
        while (parent && parent.tagName !== 'FORM' && parent.tagName !== 'BODY') {
          if (parent.getAttribute('role') === 'radiogroup') {
            groups[name].ariaLabel = parent.getAttribute('aria-label') || '';
            groups[name].ariaLabelledBy = parent.getAttribute('aria-labelledby') || '';
            break;
          }
          parent = parent.parentElement;
        }
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
        ariaLabel: radio.getAttribute('aria-label') || '',
        ariaLabelledBy: radio.getAttribute('aria-labelledby') || '',
        hidden: isHidden // Include visibility info but don't filter
      });
      
      // Update the group's classes - collect classes from all radio buttons
      if (radio.className && !groups[name].className.includes(radio.className)) {
        groups[name].className += (groups[name].className ? ' ' : '') + radio.className;
        groups[name].class += (groups[name].class ? ' ' : '') + (radio.getAttribute('class') || '');
      }
      
      // Update group's hidden status - if at least one option is visible, the group is visible
      if (!isHidden) {
        groups[name].hidden = false;
      }
      
      console.log(`Added option "${radio.value}" to group "${name}", total options: ${groups[name].options.length}`);
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
  // First check for ARIA labeling
  const ariaLabelledBy = element.getAttribute('aria-labelledby');
  if (ariaLabelledBy) {
    const labelElement = document.getElementById(ariaLabelledBy);
    if (labelElement) {
      return labelElement.textContent.trim();
    }
  }
  
  // Check for direct aria-label attribute
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) {
    return ariaLabel.trim();
  }
  
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
      let labelText = parent.textContent.trim();
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
    
    const radioName = radioElement.name;
    const allRadios = Array.from(
      document.querySelectorAll(`input[type="radio"][name="${CSS.escape(radioName)}"]`)
    );
    
    if (allRadios.length === 0) return null;
    
    let commonAncestor = allRadios[0].parentElement;
    let foundCommon = false;
    
    for (let level = 0; level < 6 && !foundCommon && commonAncestor; level++) {
      if (allRadios.every(radio => commonAncestor.contains(radio))) {
        foundCommon = true;
      } else {
        commonAncestor = commonAncestor.parentElement;
      }
    }
    
    if (!commonAncestor) return null;
    
    console.log(`Found common ancestor for radio group "${radioName}":`, commonAncestor);
    
    let currentAncestor = commonAncestor;
    for (let i = 0; i < 3 && currentAncestor; i++) {
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
        
        const ariaLabel = currentAncestor.getAttribute('aria-label');
        if (ariaLabel) {
          console.log(`Found role="radiogroup" with aria-label: "${ariaLabel}"`);
          return ariaLabel;
        }
      }
      currentAncestor = currentAncestor.parentElement;
    }
    
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
    
    const parentElement = commonAncestor.parentElement;
    if (parentElement) {
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
      
      const grandParentElement = parentElement.parentElement;
      if (grandParentElement) {
        const children = Array.from(grandParentElement.children);
        const parentIndex = children.indexOf(parentElement);
        
        if (parentIndex > 0) {
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
    
    const radioContainers = allRadios.map(radio => {
      let container = radio;
      while (container.parentElement !== commonAncestor && container.parentElement) {
        container = container.parentElement;
      }
      return container;
    });
    
    const uniqueContainers = [...new Set(radioContainers)];
    
    const allChildren = Array.from(commonAncestor.children);
    for (let i = 0; i < allChildren.length; i++) {
      const child = allChildren[i];
      
      if (uniqueContainers.includes(child)) continue;
      
      if (child.tagName === 'LABEL' || 
          child.tagName === 'SPAN' || 
          child.tagName === 'DIV' && !child.querySelector('input[type="radio"]')) {
        const text = child.textContent.trim();
        if (text && text.length < 150) {
          console.log(`Found potential label preceding radio containers: "${text}"`);
          return text;
        }
      }
      
      if (i > 0 && uniqueContainers.includes(allChildren[i])) break;
    }
    
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
    
    let element = radioElement;
    let parent = element.parentElement;
    let depth = 0;
    
    while (parent && depth < 6) {
      if (parent.getAttribute('role') === 'radiogroup') {
        const labelledById = parent.getAttribute('aria-labelledby');
        if (labelledById) {
          const labelElement = document.getElementById(labelledById);
          if (labelElement) {
            const text = labelElement.textContent.trim();
            console.log(`Found role="radiogroup" with aria-labelledby: "${text}"`);
            return text;
          }
        }
        
        const ariaLabel = parent.getAttribute('aria-label');
        if (ariaLabel) {
          console.log(`Found role="radiogroup" with aria-label: "${ariaLabel}"`);
          return ariaLabel;
        }
      }
      
      parent = parent.parentElement;
      depth++;
    }
    
    parent = radioElement.parentElement;
    depth = 0;
    const maxDepth = 5;
    
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
    
    const structuredGroupLabel = detectStructuredRadioGroup(radioElement);
    if (structuredGroupLabel) {
      console.log(`Found structured group label: "${structuredGroupLabel}"`);
      return structuredGroupLabel;
    }
    
    parent = radioElement.parentElement;
    depth = 0;
    
    while (parent && depth < 6) {
      if (parent.classList.contains('form-group')) {
        const directLabel = parent.querySelector(':scope > label');
        if (directLabel) {
          const text = directLabel.textContent.trim();
          console.log(`Found Bootstrap form-group direct label: "${text}"`);
          return text;
        }
      }
      
      const isFormGroup = 
        (parent.querySelector('label') && parent.querySelectorAll('input, select, textarea').length > 0) ||
        (parent.children.length >= 2 && 
         Array.from(parent.children).some(el => el.tagName === 'LABEL' || 
                                         el.querySelector('label'))) ||
        Array.from(parent.classList).some(cls => 
          /form|group|field|control|row/i.test(cls)
        );
      
      if (isFormGroup) {
        console.log('Found potential form group container:', parent);
        
        const directLabels = Array.from(parent.children).filter(
          child => child.tagName === 'LABEL' && 
                  !child.querySelector('input[type="radio"]')
        );
        
        if (directLabels.length > 0) {
          const text = directLabels[0].textContent.trim();
          console.log(`Found direct label in form group: "${text}"`);
          return text;
        }
        
        const allLabels = Array.from(parent.querySelectorAll('label'));
        const standaloneLabels = allLabels.filter(label => !label.querySelector('input[type="radio"]'));
        
        for (const criteria of [
          label => label.parentNode === parent && 
                  Array.from(label.classList).some(cls => /label|caption|header|title/i.test(cls)),
          label => !radioElement.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING,
          label => !label.hasAttribute('for'),
          label => true
        ]) {
          const matchedLabel = standaloneLabels.find(criteria);
          if (matchedLabel) {
            const text = matchedLabel.textContent.trim();
            console.log(`Found standalone label: "${text}"`);
            return text;
          }
        }
        
        const descriptiveElements = parent.querySelectorAll('h1, h2, h3, h4, h5, h6, legend, caption, [aria-label]');
        for (const elem of descriptiveElements) {
          const text = elem.getAttribute('aria-label') || elem.textContent.trim();
          if (text) {
            console.log(`Found descriptive element: "${text}"`);
            return text;
          }
        }
        
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
    
    const name = radioElement.name;
    if (!name) {
      console.log('Radio button has no name attribute');
      return '';
    }
    
    const selector = `input[type="radio"][name="${CSS.escape(name)}"]`;
    console.log(`Looking for radio buttons with selector: ${selector}`);
    const radioGroup = Array.from(document.querySelectorAll(selector));
    console.log(`Found ${radioGroup.length} radio buttons in group "${name}"`);
    
    if (radioGroup.length > 0) {
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
      
      const firstRadio = radioGroup.reduce((first, current) => {
        try {
          return document.compareDocumentPosition(current) & Node.DOCUMENT_POSITION_PRECEDING ? current : first;
        } catch (e) {
          console.error('Error comparing DOM positions:', e);
          return first;
        }
      }, radioGroup[0]);
      
      if (firstRadio) {
        console.log('Searching above first radio button for labels');
        
        let element = firstRadio;
        while (element && element.previousElementSibling) {
          const prev = element.previousElementSibling;
          
          if (/^H[1-6]$/.test(prev.tagName)) {
            const text = prev.textContent.trim();
            console.log(`Found heading above group: "${text}"`);
            return text;
          }
          
          if (['DIV', 'P', 'LABEL', 'SPAN'].includes(prev.tagName)) {
            const emphasized = prev.querySelector('strong, b, label, .form-label, .control-label');
            if (emphasized) {
              const text = emphasized.textContent.trim();
              console.log(`Found emphasized text above group: "${text}"`);
              return text;
            }
            
            const hasInputs = prev.querySelector('input, select, textarea, button');
            if (!hasInputs && prev.textContent.trim().length > 0) {
              const text = prev.textContent.trim();
              console.log(`Found potential text label above group: "${text}"`);
              return text;
            }
          }
          
          element = prev;
        }
        
        parent = firstRadio.parentElement;
        depth = 0;
        while (parent && depth < 3) {
          const labelCandidates = parent.querySelectorAll('label, .form-label, .control-label, legend');
          for (const labelEl of labelCandidates) {
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
    
    const radioName = radioElement.name;
    if (radioName) {
      const allRadiosWithSameName = document.querySelectorAll(`input[type="radio"][name="${CSS.escape(radioName)}"]`);
      if (allRadiosWithSameName.length > 0) {
        let commonParent = allRadiosWithSameName[0].parentElement;
        let foundCommon = false;
        
        while (commonParent && !foundCommon) {
          const containsAll = Array.from(allRadiosWithSameName).every(radio => 
            commonParent.contains(radio)
          );
          
          if (containsAll) {
            foundCommon = true;
            const parentContainer = commonParent.parentElement;
            if (parentContainer) {
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

    const formattedName = name
      .replace(/([A-Z])/g, ' $1')
      .replace(/[-_]/g, ' ')
      .replace(/^\w/, c => c.toUpperCase());
      
    console.log(`No label found, using formatted name: "${formattedName}"`);
    return formattedName;
  } catch (error) {
    console.error('Error in getRadioGroupLabel:', error);
    return radioElement.name || '';
  }
}

self.FormRadios = {
  extractRadioGroups,
  getRadioElementLabel,
  getRadioGroupLabel,
  isElementHidden
};
