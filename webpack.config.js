const path = require('path');
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
      content: './browser-extension/content.js',
      // UI scripts
      popup: './browser-extension/popup.js',
      options: './browser-extension/options.js',
      profile: './browser-extension/profile.js',
      formAnalysis: './browser-extension/formAnalysis.js',
      callback: './browser-extension/callback.js',
      'file-selector': './browser-extension/file-selector.js',
      // Include all other JS files in the modules folder
      'modules/userProfile': './browser-extension/modules/userProfile.js',
      'modules/aiService': './browser-extension/modules/aiService.js',
      'modules/formFiller': './browser-extension/modules/formFiller.js',
      'modules/formProcessor': './browser-extension/modules/formProcessor.js',
      'modules/utils': './browser-extension/modules/utils.js',
      // UI injection script
      'scripts/ui-injector': './browser-extension/scripts/ui-injector.js',
      // Form extraction script
      'forms/form_extract': './browser-extension/forms/form_extract.js',
      'forms/form_radios': './browser-extension/forms/form_radios.js',
      // files script
      'files/docx-extractor': './browser-extension/files/docx-extractor.js',
      // 'files/pdf-extractor': './browser-extension/files/pdf-extractor.js',
      'auth': './browser-extension/auth.js',
      'libs/mammoth.browser.min': './browser-extension/libs/mammoth.browser.min.js',
      'mappings': './browser-extension/mappings.js',
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js',
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
    plugins: [
      new CleanWebpackPlugin(),
      new CopyPlugin({
        patterns: [
          // Copy manifest and static assets
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
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env']
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
