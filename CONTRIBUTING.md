# Contributing to FormMasterPro

Thank you for your interest in contributing to FormMasterPro! We welcome contributions from the community and are grateful for your support.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment. Please:

- Be respectful and considerate in your communication
- Welcome newcomers and help them get started
- Accept constructive criticism gracefully
- Focus on what is best for the community
- Show empathy towards other community members

## How Can I Contribute?

### Reporting Bugs

Before creating a bug report, please check the [existing issues](https://github.com/haroldmei/form-master-pro/issues) to avoid duplicates.

When filing a bug report, include:

- **Clear title and description** of the issue
- **Steps to reproduce** the problem
- **Expected behavior** vs actual behavior
- **Screenshots** if applicable
- **Browser version** and OS information
- **Extension version** you're using
- **Console errors** if any

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion:

- Use a clear and descriptive title
- Provide a detailed description of the proposed functionality
- Explain why this enhancement would be useful
- Include mockups or examples if applicable

### Code Contributions

1. **Find an issue to work on** or create a new one
2. **Comment on the issue** to let others know you're working on it
3. **Fork the repository** and create your branch
4. **Make your changes** following our coding standards
5. **Test thoroughly** on multiple websites
6. **Submit a pull request** with a clear description

## Development Setup

### Prerequisites

- Node.js v16.0.0 or higher
- npm v7.0.0 or higher
- Chrome browser (latest version)
- Git

### Setup Steps

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/form-master-pro.git
cd form-master-pro

# Add upstream remote
git remote add upstream https://github.com/haroldmei/form-master-pro.git

# Install dependencies
npm install

# Start development build with watch mode
npm run dev
```

### Loading the Extension

1. Build the extension: `npm run build:dev`
2. Open Chrome and navigate to `chrome://extensions`
3. Enable "Developer mode" (toggle in top-right)
4. Click "Load unpacked"
5. Select the `dist` folder from the project

### Testing Your Changes

1. Make changes to source files in `browser-extension/`
2. Run `npm run build:dev` to rebuild (or use `npm run dev` for auto-rebuild)
3. Reload the extension in `chrome://extensions`
4. Test on various websites with different form types

## Pull Request Process

### Before Submitting

- Ensure your code follows the coding standards
- Update documentation if you changed functionality
- Add or update tests if applicable
- Run the linter: `npm run lint`
- Test on at least 3 different websites
- Verify no console errors

### Submitting

1. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Commit your changes** with clear messages:
   ```bash
   git commit -m "feat: add support for custom field detection"
   ```

3. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

4. **Open a Pull Request** on GitHub with:
   - Clear title describing the change
   - Detailed description of what and why
   - Reference to related issues (e.g., "Closes #123")
   - Screenshots/GIFs for UI changes
   - Test results on different websites

### Pull Request Review

- Maintainers will review your PR
- Address any feedback or requested changes
- Once approved, a maintainer will merge your PR

## Coding Standards

### JavaScript Style

- Use modern ES6+ syntax
- Use `const` for constants, `let` for variables
- Use arrow functions where appropriate
- Keep functions small and focused (< 50 lines)
- Use descriptive variable and function names
- Avoid deeply nested code (max 3 levels)

### Example

```javascript
// Good
const getUserProfile = async () => {
  try {
    const profile = await fetchProfile();
    return processProfile(profile);
  } catch (error) {
    console.error('Error fetching profile:', error);
    throw error;
  }
};

// Avoid
function xyz() {
  chrome.storage.local.get(['data'], function(result) {
    if (result.data) {
      if (result.data.profile) {
        if (result.data.profile.name) {
          // Too deeply nested
        }
      }
    }
  });
}
```

### Comments

- Add comments for complex logic
- Use JSDoc for functions with parameters
- Explain "why" not "what" when the code is clear
- Keep comments up-to-date with code changes

```javascript
/**
 * Extract form fields from the current webpage
 * 
 * @param {Object} options - Extraction options
 * @param {boolean} options.includeHidden - Include hidden fields
 * @returns {Array<Object>} Array of field objects
 */
function extractFormFields(options = {}) {
  // Implementation
}
```

### File Organization

- Keep related functionality together
- Use modules for separation of concerns
- Avoid circular dependencies
- Export only what's needed

## Commit Message Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring (no feature change)
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks (dependencies, build, etc.)

### Examples

```
feat(form-extraction): add support for radio button groups

Implemented radio button group detection with label association.
Groups are now properly identified and presented to the user.

Closes #45
```

```
fix(ai-service): handle API rate limiting gracefully

Added exponential backoff retry logic when Claude API returns 429.
Users now see a clear message instead of a cryptic error.

Fixes #78
```

## Testing Guidelines

### Manual Testing

Before submitting, test your changes on:

1. **Different form types**:
   - Contact forms
   - Registration forms
   - Job application forms
   - Survey forms
   - E-commerce checkout forms

2. **Different field types**:
   - Text inputs
   - Email/phone inputs
   - Dropdowns (select)
   - Radio buttons
   - Checkboxes
   - Text areas
   - Date pickers

3. **Edge cases**:
   - Empty forms
   - Pre-filled forms
   - Dynamic forms (added via JS)
   - Forms with validation
   - Multi-page forms

### Test Websites

Test on a variety of websites including:
- Popular sites (LinkedIn, Indeed, etc.)
- Government forms
- Educational institution forms
- Small business websites

### Reporting Test Results

Include in your PR description:

```
**Tested on:**
- Site A: Contact form - ✅ All fields filled correctly
- Site B: Registration form - ✅ Handles dropdowns properly
- Site C: Job application - ⚠️ Date field needs manual input
```

## Documentation

### When to Update Documentation

Update documentation when you:
- Add a new feature
- Change existing functionality
- Fix a significant bug
- Update dependencies
- Change build process

### What to Document

- **README.md**: High-level features and setup
- **Code comments**: Complex logic and algorithms
- **API documentation**: Public functions and modules
- **CHANGELOG.md**: All notable changes

### Documentation Style

- Use clear, concise language
- Include code examples
- Add screenshots for UI features
- Keep it up-to-date

## Questions?

If you have questions about contributing:

- Check the [README.md](README.md) for general information
- Look at [existing issues](https://github.com/haroldmei/form-master-pro/issues) for similar questions
- Open a new issue with the "question" label
- Reach out to maintainers via discussions

## Recognition

All contributors will be recognized in our README.md. Thank you for making FormMasterPro better! 🎉

## License

By contributing to FormMasterPro, you agree that your contributions will be licensed under the MIT License.

