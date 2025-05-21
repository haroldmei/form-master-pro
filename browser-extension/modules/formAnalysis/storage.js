/**
 * Form Analysis V2 - Storage Module
 * Handles storage operations for form analysis data
 */

// Storage keys
const STORAGE_KEYS = {
  ALL_SUGGESTIONS: 'allSuggestions'
};

// Initialize storage
let allSuggestions = {};

// Load initial data from storage
chrome.storage.local.get([STORAGE_KEYS.ALL_SUGGESTIONS], function(result) {
  if (result && result[STORAGE_KEYS.ALL_SUGGESTIONS]) {
    allSuggestions = result[STORAGE_KEYS.ALL_SUGGESTIONS];
  }
});

// Save form analysis data
function saveFormAnalysisData(controls, callback) {
  // Store suggestions
  const serializableControls = controls.map(control => ({
    ...control,
    suggestions: allSuggestions[control.id] || []
  }));

  // Update allSuggestions
  serializableControls.forEach(control => {
    if (control.suggestions && control.suggestions.length > 0) {
      allSuggestions[control.id] = control.suggestions;
    }
  });

  // Save to storage
  chrome.storage.local.set({
    [STORAGE_KEYS.ALL_SUGGESTIONS]: allSuggestions
  }, function() {
    if (callback) callback();
  });
}

// Get form analysis data for a URL
function getFormAnalysisData(rootUrl, callback) {
  if (callback) {
    callback(allSuggestions);
  }
  return Promise.resolve(allSuggestions);
}

// Get suggestions for a specific control
function getControlSuggestions(controlId) {
  return new Promise((resolve) => {
    resolve(allSuggestions[controlId] || []);
  });
}

// Get all suggestions
function getAllSuggestions() {
  return new Promise((resolve) => {
    resolve(allSuggestions);
  });
}

// Clear all stored data
function clearAllData(callback) {
  allSuggestions = {};

  chrome.storage.local.remove([STORAGE_KEYS.ALL_SUGGESTIONS], function() {
    if (callback) callback();
  });
}

// Create and expose the module
const formAnalysisStorage = {
  saveFormAnalysisData,
  getFormAnalysisData,
  getControlSuggestions,
  getAllSuggestions,
  clearAllData,
  init: function() {
    // Initialize module if needed
    console.log('Form Analysis Storage initialized');
  }
};

// Expose to global scope for Chrome extension
self.formAnalysisStorage = formAnalysisStorage; 