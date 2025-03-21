"""
Extraction utilities for radio button controls.
"""
from forms.form_common import find_label_for, find_group_label, get_associated_text

def extract_radio_groups(container):
    """Extract radio button groups"""
    radio_groups = {}
    radios = container.find_all('input', type='radio')
    
    for radio in radios:
        name = radio.get('name', '')
        if not name:
            continue
            
        if name not in radio_groups:
            radio_groups[name] = {
                'name': name,
                'options': [],
                'label': find_group_label(container, name)
            }
        
        option = {
            'id': radio.get('id', ''),
            'value': radio.get('value', ''),
            'checked': radio.has_attr('checked'),
            'disabled': radio.has_attr('disabled')
        }
        
        # Try to find label for this specific radio button
        option_label = find_label_for(container, radio)
        if option_label:
            option['label'] = option_label
            
        # Get associated text (might be different from label)
        option_text = get_associated_text(container, radio)
        if option_text and option_text != option.get('label', ''):
            option['text'] = option_text
            
        radio_groups[name]['options'].append(option)
    
    return list(radio_groups.values())
