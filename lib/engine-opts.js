'use strict';

/**
 * Template engine options
 */
class EngineOpts {
// TODO : ESM use... export class EngineOpts {

  /**
   * Template engine options
   * @param {Object} [opts] The template engine options
   * @param {String} [opts.compileMode=sync] Determines if compilation will be done in `async` or `sync`
   * @param {String} [opts.defaultExtension=''] The default extension name to append to template names when multiple engines are configured 
   * and an explicit extension is not provided for a given template
   * @param {Boolean} [opts.isCached] if set to false, templates will not be cached (thus will perform a _read_ on every use- NOT FOR PRODUCTION
   * USE!)
   * @param {String} [opts.relativeTo='/'] A base path used as prefix for path and partialsPath
   * @param {String} [opts.partialsPath='views/partials'] The root path, or array of paths, where partials are located/identified at. Partials
   * are small segments of template code that can be nested and reused throughout other templates.
   * @param {String} [opts.outputSourcePath] When defined, will be used as the directory structure that will be generated within the `outputPath`
   * (otherwise, no directory structure is initialized)
   * @param {String} [opts.outputPath] When defined, templates will be written to {@link Recall} (__otherwise, compiled templates reside
   * in-memory rather than processed via a {@link Recall} instance__)
   * @param {String} [opts.outputExtension=.js] Extension used for generated output sources __ignored when `outputPath` is omitted__
   * @param {Object} [opts.outputFormatting] The formatting options passed into {@link Recall} _format function_ that will format the compiled
   * template source __ignored when `outputPath` is omitted__
   * @param {String} [opts.errorsFilePath] An explicitly defined path to a error file that will be templated
   * @param {String} [opts.encoding='utf8'] The text encoding used by the templates when reading the files and outputting the result
   * @param {RegExp} [opts.evaluate] Expression to find direct script evaluations within a template
   * @param {RegExp} [opts.interpolate] Expression to find interpolations within a template
   * @param {RegExp} [opts.encode] Expression to find interpolations with encodings within a template
   * @param {RegExp} [opts.conditional] Expression to find conditional statements within a template
   * @param {RegExp} [opts.iterate] Expression to find array driven iterations within a template
   * @param {RegExp} [opts.include] Expression to find templates replacements within other/nested templates
   * @param {RegExp} [opts.filename] Expression that will be used to capture template names from passed definition filenames when a template name
   * hasn't been passed
   * 
   * ** NOTE: Should contain 3 capture groups:**
   * 1. Full path excluding final filename w/o extension
   * 1. File name w/o extension
   * 1. Extension with preceding `.`
   * @param {RegExp} [opts.errorline] Expression that will be used to detect line/column numbers of potential errors that may occur within a
   * template (thrown error messages will contain the line/column number of where script evaluations fail- ommit for slight performance gain)
   * @param {String} [opts.varname=it] The variable name where the passed data object will be accessible within template expressions (e.g.
   * it.somePassedVal). May also be used to identify the persistence space.
   * @param {Boolean} [opts.strip=true] When true, all unneeded characters will removed from parsed template results, thus reducing the overall
   * size of the template results
   * @param {Boolean} [opts.append=true] A performance optimization setting that, depending on the javascript engine used and size of the
   * template, may produce better results with append set to false
   * @param {Boolean} [opts.doNotSkipEncoded=false] When true, all HTML characters with be escaped during encode expression compilations
   * @param {Function} [opts.logger] A function that will accept logging messages (i.e. `logger('some message to log')`)
   */
  constructor(opts) {
    var val, dflt = EngineOpts.DEFAULT_OPTIONS();
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
      compileMode: 'sync',
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
      conditional:  /\{\{\?(\?)?\s*([\s\S]*?)\s*\}\}/g,
      iterate:  /\{\{~\s*(?:\}\}|([\s\S]+?)\s*\:\s*([\w$]+)\s*(?:\:\s*([\w$]+))?\s*\}\})/g,
      include: /\{\{#\s*(include)\.([\s\S]+?)\}\}/g,
      filename: /^(.*[\\\/]|^)([^\.]*)(.*)$/,
      errorLine:  /\r\n|\r|\n/g,
      varname: 'it',
      strip:  true,
      append: true,
      doNotSkipEncoded: false,
      logger: null
    });
  }
}

// TODO : ESM remove the following line...
exports.EngineOpts = EngineOpts;