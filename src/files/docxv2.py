from docx.api import Document
import json
import re

def process_document_elements(docx_path):
    """
    Process document with access to runs and formatting.
    
    Args:
        docx_path (str): Path to the .docx file
    """
    doc = Document(docx_path)
    
    # Access formatting within paragraphs
    for para in doc.paragraphs:
        print(f"Paragraph alignment: {para.alignment}")
        
        for run in para.runs:
            # A run is a sequence of text with consistent formatting
            text = run.text
            bold = run.bold
            italic = run.italic
            underline = run.underline
            
            print(f"Text: '{text}', Bold: {bold}, Italic: {italic}, Underline: {underline}")

from docx import Document

def clean_text(text):
    """
    Clean text by removing excess whitespace and normalizing content.
    
    Args:
        text (str): Text to clean
        
    Returns:
        str: Cleaned text
    """
    if not text:
        return ""
    
    # Remove extra whitespace
    cleaned = re.sub(r'\s+', ' ', text.strip())
    
    # Remove any control characters
    cleaned = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', cleaned)
    
    return cleaned

def extract_structured_content(docx_path):
    """
    Extract content with basic structure preserved.
    
    Args:
        docx_path (str): Path to the .docx file
        
    Returns:
        dict: Dictionary containing document content by section
    """
    doc = Document(docx_path)
    content = {
        'paragraphs': [],
        'headings': [],
        'tables': []
    }
    
    # Extract paragraphs and detect headings
    for para in doc.paragraphs:
        cleaned_text = clean_text(para.text)
        if not cleaned_text:  # Skip empty paragraphs
            continue
            
        if para.style.name.startswith('Heading'):
            content['headings'].append({
                'level': int(para.style.name[-1]) if para.style.name[-1].isdigit() else 0,
                'text': cleaned_text
            })
        else:
            content['paragraphs'].append(cleaned_text)
    
    # Extract tables
    for i, table in enumerate(doc.tables):
        table_data = []
        has_content = False
        for row in table.rows:
            row_data = [clean_text(cell.text) for cell in row.cells]
            # Check if row has any non-empty content
            if any(cell for cell in row_data):
                has_content = True
                table_data.append(row_data)
        
        # Only add tables with actual content
        if has_content:
            content['tables'].append(table_data)
    
    return content

if __name__ == '__main__':
    content = extract_structured_content('C:\\Users\harol\\Documents\\0105 郭巾秋\\澳洲大学申请信息表2020.docx')
    
    # Save to JSON file
    with open('document.json', 'w', encoding='utf-8') as f:
        json.dump(content, f, ensure_ascii=False, indent=4)
    
    print(f"Content extracted and saved to document.json")