# Form Master Browser Extension

Create a standalone browser extension project which contains one button in the UI.
1. Right click on the button will bring up file or folder selection dialog. 
2. Select a file folder, read the content to the browser storage. Currently it supports loading a json file, include a sample .json file for testing purpose.
2. Left click on the button to print the content to the console.

## Installation Instructions

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" button and select the folder containing these files
5. The extension should now appear in your browser toolbar

## Usage

- Left-click the button to display the currently loaded content
- Right-click the button to select and load a JSON file

## Files

- `manifest.json`: Extension configuration
- `popup.html`: Extension popup UI
- `popup.js`: Handles button click events and file operations
- `sample.json`: Sample JSON file for testing
- `icons/`: Folder containing extension icons

Note: You'll need to create an "icons" folder and add icon files (icon16.png, icon48.png, icon128.png) before loading the extension.