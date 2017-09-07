'use strict';

const fs = require('fs')
const path = require('path')
const webpack = require('webpack')

var EXAMPLES_DIR = path.resolve('./examples');

function buildEntries() {
  return fs.readdirSync(EXAMPLES_DIR).reduce(function (entries, dir) {
    if (dir === 'build') {
      return entries;
    }

    var isDraft = dir.charAt(0) === '_';
    var isDirectory = fs.lstatSync(path.join(EXAMPLES_DIR, dir)).isDirectory();

    if (!isDraft && isDirectory) {
      entries[dir] = path.join(EXAMPLES_DIR, dir, 'app.tsx');
    }

    return entries;
  }, {});
}

module.exports = {
  entry: buildEntries(),

  output: {
    filename: '[name].js',
    chunkFilename: '[id].chunk.js',
    path: path.resolve(EXAMPLES_DIR + '/__build__'),
    publicPath: '/__build__/'
  },

  // Enable sourcemaps
  devtool: "cheap-source-map",

  resolve: {
    // Add .ts and .tsx as resolvable extensions, and prefer .es.js files
	// over plain .js ones so we can use ES6 code if a dependent library
	// provides it.
    extensions: [
      ".webpack.js", ".web.js", ".ts", ".tsx", ".es.js", ".js"
    ],

    // Resolve absolute module references from src/ as well as node_modules/
    modules: [
      path.join(__dirname, "./src"),
      "node_modules"
    ]
  },

  module: {
    rules: [
      // Process .ts and .tsx files via the TypeScript compiler
      {
        test: /\.[jt]sx?$/,
        use: ["awesome-typescript-loader"],
        exclude: /node_modules/
      },

	    // Process .css files via style-loader and css-loader
      {
        test: /\.css$/,
        use: [
          "style-loader", "css-loader"
        ]
      },

      // Re-process any output .js files via source-map-loader
      {
        test: /\.js$/,
        use: ["source-map-loader"],
        exclude: /node_modules/,
        enforce: "pre"
      }
    ]
  },

  plugins: [
    new webpack.optimize.CommonsChunkPlugin("shared"),

    // Provide $, jQuery, React and ReactDOM as UMD globals because golden-layout
    // wants them so. :(
    new webpack.ProvidePlugin({
      $: "jquery",
      jQuery: "jquery",
      React: "react",
      ReactDOM: "react-dom"
    })
  ]
}
