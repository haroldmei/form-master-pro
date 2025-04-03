# FormMasterPro

[![Production Release](https://github.com/username/form-master-pro/actions/workflows/production-release.yml/badge.svg)](https://github.com/username/form-master-pro/actions/workflows/production-release.yml)
[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/YOUR_EXTENSION_ID)](https://chrome.google.com/webstore/detail/YOUR_EXTENSION_ID)

## Transform Your Form-Filling Experience

FormMasterPro is a revolutionary tool designed to eliminate the tedious task of manual form filling. With powerful AI capabilities and cross-platform compatibility, it streamlines your workflow and saves valuable time.

## Key Features

### 🌐 Universal Form Compatibility

FormMasterPro intelligently adapts to virtually any form structure it encounters:

- **Automatic Field Detection**: Identifies form fields regardless of their layout or design
- **Smart Field Matching**: Maps your data to the appropriate fields based on context and patterns
- **Form Type Recognition**: Automatically distinguishes between different types of forms (applications, registrations, surveys, etc.)
- **Dynamic Adaptation**: Adjusts to changing form structures and variations across websites

### 🧠 AI-Powered Document Processing

Transform raw data into perfectly formatted form entries:

- **Unstructured Document Parsing**: Extract relevant information from emails, PDFs, and text documents
- **Structured Data Import**: Seamlessly import data from CSV, JSON, and other structured formats
- **Intelligent Data Extraction**: Identify and extract key information from complex documents
- **Contextual Understanding**: Comprehends the meaning behind form fields to ensure accurate data mapping
- **Format Conversion**: Automatically reformats data to match form requirements

### 💻 Cross-Platform Functionality

Use FormMasterPro anywhere Chrome is available:

- **Chrome Extension**: Works on Windows, macOS, Linux, and ChromeOS
- **Cloud Synchronization**: Access your data across all your devices
- **Consistent Experience**: Enjoy the same powerful features regardless of operating system
- **Workplace Integration**: Seamlessly integrate with your existing workflow tools
- **On-the-go Access**: Fill forms efficiently even on mobile Chrome (Android)

## Features

- **Form Analysis**: Automatically detects and maps form fields on any webpage
- **Data Extraction**: Extracts relevant information from DOCX and JSON files
- **Field Mapping**: Intuitive interface for mapping data to form fields
- **Bulk Processing**: Process multiple applications efficiently
- **Extensible Architecture**: Modular design for adding support for different universities

## System Requirements

- **Operating System**: Windows 10+ (preferred), macOS, or Linux
- **Node.js**: v16.0.0 or higher
- **Chromium-based browser**: Chrome, Edge, or Brave
- **Chrome WebDriver**: Compatible with your Chrome version

## Logic

- **Form analysis**: analyse the forms, extract key words
- **Load content**: load a file into memory
- **Extract content from AI**: make api calls to AI
- **Fill out the form**: automatically fill out forms

## For Developers

### Running the JavaScript Version

### Building the Browser Extension

1. Navigate to the browser-extension directory:
   ```bash
   npm install
   npm run dev
   npm run build
   npm run obfuscate
   npm run package
   ```

2. Load the unpacked extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `browser-extension` folder

3. Note the generated extension ID - you'll need it for the companion app setup

### Debugging

- Browser extension logs are available in the browser's developer console
- Companion app logs are written to the `.formmaster` directory in your user home folder
- Use the `--verbose` flag for additional logging

## For Users

### Installation

#### Browser Extension

1. Download the latest release from [GitHub Releases](https://github.com/haroldmei/form-master/releases)
2. Extract the ZIP file
3. In Chrome, navigate to `chrome://extensions`
4. Enable "Developer mode" in the top-right corner
5. Click "Load unpacked" and select the extracted `browser-extension` folder
6. Note the extension ID (visible on the extensions page)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Built with Selenium WebDriver, Mammoth.js, and Electron
- Icons from [Material Design Icons](https://material.io/resources/icons/)

## Learn More

Visit our [website](https://formasterpro.example.com) for tutorials, documentation, and support.

## Todo list
* Auth failed should bring user to account page
* 