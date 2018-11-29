'use strict';

/**
 * `templeo` options module
 * @module templeo/options
 */
/**
 * Template engine options
 * @typedef {Object} module:templeo/options.Options
 * @property {String} [opts.defaultExtension=''] The default extension name to append to template names when multiple engines are configured 
 * and an explicit extension is not provided for a given template
 * @property {Boolean} [opts.isCached] if set to false, templates will not be cached (thus will perform a _read_ on every use- __NOT FOR PRODUCTION
 * USE!__)
 * @property {String} [opts.encoding='utf8'] The text encoding used by the templates during reads
 * @property {RegExp} [opts.evaluate] Expression to find direct script evaluations within a template
 * @property {RegExp} [opts.interpolate] Expression to find interpolations within a template
 * @property {RegExp} [opts.encode] Expression to find interpolations with encodings within a template
 * @property {RegExp} [opts.conditional] Expression to find conditional statements within a template
 * @property {RegExp} [opts.iterate] Expression to find array driven iterations within a template
 * @property {RegExp} [opts.iterateIn] Expression to find object driven iterations within a template (i.e. `for in`)
 * @property {RegExp} [opts.include] Expression to find templates replacements within other/nested templates
 * @property {RegExp} [opts.filename] Expression that will be used to capture template names from passed definition __pseudo__ filenames when a
 * template name hasn't been passed
 * 
 * __ NOTE: Should contain 3 capture groups:__
 * 1. Full __pseudo__ path excluding final __pseudo__ filename w/o extension
 * 1. __Pseudo__ file name w/o extension
 * 1. Extension with preceding `.`
 * @property {String} [opts.varname=it] The variable name where the passed data object will be accessible within template expressions (e.g.
 * it.somePassedVal). May also be used to identify the persistence space.
 * @property {Boolean} [opts.strip=true] When true, all unneeded characters will removed from parsed template results, thus reducing the overall
 * size of the template results
 * @property {Boolean} [opts.append=true] A performance optimization setting that, depending on the javascript engine used and size of the
 * template, may produce better results with append set to false
 * @property {Boolean} [opts.doNotSkipEncoded=false] When true, all HTML characters with be escaped during encode expression compilations
 * @property {Boolean} [opts.errorLine] When true, an attempt will be made when an error occurs to capture an __approximate__ line/column number
 * in the template where the error occurred. __NOTE:__ There are better, more accurate alternatives that can and should be used that can be
 * controlled by the `cache`. See the various `engine*` derivatives in the engine being used for more details.
 * @property {Object} [opts.logger] The logger for handling logging output
 * @property {Function} [opts.debug] A function that will accept __debug__ level logging messages (i.e. `debug('some message to log')`)
 * @property {Function} [opts.info] A function that will accept __info__ level logging messages (i.e. `info('some message to log')`)
 * @property {Function} [opts.warn] A function that will accept __warning__ level logging messages (i.e. `warn('some message to log')`)
 * @property {Function} [opts.error] A function that will accept __error__ level logging messages (i.e. `error('some message to log')`)
 */

const DEFAULT_OPTIONS = Object.freeze({
  useCommonJs: true,
  defaultExtension: 'html',
  isCached: true, // use with caution: when false, loads template file(s) on every request!!!
  formatOptions: null, // formatting options passed into something like "js-beautify" from the engine
  encoding: 'utf8',
  evaluate: /\{\{([\s\S]+?(\}?)+)\}\}/g,
  interpolate: /\{\{=([\s\S]+?)\}\}/g,
  encode: /\{\{!([\s\S]+?)\}\}/g,
  conditional: /\{\{\?(\?)?\s*([\s\S]*?)\s*\}\}/g,
  iterate: /\{\{~\s*(?:\}\}|([\s\S]+?)\s*\:\s*([\w$]+)\s*(?:\:\s*([\w$]+))?\s*\}\})/g,
  iterateIn: /\{\{\*\s*(?:\}\}|([\s\S]+?)\s*\:\s*([\w$]+)\s*(?:\:\s*([\w$]+))?\s*\}\})/g,
  include: /\{\{#\s*([\s\S]+?)\}\}/g,
  filename: /^(.*[\\\/]|^)([^\.]*)(.*)$/,
  varname: 'it',
  strip:  true,
  append: true,
  doNotSkipEncoded: false,
  errorLine: false,
  logger: Object.freeze({
    debug: null,
    info: null,
    warn: null,
    error: null
  })    
});

/**
 * Template engine options
 */
class EngineOpts {
// TODO : ESM use... export class EngineOpts {

  /**
   * Template engine options
   * @param {module:templeo/options.Options} [opts] The template engine options
   */
  constructor(opts) {
    this.build(opts, DEFAULT_OPTIONS, this);
  }

  /**
   * Builds the {@link Options}
   * @param {module:templeo/options.Options} opts The template engine options
   * @param {Object} dflt The object that contains the default options
   * @param {Object} to The object where the options will be set
   * @returns {Object} The `to` object
   */
  build(opts, dflt, to) {
    var val;
    Object.defineProperty(to, 'compileMode', { // engine always uses compileMode = async
      enumerable: true,
      value: 'async'
    });
    for (let key in dflt) {
      if (dflt[key] && !(dflt[key] instanceof RegExp) && typeof dflt[key] === 'object') {
        val = {};
        for (let key2 in dflt[key]) val[key2] = !opts || !opts[key] || typeof opts[key][key2] === 'undefined' ? dflt[key][key2] : opts[key][key2];
        Object.freeze(val);
      } else val = !opts || typeof opts[key] === 'undefined' ? dflt[key] : opts[key];
      Object.defineProperty(to, key, {
        enumerable: true,
        value: val
      });
    }
    return to;
  }

  /**
   * @returns {module:templeo/options.Options} The default options
   */
  static get defaultOptions() {
    return DEFAULT_OPTIONS;
  }
}

// TODO : ESM remove the following line...
module.exports = EngineOpts;