"""
Common utilities for form control extraction.
"""
import re
from bs4 import Tag
from forms.utils.logger import get_logger

logger = get_logger('form_extract')

def find_label_for(container, element):
    """Find label text for an input element"""
    element_id = element.get('id')
    if not element_id:
        return None
        
    # Look for a label with matching 'for' attribute
    label = container.find('label', attrs={'for': element_id})
    if label:
        # Remove any child elements from label text
        for child in label.find_all():
            child.extract()
        return label.text.strip()
    
    # If no direct label found, look for wrapping label
    parent = element.parent
    if parent and parent.name == 'label':
        # Check if parent is a Tag object before attempting to copy
        if isinstance(parent, Tag):
            try:
                # Clone label to avoid modifying original
                parent_clone = parent.copy()
                # Remove the input element from cloned label
                for child in parent_clone.find_all():
                    if child.get('id') == element_id:
                        child.extract()
                return parent_clone.text.strip()
            except (AttributeError, TypeError) as e:
                # Log the error and continue with alternative approach
                logger.warning(f"Error copying parent tag: {e}")
                # Alternative: extract text directly from parent
                original_html = str(parent)
                element_html = str(element)
                if element_html in original_html:
                    text = parent.text.strip()
                    return text
        else:
            # If parent is not a Tag object, just get text
            return parent.text.strip() if hasattr(parent, 'text') else None
        
    return None

def find_group_label(container, group_name):
    """Try to find a label for a group of form controls (like radio buttons)"""
    # This is more heuristic-based since groups often don't have explicit labels with 'for' attributes
    # Look for preceding label or legend
    
    # First try to find any element with the group name in title attributes
    title_elements = container.find_all(attrs={'title': re.compile(group_name, re.IGNORECASE)})
    if title_elements:
        return title_elements[0].text.strip()
    
    # Next look for legends in fieldsets
    for radio in container.find_all('input', attrs={'name': group_name}):
        fieldset = find_parent_by_tag(radio, 'fieldset')
        if fieldset:
            legend = fieldset.find('legend')
            if legend:
                return legend.text.strip()
    
    # Finally, look for nearby labels or headings
    for radio in container.find_all('input', attrs={'name': group_name}):
        parent = radio.parent
        while parent and parent != container:
            prev = parent.find_previous_sibling(['label', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div'])
            if prev and prev.name in ['label', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p']:
                return prev.text.strip()
            parent = parent.parent
    
    return None

def find_parent_by_tag(element, tag_name):
    """Find parent element with specific tag name"""
    if not element:
        return None
        
    parent = element.parent
    while parent:
        if parent.name == tag_name:
            return parent
        parent = parent.parent
    return None

def get_associated_text(container, element):
    """
    Get text that's associated with a form control but might not be in a formal label
    This helps capture text next to checkboxes and radio buttons
    """
    # First check if there's a wrapping label that contains text directly
    parent = element.parent
    if parent and parent.name == 'label':
        # Extract text but exclude nested elements
        text_content = ''
        for content in parent.contents:
            if isinstance(content, str):
                text_content += content.strip()
        
        if text_content:
            return text_content.strip()
    
    # Check for next sibling that might contain the text (common with checkboxes/radios)
    sibling = element.next_sibling
    if sibling and isinstance(sibling, str) and sibling.strip():
        return sibling.strip()
    
    # Sometimes the text is in a span or other element next to the input
    if parent:
        for sib in parent.find_next_siblings():
            if sib.name in ['span', 'div', 'p'] and sib.text.strip():
                return sib.text.strip()
    
    # Look at previous siblings too (less common but possible)
    if parent:
        for sib in parent.find_previous_siblings():
            if sib.name in ['span', 'div', 'p'] and sib.text.strip():
                return sib.text.strip()
    
    # As a last resort, find any nearby text node
    if parent and parent.parent:
        text_nodes = [node for node in parent.parent.contents if isinstance(node, str) and node.strip()]
        if text_nodes:
            return text_nodes[0].strip()
            
    return None