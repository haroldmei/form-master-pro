/**
 * Checkbox Group Extraction Module
 * Identifies and extracts groups of related checkboxes in forms
 */

function extractCheckboxGroups(container) {
  // First, try to directly match common patterns like Bootstrap checkbox groups
  const directMatches = extractBootstrapCheckboxGroups(container);
  if (directMatches.length > 0) {
    console.log(`Found ${directMatches.length} directly matched checkbox groups`);
    return directMatches;
  }
  
  // Continue with the generic approach if no direct matches
  const checkboxGroups = {};
  const checkboxElements = container.querySelectorAll('input[type="checkbox"]');
  
  console.log(`Found ${checkboxElements.length} checkboxes in container`);
  
  // First pass: group checkboxes by their name attribute
  checkboxElements.forEach(checkbox => {
    const name = checkbox.name || '';
    if (name) {
      if (!checkboxGroups[name]) {
        checkboxGroups[name] = [];
      }
      
      // Get the direct label for this checkbox option
      const optionLabel = getCheckboxOptionLabel(checkbox);
      
      checkboxGroups[name].push({
        id: checkbox.id || '',
        value: checkbox.value || '',
        checked: checkbox.checked,
        label: optionLabel
      });
      
      console.log(`Added checkbox with name: ${name}, id: ${checkbox.id}, label: ${optionLabel}`);
    }
  });
  
  console.log('Checkboxes grouped by name:', Object.keys(checkboxGroups));
  
  // Second pass: identify structural groups even if names are different
  const structuralGroups = identifyStructuralCheckboxGroups(container);
  console.log(`Found ${structuralGroups.length} structural checkbox groups`);
  
  for (const group of structuralGroups) {
    if (!checkboxGroups[group.name]) {
      checkboxGroups[group.name] = [];
    }
    
    // Add any checkboxes not already included
    for (const option of group.options) {
      const existingOption = checkboxGroups[group.name].find(o => o.id === option.id);
      if (!existingOption) {
        checkboxGroups[group.name].push(option);
      }
    }
  }
  
  // Convert to array and determine the group label
  const result = [];
  for (const [name, options] of Object.entries(checkboxGroups)) {
    if (options.length > 1) { // Only consider it a group if there are multiple options
      console.log(`Processing group with name: ${name} and ${options.length} options`);
      
      const groupContainers = findCheckboxGroupContainers(container, options);
      console.log(`Found ${groupContainers.length} potential containers for group ${name}`);
      
      // If we found a container with a form-group class, prioritize it
      const formGroupContainer = groupContainers.find(elem => 
        elem.className && elem.className.includes('form-group')
      );
      
      let groupLabel = '';
      if (formGroupContainer) {
        groupLabel = findGroupLabel(formGroupContainer);
      } 
      
      if (!groupLabel) {
        groupLabel = determineGroupLabel(groupContainers, options);
      }
      
      console.log(`Group ${name} label determined as: "${groupLabel}"`);
      
      if (groupLabel) {
        result.push({
          type: 'checkboxGroup',
          name: name,
          label: groupLabel,
          options: options
        });
      }
    }
  }
  
  console.log(`Final checkbox groups detected: ${result.length}`);
  return result;
}

function extractBootstrapCheckboxGroups(container) {
  const result = [];
  const processedGroups = new Set(); // Keep track of processed form groups
  
  // Look for the standard pattern: div.form-group > label + multiple div.form-check > input[type="checkbox"]
  const formGroups = container.querySelectorAll('div[class*="form-group"]');
  
  formGroups.forEach(formGroup => {
    // Check if this form-group has a direct label child
    const groupLabel = formGroup.querySelector(':scope > label');
    if (!groupLabel) return;
    
    // Find all checkbox inputs within this form-group
    const checkboxInputs = formGroup.querySelectorAll('input[type="checkbox"]');
    if (checkboxInputs.length < 2) return;
    
    console.log(`Found Bootstrap checkbox group with label: "${groupLabel.textContent.trim()}" and ${checkboxInputs.length} options`);
    
    // Create options array from checkboxes
    const options = [];
    let groupName = null;
    
    checkboxInputs.forEach(checkbox => {
      // Get the name if we don't have it yet
      if (!groupName && checkbox.name) {
        groupName = checkbox.name;
      }
      
      // Get the option label
      const optionLabel = getCheckboxOptionLabel(checkbox);
      
      options.push({
        id: checkbox.id || '',
        value: checkbox.value || '',
        checked: checkbox.checked,
        label: optionLabel
      });
    });
    
    // Use the first checkbox's name, or generate a name if needed
    if (!groupName) {
      groupName = `checkbox_group_${result.length + 1}`;
    }
    
    result.push({
      type: 'checkboxGroup',
      name: groupName,
      label: groupLabel.textContent.trim(),
      options: options
    });
    
    // Mark this form group as processed
    processedGroups.add(formGroup);
  });
  
  // Special case for inline checkboxes pattern: 
  // div.form-group > label + div > multiple div.form-check-inline
  formGroups.forEach(formGroup => {
    // Skip if we already processed this form group
    if (processedGroups.has(formGroup)) {
      return;
    }
    
    const groupLabel = formGroup.querySelector(':scope > label');
    if (!groupLabel) return;
    
    // Look for form-check-inline elements
    const inlineChecks = formGroup.querySelectorAll('.form-check-inline');
    if (inlineChecks.length >= 2) {
      const options = [];
      let groupName = null;
      
      inlineChecks.forEach(inlineCheck => {
        const checkbox = inlineCheck.querySelector('input[type="checkbox"]');
        if (!checkbox) return;
        
        if (!groupName && checkbox.name) {
          groupName = checkbox.name;
        }
        
        const optionLabel = getCheckboxOptionLabel(checkbox);
        options.push({
          id: checkbox.id || '',
          value: checkbox.value || '',
          checked: checkbox.checked,
          label: optionLabel
        });
      });
      
      if (options.length >= 2) {
        // Only create a group if we found at least 2 options
        if (!groupName) {
          groupName = `checkbox_group_${result.length + 1}`;
        }
        
        console.log(`Found inline checkbox group with label: "${groupLabel.textContent.trim()}" and ${options.length} options`);
        
        result.push({
          type: 'checkboxGroup',
          name: groupName,
          label: groupLabel.textContent.trim(),
          options: options
        });
        
        // Mark this form group as processed
        processedGroups.add(formGroup);
      }
    }
  });
  
  console.log(`Found ${result.length} Bootstrap checkbox groups`);
  return result;
}

function getCheckboxOptionLabel(checkbox) {
  // Try to find a label by for attribute
  if (checkbox.id) {
    const labelElement = document.querySelector(`label[for="${checkbox.id}"]`);
    if (labelElement) {
      return labelElement.textContent.trim();
    }
  }
  
  // Try to find a parent label
  let parent = checkbox.parentElement;
  while (parent) {
    if (parent.tagName === 'LABEL') {
      return parent.textContent.trim().replace(checkbox.value, '').trim();
    }
    parent = parent.parentElement;
  }
  
  // Check for label as next sibling (common pattern)
  let sibling = checkbox.nextElementSibling;
  if (sibling && sibling.tagName === 'LABEL') {
    return sibling.textContent.trim();
  }
  
  return checkbox.value || '';
}

function identifyStructuralCheckboxGroups(container) {
  const result = [];
  
  // Look for common checkbox group containers
  const potentialGroups = findPotentialCheckboxGroupContainers(container);
  
  for (const groupContainer of potentialGroups) {
    // Look for a group label
    const groupLabel = findGroupLabel(groupContainer);
    if (!groupLabel) continue;
    
    // Find checkboxes within this container
    const checkboxes = groupContainer.querySelectorAll('input[type="checkbox"]');
    if (checkboxes.length < 2) continue;
    
    const options = [];
    for (const checkbox of checkboxes) {
      options.push({
        id: checkbox.id || '',
        name: checkbox.name || '',
        value: checkbox.value || '',
        checked: checkbox.checked,
        label: getCheckboxOptionLabel(checkbox)
      });
    }
    
    // Use the first non-empty name, or generate one if needed
    const groupName = options.find(o => o.name)?.name || `checkbox_group_${result.length + 1}`;
    
    result.push({
      name: groupName,
      label: groupLabel,
      options: options
    });
  }
  
  return result;
}

function findPotentialCheckboxGroupContainers(container) {
  const result = [];
  
  // First, specifically look for Bootstrap-style form-group with a direct label and checkbox-inputs
  const formGroups = container.querySelectorAll('div[class*="form-group"]');
  for (const group of formGroups) {
    // Check if this has the pattern we're looking for
    const groupLabel = group.querySelector(':scope > label');
    if (groupLabel) {
      const checkboxes = group.querySelectorAll('input[type="checkbox"]');
      
      // If we have a label and multiple checkboxes, this is likely a checkbox group
      if (checkboxes.length >= 2) {
        console.log(`Found Bootstrap form-group with direct label "${groupLabel.textContent.trim()}" and ${checkboxes.length} checkboxes`);
        result.push(group);
        continue;
      }
      
      // Special case: check if we have form-check divs each with a checkbox
      const formChecks = group.querySelectorAll('div[class*="form-check"]');
      if (formChecks.length >= 2) {
        let checkboxCount = 0;
        formChecks.forEach(check => {
          if (check.querySelector('input[type="checkbox"]')) {
            checkboxCount++;
          }
        });
        
        if (checkboxCount >= 2) {
          console.log(`Found Bootstrap form-group with form-checks containing ${checkboxCount} checkboxes`);
          result.push(group);
          continue;
        }
      }
      
      // Handle inline checkbox pattern: div.form-group > label + div > multiple div.form-check-inline
      const inlineChecks = group.querySelectorAll('.form-check-inline');
      if (inlineChecks.length >= 2) {
        let inlineCheckboxCount = 0;
        inlineChecks.forEach(check => {
          if (check.querySelector('input[type="checkbox"]')) {
            inlineCheckboxCount++;
          }
        });
        
        if (inlineCheckboxCount >= 2) {
          console.log(`Found Bootstrap form-group with ${inlineCheckboxCount} inline checkboxes`);
          result.push(group);
          continue;
        }
      }
    }
  }
  
  // Find elements with multiple checkboxes
  const checkboxContainers = new Map();
  const checkboxes = container.querySelectorAll('input[type="checkbox"]');
  
  // Build a map of containers and their checkbox counts
  for (const checkbox of checkboxes) {
    let parent = checkbox.parentElement;
    let depth = 0;
    const maxDepth = 5; // Increased depth to catch more distant parent containers
    
    while (parent && depth < maxDepth) {
      const count = checkboxContainers.get(parent) || 0;
      checkboxContainers.set(parent, count + 1);
      parent = parent.parentElement;
      depth++;
    }
  }
  
  // Find containers with at least 2 checkboxes and a label or heading
  for (const [elem, count] of checkboxContainers.entries()) {
    if (count >= 2) {
      // Look for label in this container or its direct parent
      const hasLabel = elem.querySelector('label:not([for]), label:first-child') || 
                       elem.previousElementSibling?.tagName === 'LABEL' ||
                       elem.querySelector('legend, h1, h2, h3, h4, h5, h6') ||
                       (elem.parentElement && elem.parentElement.querySelector(':scope > label'));
      
      if (hasLabel) {
        result.push(elem);
      }
    }
  }
  
  // Special case: look for a container with a label followed by multiple divs each containing a checkbox
  const divs = container.querySelectorAll('div');
  for (const div of divs) {
    const firstChild = div.firstElementChild;
    if (firstChild && firstChild.tagName === 'LABEL') {
      // Check if this div contains multiple divs each with a checkbox
      let checkboxDivs = Array.from(div.querySelectorAll('div')).filter(childDiv => 
        childDiv.querySelector('input[type="checkbox"]')
      );
      
      if (checkboxDivs.length >= 2) {
        console.log(`Found special case: div with label and ${checkboxDivs.length} checkbox divs`);
        result.push(div);
      }
    }
  }
  
  return result;
}

function findCheckboxGroupContainers(container, options) {
  const result = [];
  
  // Get the actual checkbox elements from their IDs
  const checkboxes = options
    .map(option => option.id ? container.querySelector(`#${option.id}`) : null)
    .filter(Boolean);
  
  if (checkboxes.length < 2) return result;
  
  // Find common parent containers
  const commonAncestors = new Map();
  
  for (const checkbox of checkboxes) {
    let parent = checkbox.parentElement;
    let depth = 0;
    const maxDepth = 6; // Increased depth to ensure we find common parents
    
    while (parent && depth < maxDepth && parent !== container) {
      const count = commonAncestors.get(parent) || 0;
      commonAncestors.set(parent, count + 1);
      parent = parent.parentElement;
      depth++;
    }
  }
  
  // Filter to containers that have all checkboxes
  for (const [elem, count] of commonAncestors.entries()) {
    if (count === checkboxes.length) {
      result.push(elem);
    }
  }
  
  return result.sort((a, b) => {
    // Prefer containers closer to the checkboxes (deeper in the DOM)
    return b.querySelectorAll('*').length - a.querySelectorAll('*').length;
  });
}

function determineGroupLabel(containers, options) {
  // Try each container from most specific to most general
  for (const container of containers) {
    // Check for a label directly in the container or its parent
    let label = findGroupLabel(container);
    if (label) return label;
    
    // Also check parent containers for labels
    if (container.parentElement) {
      label = findGroupLabel(container.parentElement);
      if (label) return label;
    }
  }
  
  // If no container had a label, look for a common prefix in option labels
  if (options.length >= 2 && options.every(o => o.label)) {
    const labels = options.map(o => o.label);
    const commonPrefix = findCommonTextPrefix(labels);
    if (commonPrefix && commonPrefix.length > 5) { // Only if meaningful prefix
      return commonPrefix.trim();
    }
  }
  
  return '';
}

function findGroupLabel(container) {
  // Bootstrap pattern: direct label child of a form-group
  if (container.className && container.className.includes('form-group')) {
    const directLabel = container.querySelector(':scope > label');
    if (directLabel) {
      console.log(`Found direct label "${directLabel.textContent.trim()}" in form-group`);
      return directLabel.textContent.trim();
    }
  }
  
  // Look for a direct label child
  const directLabel = container.querySelector(':scope > label');
  if (directLabel) {
    return directLabel.textContent.trim();
  }
  
  // Look for a label as previous sibling
  if (container.previousElementSibling && container.previousElementSibling.tagName === 'LABEL') {
    return container.previousElementSibling.textContent.trim();
  }
  
  // Look for a fieldset legend
  if (container.tagName === 'FIELDSET') {
    const legend = container.querySelector('legend');
    if (legend) {
      return legend.textContent.trim();
    }
  }
  
  // Check for headings within the container
  const heading = container.querySelector('h1, h2, h3, h4, h5, h6, legend');
  if (heading) {
    return heading.textContent.trim();
  }
  
  // Check for the first label in the container that's not directly associated with a checkbox
  const labels = Array.from(container.querySelectorAll('label'));
  for (const label of labels) {
    // Skip labels that are directly for checkboxes
    const forAttr = label.getAttribute('for');
    if (!forAttr) {
      return label.textContent.trim();
    }
    
    const associatedElement = document.getElementById(forAttr);
    // If the label is for a non-checkbox or can't find the element, it might be a group label
    if (!associatedElement || associatedElement.type !== 'checkbox') {
      return label.textContent.trim();
    }
  }
  
  // Special case: if this is a div with class containing "form-group", look for the first label
  if (container.tagName === 'DIV' && container.className && container.className.includes('form-group')) {
    const firstLabel = container.querySelector('label');
    if (firstLabel) {
      return firstLabel.textContent.trim();
    }
  }
  
  // Check for any text nodes directly within the container
  for (const child of container.childNodes) {
    if (child.nodeType === Node.TEXT_NODE && child.textContent.trim()) {
      return child.textContent.trim();
    }
  }
  
  return '';
}

function findCommonTextPrefix(strings) {
  if (!strings.length) return '';
  if (strings.length === 1) return strings[0];
  
  let prefix = '';
  const firstStr = strings[0];
  
  for (let i = 0; i < firstStr.length; i++) {
    const char = firstStr.charAt(i);
    if (strings.every(str => str.charAt(i) === char)) {
      prefix += char;
    } else {
      break;
    }
  }
  
  return prefix;
}

function getGroupedCheckboxIds(checkboxGroups) {
  const ids = new Set();
  
  for (const group of checkboxGroups) {
    for (const option of group.options) {
      if (option.id) {
        ids.add(option.id);
      }
    }
  }
  
  return ids;
}

function removeDebugLogs() {
  // This is a reminder to remove console.logs before production
  console.log = function() {};
}

// Export the module functions for use in browser context
self.FormCheckboxGroups = {
  extractCheckboxGroups,
  getGroupedCheckboxIds
};
