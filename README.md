# FormMaster Pro

[![Production Release](https://github.com/username/form-master-pro/actions/workflows/production-release.yml/badge.svg)](https://github.com/username/form-master-pro/actions/workflows/production-release.yml)
[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/YOUR_EXTENSION_ID)](https://chrome.google.com/webstore/detail/YOUR_EXTENSION_ID)

## Transform Your Form-Filling Experience

FormMaster Pro is a revolutionary tool designed to eliminate the tedious task of manual form filling. With powerful AI capabilities and cross-platform compatibility, it streamlines your workflow and saves valuable time.

## Key Features

### 🌐 Universal Form Compatibility

FormMaster Pro intelligently adapts to virtually any form structure it encounters:

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

Use FormMaster Pro anywhere Chrome is available:

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

### Setting Up the Development Environment

1. **Clone the repository**

   ```bash
   git clone https://github.com/haroldmei/form-master.git
   cd form-master-pro
   ```

2. **Install dependencies for JavaScript version**

   ```bash
   # Install JS dependencies
   cd js-src
   npm install
   
   # Install browser extension dependencies
   cd ../browser-extension
   npm install
   
   # Install companion app dependencies
   cd ../companion-app
   npm install
   ```

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

## Getting Started

1. Install FormMaster Pro from the [Chrome Web Store](https://chrome.google.com/webstore/detail/YOUR_EXTENSION_ID)
2. Pin the extension to your browser toolbar
3. Click the FormMaster Pro icon when you encounter a form
4. Import your data or let FormMaster Pro extract it from your documents
5. Review and submit the automatically filled form

### Quick Start Tutorial

1. **Launch the Companion App**
   - Start the FormMaster Companion app
   - It will appear in your system tray/menu bar
   
2. **Load Data File**
   - Click the FormMaster icon in your browser
   - Click "Load Data File"
   - Select a DOCX or JSON file containing your form data
   
3. **Configure Field Mappings**
   - Click "Field Mappings" in the extension popup
   - Add a new URL pattern matching the form you want to fill
   - For each form field:
     - Enter the field ID or label
     - Choose the mapping type (direct, table, or regex)
     - Specify the mapping value
   - Click "Save Mappings"
   
4. **Fill Forms**
   - Navigate to the form page
   - Click "Analyze Form" in the extension popup
   - Review the detected form fields
   - Click "Auto Fill Form"
   
5. **Review and Submit**
   - Verify all fields were filled correctly
   - Make any necessary corrections manually
   - Submit the form

### Field Mapping Guide

#### Direct Value Mapping

Use for static text values:
- Field ID: `firstName`
- Mapping Type: `direct`
- Mapping Value: `John`

#### Table Cell Mapping

Extract data from a specific table cell:
- Field ID: `email`
- Mapping Type: `table`
- Mapping Value: `0,2,1` (table 0, row 2, column 1)

#### Regex Pattern Mapping

Use regular expressions to extract specific data:
- Field ID: `phoneNumber`
- Mapping Type: `regex`
- Mapping Value: `Phone:\s*(\d+)` (extracts digits after "Phone:")

### Troubleshooting

- **Connection Issues**: Ensure the companion app is running and shows "Connected"
- **Form Detection Problems**: Try refreshing the page before analyzing
- **Mapping Errors**: Verify your field IDs and mapping values
- **Extension Not Working**: Check if the extension is enabled and has the necessary permissions

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