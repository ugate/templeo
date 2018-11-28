'use strict';

/**
 * Template engine options
 */
class EngineOpts {
// TODO : ESM use... export class EngineOpts {

  /**
   * Template engine options
   * @param {Object} [opts] The template engine options
   * @param {String} [opts.defaultExtension=''] The default extension name to append to template names when multiple engines are configured 
   * and an explicit extension is not provided for a given template
   * @param {Boolean} [opts.isCached] if set to false, templates will not be cached (thus will perform a _read_ on every use- __NOT FOR PRODUCTION
   * USE!__)
   * @param {String} [opts.relativeTo='/'] A base path used as prefix for `opts.path` and `opts.partialsPath`. Depending on the `engine`/`cache`
   * being used, the path may be just a virtual path that identifies a group of templates.
   *  @param {String} [opts.path='views'] The root path where views are located/identified. Depending on the `engine`/`cache` being used, the
   * path may be just a virtual path that identifies a group of views.
   * @param {String} [opts.partialsPath='views/partials'] The root path where partials are located/identified. Partials are small segments of
   * template code that can be nested and reused throughout other templates. Depending on the `engine`/`cache` being used, the path may be just
   * a virtual path that identifies a group of templates as partial/fragments.
   * @param {String} [opts.outputSourcePath] When defined __and supported by the underlying `engine` and/or `cache`__, will be used as the
   * directory structure that will be generated within the `outputPath`. When not defined, no directory structure is initialized. __NOTE:__ The
   * path may or may not differ from `opts.path`/`opts.partialsPath` since there may or may not be an actual file associated with a template or
   * partial.
   * @param {String} [opts.outputPath] When defined, templates will be written to {@link Cachier} (__otherwise, compiled templates reside
   * in-memory rather than processed via a {@link Cachier} instance__)
   * @param {String} [opts.outputExtension=.js] Extension used for generated output sources __ignored when `outputPath` is omitted__
   * @param {Object} [opts.outputFormatting] The formatting options passed into {@link Cachier} _format function_ that will format the compiled
   * template source __ignored when `outputPath` is omitted__
   * @param {String} [opts.errorsFilePath] An explicitly defined path to a error file that will be templated
   * @param {String} [opts.encoding='utf8'] The text encoding used by the templates when reading the files and outputting the result
   * @param {RegExp} [opts.evaluate] Expression to find direct script evaluations within a template
   * @param {RegExp} [opts.interpolate] Expression to find interpolations within a template
   * @param {RegExp} [opts.encode] Expression to find interpolations with encodings within a template
   * @param {RegExp} [opts.conditional] Expression to find conditional statements within a template
   * @param {RegExp} [opts.iterate] Expression to find array driven iterations within a template
   * @param {RegExp} [opts.iterateIn] Expression to find object driven iterations within a template (i.e. `for in`)
   * @param {RegExp} [opts.include] Expression to find templates replacements within other/nested templates
   * @param {RegExp} [opts.filename] Expression that will be used to capture template names from passed definition filenames when a template name
   * hasn't been passed
   * 
   * __ NOTE: Should contain 3 capture groups:**
   * 1. Full path excluding final filename w/o extension
   * 1. File name w/o extension
   * 1. Extension with preceding `.`
   * @param {String} [opts.varname=it] The variable name where the passed data object will be accessible within template expressions (e.g.
   * it.somePassedVal). May also be used to identify the persistence space.
   * @param {Boolean} [opts.strip=true] When true, all unneeded characters will removed from parsed template results, thus reducing the overall
   * size of the template results
   * @param {Boolean} [opts.append=true] A performance optimization setting that, depending on the javascript engine used and size of the
   * template, may produce better results with append set to false
   * @param {Boolean} [opts.doNotSkipEncoded=false] When true, all HTML characters with be escaped during encode expression compilations
   * @param {Object} [opts.logger] The logger for handling logging output
   * @param {Function} [opts.debug] A function that will accept __debug__ level logging messages (i.e. `debug('some message to log')`)
   * @param {Function} [opts.info] A function that will accept __info__ level logging messages (i.e. `info('some message to log')`)
   * @param {Function} [opts.warn] A function that will accept __warning__ level logging messages (i.e. `warn('some message to log')`)
   * @param {Function} [opts.error] A function that will accept __error__ level logging messages (i.e. `error('some message to log')`)
   */
  constructor(opts) {
    var val, dflt = EngineOpts.DEFAULT_OPTIONS();
    Object.defineProperty(this, 'compileMode', { // engine always uses compileMode = async
      enumerable: true,
      value: 'async'
    });
    for (let key in dflt) {
      if (dflt[key] && !(dflt[key] instanceof RegExp) && typeof dflt[key] === 'object') {
        val = {};
        for (let key2 in dflt[key]) val[key2] = !opts || !opts[key] || typeof opts[key][key2] === 'undefined' ? dflt[key][key2] : opts[key][key2];
        Object.freeze(val);
      } else val = !opts || typeof opts[key] === 'undefined' ? dflt[key] : opts[key];
      Object.defineProperty(this, key, {
        enumerable: true,
        value: val
      });
    }
  }

  /**
   * The default {@link EngineOpts}
   */
  static DEFAULT_OPTIONS() {
    return Object.freeze({
      useCommonJs: true,
      defaultExtension: 'html',
      isCached: true, // use with caution: when false, loads template file(s) on every request!!!
      relativeTo: '/',
      path: 'views',
      partialsPath: 'views/partials',
      outputSourcePath: null, // by default, paths are used as identifiers
      outputPath: null,
      outputExtension: 'js',
      outputFormatting: null, // formatting options passed into something like "js-beautify" from the engine
      errorsFilePath: null,
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
      logger: Object.freeze({
        debug: null,
        info: null,
        warn: null,
        error: null
      })    
    });
  }
}

// TODO : ESM remove the following line...
module.exports = EngineOpts;