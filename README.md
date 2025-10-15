# FormMasterPro

> **AI-Powered Form Automation for Chrome**

[![Version](https://img.shields.io/badge/version-0.1.26-blue.svg)](https://github.com/haroldmei/form-master-pro)
[![License](https://img.shields.io/badge/license-Proprietary-red.svg)](LICENSE)
[![Chrome Web Store](https://img.shields.io/badge/Chrome-Extension-brightgreen.svg)](https://chrome.google.com/webstore)

FormMasterPro is an intelligent Chrome extension that eliminates the tedium of filling out online forms by automatically extracting information from your documents and populating form fields using advanced AI technology.

---

## 📋 Table of Contents

- [For Users](#-for-users)
  - [What is FormMasterPro?](#what-is-formmasterpro)
  - [Key Features](#key-features)
  - [Installation](#installation)
  - [Getting Started](#getting-started)
  - [How to Use](#how-to-use)
  - [Privacy & Security](#privacy--security)
  - [FAQ](#faq)
- [For Developers](#-for-developers)
  - [Technical Architecture](#technical-architecture)
  - [Development Setup](#development-setup)
  - [Project Structure](#project-structure)
  - [Build & Deploy](#build--deploy)
  - [Contributing](#contributing)

---

## 👥 For Users

### What is FormMasterPro?

FormMasterPro is a smart form-filling assistant that saves you time and reduces errors when completing online forms. Whether you're applying for jobs, registering for services, or filling out repetitive paperwork, FormMasterPro automates the process by:

1. **Extracting information** from your PDF and DOCX documents
2. **Analyzing web forms** to understand what information is needed
3. **Intelligently matching** your data to the correct form fields
4. **Auto-filling forms** with accurate information

### Key Features

#### 🧠 AI-Powered Intelligence
- Uses Claude AI to understand form context and requirements
- Automatically maps your document data to form fields
- Handles complex forms with dropdown menus, radio buttons, and checkboxes

#### 📄 Document Support
- **PDF files**: Extracts text and structured data
- **DOCX files**: Reads formatted documents, tables, and paragraphs
- Remembers your information for future use

#### 🎯 Smart Form Analysis
- Detects all fillable fields on any webpage
- Recognizes field types (text, email, date, select, etc.)
- Visual side panel shows form structure and detected fields
- Highlights fields as you hover over them in the analysis

#### ♿ Universal Compatibility
- Works with any website's forms
- Supports accessibility features (ARIA labels)
- Handles dynamic forms and custom form libraries
- Compatible with popular form frameworks

#### 🔒 Privacy-First Design
- All document processing happens locally in your browser
- No data sent to external servers except Claude AI for field matching
- You control what information is stored
- Secure authentication via Auth0

### Installation

#### Option 1: Chrome Web Store (Recommended)
1. Visit the [FormMasterPro page on Chrome Web Store](#)
2. Click "Add to Chrome"
3. Click "Add extension" when prompted
4. The FormMasterPro icon will appear in your browser toolbar

#### Option 2: Manual Installation (Developer Mode)
1. Download the latest release from [GitHub Releases](https://github.com/haroldmei/form-master-pro/releases)
2. Extract the ZIP file to a folder
3. Open Chrome and navigate to `chrome://extensions`
4. Enable "Developer mode" (toggle in top-right corner)
5. Click "Load unpacked"
6. Select the extracted folder
7. FormMasterPro is now installed!

### Getting Started

#### Step 1: Set Up Your API Key

FormMasterPro uses Claude AI for intelligent form filling. You'll need a Claude API key:

1. Get a free Claude API key from [Anthropic](https://console.anthropic.com/)
2. Click the FormMasterPro icon in your browser toolbar
3. In the popup, find the "Claude API Key" section
4. Paste your API key
5. Click "Save API Key"
6. Click "Test API Key" to verify it works

> **Note**: The API key is stored securely in your browser and only used for form analysis.

#### Step 2: Create an Account (Optional)

For subscription features and cloud sync:

1. Click the FormMasterPro icon
2. Click "Log In"
3. Sign in with your Google account
4. Verify your email address
5. You're ready to go!

### How to Use

#### Basic Workflow

**1. Prepare Your Document**
- Have your information ready in a PDF or DOCX file
- Examples: resume, application form, personal information sheet
- Upload it through the extension popup

**2. Navigate to a Form**
- Go to any website with a form you want to fill
- Examples: job applications, registration forms, contact forms

**3. Analyze the Form**
- Click the FormMasterPro icon in your toolbar
- Click "Analyze Current Form"
- A side panel appears showing all detected fields
- Hover over entries to see corresponding form fields highlighted

**4. Auto-Fill the Form**
- The extension automatically fills in matching fields
- Review the populated information
- Make any necessary adjustments
- Submit the form!

#### Advanced Features

**Form Analysis Panel**
- **Resize**: Drag the left edge to adjust panel width
- **Field Details**: See field type, ID, and available options
- **Field Highlighting**: Hover over panel entries to locate fields on the page
- **Close**: Click the X or press ESC to close

**Data Management**
- **Clear Data**: Remove all cached form suggestions
- **Change Document**: Upload a new document to use different information
- **Manual Override**: Edit any auto-filled field before submission

### Privacy & Security

#### What Data is Collected?
- **Local Storage**: Form mappings and preferences
- **Authentication**: Email and account info (if logged in)
- **Usage**: Basic subscription and feature usage stats

#### What Data is NOT Collected?
- Your form submissions are never stored
- Document contents remain on your device
- Form data is not shared with third parties

#### How is My Data Protected?
- Documents processed locally in your browser
- API communications encrypted (HTTPS)
- Secure authentication via Auth0
- No long-term storage of sensitive information

### FAQ

**Q: Do I need to pay to use FormMasterPro?**
A: The extension requires a Claude API key (which has free tier options). Subscription plans unlock additional features.

**Q: What happens if I don't have a Claude API key?**
A: The AI-powered form filling won't work, but you can still analyze forms and manually fill them.

**Q: Can FormMasterPro fill password fields?**
A: No, for security reasons, FormMasterPro does not fill password fields.

**Q: Does it work with all websites?**
A: FormMasterPro works with most standard HTML forms. Some heavily customized or proprietary form systems may have limited compatibility.

**Q: How accurate is the auto-filling?**
A: The AI is highly accurate but not perfect. Always review filled forms before submission.

**Q: Can I use this for multiple people?**
A: Yes, you can upload different documents and switch between profiles.

**Q: Is my data safe?**
A: Yes. All processing is local, and we follow industry best practices for data security.

---

## 💻 For Developers

### Technical Architecture

FormMasterPro is built as a Chromium browser extension using vanilla JavaScript with the following architecture:

```
┌─────────────────────────────────────────────┐
│           Browser Extension                  │
├─────────────────────────────────────────────┤
│                                              │
│  ┌──────────────┐      ┌─────────────────┐ │
│  │   Popup UI   │      │  Content Script │ │
│  └──────┬───────┘      └────────┬────────┘ │
│         │                       │          │
│  ┌──────▼───────────────────────▼────────┐ │
│  │      Background Service Worker        │ │
│  └──────┬───────────────────────┬────────┘ │
│         │                       │          │
│  ┌──────▼──────┐         ┌──────▼────────┐ │
│  │ Form        │         │ Document      │ │
│  │ Processor   │         │ Processor     │ │
│  └──────┬──────┘         └──────┬────────┘ │
│         │                       │          │
└─────────┼───────────────────────┼──────────┘
          │                       │
    ┌─────▼──────┐         ┌──────▼────────┐
    │ Claude AI  │         │ PDF.js /      │
    │ API        │         │ Mammoth.js    │
    └────────────┘         └───────────────┘
```

#### Core Modules

**1. Form Analysis** (`forms/form_extract.js`)
- Extracts all form fields from webpage DOM
- Detects field types (text, select, radio, checkbox, etc.)
- Identifies labels using multiple strategies (label tags, ARIA, placeholders)
- Handles complex form structures and grouped fields

**2. AI Service** (`modules/aiService.js`)
- Interfaces with Claude AI API (Anthropic)
- Processes user profile data for optimal token usage
- Generates intelligent field value suggestions
- Handles both extraction and selection-type fields

**3. Form Processor** (`modules/formProcessor.js`)
- Orchestrates the form-filling workflow
- Manages field mappings and caching
- Applies rule-based matching for common fields
- Stores suggestions per site and user profile

**4. Form Filler** (`modules/formFiller.js`)
- Populates form fields with values
- Handles different field types appropriately
- Triggers appropriate browser events (change, input, blur)
- Provides visual feedback during filling

**5. Document Processor** (`modules/userProfile.js`)
- Extracts text from PDF files using PDF.js
- Parses DOCX files using Mammoth.js
- Manages user profile data in local storage
- Optimizes document data for API calls

### Development Setup

#### Prerequisites

- **Node.js**: v16.0.0 or higher
- **npm**: v7.0.0 or higher
- **Chrome Browser**: Latest version
- **Claude API Key**: For testing AI features

#### Installation

```bash
# Clone the repository
git clone https://github.com/haroldmei/form-master-pro.git
cd form-master-pro

# Install dependencies
npm install
```

#### Development Commands

```bash
# Development build with watch mode
npm run dev

# Production build
npm run build

# Development build (one-time)
npm run build:dev

# Create packaged extension
npm run package

# Create development package
npm run package:dev

# Obfuscate code (production)
npm run obfuscate

# Full package with installer
npm run package:full

# Version bumping
npm run version:patch    # 0.1.26 -> 0.1.27
npm run version:minor    # 0.1.26 -> 0.2.0
npm run version:major    # 0.1.26 -> 1.0.0

# Linting
npm run lint
```

#### Loading the Extension for Development

1. Run `npm run build:dev` to create a development build
2. Open Chrome and go to `chrome://extensions`
3. Enable "Developer mode" (top-right toggle)
4. Click "Load unpacked"
5. Select the `dist` folder from the project
6. Make changes to source files
7. Run `npm run build:dev` again or use `npm run dev` for auto-rebuild
8. Click the refresh icon on the extension card in `chrome://extensions`

### Project Structure

```
form-master-pro/
├── browser-extension/          # Source code
│   ├── background.js           # Service worker
│   ├── popup.html              # Extension popup UI
│   ├── popup.js                # Popup logic
│   ├── options.html            # Settings page
│   ├── options.js              # Settings logic
│   ├── callback.html           # Auth callback
│   ├── callback.js             # Auth callback logic
│   ├── ui-injector.js          # Content script injector
│   ├── auth.js                 # Auth0 integration
│   ├── forms/                  # Form extraction modules
│   │   ├── form_extract.js     # Main form parser
│   │   ├── form_radios.js      # Radio button handler
│   │   └── form_checkboxgroup.js # Checkbox group handler
│   ├── modules/                # Core business logic
│   │   ├── aiService.js        # Claude AI integration
│   │   ├── formFiller.js       # Form filling engine
│   │   ├── formProcessor.js    # Form processing logic
│   │   ├── userProfile.js      # Document & profile management
│   │   └── utils.js            # Utility functions
│   ├── styles/                 # CSS files
│   │   ├── injector-ui.css     # Injected UI styles
│   │   └── formAnalysis.css    # Analysis panel styles
│   ├── libs/                   # Third-party libraries
│   │   ├── jszip.min.js        # ZIP handling
│   │   ├── pdf.min.js          # PDF processing
│   │   └── pdf.worker.min.js   # PDF worker thread
│   └── manifest.json           # Extension manifest
├── dist/                       # Built extension (generated)
├── packages/                   # Packaged releases (generated)
├── scripts/                    # Build scripts
│   ├── build-installer.js      # Installer builder
│   ├── bump-version.js         # Version management
│   ├── obfuscate.js            # Code obfuscation
│   └── package.js              # Packaging script
├── webpack.config.js           # Webpack configuration
├── package.json                # Project dependencies
└── README.md                   # This file
```

### Build & Deploy

#### Building for Production

```bash
# Full production build with obfuscation
npm run build
npm run obfuscate

# Package for distribution
npm run package

# The packaged extension will be in packages/form-master-pro.zip
```

#### Webpack Configuration

The project uses Webpack 5 for bundling with the following key features:

- **Babel transpilation**: ES6+ → ES5 for compatibility
- **Code splitting**: Separate bundles for different components
- **Minification**: Terser for JavaScript compression
- **Asset copying**: Static files and libraries
- **Source maps**: Available in development mode

Key configurations in `webpack.config.js`:
- Entry points for each module
- Optimization settings for production
- Plugin configuration for asset management
- Output directory and file naming

#### Chrome Web Store Deployment

1. Build the production version: `npm run package`
2. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
3. Click "New Item"
4. Upload `packages/form-master-pro.zip`
5. Fill in the listing details:
   - Description (use `store-description.md`)
   - Screenshots
   - Category: Productivity
   - Privacy policy URL
6. Submit for review

#### Version Management

Version numbers follow [Semantic Versioning](https://semver.org/):
- **Patch** (0.1.26 → 0.1.27): Bug fixes, minor changes
- **Minor** (0.1.26 → 0.2.0): New features, backward compatible
- **Major** (0.1.26 → 1.0.0): Breaking changes

To update version:
```bash
npm run version:patch
# or
npm run version:minor
# or
npm run version:major
```

This updates:
- `package.json`
- `browser-extension/manifest.json`
- `browser-extension/package.json`

### Technical Details

#### Manifest V3

FormMasterPro uses Manifest V3 for Chrome extensions with:

- **Service Worker**: Background processing without persistent background pages
- **Scripting API**: Dynamic content script injection
- **Storage API**: Local data persistence
- **Identity API**: OAuth authentication
- **Host Permissions**: Access to all URLs for form filling

#### Key Dependencies

**Runtime:**
- `pdfjs-dist`: PDF parsing and text extraction
- `mammoth`: DOCX to HTML/text conversion
- `jszip`: ZIP file handling

**Development:**
- `webpack`: Module bundling
- `babel`: JavaScript transpilation
- `terser-webpack-plugin`: Code minification
- `javascript-obfuscator`: Code protection
- `eslint`: Code linting

#### API Integration

**Claude AI (Anthropic)**
- Endpoint: `https://api.anthropic.com/v1/messages`
- Model: `claude-3-haiku-20240307`
- Used for: Intelligent field value extraction and selection
- Rate limits: Depends on API tier

**Auth0**
- Used for: User authentication and authorization
- Supports: Google OAuth
- Features: Email verification, JWT tokens

#### Storage Architecture

**Chrome Local Storage:**
```javascript
{
  // User's document and profile data
  userProfile: {
    filename: "resume.pdf",
    extractedContent: { ... },
    docxData: { ... }
  },
  
  // AI-generated and rule-based suggestions (cached per site + profile)
  allSuggestions: {
    "example.com_profile_resume.pdf": {
      "First Name": "John",
      "Email": "john@example.com",
      ...
    }
  },
  
  // Site-specific field mappings
  fieldMappings: {
    "example.com": [
      {
        id: "fname",
        label: "First Name",
        type: "text",
        value: "John",
        aiGenerated: true,
        lastUsed: "2025-10-15T..."
      }
    ]
  },
  
  // User authentication state
  authState: {
    accessToken: "...",
    idToken: "...",
    expiresAt: 1697894400
  },
  
  // Claude API key
  claudeApiKey: "sk-ant-..."
}
```

#### Form Field Detection Strategy

1. **Label Association**
   - `<label for="fieldId">` tags
   - Parent `<label>` containing input
   - Adjacent label elements

2. **ARIA Attributes**
   - `aria-label`
   - `aria-labelledby`
   - `aria-describedby`

3. **Placeholder Text**
   - `placeholder` attribute

4. **Field Name/ID**
   - `name` attribute
   - `id` attribute

5. **Context Analysis**
   - Surrounding text content
   - Table headers
   - Fieldset legends

### Contributing

We welcome contributions! Please follow these guidelines:

#### Code Style

- Use modern ES6+ JavaScript
- Follow existing code formatting
- Add comments for complex logic
- Keep functions focused and small

#### Pull Request Process

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Test thoroughly
5. Commit with clear messages: `git commit -m 'Add amazing feature'`
6. Push to your fork: `git push origin feature/amazing-feature`
7. Open a Pull Request

#### Commit Message Format

```
type(scope): brief description

Detailed explanation of changes (if needed)

Fixes #issue_number
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

#### Testing Guidelines

Before submitting:
- Test on multiple websites with different form types
- Verify all field types work correctly
- Check console for errors
- Test with different document formats
- Ensure no sensitive data leaks

### API Documentation

#### Form Extraction API

```javascript
// Extract all form fields from current page
const formData = self.FormExtract.extractFormControls();

// Returns:
{
  inputs: [...],      // Text, email, tel, etc.
  selects: [...],     // Dropdown menus
  textareas: [...],   // Text areas
  radios: [...],      // Radio button groups
  checkboxGroups: [...], // Checkbox groups
  checkboxes: [...]   // Individual checkboxes
}
```

#### AI Service API

```javascript
// Get AI suggestions for form fields
const suggestions = await aiService.getAiSuggestions(
  fieldKeywords,  // Object: { fieldName: [options] }
  userProfile,    // User's document data
  url            // Current page URL
);

// Test API key validity
const isValid = await aiService.testClaudeApiKey(apiKey);
```

#### Form Processor API

```javascript
// Process form and get field values
const result = await formProcessor.processForm(
  formFields,  // Array of field objects
  url         // Current page URL
);

// Returns:
{
  success: true,
  fields: [
    {
      id: "fname",
      name: "firstName",
      label: "First Name",
      type: "text",
      value: "John",
      aiGenerated: true
    },
    ...
  ]
}

// Clear all cached suggestions
const clearResult = await formProcessor.clearSuggestions();
```

#### Form Filler API

```javascript
// Fill form with provided values
formFiller.fillForm(fieldValues);

// fieldValues: Array of field objects with values
```

### Troubleshooting

**Extension doesn't appear in toolbar**
- Check `chrome://extensions` to ensure it's enabled
- Reload the extension

**Forms not being detected**
- Ensure the page has loaded completely
- Try clicking "Analyze Current Form" again
- Check browser console for errors

**AI suggestions not working**
- Verify Claude API key is set and valid
- Check API key has sufficient credits
- Review console for API error messages

**Build errors**
- Clear `node_modules` and reinstall: `rm -rf node_modules && npm install`
- Ensure Node.js version is 16+
- Check for syntax errors in modified files

**Extension crashes or freezes**
- Check for infinite loops in content scripts
- Review console for memory errors
- Disable and re-enable the extension

### Support & Resources

- **Documentation**: This README
- **Issues**: [GitHub Issues](https://github.com/haroldmei/form-master-pro/issues)
- **Discussions**: [GitHub Discussions](https://github.com/haroldmei/form-master-pro/discussions)
- **Email**: support@formmasterpro.com

### License

This software is proprietary and protected by copyright law.

Copyright © 2023-2025 FormMasterPro Team. All rights reserved.

See [LICENSE](LICENSE) file for full terms.

### Acknowledgments

- **Claude AI** by Anthropic for intelligent form understanding
- **PDF.js** by Mozilla for PDF processing
- **Mammoth.js** for DOCX conversion
- **Auth0** for authentication services
- Icons from [Material Design Icons](https://material.io/resources/icons/)

---

**Made with ❤️ by the FormMasterPro Team**

*Saving time, one form at a time.*
