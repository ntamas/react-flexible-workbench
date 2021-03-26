var path = require('path');
var webpack = require('webpack');
var BASE_DIR = './'
var COMPONENT_NAME = 'react-flexible-workbench';
var plugins = [];

function getPackageMain() {
  return require(path.resolve('./package.json')).main;
}

if (process.env.MINIFY) {
/*
  var UglifyJsPlugin = require('uglifyjs-webpack-plugin');
  plugins.push(
    new UglifyJsPlugin()
  );
*/
  COMPONENT_NAME += '.min';
}

module.exports = {
  entry: path.resolve(getPackageMain()),
  mode: "development",

  output: {
    filename: './dist/' + COMPONENT_NAME + '.js',
    library: COMPONENT_NAME,
    libraryTarget: 'umd'
  },

  // Don't merge React or JQuery into the final, distributed bundle
  externals: {
    'jquery': 'JQuery',
    'react': 'React',
    'react-dom': 'ReactDOM'
  },

  module: {
    rules: [
      // Process .css files via style-loader and css-loader
      {
        test: /\.css$/,
        use: [
          "style-loader", "css-loader"
        ]
      }
    ]
  },
  plugins: plugins
};
