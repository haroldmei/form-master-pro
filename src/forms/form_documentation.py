"""
Utilities for generating documentation from extracted form controls.
"""
import os
import json
from pathlib import Path
import datetime
from utils.logger import get_logger

logger = get_logger('form_extract')

def create_label_mapping(controls):
    """
    Create a mapping of labels to their respective controls for easier reference
    
    Args:
        controls: Dictionary of form controls from extract_form_controls
        
    Returns:
        dict: Mapping of labels to control references
    """
    label_mapping = {}
    
    # Process text inputs
    for i, input_ctrl in enumerate(controls.get('inputs', [])):
        if input_ctrl.get('label'):
            label = input_ctrl['label']
            label_mapping[label] = {
                'type': 'input',
                'input_type': input_ctrl['type'],
                'id': input_ctrl['id'],
                'name': input_ctrl['name'],
                'index': i
            }
    
    # Process selects
    for i, select in enumerate(controls.get('selects', [])):
        if select.get('label'):
            label = select['label']
            label_mapping[label] = {
                'type': 'select',
                'id': select['id'],
                'name': select['name'],
                'has_chosen': select.get('has_chosen', False),
                'index': i,
                'options': [opt['text'] for opt in select.get('options', [])]
            }
    
    # Process textareas
    for i, textarea in enumerate(controls.get('textareas', [])):
        if textarea.get('label'):
            label = textarea['label']
            label_mapping[label] = {
                'type': 'textarea',
                'id': textarea['id'],
                'name': textarea['name'],
                'index': i
            }
    
    # Process radio groups
    for i, radio_group in enumerate(controls.get('radios', [])):
        if radio_group.get('label'):
            label = radio_group['label']
            label_mapping[label] = {
                'type': 'radio_group',
                'name': radio_group['name'],
                'index': i,
                'options': []
            }
            
            # Add individual radio options
            for option in radio_group.get('options', []):
                option_text = option.get('label', '') or option.get('text', '') or option.get('value', '')
                label_mapping[label]['options'].append({
                    'id': option['id'],
                    'value': option['value'],
                    'text': option_text
                })
    
    # Process checkboxes - Use improved logic to ensure we have text for each
    for i, checkbox in enumerate(controls.get('checkboxes', [])):
        # Combine all possible text sources to get the best label
        all_text_sources = []
        
        # Get the formal label if available
        if checkbox.get('label'):
            all_text_sources.append(checkbox.get('label'))
            
        # Get the associated text if available
        if checkbox.get('text'):
            all_text_sources.append(checkbox.get('text'))
            
        # Fallback to name or id if needed
        if not all_text_sources and checkbox.get('name'):
            all_text_sources.append(f"checkbox-{checkbox.get('name')}")
        elif not all_text_sources and checkbox.get('id'):
            all_text_sources.append(f"checkbox-{checkbox.get('id')}")
        
        # Use the first available text as key
        if all_text_sources:
            display_text = all_text_sources[0]
            # Ensure we don't duplicate keys - append index if needed
            if display_text in label_mapping:
                display_text = f"{display_text} (#{i+1})"
                
            label_mapping[display_text] = {
                'type': 'checkbox',
                'id': checkbox.get('id', ''),
                'name': checkbox.get('name', ''),
                'value': checkbox.get('value', ''),
                'text': checkbox.get('text', ''),
                'label': checkbox.get('label', ''),
                'index': i
            }
    
    return label_mapping

def generate_field_documentation(controls):
    """
    Generate human-readable documentation of form fields
    
    Args:
        controls: Dictionary of form controls from extract_form_controls
        
    Returns:
        str: Markdown-formatted documentation of form fields
    """
    docs = ["# Form Field Documentation\n"]
    mapping = controls.get('label_mapping', {})
    
    # Group by field type
    field_types = {
        'Text Inputs': [],
        'Dropdowns': [],
        'Radio Groups': [],
        'Checkboxes': [],
        'Textareas': []
    }
    
    for label, info in mapping.items():
        field_type = info['type']
        if field_type == 'input':
            field_types['Text Inputs'].append((label, info))
        elif field_type == 'select':
            field_types['Dropdowns'].append((label, info))
        elif field_type == 'radio_group':
            field_types['Radio Groups'].append((label, info))
        elif field_type == 'checkbox':
            field_types['Checkboxes'].append((label, info))
        elif field_type == 'textarea':
            field_types['Textareas'].append((label, info))
    
    # Generate markdown for each type
    for type_name, fields in field_types.items():
        if not fields:
            continue
            
        docs.append(f"## {type_name}\n")
        
        for label, info in fields:
            docs.append(f"### {label}")
            docs.append(f"- ID: `{info.get('id', 'None')}`")
            docs.append(f"- Name: `{info.get('name', 'None')}`")
            
            if type_name == 'Text Inputs':
                docs.append(f"- Type: `{info.get('input_type', 'text')}`")
            elif type_name == 'Dropdowns':
                docs.append("- Options:")
                for option in info.get('options', []):
                    docs.append(f"  - {option}")
            elif type_name == 'Radio Groups':
                docs.append("- Options:")
                for option in info.get('options', []):
                    option_text = option.get('text', option.get('value', 'Unknown'))
                    option_value = option.get('value', '')
                    docs.append(f"  - {option_text} `[value: {option_value}]`")
            elif type_name == 'Checkboxes':
                docs.append(f"- ID: `{info.get('id', 'None')}`")
                docs.append(f"- Name: `{info.get('name', 'None')}`")
                
                # Add all available text sources for clarity
                if info.get('label') and info.get('label') != label:
                    docs.append(f"- Label: `{info['label']}`")
                if info.get('text') and info.get('text') != label and info.get('text') != info.get('label'):
                    docs.append(f"- Text: `{info['text']}`")
                
                docs.append(f"- Value: `{info.get('value', '')}`")
            
            docs.append("")  # Empty line for spacing
    
    return "\n".join(docs)

def generate_code_from_controls(controls):
    """
    Generate Python code to interact with the extracted form controls
    
    Args:
        controls: Dictionary of form controls from extract_form_controls
        
    Returns:
        str: Python code snippet for form interaction
    """
    code = []
    code.append("# Generated code for form interaction")
    code.append("from selenium.webdriver.common.by import By")
    code.append("from forms.form_utils import set_value_by_id, select_chosen_option_by_id, ensure_radio_selected")
    code.append("")
    
    # Process text inputs
    for input_ctrl in controls.get('inputs', []):
        if input_ctrl['type'] in ['text', 'email', 'tel', 'number', 'date', 'password']:
            id_val = input_ctrl['id']
            if id_val:
                comment = f"# {input_ctrl['label']}" if input_ctrl['label'] else ""
                code.append(f"set_value_by_id(driver, '{id_val}', 'value') {comment}")
    
    # Process selects
    for select in controls.get('selects', []):
        id_val = select['id']
        if id_val:
            comment = f"# {select['label']}" if select['label'] else ""
            if select['has_chosen']:
                code.append(f"select_chosen_option_by_id(driver, '{id_val}', 'option text') {comment}")
            else:
                code.append(f"select_option_by_id(driver, '{id_val}', 'option text') {comment}")
    
    # Process radio groups
    for radio_group in controls.get('radios', []):
        comment = f"# {radio_group['label']}" if radio_group.get('label') else ""
        code.append(f"# Radio group: {radio_group['name']} {comment}")
        for option in radio_group['options']:
            if option['id']:
                label = f" # {option['label']}" if option.get('label') else ""
                code.append(f"ensure_radio_selected(driver, '{option['id']}'){label}")
    
    # Process checkboxes
    for checkbox in controls.get('checkboxes', []):
        id_val = checkbox['id']
        if id_val:
            comment = f" # {checkbox['label']}" if checkbox['label'] else ""
            code.append(f"check_button_by_id(driver, '{id_val}'){comment}")
    
    return "\n".join(code)

def save_form_controls_to_json(controls, output_path=None):
    """
    Save extracted form controls to a JSON file
    
    Args:
        controls: Dictionary of form controls from extract_form_controls
        output_path: Path to save the JSON file, if None generates a timestamped filename
        
    Returns:
        str: Path to the saved JSON file
    """
    if output_path is None:
        # Generate a timestamped filename
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        output_dir = Path(os.path.join(os.path.expanduser("~"), "formmaster_output"))
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = os.path.join(output_dir, f"form_controls_{timestamp}.json")
    
    # Convert complex objects to serializable types
    def json_serializable(obj):
        if isinstance(obj, set):
            return list(obj)
        return obj
    
    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(controls, f, default=json_serializable, indent=2, ensure_ascii=False)
        logger.info(f"Form controls saved to {output_path}")
        return output_path
    except Exception as e:
        logger.error(f"Error saving form controls to JSON: {str(e)}")
        return None

def save_form_documentation(driver, controls, output_path=None):
    """
    Save documentation to a markdown file
    
    Args:
        driver: Selenium WebDriver instance
        controls: Dictionary of form controls
        output_path: Path to save the documentation, if None generates a timestamped filename
        
    Returns:
        str: Path to the saved markdown file
    """
    docs = generate_field_documentation(controls)
    
    if output_path is None:
        # Generate a timestamped filename
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        output_dir = Path(os.path.join(os.path.expanduser("~"), "formmaster_output"))
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = os.path.join(output_dir, f"form_documentation_{timestamp}.md")
    
    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(docs)
        logger.info(f"Form documentation saved to {output_path}")
        return output_path
    except Exception as e:
        logger.error(f"Error saving form documentation: {str(e)}")
        return None
