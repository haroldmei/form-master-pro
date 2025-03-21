"""
Extraction utilities for checkbox controls.
"""
from forms.form_common import find_label_for, find_parent_by_tag
from utils.logger import get_logger

logger = get_logger('form_extract_checkboxes')

def extract_checkboxes(container):
    """Extract checkbox inputs"""
    if container is None:
        logger.error("Container is None in extract_checkboxes")
        return []
        
    try:
        checkboxes = container.find_all('input', type='checkbox')
        
        result = []
        for checkbox in checkboxes:
            checkbox_info = {
                'id': checkbox.get('id', ''),
                'name': checkbox.get('name', ''),
                'value': checkbox.get('value', ''),
                'checked': checkbox.has_attr('checked'),
                'disabled': checkbox.has_attr('disabled')
            }
            
            # Try to find formal label with 'for' attribute 
            checkbox_info['label'] = find_label_for(container, checkbox)
            
            # Try to find associated text through various methods
            try:
                text_content = get_checkbox_text(container, checkbox)
                if text_content:
                    checkbox_info['text'] = text_content
            except Exception as e:
                logger.error(f"Error getting checkbox text: {e}")
            
            result.append(checkbox_info)
            
        return result
    except Exception as e:
        logger.error(f"Error in extract_checkboxes: {e}")
        return []

def get_checkbox_text(container, checkbox):
    """
    Get text associated with a checkbox through multiple approaches
    This is specialized for checkboxes which often have complex label patterns
    """
    if container is None or checkbox is None:
        return None
        
    text = []
    
    # Method 1: Check for span element within the same label as checkbox
    parent = checkbox.parent
    if parent and parent.name == 'label':
        # Look for span elements inside the label
        spans = parent.find_all('span')
        if spans:
            for span in spans:
                if span and span.text and span.text.strip():
                    text.append(span.text.strip())
        
        # If no spans with text, extract text directly from the label
        if not any(text):
            label_text = ""
            for content in parent.contents:
                if isinstance(content, str):
                    label_text += content.strip() + " "
                # For non-input elements within label, get their text
                elif content is not None and hasattr(content, 'name') and content.name != 'input':
                    if hasattr(content, 'get_text'):
                        label_text += content.get_text().strip() + " "
            
            if label_text.strip():
                text.append(label_text.strip())
    
    # Method 2: Check for immediately adjacent text nodes
    next_sibling = checkbox.next_sibling
    if next_sibling and isinstance(next_sibling, str) and next_sibling.strip():
        text.append(next_sibling.strip())
    
    # Method 3: Check for adjacent span, label or text elements
    if parent:
        # Look for sibling elements that might contain label text
        for sibling in parent.next_siblings:
            if isinstance(sibling, str) and sibling.strip():
                text.append(sibling.strip())
                break
            elif sibling.name in ['span', 'label', 'div'] and sibling.text.strip():
                text.append(sibling.text.strip())
                break
    
    # Method 4: Look for elements with matching "for" attribute
    if checkbox.get('id'):
        label_elem = container.find('label', attrs={'for': checkbox.get('id')})
        if label_elem and label_elem.text.strip():
            text.append(label_elem.text.strip())
            
    # Method 5: If within a table cell, look for text in adjacent cells
    cell = find_parent_by_tag(checkbox, 'td')
    if cell:
        # Look for text in the next cell
        next_cell = cell.find_next_sibling('td')
        if next_cell and next_cell.text.strip():
            text.append(next_cell.text.strip())
    
    # Method 6: If wrapped in a div with adjacent label/span, get that text
    div_parent = find_parent_by_tag(checkbox, 'div') 
    if div_parent:
        # Look for nearby elements that might have label text
        for sibling in div_parent.next_siblings:
            if isinstance(sibling, str) and sibling.strip():
                text.append(sibling.strip())
                break
            elif sibling.name in ['label', 'span', 'div'] and sibling.text.strip():
                text.append(sibling.text.strip())
                break
    
    # Return the first non-empty text found
    for item in text:
        if item:
            return item
    
    return None
