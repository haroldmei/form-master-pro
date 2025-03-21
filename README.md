# FormMaster

## Automate Your Form Submissions at Scale

FormMaster is a powerful automation tool designed to streamline the process of submitting multiple form entries across various platforms.

![FormMaster Logo](./formmaster.png)

## 🚀 Key Features

- **Bulk Processing:** With predefined templates, lodge hundreds of customer information entries within hours instead of days
- **AI-Powered Document Extraction:** Automatically extract information from various document types (PDF, DOCX, XLSX, etc.)
- **Flexible Automation:** Choose between full automation or semi-automation with user review
- **Custom Templates:** Create reusable templates for your most common form submissions
- **Reliability:** Robust error handling ensures your submissions complete successfully

## 💼 Use Cases

- **Education:** Process hundreds of student applications with speed and accuracy
- **HR & Recruitment:** Submit candidate information to multiple job portals automatically
- **Healthcare:** Process patient intake forms efficiently
- **Legal Services:** Submit documentation to courts and government agencies
- **Real Estate:** Process multiple property listings across platforms

## 🔧 Getting Started

## Usage

After installation, you can run FormMaster in two ways:

### Command Line

```bash
python src\files\docx-extractor.py "C:\\Users\\harol\\Documents\\0105 郭巾秋\\澳洲大学申请信息表2020.docx" --output out.json

python -m formfiller --path /path/to/student/documents --portal usyd
```

### As Python Module

```python
from formmaster import FormFiller

filler = FormFiller(path="/path/to/student/documents", portal="usyd")
filler.run()
```

## ✨ Why FormMaster?

> "FormMaster reduced our application processing time by 90%. What used to take us weeks now takes just hours." - Education Administrator

### Save Time, Reduce Errors

Manual form entry is tedious and error-prone. FormMaster automates the process, ensuring accuracy while saving valuable staff time. Our intelligent form filling technology understands form structures and adapts to changes, ensuring your submissions are always successful.

### Powerful AI Integration

Our AI capabilities mean FormMaster can:
- Extract information from unstructured documents
- Intelligently map extracted data to the right form fields
- Learn from corrections to improve future accuracy

### Scalable Solutions for Any Size Organization

Whether you're processing dozens or thousands of submissions, FormMaster scales to meet your needs with flexible deployment options.

## 📊 Performance Metrics

- **Speed:** Process forms up to 50x faster than manual entry
- **Accuracy:** Reduce data entry errors by up to 95%
- **ROI:** Organizations typically see ROI within the first month of implementation

## Development

### Building the Package

To build the package locally:

1. Ensure you have the build tools installed:
   ```bash
   pip install build twine
   ```

2. Build the package:
   ```bash
   python -m build
   ```

This will create distribution files in the `dist/` directory:
- `formmaster-0.1.0-py3-none-any.whl` (Wheel package)
- `formmaster-0.1.0.tar.gz` (Source distribution)

### Publishing to PyPI

To upload the package to PyPI:

1. Test your package with TestPyPI first:
   ```bash
   python -m twine upload --repository-url https://test.pypi.org/legacy/ dist/*
   ```

2. Upload to the official PyPI:
   ```bash
   python -m twine upload dist/*
   ```

### Release

1. Versioning
```bash
python increment_version.py
```

2. Tagging
```bash
git tag -a v0.1.21 -m "FormMaster version 0.1.21 release"
git push origin v0.1.21
```

You will need to provide your PyPI credentials during upload. Alternatively, create a `.pypirc` file in your home directory:

## Documentation

For detailed documentation, please visit the [GitHub repository](https://github.com/haroldmei/form-master).

## 📞 Contact Us

Ready to revolutionize your form submission process? [Get in touch today!](mailto:contact@formmaster.com)

## License

This project is licensed under the MIT License - see the LICENSE file for details.