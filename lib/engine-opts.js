'use strict';

/**
 * `templeo` options module
 * @module templeo/options
 */
/**
 * Template engine options
 * @typedef {Object} module:templeo/options.Options
 * @property {Boolean} [useCommonJs=true] When true, __CommonJS Module__ semantics will be used. When false, __ECMAScript Module__ semantics
 * will be used.
 * @property {String} [defaultExtension='html'] The default extension name to append to template names when multiple engines are configured 
 * and an explicit extension is not provided for a given template
 * @property {Boolean} [isCached] if set to false, templates will not be cached (thus will perform a _read_ on every use- __NOT FOR PRODUCTION
 * USE!__)
 * @property {Object} [formatOptions] The `engine` formatting options passed into a specified _format function_ that will format the compiled
 * template code. For example, when generated template code is generated during compilation and the desired code should be formatted using the
 * `js-beautify` module, the `formatOptions` would be passed into the module as the `js-beautify` options.
 * @property {String} [encoding='utf8'] The text encoding used by the templates during reads
 * @property {Object[]} [partials] Partials that will be registered by the `engine` during a `scan`
 * @property {String} [partials[].name] The partial name
 * @property {String} [partials[].content] The _raw_ partial content
 * @property {RegExp} [defaultPartialContent='&nbsp;'] The value to use for a partial when a partial returns a
 * [falsy](https://developer.mozilla.org/en-US/docs/Glossary/Falsy) value or a partial is _included_ that cannot be resolved. Wwhen partial
 * content is empty or cannot be found errors may be thrown when the template engine is used within an external template plugin.
 * @property {RegExp} [filename] Expression that will be used to capture template names from passed definition __pseudo__ filenames when a
 * template name hasn't been passed
 * 
 * __ NOTE: Should contain 3 capture groups:__
 * 1. Full __pseudo__ path excluding final __pseudo__ filename w/o extension
 * 1. __Pseudo__ file name w/o extension
 * 1. Extension with preceding `.`
 * @property {String} [varName=it] The variable name of passed context objects that will be accessible by reference within template expressions
 * (e.g. it.somePassedVal)
 * @property {Boolean} [strip=true] When true, all unneeded characters will removed from parsed template results, thus reducing the overall
 * size of the template results
 * @property {Boolean} [append=true] A performance optimization setting that, depending on the javascript engine used and size of the
 * template, may produce better results with append set to false
 * @property {Boolean} [doNotSkipEncoded=false] When true, all HTML characters with be escaped during encode expression compilations
 * @property {Boolean} [errorLine] When true, an attempt will be made when an error occurs to capture an __approximate__ line/column number
 * in the template where the error occurred. __NOTE:__ There are better, more accurate alternatives that can and should be used that can be
 * controlled by the `cache`. See the various `engine*` derivatives in the engine being used for more details.
 * @property {Object} [logger] The logger for handling logging output
 * @property {Function} [logger.debug] A function that will accept __debug__ level logging messages (i.e. `debug('some message to log')`)
 * @property {Function} [logger.info] A function that will accept __info__ level logging messages (i.e. `info('some message to log')`)
 * @property {Function} [logger.warn] A function that will accept __warning__ level logging messages (i.e. `warn('some message to log')`)
 * @property {Function} [logger.error] A function that will accept __error__ level logging messages (i.e. `error('some message to log')`)
 */

const DEFAULT_OPTIONS = Object.freeze({
  useCommonJs: true,
  defaultExtension: 'html',
  defaultPartialContent: '&nbsp;',
  isCached: true, // use with caution: when false, loads template file(s) on every request!!!
  formatOptions: null, // formatting options passed into something like "js-beautify" from the engine
  encoding: 'utf8',
  partials: null,
  filename: /^(.*[\\\/]|^)([^\.]*)(.*)$/,
  varName: 'it',
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