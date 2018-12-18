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
 * @property {String} [defaultExtension=''] The default extension name to append to template names when multiple engines are configured 
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
 * @property {RegExp} [assign] Expression to find either variable assignments or variable values within a template that are not part of the context
 * object (i.e. `varname` namespace). The expression should contain at least three capturing groups that consist of the variable name, the operator
 * (typically `=`) and the value being assigned.
 * @property {RegExp} [interpolate] Expression to find interpolations within a template (i.e. insertions). The expression should contain at least
 * one capturing group that consists of the value that will be interpolated into the template.
 * @property {RegExp} [conditional] Expression to find conditional statements within a template. The expression should contain two capturing groups:
 * the optional value whose presense indicates that the condition is part of an `else if` clause and the conditional statement.
 * @property {RegExp} [iterate] Expression to find loop iterations within a template (i.e. `for` or `for of`). The expression should contain
 * between one to three capturing groups: the variable that will be iterated, the name given to each value that is being iterated and the name given
 * to the index value.
 * @property {RegExp} [iterateIn] The expression to find enumerable, non-Symbol property iterations within a template (i.e. `for in`). The expression
 * should contain between one to three capturing groups: the variable that will be iterated, the object whose non-Symbol enumerable properties are
 * iterated over and the property name of the value that is assigned to the variable on each iteration.
 * @property {RegExp} [include] The expression to find templates replacements within other/nested templates. The expression should contain at least
 * one capturing group that contains the period delimited partial name that will be transpiled into the current template.
 * @property {RegExp} [comment] The expression that will replace comments prior to rendering
 * @property {RegExp} [encode] The expression to find encoded sections that will be encoded within a template (should contain at least one capturing
 * group that contains the value that will be encoded)
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
  isCached: true, // use with caution: when false, loads template file(s) on every request!!!
  formatOptions: null, // formatting options passed into something like "js-beautify" from the engine
  encoding: 'utf8',
  partials: null,
  assign: /\{\{\s*([^=\s]+)\s*(=?)\s*([\s\S]*?(?:\}?)+)\}\}/g,
  interpolate: /\{\{=\s*([\s\S]+?(?:\}?)+)\}\}/g,
  conditional: /\{\{\?(\?)?\s*([\s\S]*?(?:\}?)+)\}\}/g,
  iterate: /\{\{~\s*(?:\}\}|([\s\S]+?)\s*:\s*([\w$]+)\s*(?:\:\s*([\w$]+))?\}\})/g,
  iterateIn: /\{\{\*\s*(?:\}\}|([\s\S]+?)\s*:\s*([\w$]+)\s*(?:\:\s*([\w$]+))?\s*\}\})/g,
  include: /\{\{#\s*([\s\S]+?)\}\}/g,
  comment: /\{\{\![\s\S]+?\}\}/g,
  encode: /\{\{-([\s\S]+?)\}\}/g,
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