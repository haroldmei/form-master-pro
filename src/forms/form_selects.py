"""
Extraction utilities for select dropdown controls.
"""
from forms.utils.form_extract_common import find_label_for
from forms.utils.logger import get_logger

logger = get_logger('form_extract_selects')

def extract_selects(container):
    """Extract select dropdowns and their options"""
    selects = container.find_all('select')
    
    result = []
    for select in selects:
        options = []
        for option in select.find_all('option'):
            options.append({
                'value': option.get('value', ''),
                'text': option.text.strip(),
                'selected': option.has_attr('selected')
            })
        
        select_info = {
            'id': select.get('id', ''),
            'name': select.get('name', ''),
            'required': select.has_attr('required'),
            'disabled': select.has_attr('disabled'),
            'options': options
        }
        
        # Try to find label
        select_info['label'] = find_label_for(container, select)
        
        # Check for Chosen enhancement - escape selector to handle special characters
        select_id = select.get('id', '')
        if select_id:
            try:
                # Use a safer approach to find the chosen container
                chosen_class = f"{select_id}_chosen"
                chosen_elements = container.find_all(id=chosen_class)
                select_info['has_chosen'] = len(chosen_elements) > 0
            except Exception as e:
                logger.warning(f"Error checking for chosen enhancement for {select_id}: {e}")
                select_info['has_chosen'] = False
        else:
            select_info['has_chosen'] = False
        
        result.append(select_info)
    
    return result
