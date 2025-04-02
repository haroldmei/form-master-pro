const path = require('path');
const webpack = require('webpack'); // Add this import
const CopyPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin'); // Add this import
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
      content: './browser-extension/content.js',
      // UI scripts
      popup: './browser-extension/popup.js',
      options: './browser-extension/options.js',
      formAnalysis: './browser-extension/formAnalysis.js',
      callback: './browser-extension/callback.js',
      // Include all other JS files in the modules folder
      'modules/userProfile': './browser-extension/modules/userProfile.js',
      'modules/aiService': './browser-extension/modules/aiService.js',
      'modules/formFiller': './browser-extension/modules/formFiller.js',
      'modules/formProcessor': './browser-extension/modules/formProcessor.js',
      'modules/utils': './browser-extension/modules/utils.js',
      // UI injection script
      'ui-injector': './browser-extension/ui-injector.js',
      // Form extraction script
      'forms/form_extract': './browser-extension/forms/form_extract.js',
      'forms/form_radios': './browser-extension/forms/form_radios.js',
      'auth': './browser-extension/auth.js',
      'libs/jszip.min': './browser-extension/libs/jszip.min.js',
      'libs/pdf.min': './browser-extension/libs/pdf.min.js',
      'libs/pdf.worker.min': './browser-extension/libs/pdf.worker.min.js',
      'mappings': './browser-extension/mappings.js',
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
              drop_console: isProduction, // Only drop in production
              drop_debugger: isProduction,
              pure_funcs: isProduction ? ['console.log', 'console.info', 'console.debug', 'console.warn'] : [],
              passes: 2, // Multiple optimization passes
              ecma: 2020, // Use modern ECMAScript features for better minification
              toplevel: true, // Better top-level minification
              unsafe_math: true, // Allow unsafe math optimizations
              booleans_as_integers: true // Convert boolean to integer when beneficial
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
        // Add CSS minifier
        new CssMinimizerPlugin({
          minimizerOptions: {
            preset: [
              'default',
              { 
                discardComments: { removeAll: true },
                normalizeWhitespace: true,
                minifyFontValues: true
              },
            ],
          }
        })
      ],
      // Add better tree shaking configuration
      usedExports: true,
      innerGraph: true,
      sideEffects: true,
      splitChunks: isProduction ? {
        chunks: 'all',
        minSize: 20000,
        maxSize: 0,
        minChunks: 1,
        maxAsyncRequests: 30,
        maxInitialRequests: 30,
        automaticNameDelimiter: '~',
        enforceSizeThreshold: 50000,
        cacheGroups: {
          defaultVendors: {
            test: /[\\/]node_modules[\\/]/,
            priority: -10,
            reuseExistingChunk: true,
          },
          default: {
            minChunks: 2,
            priority: -20,
            reuseExistingChunk: true,
          },
        },
      } : false,
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
          filename: `form-master-pro-v${require('./package.json').version}.zip`, // Use version from package.json
          path: '../packages',
          compressionOptions: {
            level: 9 // Maximum compression level
          }
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
