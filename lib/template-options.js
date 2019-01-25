'use strict';

/**
 * `templeo` options module
 * @module templeo/options
 */
/**
 * Template compilation options
 * @typedef {Object} module:templeo/options.Options
 * @property {Boolean} [useCommonJs=true] When true, __CommonJS Module__ semantics will be used. When false, __ECMAScript Module__ semantics
 * will be used.
 * @property {String} [pathBase=''] A base path used as prefix for `read`/`write` operations. The path format may vary depending on the cache
 * implementation used (i.e. URL, file system, etc.). See the cache `read`/`write` operations for more details
 * @property {RegExp} [pathBaseBypass=/^https?:\/?\/?[^:\/\s]+/i] An expression that will tested against template names to determine if the
 * template name will be prefixed with the `pathBase` during `read`/`write` operations. Any matches will __not__ be prefixed.
 * @property {Boolean} [rejectUnauthorized=true] A flag that indicates the client should reject unauthorized server certificates. When
 * running in the browser [CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS) will apply instead.
 * @property {String} [defaultExtension='html'] The default extension name to append to template names when multiple engines are configured 
 * and an explicit extension is not provided for a given template
 * @property {String} [defaultBaseTemplateName='baseTemplate'] The name assigned to the primary template content passed into
 * {@link Engine.compile} - similar to the name assignment when calling {@link Engine.registerPartial}. Set to a _falsy_ value to generate
 * the name.
 * @property {RegExp} [defaultPartialContent='&nbsp;'] The value to use for a partial when a partial returns a non-string value
 * @property {Boolean} [isCached] if set to false, templates will not be cached (thus will perform a _read_ on every use- __NOT FOR PRODUCTION
 * USE!__)
 * @property {Boolean} [renderTimeIncludeReads=true] When `true`, any `include` defined in a template that is not found during compiling the
 * template will cause an attempt to read the partial content when encountered during __rendering__. When `false` __only__ partials that are
 * set before compiling a template will be available to `include` and any that are not found will cause render-time errors.
 * @property {Object} [formatOptions] The formatting options passed into an optional _format function_ passed to the engine that will format
 * the compiled template code. For example, when generated template code is generated during compilation and the desired code should be
 * formatted using the `js-beautify` or `uglify-js` module, the `formatOptions` would be passed into the module as the `js-beautify` or
 * `uglify-js` options.
 * @property {String} [encoding='utf8'] The text encoding used by the templates during reads
 * [falsy](https://developer.mozilla.org/en-US/docs/Glossary/Falsy) value or a partial is _included_ that cannot be resolved. Wwhen partial
 * content is empty or cannot be found errors may be thrown when the template engine is used within an external template plugin.
 * @property {String} [varName='it'] The variable name of passed context objects that will be accessible by reference within template expressions
 * (e.g. it.somePassedVal)
 * @property {RegExp} [filename=/^(.*[\\\/]|^)([^\.]*)(.*)$/] Expression that will be used to capture template names from passed definition
 * __pseudo__ filenames when a template name hasn't been passed
 * 
 * __ NOTE: Should contain 3 capture groups:__
 * 1. Full __pseudo__ path excluding final __pseudo__ filename w/o extension
 * 1. __Pseudo__ file name w/o extension
 * 1. Extension with preceding `.`
 */

const DEFAULTS = Object.freeze({
  useCommonJs: true,
  pathBase: '',
  pathBaseBypass: /^https?:\/?\/?[^:\/\s]+/i,
  rejectUnauthorized: true,
  defaultExtension: 'html',
  defaultBaseTemplateName: 'baseTemplate',
  defaultPartialContent: '&nbsp;',
  isCached: true, // use with caution: when false, loads template file(s) on every request!!!
  renderTimeIncludeReads: true,
  formatOptions: null,
  encoding: 'utf8',
  varName: 'it',
  filename: /^(.*[\\\/]|^)([^\.]*)(.*)$/
});

/**
 * Template compilation options. See {@link module:templeo/options.Options} for a full listing of options.
 * @see module:templeo/options.Options
 */
class TemplateOpts {
// TODO : ESM use... export class TemplateOpts {

  /**
   * Template compilation options
   * @param {module:templeo/options.Options} [opts] The template compilation options
   */
  constructor(opts) {
    this.build(opts, DEFAULTS, this);
  }

  /**
   * Builds the {@link Options}
   * @param {module:templeo/options.Options} opts The template compilation options
   * @param {Object} dflt The object that contains the default options
   * @param {Object} to The object where the options will be set
   * @returns {Object} The `to` object
   */
  build(opts, dflt, to) {
    var val, isRx;
    for (let key in dflt) {
      isRx = dflt[key] && dflt[key] instanceof RegExp;
      if (dflt[key] && !isRx && typeof dflt[key] === 'object') {
        val = {};
        for (let key2 in dflt[key]) val[key2] = !opts || !opts[key] || typeof opts[key][key2] === 'undefined' ? dflt[key][key2] : opts[key][key2];
        Object.freeze(val);
      } else val = !opts || typeof opts[key] === 'undefined' ? dflt[key] : opts[key];
      Object.defineProperty(to, key, { enumerable: true, value: val });
      //if (isRx) to[key].toJSON = function toJSON() {
      //  return { class: RegExp.name, source: this.source, flags: this.flags }; // ensure regular expressions are retained during serialization (i.e. JSON.stringify) 
      //};
    }
    return to;
  }

  /**
   * @returns {module:templeo/options.Options} The default options
   */
  static get defaults() {
    return DEFAULTS;
  }
}

// TODO : ESM remove the following line...
module.exports = TemplateOpts;