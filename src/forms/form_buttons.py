"""
Extraction utilities for button controls.
"""

def extract_buttons(container):
    """Extract button elements and input elements with type button/submit/reset"""
    buttons = container.find_all('button')
    button_inputs = container.find_all('input', type=lambda t: t in ['button', 'submit', 'reset'])
    
    result = []
    
    for button in buttons:
        result.append({
            'id': button.get('id', ''),
            'name': button.get('name', ''),
            'type': button.get('type', 'button'),
            'text': button.text.strip(),
            'disabled': button.has_attr('disabled')
        })
    
    for button in button_inputs:
        result.append({
            'id': button.get('id', ''),
            'name': button.get('name', ''),
            'type': button.get('type', 'button'),
            'value': button.get('value', ''),
            'disabled': button.has_attr('disabled')
        })
        
    return result
