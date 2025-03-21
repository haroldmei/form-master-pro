const { By, until, Key, ActionChains } = require('selenium-webdriver');
const { getLogger } = require('../utils/logger');

/**
 * Set value to an input field by ID
 * @param {WebDriver} driver - Selenium WebDriver instance
 * @param {string} elementId - ID of the element
 * @param {string} value - Value to set
 */
async function setValueById(driver, elementId, value) {
  try {
    const element = await driver.findElement(By.id(elementId));
    await element.clear();
    await element.sendKeys(value);
  } catch (e) {
    if (e.name === 'InvalidElementStateError') {
      // If element can't be cleared, try using JavaScript
      await driver.executeScript(`document.getElementById('${elementId}').value = '${value}';`);
    } else {
      console.log(`Error setting value for element ${elementId}: ${e}`);
    }
  }
}

/**
 * Select an option from a dropdown by ID
 * @param {WebDriver} driver - Selenium WebDriver instance
 * @param {string} elementId - ID of the element
 * @param {string} optionText - Text of the option to select
 */
async function selectOptionById(driver, elementId, optionText) {
  try {
    // For chosen-enhanced dropdowns, need to click and then select
    const dropdown = await driver.findElement(By.id(`${elementId}_chosen`));
    
    // Scroll dropdown into view before clicking
    await driver.executeScript("arguments[0].scrollIntoView({block: 'center'});", dropdown);
    
    // Try clicking with wait for it to be clickable
    try {
      await driver.wait(until.elementIsVisible(dropdown), 5000);
      await driver.wait(until.elementIsEnabled(dropdown), 5000);
      await dropdown.click();
    } catch (e) {
      // Fallback to JavaScript click if regular click doesn't work
      await driver.executeScript("arguments[0].click();", dropdown);
    }
    
    // Find options and try to match text
    const options = await driver.findElements(By.css(`#${elementId}_chosen .chosen-results li`));
    let matchedOption = null;
    
    for (const option of options) {
      const text = await option.getText();
      if (text.toLowerCase().includes(optionText.toLowerCase())) {
        matchedOption = option;
        break;
      }
    }
    
    if (matchedOption) {
      // Scroll the option into view
      await driver.executeScript("arguments[0].scrollIntoView({block: 'center'});", matchedOption);
      
      try {
        // Try using ActionChains for better click control
        const actions = driver.actions();
        await actions.move({ origin: matchedOption }).click().perform();
      } catch (e) {
        if (e.name === 'ElementClickInterceptedException') {
          // If still intercepted, use JavaScript click
          await driver.executeScript("arguments[0].click();", matchedOption);
        } else {
          throw e;
        }
      }
    }
  } catch (e) {
    console.log(`Error selecting option for element ${elementId}: ${e}`);
    // Last resort - try direct value setting if possible
    try {
      const selectElement = await driver.findElement(By.id(elementId));
      await driver.executeScript(`document.getElementById('${elementId}').value = '${optionText}';`);
      // Trigger change event to ensure the UI updates
      await driver.executeScript("arguments[0].dispatchEvent(new Event('change', { bubbles: true }));", selectElement);
    } catch (err) {
      console.log(`Failed to set value for dropdown ${elementId} using JavaScript fallback`);
    }
  }
}

/**
 * Select an option from a Chosen dropdown by clicking and searching
 * @param {WebDriver} driver - Selenium WebDriver instance
 * @param {string} elementId - ID of the select element (without the _chosen suffix)
 * @param {string} optionText - Text of the option to select (case insensitive)
 * @returns {Promise<boolean>} Success status
 */
async function selectChosenOptionById(driver, elementId, optionText) {
  const logger = getLogger('form_utils');
  
  try {
    // Click on the Chosen container to open the dropdown
    const chosenContainer = await driver.findElement(By.id(`${elementId}_chosen`));
    await chosenContainer.click();
    
    // Wait for dropdown to be visible
    const searchInput = await driver.wait(
      until.elementLocated(By.css(`#${elementId}_chosen .chosen-search-input`)),
      10000
    );
    
    // Type the option text to filter
    await searchInput.clear();
    await searchInput.sendKeys(optionText);
    
    // Wait a moment for filtering to occur
    await driver.sleep(500);
    
    // Find and click the filtered option (case insensitive)
    const options = await driver.findElements(By.css(`#${elementId}_chosen .chosen-results li`));
    for (const option of options) {
      const text = await option.getText();
      if (text.toLowerCase() === optionText.toLowerCase() || text.toLowerCase().includes(optionText.toLowerCase())) {
        await option.click();
        logger.info(`Selected '${text}' from Chosen dropdown '${elementId}'`);
        return true;
      }
    }
    
    // If exact match not found, click first result if available
    if (options.length > 0) {
      const firstOptionText = await options[0].getText();
      await options[0].click();
      logger.info(`Selected first available option '${firstOptionText}' from Chosen dropdown '${elementId}'`);
      return true;
    }
    
    logger.warning(`Could not find option '${optionText}' in Chosen dropdown '${elementId}'`);
    return false;
  } catch (e) {
    logger.error(`Error selecting option from Chosen dropdown: ${e}`);
    return false;
  }
}

/**
 * Check a checkbox or radio button by ID
 * @param {WebDriver} driver - Selenium WebDriver instance
 * @param {string} elementId - ID of the element
 */
async function checkButtonById(driver, elementId) {
  try {
    const element = await driver.findElement(By.id(elementId));
    const isSelected = await element.isSelected();
    if (!isSelected) {
      await element.click();
    }
  } catch (e) {
    console.log(`Error checking element ${elementId}: ${e}`);
  }
}

/**
 * Select a radio button by its name and value attributes
 * @param {WebDriver} driver - Selenium WebDriver instance
 * @param {string} name - Name attribute of the radio button
 * @param {string} value - Value attribute of the radio button
 */
async function selectRadioByValue(driver, name, value) {
  try {
    // Find all radio buttons with the given name and value
    const radioButtons = await driver.findElements(
      By.css(`input[name='${name}'][value='${value}']`)
    );
    
    // Click the first matching radio button if found
    if (radioButtons.length > 0) {
      const isSelected = await radioButtons[0].isSelected();
      if (!isSelected) {
        await radioButtons[0].click();
      }
    }
  } catch (e) {
    console.log(`Error selecting radio button ${name}=${value}: ${e}`);
  }
}

/**
 * Check if an element is visible on the page
 * @param {WebDriver} driver - Selenium WebDriver instance
 * @param {string} elementId - ID of the element
 * @returns {Promise<boolean>} Whether the element is visible
 */
async function isElementVisible(driver, elementId) {
  try {
    const element = await driver.findElement(By.id(elementId));
    return await element.isDisplayed();
  } catch {
    return false;
  }
}

/**
 * Ensures a radio button is selected by trying multiple methods
 * @param {WebDriver} driver - Selenium WebDriver instance
 * @param {string} elementId - ID of the element
 */
async function ensureRadioSelected(driver, elementId) {
  try {
    // Wait for the element to be clickable
    const element = await driver.wait(
      until.elementLocated(By.id(elementId)),
      10000
    );
    
    // Try standard click
    await element.click();
    
    // Verify it was selected, if not try JavaScript
    const isSelected = await element.isSelected();
    if (!isSelected) {
      await driver.executeScript(`document.getElementById('${elementId}').click();`);
    }
    
    // Final verification with small wait
    await driver.wait(
      async () => {
        const elem = await driver.findElement(By.id(elementId));
        return await elem.isSelected();
      },
      2000
    );
  } catch (e) {
    console.log(`Warning: Could not select radio button ${elementId}: ${e}`);
    // Last resort - forcibly set the checked property using JavaScript
    await driver.executeScript(
      `document.getElementById('${elementId}').checked = true;` + 
      `document.getElementById('${elementId}').dispatchEvent(new Event('change', { bubbles: true }));`
    );
  }
}

module.exports = {
  setValueById,
  selectOptionById,
  selectChosenOptionById,
  checkButtonById,
  selectRadioByValue,
  isElementVisible,
  ensureRadioSelected
};
