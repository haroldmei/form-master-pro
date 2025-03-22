/**
 * Form control extraction utilities for FormMaster.
 * This module provides functions to extract and analyze form controls from HTML pages.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const cheerio = require('cheerio');
const { getLogger } = require('../utils/logger');

// Import individual control extractors
const { extractInputs } = require('./form_inputs');
const { extractSelects } = require('./form_selects');
const { extractTextareas } = require('./form_textareas');
const { extractButtons } = require('./form_buttons');
const { extractRadioGroups } = require('./form_radios');
const { extractCheckboxes } = require('./form_checkboxes');

// Import documentation utilities
const {
  createLabelMapping,
  generateFieldDocumentation,
  generateCodeFromControls,
  saveFormControlsToJson,
  saveFormDocumentation
} = require('./form_documentation');

const logger = getLogger('form_extract');

/**
 * Extract form controls from the current page using Selenium WebDriver
 * 
 * @param {WebDriver} driver - Selenium WebDriver instance
 * @param {string} formSelector - CSS selector for the form element
 * @returns {Object} Dictionary of form controls grouped by type
 */
async function extractFormControls(driver, formSelector = null) {
  try {
    // Get page HTML
    const html = await driver.getPageSource();
    
    // Parse with Cheerio
    const $ = cheerio.load(html);
    
    // Find target form if selector provided, otherwise use whole document
    const container = formSelector ? $(formSelector) : $('body');
    if (formSelector && container.length === 0) {
      logger.warning(`Form selector '${formSelector}' not found`);
      return {};
    }
    
    // Extract different control types
    const controls = {
      inputs: extractInputs($, container),
      selects: extractSelects($, container),
      textareas: extractTextareas($, container),
      buttons: extractButtons($, container),
      radios: extractRadioGroups($, container),
      checkboxes: extractCheckboxes($, container)
    };
    
    // Create a label-to-control mapping for easier reference
    controls.label_mapping = createLabelMapping(controls);
    
    return controls;
  } catch (e) {
    logger.error(`Error extracting form controls: ${e.message}`);
    logger.error(e.stack);
    return {};
  }
}

/**
 * Extract a more user-friendly form structure with labels as primary keys
 * 
 * @param {WebDriver} driver - Selenium WebDriver instance
 * @param {string} formSelector - CSS selector for the form element
 * @returns {Object} Dictionary with labels as keys and control information as values
 */
async function extractFormStructure(driver, formSelector = null) {
  try {
    const controls = await extractFormControls(driver, formSelector);
    return controls.label_mapping || {};
  } catch (e) {
    logger.error(`Error extracting form structure: ${e.message}`);
    logger.error(e.stack);
    return {};
  }
}

/**
 * Extract form controls from the current page and save them to a JSON file
 * 
 * @param {WebDriver} driver - Selenium WebDriver instance
 * @param {string} formSelector - CSS selector for the form element
 * @param {string} outputPath - Path to save the JSON file
 * @returns {Array} [controls, json_path]
 */
async function extractAndSaveFormControls(driver, formSelector = null, outputPath = null) {
  try {
    const controls = await extractFormControls(driver, formSelector);
    const jsonPath = saveFormControlsToJson(controls, outputPath);
    return [controls, jsonPath];
  } catch (e) {
    logger.error(`Error extracting and saving form controls: ${e.message}`);
    logger.error(e.stack);
    return [{}, null];
  }
}

/**
 * Extract form controls and save both JSON and markdown documentation
 * 
 * @param {WebDriver} driver - Selenium WebDriver instance
 * @param {string} formSelector - CSS selector for the form element
 * @param {string} basePath - Base path for output files
 * @returns {Array} [controls, jsonPath, mdPath]
 */
async function extractAndSaveAll(driver, formSelector = null, basePath = null) {
  try {
    const controls = await extractFormControls(driver, formSelector);
    
    if (!basePath) {
      const timestamp = new Date().toISOString()
        .replace(/[-:]/g, '_')
        .replace(/T/g, '_')
        .split('.')[0];
      
      const outputDir = path.join(os.homedir(), "formmaster_output");
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      basePath = path.join(outputDir, `form_${timestamp}`);
    }
    
    const jsonPath = saveFormControlsToJson(controls, `${basePath}.json`);
    const docs = generateFieldDocumentation(controls);
    
    const mdPath = `${basePath}.md`;
    try {
      fs.writeFileSync(mdPath, docs, 'utf8');
      logger.info(`Form documentation saved to ${mdPath}`);
    } catch (e) {
      logger.error(`Error saving form documentation: ${e.message}`);
      logger.error(e.stack);
      mdPath = null;
    }
    
    return [controls, jsonPath, mdPath];
  } catch (e) {
    logger.error(`Error in extract_and_save_all: ${e.message}`);
    logger.error(e.stack);
    return [{}, null, null];
  }
}

module.exports = {
  extractFormControls,
  extractFormStructure,
  extractAndSaveFormControls,
  extractAndSaveAll
};
