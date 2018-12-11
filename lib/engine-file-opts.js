'use strict';

/**
 * Template engine options for a file/system back-end
 * @typedef {module:templeo/options.Options} module:templeo/options.FileOptions
 * @property {String} [pathBase='/'] A base path used as prefix for the `path` and `partialsPath` and will be used as the root path during 
 * `read`/`write` operations on the file system
 * @property {String} [path='views'] The __relative__ path where views are located/identified
 * @property {String} [partialsPath='views/partials'] The __relative__ path to the `pathBase` where partials are located/identified. Partials are
 * small segments of template code that can be nested and reused throughout other templates. The path is used during `read`/`write` oprtations in
 * conjunction with the `pathBase` for prefixing file paths. The path will also be used when registering partials during the `scan` process and is
 * removed from file paths when extracting partial `name`s used for registration.
 * @property {String} [scanSourcePath] When defined, will be used as the directory structure that will be generated within the `outputPath` during
 * the `scan` process. It will also be used for file discovery when registering partials during the `scan` process. When not defined, no directory
 * structure is initialized.
 * @property {Boolean} [watchScannedSourcePaths] When true, any directory discovered during a `scan` will be watched by the underlying operating system
 * for file changes, adds, etc. and template partials will be registered/re-registered accordingly. __NOTE: All watched files will continue to be watched
 * until `engine.clearCache` is called.__
 * @property {String} [outputPath] When defined, compiled template code will be written to the the path within the file system. (__otherwise, they
 * will reside in-memory__)
 * @property {String} [outputFileExt=js] Extension used for generated output sources __ignored when `outputPath` is omitted__
 */

const EngineOpts = require('./engine-opts');
// TODO : ESM uncomment the following lines...
// TODO : import * as EngineOpts from './engine-opts.mjs';

const DEFAULT_OPTIONS = Object.freeze({
  pathBase: '/',
  path: 'views',
  partialsPath: 'views/partials',
  scanSourcePath: null,
  watchScannedSourcePaths: false,
  outputPath: null,
  outputFileExt: 'js'
});

/**
 * Template engine options for a file/system back-end
 */
class EngineFileOpts extends EngineOpts {
  // TODO : ESM use... export class EngineFileOpts extends EngineOpts {

  /**
   * @override
   * @inheritdoc
   */
  build(opts, dflt, to) {
    super.build(opts, dflt, to);
    super.build(opts, EngineFileOpts.defaultOptions, to);
  }

  /**
   * @returns {module:templeo/options.FileOptions} The default options
   */
  static get defaultOptions() {
    return DEFAULT_OPTIONS;
  }
}

// TODO : ESM remove the following line...
module.exports = EngineFileOpts;