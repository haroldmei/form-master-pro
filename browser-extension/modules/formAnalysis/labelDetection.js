/**
 * Form Analysis V2 - Label Detection Module
 * Handles identifying and managing form element labels
 */
// Prevent redeclaration error by checking if the module already exists
if (typeof formAnalysisLabels === 'undefined') {
  const formAnalysisLabels = (() => {
    /**
     * Find all labels associated with a form control
     * @param {HTMLElement} element - The form control element
     * @param {Object} controlInfo - The control info object to update
     */
    function findLabels(element, controlInfo) {
      if (!controlInfo.labels) {
        controlInfo.labels = [];
      }
      
      // Method 1: Check for explicit label with 'for' attribute
      if (element.id) {
        const explicitLabels = document.querySelectorAll(`label[for="${element.id}"]`);
        explicitLabels.forEach(label => {
          controlInfo.labels.push({
            element: label,
            text: label.textContent.trim(),
            type: 'explicit'
          });
        });
      }
      
      // Method 2: Check for ancestor label (implicit label)
      let parent = element.parentElement;
      while (parent && parent.tagName !== 'BODY') {
        if (parent.tagName === 'LABEL') {
          controlInfo.labels.push({
            element: parent,
            text: parent.textContent.trim().replace(element.value || '', ''),
            type: 'implicit'
          });
          break;
        }
        parent = parent.parentElement;
      }
      
      // Method 3: Check for preceding text or elements that might be labels
      if (controlInfo.labels.length === 0) {
        const previousElement = element.previousElementSibling;
        if (previousElement && 
            (previousElement.tagName === 'SPAN' || 
             previousElement.tagName === 'DIV' || 
             previousElement.tagName === 'P')) {
          controlInfo.labels.push({
            element: previousElement,
            text: previousElement.textContent.trim(),
            type: 'preceding'
          });
        }
      }
      
      // Method 4: Look for aria-labelledby
      if (element.hasAttribute('aria-labelledby')) {
        const labelIds = element.getAttribute('aria-labelledby').split(' ');
        labelIds.forEach(id => {
          const labelElement = document.getElementById(id);
          if (labelElement) {
            controlInfo.labels.push({
              element: labelElement,
              text: labelElement.textContent.trim(),
              type: 'aria-labelledby'
            });
          }
        });
      }
      
      // Method 5: Check for aria-label
      if (element.hasAttribute('aria-label')) {
        controlInfo.labels.push({
          element: null,
          text: element.getAttribute('aria-label').trim(),
          type: 'aria-label'
        });
      }
      
      // If still no label found, use placeholder or name as fallback
      if (controlInfo.labels.length === 0) {
        if (element.placeholder) {
          controlInfo.labels.push({
            element: null,
            text: element.placeholder,
            type: 'placeholder'
          });
        } else if (element.name) {
          controlInfo.labels.push({
            element: null,
            text: element.name.replace(/[-_]/g, ' '),
            type: 'name'
          });
        }
      }
    }
    
    /**
     * Find options for select elements
     * @param {HTMLSelectElement} element - The select element
     * @param {Object} controlInfo - The control info object to update
     */
    function findSelectOptions(element, controlInfo) {
      if (!controlInfo.options) {
        controlInfo.options = [];
      }
      
      const options = Array.from(element.options);
      options.forEach(option => {
        controlInfo.options.push({
          element: option,
          value: option.value,
          text: option.text.trim(),
          selected: option.selected
        });
      });
    }
    
    /**
     * Find options for radio button groups
     * @param {HTMLInputElement} element - The radio button element
     * @param {Object} controlInfo - The control info object to update
     */
    function findRadioOptions(element, controlInfo) {
      if (!formAnalysisContainers) {
        console.error('Required dependency missing: formAnalysisContainers');
        return;
      }
      
      const name = element.name;
      if (!name) return;
      
      // Get all radios in this group, either from stored groupElements or by querying
      const radioGroup = controlInfo.groupElements || 
                        Array.from(document.querySelectorAll(`input[type="radio"][name="${name}"]`));
      
      // Find common container for all radio buttons in the group
      let commonContainer = null;
      
      // If there are multiple radio buttons, try to find a common container
      if (radioGroup.length > 1) {
        // Try finding common container by DOM structure first
        if (!formAnalysisDomUtils) {
          console.error('Required dependency missing: formAnalysisDomUtils');
          return;
        }
        
        commonContainer = formAnalysisDomUtils.findCommonAncestor(radioGroup);
        
        // If no common container found using DOM structure, try more advanced techniques
        if (!commonContainer || commonContainer === document.body) {
          commonContainer = formAnalysisContainers.findBestRadioGroupContainer(radioGroup);
        }
      }
      
      // If we found a common container, use it
      if (commonContainer && commonContainer !== document.body) {
        controlInfo.container = commonContainer;
        controlInfo.isRadioGroup = true; // Mark as radio group for special handling
      }
      
      // Gather all options from the radio group
      controlInfo.options = controlInfo.options || [];
      
      radioGroup.forEach(radio => {
        // Find the label for this radio
        let labelText = '';
        let labelElement = null;
        
        // Try explicit label
        if (radio.id) {
          labelElement = document.querySelector(`label[for="${radio.id}"]`);
          if (labelElement) {
            labelText = labelElement.textContent.trim();
          }
        }
        
        // Try implicit label (parent is a label)
        if (!labelText) {
          let parent = radio.parentElement;
          while (parent && parent.tagName !== 'BODY') {
            if (parent.tagName === 'LABEL') {
              labelElement = parent;
              labelText = parent.textContent.trim();
              break;
            }
            parent = parent.parentElement;
          }
        }
        
        // Try nearby text node or simple elements
        if (!labelText) {
          labelText = formAnalysisContainers.findNearbyText(radio);
        }
        
        controlInfo.options.push({
          element: radio,
          value: radio.value,
          text: labelText || radio.value,
          selected: radio.checked,
          labelElement: labelElement
        });
      });
      
      // Add a more descriptive label for the radio group if possible
      if (controlInfo.labels.length === 0) {
        // Try to find a legend or heading near the container
        const groupLabel = formAnalysisContainers.findRadioGroupLabel(controlInfo.container, radioGroup);
        if (groupLabel) {
          controlInfo.labels.push({
            element: groupLabel.element,
            text: groupLabel.text,
            type: 'group-label'
          });
        }
      }
    }
    
    return {
      findLabels,
      findSelectOptions,
      findRadioOptions
    };
  })();

  // Expose the module to the global scope
  self.formAnalysisLabels = formAnalysisLabels;
} 