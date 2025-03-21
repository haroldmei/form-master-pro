"""
Extraction utilities for text input controls.
"""
from forms.form_common import find_label_for

def extract_inputs(container):
    """Extract text, email, password, date and number inputs"""
    input_types = ['text', 'email', 'password', 'date', 'number', 'tel', 'hidden']
    inputs = container.find_all('input', type=lambda t: t in input_types)
    
    result = []
    for input_elem in inputs:
        input_info = {
            'id': input_elem.get('id', ''),
            'name': input_elem.get('name', ''),
            'type': input_elem.get('type', 'text'),
            'value': input_elem.get('value', ''),
            'placeholder': input_elem.get('placeholder', ''),
            'required': input_elem.has_attr('required'),
            'max_length': input_elem.get('maxlength', ''),
            'disabled': input_elem.has_attr('disabled'),
            'readonly': input_elem.has_attr('readonly')
        }
        
        # Try to find label
        input_info['label'] = find_label_for(container, input_elem)
        
        result.append(input_info)
    
    return result
