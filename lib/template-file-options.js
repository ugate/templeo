'use strict';

/**
 * Template options for a [Node.js file/system back-end](https://nodejs.org/api/fs.html). All file options inherit from
 * [TemplateOpts]{@link module:templeo/options.Options}.
 * @typedef {module:templeo/options.Options} module:templeo/options.FileOptions
 * @property {String} [viewsPath='views'] The __relative__ path where views are located/identified
 * @property {String} [partialsPath='views/partials'] The __relative__ path to the `templatePathBase` where partials are located/identified.
 * Partials are small segments of template code that can be nested and reused throughout other templates. The path is used during `read`/`write`
 * oprtations in conjunction with the `templatePathBase` for prefixing file paths. The path will also be used when _reading_ templates.
 * @property {String} [sourcePath] When defined, will be used as the directory structure that will be generated within the `outputPath` when _reading_
 * templates. It will also be used for file discovery when registering partials from a `read` operation. When not defined, no directory structure is
 * initialized.
 * @property {Boolean} [watchRegistrationSourcePaths] When true, any directory discovered when registering partials from a `read` operation will be
 * watched by the underlying operating system for file changes, adds, etc. When a change occurs the template partial will be registered/re-registered
 * accordingly. __NOTE: All watched files will continue to be watched until `engine.clearCache` is called.__
 * @property {String} [outputPath] When defined, compiled template code will be written to the the path within the file system. Omit to use the operating
 * system's temporary directory.
 * @property {String} [outputPathTempPrefix=templeo-cache-files-] When `outputPath` is _falsy_ the prefix will be used when generating a temporary
 * directory. Otherwise, it's ignored.
 */

const TemplateOpts = require('./template-options');
const Os = require('os');
const Path = require('path');
const Fs = require('fs');
// TODO : ESM uncomment the following lines...
// TODO : import * as TemplateOpts from './template-options.mjs';
// TODO : import * as Os from 'os';
// TODO : import * as Path from 'path';
// TODO : import * as Fs from 'fs';

const OPTIONS = Object.freeze({
  defaults: Object.freeze({
    viewsPath: 'views',
    partialsPath: 'views/partials',
    sourcePath: null,
    watchRegistrationSourcePaths: false,
    outputPath: null,
    outputPathTempPrefix: 'templeo-cachier-files-'
  }),
  deriveOption
});

var MERGED_OPTIONS;

/**
 * Template options for a [Node.js file/system back-end](https://nodejs.org/api/fs.html). See {@link module:templeo/options.FileOptions} for a full
 * listing of options.
 * @see module:templeo/options.FileOptions
 * @see module:templeo/options.Options
 */
class TemplateFileOpts extends TemplateOpts {
  // TODO : ESM use... export class TemplateFileOpts extends TemplateOpts {

  /**
   * Template file options
   * @param {module:templeo/options.FileOptions} [opts] The template file options
   */
  constructor(opts) {
    super(opts);
  }

  /**
   * @see module:templeo/options.FileOptions
   * @see module:templeo/options.Options
   * @returns {Object} The object described by {@link TemplateOpts.defaultOptions}
   */
  static get defaultOptions() {
    if (MERGED_OPTIONS) return MERGED_OPTIONS;
    super.defaultOptionMerge(OPTIONS, MERGED_OPTIONS = {});
    return MERGED_OPTIONS;
  }
}

// TODO : ESM remove the following line...
module.exports = TemplateFileOpts;

/**
 * Derives option values
 * @param {Boolean} noOpt `true` when it is determined that the option value is not present
 * @param {TemplateFileOpts} opts The options that the default option is being derived for
 * @param {Object} optd The object described in {@link TemplateOpts.build}
 * @param {String} key1 The primary option name/key
 * @param {String} [key2] The secondary key used when dealing with object options (i.e. `optd.defaults[key1][key2]`)
 */
function deriveOption(noOpt, opts, optd, key, key2) {
  if (noOpt && key === 'outputPath') {
    const prefix = (opts && opts.outputPathTempPrefix) || optd.defaults.outputPathTempPrefix || '';
    return Fs.mkdtempSync(Path.join(Os.tmpdir(), prefix));
  }
  var val = noOpt ? optd.defaults[key] : opts[key];
  if (key2) return val[key2];
  //if (key === 'partialsPath') val = Path.resolve(val);
  return val;
}