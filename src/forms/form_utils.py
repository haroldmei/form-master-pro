from selenium.webdriver.common.by import By
from selenium.common.exceptions import InvalidElementStateException, ElementClickInterceptedException
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

import time
from forms.utils.logger import get_logger

def set_value_by_id(driver, element_id, value):
    """Set value to an input field by ID"""
    try:
        element = driver.find_element(By.ID, element_id)
        element.clear()
        element.send_keys(value)
    except InvalidElementStateException:
        # If element can't be cleared, try using JavaScript
        driver.execute_script(f"document.getElementById('{element_id}').value = '{value}';")
    except Exception as e:
        print(f"Error setting value for element {element_id}: {e}")

def select_option_by_id(driver, element_id, option_text):
    """Select an option from a dropdown by ID"""
    try:
        # For chosen-enhanced dropdowns, need to click and then select
        dropdown = driver.find_element(By.ID, f"{element_id}_chosen")
        
        # Scroll dropdown into view before clicking
        driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", dropdown)
        
        # Try clicking with wait for it to be clickable
        try:
            WebDriverWait(driver, 5).until(
                EC.element_to_be_clickable((By.ID, f"{element_id}_chosen"))
            ).click()
        except:
            # Fallback to JavaScript click if regular click doesn't work
            driver.execute_script("arguments[0].click();", dropdown)
        
        # Find options and try to match text
        options = driver.find_elements(By.CSS_SELECTOR, f"#{element_id}_chosen .chosen-results li")
        matched_option = None
        
        for option in options:
            if option_text.lower() in option.text.lower():
                matched_option = option
                break
        
        if matched_option:
            # Scroll the option into view
            driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", matched_option)
            
            try:
                # Try using ActionChains for better click control
                ActionChains(driver).move_to_element(matched_option).click().perform()
            except ElementClickInterceptedException:
                # If still intercepted, use JavaScript click
                driver.execute_script("arguments[0].click();", matched_option)
    except Exception as e:
        print(f"Error selecting option for element {element_id}: {e}")
        # Last resort - try direct value setting if possible
        try:
            select_element = driver.find_element(By.ID, element_id)
            driver.execute_script(f"document.getElementById('{element_id}').value = '{option_text}';")
            # Trigger change event to ensure the UI updates
            driver.execute_script("arguments[0].dispatchEvent(new Event('change', { bubbles: true }));", select_element)
        except:
            print(f"Failed to set value for dropdown {element_id} using JavaScript fallback")

def select_chosen_option_by_id(driver, element_id, option_text):
    """
    Select an option from a Chosen dropdown by clicking and searching.
    
    Args:
        driver: Selenium WebDriver
        element_id: ID of the select element (without the _chosen suffix)
        option_text: Text of the option to select (case insensitive)
    """
    logger = get_logger('form_utils')
    
    try:
        # Click on the Chosen container to open the dropdown
        chosen_container = driver.find_element(By.ID, f"{element_id}_chosen")
        chosen_container.click()
        
        # Wait for dropdown to be visible
        wait = WebDriverWait(driver, 10)
        search_input = wait.until(EC.visibility_of_element_located(
            (By.CSS_SELECTOR, f"#{element_id}_chosen .chosen-search-input")
        ))
        
        # Type the option text to filter
        search_input.clear()
        search_input.send_keys(option_text)
        
        # Wait a moment for filtering to occur
        time.sleep(0.5)
        
        # Find and click the filtered option (case insensitive)
        options = driver.find_elements(By.CSS_SELECTOR, f"#{element_id}_chosen .chosen-results li")
        for option in options:
            if option.text.lower() == option_text.lower() or option_text.lower() in option.text.lower():
                option.click()
                logger.info(f"Selected '{option.text}' from Chosen dropdown '{element_id}'")
                return True
        
        # If exact match not found, click first result if available
        if options:
            options[0].click()
            logger.info(f"Selected first available option '{options[0].text}' from Chosen dropdown '{element_id}'")
            return True
            
        logger.warning(f"Could not find option '{option_text}' in Chosen dropdown '{element_id}'")
        return False
        
    except Exception as e:
        logger.error(f"Error selecting option from Chosen dropdown: {e}")
        return False
    

def check_button_by_id(driver, element_id):
    """Check a checkbox or radio button by ID"""
    try:
        element = driver.find_element(By.ID, element_id)
        if not element.is_selected():
            element.click()
    except Exception as e:
        print(f"Error checking element {element_id}: {e}")

def select_radio_by_value(driver, name, value):
    """Select a radio button by its name and value attributes"""
    try:
        # Find all radio buttons with the given name
        radio_buttons = driver.find_elements(By.CSS_SELECTOR, f"input[name='{name}'][value='{value}']")
        
        # Click the first matching radio button if found
        if (radio_buttons):
            if not radio_buttons[0].is_selected():
                radio_buttons[0].click()
    except Exception as e:
        print(f"Error selecting radio button {name}={value}: {e}")

def is_element_visible(driver, element_id):
    """Check if an element is visible on the page"""
    try:
        element = driver.find_element(By.ID, element_id)
        return element.is_displayed()
    except:
        return False


def ensure_radio_selected(driver, element_id):
    """Ensures a radio button is selected by trying multiple methods"""
    try:
        # Wait for the element to be clickable
        element = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.ID, element_id))
        )
        
        # Try standard click
        element.click()
        
        # Verify it was selected, if not try JavaScript
        if not element.is_selected():
            driver.execute_script("document.getElementById('{}').click();".format(element_id))
            
        # Final verification with small wait
        WebDriverWait(driver, 2).until(
            lambda d: d.find_element(By.ID, element_id).is_selected()
        )
    except Exception as e:
        print(f"Warning: Could not select radio button {element_id}: {str(e)}")
        # Last resort - forcibly set the checked property using JavaScript
        driver.execute_script(
            "document.getElementById('{}').checked = true; "
            "document.getElementById('{}').dispatchEvent(new Event('change', { bubbles: true }));"
            .format(element_id, element_id)
        )
