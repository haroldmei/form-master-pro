/**
 * Utilities for generating documentation from extracted form controls.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { getLogger } = require('../utils/logger');

const logger = getLogger('form_extract');

/**
 * Create a mapping of labels to their respective controls for easier reference
 * 
 * @param {Object} controls - Dictionary of form controls from extract_form_controls
 * @returns {Object} Mapping of labels to control references
 */
function createLabelMapping(controls) {
  const labelMapping = {};
  
  // Process text inputs
  (controls.inputs || []).forEach((inputCtrl, i) => {
    if (inputCtrl.label) {
      const label = inputCtrl.label;
      labelMapping[label] = {
        type: 'input',
        input_type: inputCtrl.type,
        id: inputCtrl.id,
        name: inputCtrl.name,
        index: i
      };
    }
  });
  
  // Process selects
  (controls.selects || []).forEach((select, i) => {
    if (select.label) {
      const label = select.label;
      labelMapping[label] = {
        type: 'select',
        id: select.id,
        name: select.name,
        has_chosen: select.has_chosen || false,
        index: i,
        options: select.options ? select.options.map(opt => opt.text) : []
      };
    }
  });
  
  // Process textareas
  (controls.textareas || []).forEach((textarea, i) => {
    if (textarea.label) {
      const label = textarea.label;
      labelMapping[label] = {
        type: 'textarea',
        id: textarea.id,
        name: textarea.name,
        index: i
      };
    }
  });
  
  // Process radio groups
  (controls.radios || []).forEach((radioGroup, i) => {
    if (radioGroup.label) {
      const label = radioGroup.label;
      labelMapping[label] = {
        type: 'radio_group',
        name: radioGroup.name,
        index: i,
        options: []
      };
      
      // Add individual radio options
      (radioGroup.options || []).forEach(option => {
        const optionText = option.label || option.text || option.value || '';
        labelMapping[label].options.push({
          id: option.id,
          value: option.value,
          text: optionText
        });
      });
    }
  });
  
  // Process checkboxes - Use improved logic to ensure we have text for each
  (controls.checkboxes || []).forEach((checkbox, i) => {
    // Combine all possible text sources to get the best label
    const allTextSources = [];
    
    // Get the formal label if available
    if (checkbox.label) {
      allTextSources.push(checkbox.label);
    }
    
    // Get the associated text if available
    if (checkbox.text) {
      allTextSources.push(checkbox.text);
    }
    
    // Fallback to name or id if needed
    if (allTextSources.length === 0 && checkbox.name) {
      allTextSources.push(`checkbox-${checkbox.name}`);
    } else if (allTextSources.length === 0 && checkbox.id) {
      allTextSources.push(`checkbox-${checkbox.id}`);
    }
    
    // Use the first available text as key
    if (allTextSources.length > 0) {
      let displayText = allTextSources[0];
      // Ensure we don't duplicate keys - append index if needed
      if (labelMapping[displayText]) {
        displayText = `${displayText} (#${i + 1})`;
      }
      
      labelMapping[displayText] = {
        type: 'checkbox',
        id: checkbox.id || '',
        name: checkbox.name || '',
        value: checkbox.value || '',
        text: checkbox.text || '',
        label: checkbox.label || '',
        index: i
      };
    }
  });
  
  return labelMapping;
}

/**
 * Generate human-readable documentation of form fields
 * 
 * @param {Object} controls - Dictionary of form controls from extract_form_controls
 * @returns {string} Markdown-formatted documentation of form fields
 */
function generateFieldDocumentation(controls) {
  const docs = ["# Form Field Documentation\n"];
  const mapping = controls.label_mapping || {};
  
  // Group by field type
  const fieldTypes = {
    'Text Inputs': [],
    'Dropdowns': [],
    'Radio Groups': [],
    'Checkboxes': [],
    'Textareas': []
  };
  
  Object.entries(mapping).forEach(([label, info]) => {
    const fieldType = info.type;
    if (fieldType === 'input') {
      fieldTypes['Text Inputs'].push([label, info]);
    } else if (fieldType === 'select') {
      fieldTypes['Dropdowns'].push([label, info]);
    } else if (fieldType === 'radio_group') {
      fieldTypes['Radio Groups'].push([label, info]);
    } else if (fieldType === 'checkbox') {
      fieldTypes['Checkboxes'].push([label, info]);
    } else if (fieldType === 'textarea') {
      fieldTypes['Textareas'].push([label, info]);
    }
  });
  
  // Generate markdown for each type
  Object.entries(fieldTypes).forEach(([typeName, fields]) => {
    if (fields.length === 0) {
      return;
    }
    
    docs.push(`## ${typeName}\n`);
    
    fields.forEach(([label, info]) => {
      docs.push(`### ${label}`);
      docs.push(`- ID: \`${info.id || 'None'}\``);
      docs.push(`- Name: \`${info.name || 'None'}\``);
      
      if (typeName === 'Text Inputs') {
        docs.push(`- Type: \`${info.input_type || 'text'}\``);
      } else if (typeName === 'Dropdowns') {
        docs.push("- Options:");
        (info.options || []).forEach(option => {
          docs.push(`  - ${option}`);
        });
      } else if (typeName === 'Radio Groups') {
        docs.push("- Options:");
        (info.options || []).forEach(option => {
          const optionText = option.text || option.value || 'Unknown';
          const optionValue = option.value || '';
          docs.push(`  - ${optionText} \`[value: ${optionValue}]\``);
        });
      } else if (typeName === 'Checkboxes') {
        docs.push(`- ID: \`${info.id || 'None'}\``);
        docs.push(`- Name: \`${info.name || 'None'}\``);
        
        // Add all available text sources for clarity
        if (info.label && info.label !== label) {
          docs.push(`- Label: \`${info.label}\``);
        }
        if (info.text && info.text !== label && info.text !== info.label) {
          docs.push(`- Text: \`${info.text}\``);
        }
        
        docs.push(`- Value: \`${info.value || ''}\``);
      }
      
      docs.push("");  // Empty line for spacing
    });
  });
  
  return docs.join("\n");
}

/**
 * Generate Python code to interact with the extracted form controls
 * 
 * @param {Object} controls - Dictionary of form controls from extract_form_controls
 * @returns {string} Python code snippet for form interaction
 */
function generateCodeFromControls(controls) {
  const code = [];
  code.push("// Generated code for form interaction");
  code.push("const { By } = require('selenium-webdriver');");
  code.push("const { setValueById, selectChosenOptionById, ensureRadioSelected, checkButtonById } = require('./form_utils');");
  code.push("");
  
  // Process text inputs
  (controls.inputs || []).forEach(inputCtrl => {
    if (['text', 'email', 'tel', 'number', 'date', 'password'].includes(inputCtrl.type)) {
      const idVal = inputCtrl.id;
      if (idVal) {
        const comment = inputCtrl.label ? `// ${inputCtrl.label}` : "";
        code.push(`await setValueById(driver, '${idVal}', 'value'); ${comment}`);
      }
    }
  });
  
  // Process selects
  (controls.selects || []).forEach(select => {
    const idVal = select.id;
    if (idVal) {
      const comment = select.label ? `// ${select.label}` : "";
      if (select.has_chosen) {
        code.push(`await selectChosenOptionById(driver, '${idVal}', 'option text'); ${comment}`);
      } else {
        code.push(`await selectOptionById(driver, '${idVal}', 'option text'); ${comment}`);
      }
    }
  });
  
  // Process radio groups
  (controls.radios || []).forEach(radioGroup => {
    const comment = radioGroup.label ? `// ${radioGroup.label}` : "";
    code.push(`// Radio group: ${radioGroup.name} ${comment}`);
    (radioGroup.options || []).forEach(option => {
      if (option.id) {
        const label = option.label ? ` // ${option.label}` : "";
        code.push(`await ensureRadioSelected(driver, '${option.id}');${label}`);
      }
    });
  });
  
  // Process checkboxes
  (controls.checkboxes || []).forEach(checkbox => {
    const idVal = checkbox.id;
    if (idVal) {
      const comment = checkbox.label ? ` // ${checkbox.label}` : "";
      code.push(`await checkButtonById(driver, '${idVal}');${comment}`);
    }
  });
  
  return code.join("\n");
}

/**
 * Save extracted form controls to a JSON file
 * 
 * @param {Object} controls - Dictionary of form controls from extract_form_controls
 * @param {string} outputPath - Path to save the JSON file
 * @returns {string} Path to the saved JSON file
 */
function saveFormControlsToJson(controls, outputPath = null) {
  if (!outputPath) {
    // Generate a timestamped filename
    const timestamp = new Date().toISOString()
      .replace(/[-:]/g, '_')
      .replace(/T/g, '_')
      .split('.')[0];
    
    const outputDir = path.join(os.homedir(), "formmaster_output");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    outputPath = path.join(outputDir, `form_controls_${timestamp}.json`);
  }
  
  try {
    // Convert sets to arrays if present
    const replacer = (key, value) => {
      if (value instanceof Set) {
        return [...value];
      }
      return value;
    };
    
    fs.writeFileSync(outputPath, JSON.stringify(controls, replacer, 2), 'utf8');
    logger.info(`Form controls saved to ${outputPath}`);
    return outputPath;
  } catch (e) {
    logger.error(`Error saving form controls to JSON: ${e.message}`);
    return null;
  }
}

/**
 * Save documentation to a markdown file
 * 
 * @param {Object} driver - Selenium WebDriver instance
 * @param {Object} controls - Dictionary of form controls
 * @param {string} outputPath - Path to save the documentation
 * @returns {string} Path to the saved markdown file
 */
function saveFormDocumentation(driver, controls, outputPath = null) {
  const docs = generateFieldDocumentation(controls);
  
  if (!outputPath) {
    // Generate a timestamped filename
    const timestamp = new Date().toISOString()
      .replace(/[-:]/g, '_')
      .replace(/T/g, '_')
      .split('.')[0];
    
    const outputDir = path.join(os.homedir(), "formmaster_output");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    outputPath = path.join(outputDir, `form_documentation_${timestamp}.md`);
  }
  
  try {
    fs.writeFileSync(outputPath, docs, 'utf8');
    logger.info(`Form documentation saved to ${outputPath}`);
    return outputPath;
  } catch (e) {
    logger.error(`Error saving form documentation: ${e.message}`);
    return null;
  }
}

module.exports = {
  createLabelMapping,
  generateFieldDocumentation,
  generateCodeFromControls,
  saveFormControlsToJson,
  saveFormDocumentation
};
