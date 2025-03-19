"""
Extraction utilities for textarea controls.
"""
from forms.utils.form_extract_common import find_label_for

def extract_textareas(container):
    """Extract textarea elements"""
    textareas = container.find_all('textarea')
    
    result = []
    for textarea in textareas:
        textarea_info = {
            'id': textarea.get('id', ''),
            'name': textarea.get('name', ''),
            'value': textarea.text,
            'required': textarea.has_attr('required'),
            'placeholder': textarea.get('placeholder', ''),
            'rows': textarea.get('rows', ''),
            'cols': textarea.get('cols', ''),
            'disabled': textarea.has_attr('disabled'),
            'readonly': textarea.has_attr('readonly')
        }
        
        # Try to find label
        textarea_info['label'] = find_label_for(container, textarea)
        
        result.append(textarea_info)
        
    return result
