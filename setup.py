from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

with open("src/requirements.txt", "r", encoding="utf-8") as fh:
    requirements = fh.read().splitlines()

setup(
    name="formmaster",
    version="0.1.27",
    author="FormMaster Team",
    author_email="maintainer@example.com",
    description="Form automation tool for Australian university application processes",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/haroldmei/form-master",
    project_urls={
        "Bug Tracker": "https://github.com/haroldmei/form-master/issues",
    },
    classifiers=[
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.11",
        "License :: OSI Approved :: MIT License",
        "Operating System :: Microsoft :: Windows",
        "Development Status :: 4 - Beta",
        "Intended Audience :: Education",
        "Topic :: Office/Business :: Office Suites",
    ],
    package_dir={"": "src"},
    # Include both modules and packages
    packages=find_packages(where="src"),
    py_modules=["formfiller"],
    python_requires=">=3.11,<3.12",
    install_requires=requirements,
    entry_points={
        "console_scripts": [
            "formmaster=formfiller:run",
        ],
    },
    include_package_data=True,
)
