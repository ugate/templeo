'use strict';

/**
 * Template compilation options for a file/system back-end. All file options inherit from [TemplateOpts]{@link module:templeo/compile.Options}.
 * @typedef {module:templeo/compile.Options} module:templeo/compile.FileOptions
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
 * @property {String} [outputPath] When defined, compiled template code will be written to the the path within the file system. Omit to use the operating
 * system's temporary directory.
 * @property {String} [outputFileExt=js] Extension used for generated output sources __ignored when `outputPath` is omitted__
 */

const TemplateOpts = require('./template-options');
// TODO : ESM uncomment the following lines...
// TODO : import * as TemplateOpts from './template-options.mjs';

const DEFAULT_COMPILE_OPTS = Object.freeze({
  pathBase: '/',
  path: 'views',
  partialsPath: 'views/partials',
  scanSourcePath: null,
  watchScannedSourcePaths: false,
  outputPath: null,
  outputFileExt: 'js'
});

/**
 * Template compilation options for a file/system back-end
 */
class TemplateFileOpts extends TemplateOpts {
  // TODO : ESM use... export class TemplateFileOpts extends TemplateOpts {

  /**
   * Template compilation file options
   * @param {module:templeo/compile.FileOptions} [opts] The template compilation file options
   */
  constructor(opts) {
    super(opts);
  }

  /**
   * @override
   * @inheritdoc
   */
  build(opts, dflt, to) {
    super.build(opts, dflt, to);
    super.build(opts, TemplateFileOpts.defaultCompileOptions, to);
  }

  /**
   * @returns {module:templeo/compile.FileOptions} The default options
   */
  static get defaultCompileOptions() {
    return DEFAULT_COMPILE_OPTS;
  }
}

// TODO : ESM remove the following line...
module.exports = TemplateFileOpts;