const { By, until, Key } = require('selenium-webdriver');
const webDriverManager = require('../webdriver/manager');
const { getLogger } = require('../utils/logger');

const logger = getLogger('form-filler');

/**
 * Service to handle form filling using WebDriver
 */
class FormFillerService {
  /**
   * Fill a form using WebDriver
   * 
   * @param {string} url - URL of the form to fill
   * @param {Array} formFields - Array of form field data
   * @param {Object} fieldValues - Values to fill in the form
   */
  async fillForm(url, formFields, fieldValues) {
    logger.info(`Filling form at URL: ${url}`);
    
    try {
      // Get WebDriver instance
      const driver = await webDriverManager.getDriver();
      
      // Navigate to the form URL
      await driver.get(url);
      
      // Wait for page to load
      await driver.wait(until.elementLocated(By.tagName('body')), 10000);
      
      // Process each field
      for (const field of formFields) {
        // Skip fields without values
        if (!fieldValues[field.id] && !fieldValues[field.name]) {
          continue;
        }
        
        // Get the field value
        const value = fieldValues[field.id] || fieldValues[field.name];
        
        // Find element using the most reliable method
        let element = null;
        if (field.id) {
          try {
            element = await driver.findElement(By.id(field.id));
          } catch (error) {
            // ID not found, will try other methods
          }
        }
        
        if (!element && field.name) {
          try {
            element = await driver.findElement(By.name(field.name));
          } catch (error) {
            // Name not found, will try other methods
          }
        }
        
        if (!element && field.xpath) {
          try {
            element = await driver.findElement(By.xpath(field.xpath));
          } catch (error) {
            // XPath not found, will try other methods
            logger.debug(`Element not found by XPath: ${field.xpath}`);
          }
        }
        
        if (!element) {
          logger.warning(`Could not find element for field: ${field.label || field.name || field.id}`);
          continue;
        }
        
        // Fill the field based on its type
        await this._fillField(element, field.type, value);
      }
      
      logger.info('Form filled successfully');
      return true;
    } catch (error) {
      logger.error(`Error filling form: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Fill a specific field based on its type
   * 
   * @param {WebElement} element - WebDriver element
   * @param {string} fieldType - Type of the field
   * @param {any} value - Value to fill
   */
  async _fillField(element, fieldType, value) {
    try {
      switch (fieldType) {
        case 'text':
        case 'email':
        case 'tel':
        case 'number':
        case 'date':
        case 'url':
        case 'password':
        case 'textarea':
          await this._fillInputField(element, value);
          break;
          
        case 'select-one':
          await this._selectOption(element, value);
          break;
          
        case 'select-multiple':
          if (Array.isArray(value)) {
            for (const val of value) {
              await this._selectOption(element, val);
            }
          } else {
            await this._selectOption(element, value);
          }
          break;
          
        case 'checkbox':
          await this._setCheckbox(element, value);
          break;
          
        case 'radio':
          await this._setRadio(element, value);
          break;
          
        default:
          logger.warning(`Unsupported field type: ${fieldType}`);
      }
    } catch (error) {
      logger.error(`Error filling field of type ${fieldType}: ${error.message}`);
    }
  }
  
  /**
   * Fill a text input field
   * 
   * @param {WebElement} element - WebDriver element
   * @param {string} value - Value to fill
   */
  async _fillInputField(element, value) {
    try {
      await element.clear();
    } catch (error) {
      // Some fields can't be cleared conventionally
      try {
        // Use JavaScript to clear the field
        const driver = await webDriverManager.getDriver();
        await driver.executeScript('arguments[0].value = "";', element);
      } catch (e) {
        logger.debug(`Could not clear field: ${e.message}`);
      }
    }
    
    await element.sendKeys(value);
  }
  
  /**
   * Select an option from a dropdown
   * 
   * @param {WebElement} element - WebDriver element
   * @param {string} value - Value to select
   */
  async _selectOption(element, value) {
    const driver = await webDriverManager.getDriver();
    
    // Try to find option by value
    try {
      const option = await driver.findElement(By.css(`option[value="${value}"]`));
      await option.click();
      return;
    } catch (error) {
      // Option not found by value, try by text
    }
    
    // Try to find option by text
    try {
      const options = await element.findElements(By.css('option'));
      for (const option of options) {
        const text = await option.getText();
        if (text === value || text.includes(value)) {
          await option.click();
          return;
        }
      }
    } catch (error) {
      logger.warning(`Could not select option: ${value}`);
    }
    
    // If can't select by clicking, try using JavaScript
    try {
      await driver.executeScript(`arguments[0].value = "${value}";`, element);
      // Trigger change event
      await driver.executeScript('arguments[0].dispatchEvent(new Event("change"));', element);
    } catch (error) {
      logger.error(`Failed to select option using JavaScript: ${error.message}`);
    }
  }
  
  /**
   * Set checkbox state
   * 
   * @param {WebElement} element - WebDriver element
   * @param {boolean|string} value - Desired checkbox state
   */
  async _setCheckbox(element, value) {
    const isChecked = await element.isSelected();
    const shouldBeChecked = (value === true || value === 'true' || value === '1' || value === 'yes');
    
    if (isChecked !== shouldBeChecked) {
      await element.click();
    }
  }
  
  /**
   * Set radio button value
   * 
   * @param {WebElement} element - WebDriver element
   * @param {string} value - Desired radio value
   */
  async _setRadio(element, value) {
    const currentValue = await element.getAttribute('value');
    
    if (currentValue === value) {
      const isSelected = await element.isSelected();
      if (!isSelected) {
        await element.click();
      }
    }
  }
}

module.exports = new FormFillerService();
