#!/usr/bin/env node
// filepath: c:\Users\harol\personal\form-master-pro\js-src\bin\formmaster.js

/**
 * FormMaster CLI entry point
 */
const { run } = require('../formfiller');
const { version } = require('../index');

// Simple command line argument parser
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    dataDir: null,
    mode: 0,
    uni: null,
    help: false,
    version: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--version' || arg === '-v') {
      options.version = true;
    } else if ((arg === '--dir' || arg === '-d') && i + 1 < args.length) {
      options.dataDir = args[++i];
    } else if ((arg === '--mode' || arg === '-m') && i + 1 < args.length) {
      options.mode = parseInt(args[++i], 10);
    } else if ((arg === '--uni' || arg === '-u') && i + 1 < args.length) {
      options.uni = args[++i];
    }
  }

  return options;
}

function printHelp() {
  console.log(`FormMaster v${version}

Usage: formmaster [options]

Options:
  -h, --help            Show this help message
  -v, --version         Show version number
  -d, --dir <path>      Directory containing student data
  -m, --mode <number>   Operation mode (0 for normal operation)
  -u, --uni <code>      University code (e.g., usyd, unsw)
`);
}

// Main execution
async function main() {
  const options = parseArgs();
  
  if (options.help) {
    printHelp();
    process.exit(0);
  }
  
  if (options.version) {
    console.log(`FormMaster v${version}`);
    process.exit(0);
  }
  
  try {
    await run(options.dataDir, options.mode);
  } catch (err) {
    console.error(`Fatal error: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
  }
}

// Run the main function
main();