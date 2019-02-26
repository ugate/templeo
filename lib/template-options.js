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
 * @property {String} [templatePathBase=''] A base path used as prefix for template `read`/`write` operations. The path format may vary
 * depending on the cache implementation used (i.e. URL, file system, etc.). See the cache `read`/`write` operations for more details
 * @property {RegExp} [templatePathBaseBypass=/^https?:\/?\/?[^:\/\s]+/i] An expression that will tested against template names to determine
 * if the template name will be prefixed with the `templatePathBase` during `read`/`write` operations. Any matches will __not__ be prefixed.
 * @property {String} [contextPathBase=''] A base path used as prefix for context `read`/`write` operations. The path format may vary
 * depending on the cache implementation used (i.e. URL, file system, etc.). See the cache `read`/`write` operations for more details
 * @property {RegExp} [contextPathBaseBypass=/^https?:\/?\/?[^:\/\s]+/i] An expression that will tested against context names to determine
 * if the context name will be prefixed with the `contextPathBase` during `read`/`write` operations. Any matches will __not__ be prefixed.
 * @property {String} [defaultExtension='html'] The default extension name to append to template names when performing `read`/`write`
 * operations and an explicit extension is not already provided for a given template name
 * @property {String} [defaultTemplateName='template'] The name assigned to the primary template content passed into {@link Engine.compile},
 * similar to the name assignment when calling {@link Engine.registerPartial}. Set to a _falsy_ value to generate the name.
 * @property {String} [defaultContextName='context'] The name assigned to the context when executing a rendering funtion without passing a
 * context _object_. The name will be used to `read` the context immediately prior to rendering.
 * @property {String} [defaultContextExtension='json'] The default extension name to append to the context name when performing `read`/`write`
 * operations and an explicit extension is not already provided for a given context name
 * @property {RegExp} [defaultPartialContent='&nbsp;'] The value to use for a partial when a partial returns a non-string value
 * @property {String} [includesParametersName='params'] The name that will be added to each partial template scope that will contain any
 * parameters passed into the `include` where the partial was added. For example, `` ${ await include`somePartName${ { param: 123 } }` } ``
 * would cause `${ params.param1 }` to equal `123` within the `somePartName` partial, but __not__ in it's parent where the `include` was added.
 * @property {String} [renderTimeReadPolicy=read] The policy applied to partial template DB `read` operations when encountering
 * `include` directives that do not have template content present in cache storage during rendering. When using any other policy
 * __except "none"__, `include` directives defined in a template that reference partials that have not been registered before compiling will
 * result in a _render-time_ read of the referenced content. The following policies are valid (see any extending option implmentations for
 * any additional policy values):
 * - `read` Normal reads will occur for missing partial content encountered during rendering
 * - `none` __Only__ partial templates that are registered before compiling a template will be available to _include_ directives during rendering.
 * Any _include_ directives found that reference partials that are not found will cause render-time errors to be thrown. 
 * @property {Object} [readFetchRequestOptions=true] The JSON options that will be used when making `read` requests to capture partial content.
 * Depending upon the `Cachier` being used on the `Engine`, the options will be passed into `window.fetch`, `https.request` or some other `read`
 * operation.
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
 * @property {Boolean} [cacheRawTemplates=true] If set to `false`, raw template content will not be cached (thus will perform a _read_ on every use-
 * __NOT FOR PRODUCTION USE!__)
 * @property {Boolean} [debugger=false] When `true`, a [`debugger`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/debugger)
 * statement will be inserted into each compiled template rendering function at the __end__ of execution (compile-time options only)
 */

const OPTIONS = Object.freeze({
  defaults: Object.freeze({
    useCommonJs: true,
    templatePathBase: '',
    templatePathBaseBypass: /^https?:\/?\/?[^:\/\s]+/i,
    contextPathBase: '',
    contextPathBaseBypass: /^https?:\/?\/?[^:\/\s]+/i,
    defaultExtension: 'html',
    defaultTemplateName: 'template',
    defaultContextName: 'context',
    defaultContextExtension: 'json',
    defaultPartialContent: '&nbsp;',
    includesParametersName: 'params',
    renderTimeReadPolicy: 'read',
    readFetchRequestOptions: null,
    formatOptions: null,
    encoding: 'utf8',
    varName: 'it',
    filename: /^(.*[\\\/]|^)([^\.]*)(.*)$/,
    cacheRawTemplates: true, // use with caution: when false, loads template file(s) on every request!!!
    debugger: false
  }),
  valids: Object.freeze({
    renderTimeReadPolicy: Object.freeze([
      'read',
      'none'
    ])
  })
});

/**
 * Template compilation options. See {@link module:templeo/options.Options} for a full listing of options.
 * @see module:templeo/options.Options
 */
class TemplateOpts {
// TODO : ESM use... export class TemplateOpts {

  /**
   * Template compilation options
   * @see module:templeo/options.Options
   * @param {module:templeo/options.Options} [opts] The template compilation options
   */
  constructor(opts) {
    this.build(opts, this.constructor.defaultOptions, this);
  }

  /**
   * Builds the {@link Options} by iterating over the `dflt` (default options) object properties and either adding them to the `to`
   * object when the `opts` object does not contain the property value (or it's invalid for that option) or adds the value from `opts`
   * when the property is present and contains a valid value for the option being iterated. The final `to` object/properties will be
   * frozen using `Object.freeze` and `Object.defineProperty`.
   * @see module:templeo/options.Options
   * @param {module:templeo/options.Options} opts The template compilation options
   * @param {Object} optd An object that generatd from {@link TemplateOpts.defaultOptionMerge} that contains the default options
   * @param {Object} optd.defaults The object that contains option properties with default property values as the default values
   * @param {Object} [optd.valids] An object that contains option names as properties. Each property value should contain an `Array`
   * of _primitive_ values that represent valid values for a given option.
   * @param {Object} to The object where the options will be set- typically a {@link TemplateOpts} instance
   * @param {Object} [valids] An object that contains option names as properties. Each property should contain an `Array` of primitive
   * values that represent valid values for a given option.
   * @returns {Object} The `to` object
   */
  build(opts, optd, to) {
    var val, isRx, noOpt;
    for (let key in optd.defaults) {
      isRx = optd.defaults[key] && optd.defaults[key] instanceof RegExp;
      if (optd.defaults[key] && !isRx && typeof optd.defaults[key] === 'object') {
        val = {};
        for (let key2 in optd.defaults[key]) {
          noOpt = !opts || !opts[key] || typeof opts[key][key2] === 'undefined'
          val[key2] = optd.deriveOption ? optd.deriveOption(noOpt, opts, optd, key, key2) :
            noOpt ? optd.defaults[key][key2] : opts[key][key2];
        }
        Object.freeze(val);
      } else {
        noOpt = !opts || typeof opts[key] === 'undefined';
        val = optd.deriveOption ? optd.deriveOption(noOpt, opts, optd, key) :
          noOpt ? optd.defaults[key] : opts[key];
      }
      if (optd.valids && optd.valids[key] && !optd.valids[key].includes(val)) {
        throw new Error(`"${to.constructor.name}" for option "${key}" is set to "${val}", but it must be one of: ${optd.valids[key].join()}`);
      }
      Object.defineProperty(to, key, { enumerable: true, value: val });
      //if (isRx) to[key].toJSON = function toJSON() {
      //  return { class: RegExp.name, source: this.source, flags: this.flags }; // ensure regular expressions are retained during serialization (i.e. JSON.stringify) 
      //};
    }
    return to;
  }

  /**
   * Merges option objects into another object
   * @protected
   * @param {Object} options The option object to merge options __from__
   * @param {Object} to The object where that will be merged __into__
   */
  static defaultOptionMerge(options, to) {
    if (!to.hasOwnProperty('deriveOption') && typeof options.deriveOption === 'function') to.deriveOption = options.deriveOption;
    if (!to.hasOwnProperty('defaults')) to.defaults = {};
    if (!to.hasOwnProperty('valids')) to.valids = {};
    for (let key in options.defaults) {
      if (!to.defaults.hasOwnProperty(key)) {
        to.defaults[key] = options.defaults[key];
      }
      if (options.valids && options.valids.hasOwnProperty(key)) {
        if (to.valids.hasOwnProperty(key)) {
          to.valids[key] = Object.freeze([...options.valids[key], ...to.valids[key]]);
        } else to.valids[key] = options.valids[key];
      }
    }
    if (options === OPTIONS) { // merge complete, freeze merged options
      Object.freeze(to.defaults);
      Object.freeze(to.valids);
      Object.freeze(to);
    } else TemplateOpts.defaultOptionMerge(OPTIONS, to);
  }

  /**
   * @see module:templeo/options.Options
   * @returns {Object} An immutable object that describes how {@link module:templeo/options.Options} will be built
   * @returns {Object} `defaults` The object that contains option properties with default property values as the default values
   * @returns {Object} `valids` An object that contains option names as properties. Each property value should contain an `Array`
   * of _primitive_ values that represent valid values for a given option.
   */
  static get defaultOptions() {
    return OPTIONS;
  }
}

// TODO : ESM remove the following line...
module.exports = TemplateOpts;