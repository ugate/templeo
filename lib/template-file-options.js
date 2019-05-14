'use strict';

/**
 * Template options for a [Node.js file/system back-end](https://nodejs.org/api/fs.html). All file options inherit from
 * [TemplateOpts]{@link module:templeo/options.Options}.
 * @typedef {module:templeo/options.Options} module:templeo/options.FileOptions
 * @property {String} [relativeTo=.] The base directory path that will be used during file read/write operations for partial template content and
 * generated rendering sources.
 * @property {String} [contextPath=views] The path where the context JSON is located relative to the path set by `relativeTo`. The name of file is determined by
 * [TemplateOpts.defaultContextName]{@link module:templeo/options.Options}.
 * @property {String} [templatePath=views] The path where the primary template is located relative to the path set by `relativeTo`. The name of file is determined
 * by [TemplateOpts.defaultTemplateName]{@link module:templeo/options.Options}. Since the primary template needs to be present prior to compiling, 
 * __the option can only be used during compilation and is ignored during rendering.__
 * @property {String} [partialsPath=views/partials] The path where the partial templates are located/identified relative to the path set by `relativeTo`.
 * Partials are small segments of template code that can be nested and reused throughout other templates. The path is used during `read`/`write`
 * oprtations for prefixing file paths. Any _sub-directories_ within `partialsPath` will be mirrored within the `outputPath` or temporary directory.
 * @property {Boolean} [watchPartials] When true, any `partialsPath` directories discovered when registering partials from a `read` operation
 * will be watched by the underlying operating system for file changes, adds, etc. When a change occurs the template partial will be registered/re-registered
 * accordingly. __NOTE:__
 * __When set to true at compile-time, all watched files will continue to be watched until `engine.clearCache` is called.__
 * __When set to true at render-time, all watched files will continue to be watched until the rendering function is called with `unwatchPartials` set to true.__
 * @property {Boolean} [unwatchPartials]
 * @property {String} [outputPath] When defined and a valid `partialsPath` is defined, compiled rendering function sources will be written to corresponding
 * sub-directories mirrored during compilation and partial discovery from {@link Engine.register} reads. Omit to use the operating system's
 * temporary directory.
 * @property {String} [outputPathTempPrefix=templeo-files-] When `outputPath` is _falsy_ the prefix will be used when generating a temporary directory.
 * Otherwise, it's ignored.
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
    relativeTo: '.',
    contextPath: 'views',
    templatePath: 'views',
    partialsPath: 'views/partials',
    watchPartials: false,
    unwatchPartials: false,
    outputPath: null,
    outputPathTempPrefix: 'templeo-files-',
    useSourceURL: false,
    renderTimePolicy: 'read-write'
  }),
  deriveOption
});

var MERGED_OPTIONS;

/**
 * Template options for a [Node.js file system back-end](https://nodejs.org/api/fs.html). See {@link module:templeo/options.FileOptions} for a full
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