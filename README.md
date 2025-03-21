I'll create a comprehensive README.md file for the FormMaster project that includes both developer setup instructions and a user tutorial.

### [README.md](file:///c%3A/Users/harol/personal/form-master-pro/README.md)

```markdown
# FormMaster Pro

FormMaster Pro is an advanced form automation tool designed to streamline the process of filling out web forms, particularly for university applications. It combines a browser extension with a companion desktop application to provide robust form analysis and automated filling capabilities.

![FormMaster Logo](js-src/browser-extension/images/icon128.png)

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

3. **Configure Chrome WebDriver**

   Download the appropriate version of ChromeDriver that matches your installed Chrome version from:
   https://chromedriver.chromium.org/downloads

   Place the executable in the `.formmaster` directory in your user home folder.

### Project Structure

```
form-master-pro/
├── src/                  # Python implementation
├── js-src/               # JavaScript implementation
│   ├── files/            # Document processing utilities
│   ├── forms/            # Form handling modules
│   └── utils/            # Helper utilities
├── browser-extension/    # Chrome/Firefox extension
└── companion-app/        # Electron companion application
```

### Running the JavaScript Version

```bash
cd js-src
npm start -- --dir "/path/to/data/directory"
```

Additional flags:
- `--mode 1`: Run in form analysis mode

### Building the Browser Extension

1. Navigate to the browser-extension directory:
   ```bash
   cd browser-extension
   ```

2. Load the unpacked extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `browser-extension` folder

3. Note the generated extension ID - you'll need it for the companion app setup

### Setting Up the Companion App

1. Navigate to the companion-app directory:
   ```bash
   cd companion-app
   ```

2. Edit `register-native-messaging.js` to replace `<EXTENSION_ID>` with your Chrome extension ID:
   ```javascript
   // In allowed_origins array
   "chrome-extension://<YOUR_EXTENSION_ID_HERE>/"
   ```

3. Register the native messaging host:
   ```bash
   npm run postinstall
   ```

4. Start the companion app:
   ```bash
   npm start
   ```

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

#### Companion App

1. Download the companion app installer for your platform
2. Run the installer and follow the on-screen instructions
3. During first run, you'll be asked to enter your extension ID
4. The app will automatically register itself with your browser

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
```

This README.md provides comprehensive documentation for both developers wanting to work on the code and users simply wanting to install and use the FormMaster application. It includes step-by-step instructions for setting up the development environment, building the browser extension, and using the application to fill forms.

Made changes.

Similar code found with 2 license types