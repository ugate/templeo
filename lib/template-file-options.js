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
 * @property {Boolean} [watchPaths=false] When _true_, `partialsPath` and its discovered subdirectories are watched with native
 * [Node.js `fs.watch`](https://nodejs.org/api/fs.html#fswatchfilename-options-listener). Added or changed files are registered/re-registered,
 * removed files are unregistered, and newly created or removed subdirectories are added to or removed from the active watcher set.
 * Watchers use `{ persistent: false }`, so they do not keep the Node.js process running. File-system event behavior remains dependent on the
 * underlying operating system. __When enabled at compile-time, watchers remain active until `engine.clearCache()` is called.__
 * __When enabled at render-time, pass the same shared-store object as the renderer's fifth argument across calls; the watchers remain active
 * until a rendering call sets `unwatchPaths` to true.__
 * @property {Boolean} [unwatchPaths=false] When _true_, all render-time watchers associated with the renderer's shared store are closed.
 * __The rendering function call returns an empty string without rendering.__
 * @property {String} [outputPath] When defined and a valid `partialsPath` is defined, compiled rendering function sources will be written to corresponding
 * sub-directories mirrored during compilation and partial discovery from {@link Engine.register} reads. Omit to use the operating system's
 * temporary directory.
 * @property {String} [outputPathTempPrefix=templeo-files-] When `outputPath` is _falsy_ the prefix will be used when generating a temporary directory.
 * Otherwise, it's ignored.
 */

import TemplateOpts from './template-options.js';
import * as Os from 'node:os';
import * as Path from 'node:path';
import * as Fs from 'node:fs';

const OPTIONS = Object.freeze({
  defaults: Object.freeze({
    relativeTo: '.',
    contextPath: 'views',
    templatePath: 'views',
    partialsPath: 'views/partials',
    watchPaths: false,
    unwatchPaths: false,
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

export default TemplateFileOpts;

/**
 * Derives option values
 * @private
 * @ignore
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