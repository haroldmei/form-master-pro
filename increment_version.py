#!/usr/bin/env python
"""
Script to automatically increment version numbers across multiple files:
- setup.py
- pyproject.toml
- formmaster_installer.nsi
- .github/workflows/production-release.yml
"""

import re
import argparse
import os.path


def get_current_version(setup_path):
    """Extract the current version from setup.py"""
    with open(setup_path, 'r') as f:
        content = f.read()
    
    # Look for version pattern like version="0.1.0"
    version_match = re.search(r'version\s*=\s*["\']([0-9]+\.[0-9]+\.[0-9]+)["\']', content)
    if version_match:
        return version_match.group(1)
    else:
        raise ValueError("Could not find version string in setup.py")


def increment_version(version, increment_type='patch'):
    """Increment the version number according to semantic versioning"""
    major, minor, patch = map(int, version.split('.'))
    
    if increment_type == 'major':
        major += 1
        minor = 0
        patch = 0
    elif increment_type == 'minor':
        minor += 1
        patch = 0
    else:  # patch
        patch += 1
    
    return f"{major}.{minor}.{patch}"


def update_setup_py(setup_path, new_version):
    """Update version in setup.py"""
    with open(setup_path, 'r') as f:
        content = f.read()
    
    updated_content = re.sub(
        r'(version\s*=\s*["\'])([0-9]+\.[0-9]+\.[0-9]+)(["\'])',
        fr'\g<1>{new_version}\g<3>',
        content
    )
    
    with open(setup_path, 'w') as f:
        f.write(updated_content)
    
    print(f"Updated {setup_path} to version {new_version}")


def update_pyproject_toml(pyproject_path, new_version):
    """Update version in pyproject.toml"""
    if not os.path.exists(pyproject_path):
        print(f"Warning: {pyproject_path} not found, skipping...")
        return
        
    with open(pyproject_path, 'r') as f:
        content = f.read()
    
    updated_content = re.sub(
        r'(version\s*=\s*["\'])([0-9]+\.[0-9]+\.[0-9]+)(["\'])',
        fr'\g<1>{new_version}\g<3>',
        content
    )
    
    with open(pyproject_path, 'w') as f:
        f.write(updated_content)
    
    print(f"Updated {pyproject_path} to version {new_version}")


def update_nsis_installer(nsis_path, new_version):
    """Update version in NSIS installer script"""
    if not os.path.exists(nsis_path):
        print(f"Warning: {nsis_path} not found, skipping...")
        return
        
    with open(nsis_path, 'r') as f:
        content = f.read()
    
    # Look for and update !define VERSION "x.x.x"
    updated_content = re.sub(
        r'(!define\s+VERSION\s+["\'])([0-9]+\.[0-9]+\.[0-9]+)(["\'])',
        fr'\g<1>{new_version}\g<3>',
        content
    )
    
    with open(nsis_path, 'w') as f:
        f.write(updated_content)
    
    print(f"Updated {nsis_path} to version {new_version}")


def update_github_workflow(workflow_path, new_version):
    """Update version in GitHub Actions workflow file"""
    if not os.path.exists(workflow_path):
        print(f"Warning: {workflow_path} not found, skipping...")
        return
        
    with open(workflow_path, 'r') as f:
        content = f.read()
    
    # Update the hardcoded version in the Extract version step
    updated_content = re.sub(
        r"(\$version = ['\"])([0-9]+\.[0-9]+\.[0-9]+)(['\"])",
        fr"\g<1>{new_version}\g<3>",
        content
    )
    
    with open(workflow_path, 'w') as f:
        f.write(updated_content)
    
    print(f"Updated {workflow_path} to version {new_version}")


def main():
    parser = argparse.ArgumentParser(description='Increment version numbers across project files')
    parser.add_argument(
        '--type', 
        choices=['major', 'minor', 'patch'],
        default='patch',
        help='Type of version increment (default: patch)'
    )
    args = parser.parse_args()
    
    # File paths
    setup_path = "setup.py"
    pyproject_path = "pyproject.toml"
    nsis_path = "formmaster_installer.nsi"
    workflow_path = ".github/workflows/production-release.yml"
    
    # Get current version and increment it
    try:
        current_version = get_current_version(setup_path)
        new_version = increment_version(current_version, args.type)
        
        print(f"Incrementing version: {current_version} -> {new_version}")
        
        # Update files
        update_setup_py(setup_path, new_version)
        update_pyproject_toml(pyproject_path, new_version)
        update_nsis_installer(nsis_path, new_version)
        update_github_workflow(workflow_path, new_version)
        
        print(f"Successfully updated version to {new_version}")
    except Exception as e:
        print(f"Error: {e}")
        return 1
    
    return 0


if __name__ == "__main__":
    exit(main())
