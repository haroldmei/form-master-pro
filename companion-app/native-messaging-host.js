#!/usr/bin/env node
const path = require('path');
process.chdir(path.dirname(__dirname));
require('./native-messaging/handler').start();
