'use strict';

var path = require('path');

var config = require('../config');

var ExtractTextPlugin = require('extract-text-webpack-plugin');

var packageConfig = require('../package.json');

exports.assetsPath = function (_path) {
  var assetsSubDirectory = process.env.NODE_ENV === 'production' ? config.build.assetsSubDirectory : config.dev.assetsSubDirectory;
  return path.posix.join(assetsSubDirectory, _path);
};

exports.cssLoaders = function (options) {
  options = options || {};
  var cssLoader = {
    loader: 'css-loader',
    options: {
      sourceMap: options.sourceMap
    }
  };
  var postcssLoader = {
    loader: 'postcss-loader',
    options: {
      sourceMap: options.sourceMap
    }
  }; // generate loader string to be used with extract text plugin

  function generateLoaders(loader, loaderOptions) {
    var loaders = options.usePostCSS ? [cssLoader, postcssLoader] : [cssLoader];

    if (loader) {
      loaders.push({
        loader: loader + '-loader',
        options: Object.assign({}, loaderOptions, {
          sourceMap: options.sourceMap
        })
      });
    } // Extract CSS when that option is specified
    // (which is the case during production build)


    if (options.extract) {
      return ExtractTextPlugin.extract({
        use: loaders,
        fallback: 'vue-style-loader'
      });
    } else {
      return ['vue-style-loader'].concat(loaders);
    }
  } // https://vue-loader.vuejs.org/en/configurations/extract-css.html


  return {
    css: generateLoaders(),
    postcss: generateLoaders(),
    // less: generateLoaders('less'),
    // sass: generateLoaders('sass', { indentedSyntax: true }),
    scss: generateLoaders('sass') // stylus: generateLoaders('stylus'),
    // styl: generateLoaders('stylus')

  };
}; // Generate loaders for standalone style files (outside of .vue)


exports.styleLoaders = function (options) {
  var output = [];
  var loaders = exports.cssLoaders(options);

  for (var extension in loaders) {
    var loader = loaders[extension];
    output.push({
      test: new RegExp('\\.' + extension + '$'),
      use: loader
    });
  }

  return output;
};

exports.createNotifierCallback = function () {
  var notifier = require('node-notifier');

  return function (severity, errors) {
    if (severity !== 'error') return;
    var error = errors[0];
    var filename = error.file && error.file.split('!').pop();
    notifier.notify({
      title: packageConfig.name,
      message: severity + ': ' + error.name,
      subtitle: filename || '',
      icon: path.join(__dirname, 'logo.png')
    });
  };
};