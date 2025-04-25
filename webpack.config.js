const path = require('path');
const webpack = require('webpack'); // Add this import
const CopyPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const ZipPlugin = require('zip-webpack-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  
  return {
    mode: isProduction ? 'production' : 'development',
    devtool: isProduction ? false : 'inline-source-map',
    entry: {
      // Main background script
      background: './browser-extension/background.js',
      // Content script
      //content: './browser-extension/content.js',
      // UI scripts
      popup: './browser-extension/popup.js',
      callback: './browser-extension/callback.js',

      'content/positionUpdater': './browser-extension/content/positionUpdater.js',
      'content/uiState': './browser-extension/content/uiState.js',
      'content/highlighters': './browser-extension/content/highlighters.js',
      'content/eventHandlers': './browser-extension/content/eventHandlers.js',
      'content/formFields': './browser-extension/content/formFields.js',
      'content/index': './browser-extension/content/index.js', 

      // Include all other JS files in the modules folder
      'modules/userProfile': './browser-extension/modules/userProfile.js',
      'modules/aiService': './browser-extension/modules/aiService.js',
      'modules/formFiller': './browser-extension/modules/formFiller.js',
      'modules/formProcessor': './browser-extension/modules/formProcessor.js',
      'modules/formAnalysis': './browser-extension/modules/formAnalysis.js',
      'modules/utils': './browser-extension/modules/utils.js',
      'modules/auth': './browser-extension/modules/auth.js',
      // UI injection script
      'ui-injector': './browser-extension/ui-injector.js',
      // Form extraction script
      'forms/form_extract': './browser-extension/forms/form_extract.js',
      'forms/form_checkboxgroup': './browser-extension/forms/form_checkboxgroup.js',
      'forms/form_radios': './browser-extension/forms/form_radios.js',
      'libs/jszip.min': './browser-extension/libs/jszip.min.js',
      'libs/pdf.min': './browser-extension/libs/pdf.min.js',
      'libs/pdf.worker.min': './browser-extension/libs/pdf.worker.min.js',
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js',
      publicPath: '',
    },
    optimization: {
      minimize: isProduction,
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            format: {
              comments: false,
            },
            compress: {
              drop_console: true,
              drop_debugger: true,
              pure_funcs: ['console.log', 'console.info', 'console.debug']
            },
            mangle: {
              reserved: ['FormExtract'], // Preserve necessary global names
              properties: {
                regex: /^_/ // Mangle only private properties (starting with _)
              }
            },
          },
          extractComments: false,
        }),
      ],
    },
    resolve: {
      fallback: {
        // Provide empty mocks for Node.js modules that PDF.js tries to use
        "fs": false,
        "path": false,
        "zlib": false,
        "stream": false,
        "http": false,
        "https": false,
        "url": false,
        "crypto": false,
        "canvas": false
      }
    },
    plugins: [
      // Add this to provide necessary browser polyfills
      new webpack.ProvidePlugin({
        process: 'process/browser',
        Buffer: ['buffer', 'Buffer'],
      }),
      // Add this DefinePlugin to set API_BASE_URL based on environment
      new webpack.DefinePlugin({
        'API_BASE_URL': JSON.stringify(isProduction ? 'https://bargain4me.com' : 'http://localhost:3001')
      }),
      new CleanWebpackPlugin(),
      new CopyPlugin({
        patterns: [
          // Copy manifest and static assets
          // Add this to copy pre-built PDF.js files from node_modules
          {
            from: './browser-extension/styles/injector-ui.css',
            to: 'styles/injector-ui.css'
          },
          {
            from: './browser-extension/styles/formAnalysis.css',
            to: 'styles/formAnalysis.css'
          },
          { 
            from: 'node_modules/pdfjs-dist/build/pdf.min.mjs',
            to: 'libs/pdf.min.js' 
          },
          { 
            from: 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs',
            to: 'libs/pdf.worker.min.js' 
          },
          // Your other copy patterns...
          { 
            from: './browser-extension/manifest.json',
            to: '.'
          },
          { 
            from: './browser-extension/images', 
            to: 'images' 
          },
          { 
            from: './browser-extension/html', 
            to: '.',
            noErrorOnMissing: true
          },
          {
            from: './browser-extension/*.html',
            to: '[name][ext]'
          },
          {
            from: './browser-extension/*.css',
            to: '[name][ext]'
          },
          { 
            from: './browser-extension/css', 
            to: 'css',
            noErrorOnMissing: true
          },
          {
            from: './browser-extension/forms',
            to: 'forms',
            noErrorOnMissing: true
          },
          {
            from: './browser-extension/files',
            to: 'files',
            noErrorOnMissing: true
          },
          {
            from: './browser-extension/libs',
            to: 'libs',
            noErrorOnMissing: true
          }
        ],
      }),
      ...(isProduction ? [
        new ZipPlugin({
          filename: 'form-master-pro.zip',
          path: '../packages',
        })
      ] : [])
    ],
    externals: {
      '@babel/runtime': '@babel/runtime'
    },
    module: {
      rules: [
        {
          test: /\.jsx?$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: [
                ['@babel/preset-env', {
                  targets: {
                    chrome: '58',
                    firefox: '57',
                    safari: '11',
                    edge: '16'
                  },
                  useBuiltIns: 'usage',
                  corejs: 3
                }]
              ],
              plugins: [
                '@babel/plugin-transform-runtime' // Add this plugin
              ]
            }
          }
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader']
        },
        {
          test: /\.(png|jpg|gif|svg)$/,
          use: [{
            loader: 'file-loader',
            options: {
              name: 'images/[name].[ext]'
            }
          }]
        }
      ]
    }
  };
};
