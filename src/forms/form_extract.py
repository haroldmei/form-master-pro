"""
Form control extraction utilities for FormMaster.
This module provides functions to extract and analyze form controls from HTML pages.
"""

import os
import json
import datetime
import traceback
from pathlib import Path
from bs4 import BeautifulSoup
from selenium.common.exceptions import NoSuchElementException
from forms.utils.logger import get_logger

# Import individual control extractors
from forms.utils.form_extract_inputs import extract_inputs
from forms.utils.form_extract_selects import extract_selects
from forms.utils.form_extract_textareas import extract_textareas
from forms.utils.form_extract_buttons import extract_buttons
from forms.utils.form_extract_radios import extract_radio_groups
from forms.utils.form_extract_checkboxes import extract_checkboxes

# Import documentation utilities
from forms.utils.form_extract_documentation import (
    create_label_mapping,
    generate_field_documentation,
    generate_code_from_controls,
    save_form_controls_to_json,
    save_form_documentation
)

logger = get_logger('form_extract')

def extract_form_controls(driver, form_selector=None):
    """
    Extract form controls from the current page using Selenium WebDriver.
    
    Args:
        driver: Selenium WebDriver instance
        form_selector: CSS selector for the form element, if None extracts all form controls
        
    Returns:
        dict: Dictionary of form controls grouped by type with their attributes
    """
    try:
        # Get page HTML
        html = driver.page_source
        
        # Parse with BeautifulSoup
        soup = BeautifulSoup(html, 'html.parser')
        
        # Find target form if selector provided, otherwise use whole document
        container = soup.select_one(form_selector) if form_selector else soup
        if not container:
            logger.warning(f"Form selector '{form_selector}' not found")
            return {}
            
        # Extract different control types
        controls = {
            'inputs': extract_inputs(container),
            'selects': extract_selects(container),
            'textareas': extract_textareas(container),
            'buttons': extract_buttons(container),
            'radios': extract_radio_groups(container),
            'checkboxes': extract_checkboxes(container)
        }
        
        # Create a label-to-control mapping for easier reference
        controls['label_mapping'] = create_label_mapping(controls)
        
        return controls
        
    except Exception as e:
        logger.error(f"Error extracting form controls: {str(e)}")
        logger.error(f"Call stack:\n{traceback.format_exc()}")
        return {}

def extract_form_structure(driver, form_selector=None):
    """
    Extract a more user-friendly form structure with labels as primary keys
    
    Args:
        driver: Selenium WebDriver instance
        form_selector: CSS selector for the form element
        
    Returns:
        dict: Dictionary with labels as keys and control information as values
    """
    try:
        controls = extract_form_controls(driver, form_selector)
        return controls.get('label_mapping', {})
    except Exception as e:
        logger.error(f"Error extracting form structure: {str(e)}")
        logger.error(f"Call stack:\n{traceback.format_exc()}")
        return {}

def extract_and_save_form_controls(driver, form_selector=None, output_path=None):
    """
    Extract form controls from the current page and save them to a JSON file
    
    Args:
        driver: Selenium WebDriver instance
        form_selector: CSS selector for the form element
        output_path: Path to save the JSON file, if None generates a timestamped filename
        
    Returns:
        tuple: (dict of controls, path to saved JSON file)
    """
    try:
        controls = extract_form_controls(driver, form_selector)
        json_path = save_form_controls_to_json(controls, output_path)
        return controls, json_path
    except Exception as e:
        logger.error(f"Error extracting and saving form controls: {str(e)}")
        logger.error(f"Call stack:\n{traceback.format_exc()}")
        return {}, None

def extract_and_save_all(driver, form_selector=None, base_path=None):
    """
    Extract form controls and save both JSON and markdown documentation
    
    Args:
        driver: Selenium WebDriver instance
        form_selector: CSS selector for the form element
        base_path: Base path for output files, if None uses default
        
    Returns:
        tuple: (dict of controls, path to JSON file, path to markdown file)
    """
    try:
        controls = extract_form_controls(driver, form_selector)
        
        if base_path is None:
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            output_dir = Path(os.path.join(os.path.expanduser("~"), "formmaster_output"))
            output_dir.mkdir(parents=True, exist_ok=True)
            base_path = os.path.join(output_dir, f"form_{timestamp}")
        
        json_path = save_form_controls_to_json(controls, f"{base_path}.json")
        docs = generate_field_documentation(controls)
        
        md_path = f"{base_path}.md"
        try:
            with open(md_path, 'w', encoding='utf-8') as f:
                f.write(docs)
            logger.info(f"Form documentation saved to {md_path}")
        except Exception as e:
            logger.error(f"Error saving form documentation: {str(e)}")
            logger.error(f"Call stack:\n{traceback.format_exc()}")
            md_path = None
        
        return controls, json_path, md_path
    except Exception as e:
        logger.error(f"Error in extract_and_save_all: {str(e)}")
        logger.error(f"Call stack:\n{traceback.format_exc()}")
        return {}, None, None
