'use strict';

// TODO : ESM remove the following lines...
const TemplateOpts = require('./lib/template-options');
const Cachier = require('./lib/cachier');
const Sandbox = require('./lib/sandbox');
// TODO : ESM uncomment the following lines...
// TODO : import * as TemplateOpts from './lib/template-options.mjs';
// TODO : import * as Cachier from './lib/cachier.mjs';
// TODO : import * as Sandbox from './lib/sandbox.mjs';

/**
 * Micro rendering template engine
 * @module templeo
 * @example
 * // Hapi.js example:
 * const Hapi = require('hapi');
 * const Vision = require('vision');
 * const HtmlFrmt = require('js-beautify').html;
 * const JsFrmt = require('js-beautify').js;
 * const Engine = require('templeo');
 * const econf = {
 *   partialsURL: 'https://example.com', // partial reads from a server?
 *   contextURL: 'https://example.com', // context read from a server?
 *   partialsPath: 'views/partials', // file path to the partials
 *   defaultExtension: 'html' // can be HTML, JSON, etc.
 * };
 * const cachier = new CachierFiles(econf, HtmlFrmt, JsFrmt);
 * const htmlEngine = new Engine(cachier);
 * // use the following instead if compiled templates don't need to be stored in files
 * // const htmlEngine = new Engine(econf, HtmlFrmt, JsFrmt);
 * const server = Hapi.Server({});
 * await server.register(Vision);
 * server.views({
 *  compileMode: 'async',
 *  relativeTo: '.',
 *  path: 'views',
 *  partialsPath: econf.partialsPath,
 *  defaultExtension: econf.defaultExtension,
 *  layoutPath: 'views/layout',
 *  layout: true,
 *  helpersPath: 'views/helpers',
 *  engines: {
 *    html: htmlEngine,
 *    json: new JsonEngine()
 *  }
 * });
 * // optionally set a partial function that can be accessed in the routes for
 * // instances where partials need to be generated, but not rendered to clients
 * server.app.htmlPartial = htmlEngine.genPartialFunc();
 * await server.start();
 * // it's a good practice to clear files after the server shuts down
 * server.events.on('stop', async () => {
 *  await htmlEngine.clearCache();
 * });
 */
class Engine {
// TODO : ESM use... export class Engine {

  /**
   * Creates a template literal engine
   * @param {TemplateOpts} [opts] The {@link TemplateOpts} to use
   * @param {Function} [readFormatter] The `function(string, readFormatOptions)` that will return a formatted string for __reading__
   * data using the `options.readFormatOptions` from {@link TemplateOpts} as the formatting options. Typically reads are for __HTML__
   * _minification_ and/or _beautifying_.
   * @param {Function} [writeFormatter] The `function(string, writeFormatOptions)` that will return a formatted string for __writting__
   * data using the `options.writeFormatOptions` from {@link TemplateOpts} as the formatting options. Typically reads are for __JS__
   * _minification_ and/or _beautifying_.
   * @param {Object} [log] The log for handling logging output
   * @param {Function} [log.debug] A function that will accept __debug__ level logging messages (i.e. `debug('some message to log')`)
   * @param {Function} [log.info] A function that will accept __info__ level logging messages (i.e. `info('some message to log')`)
   * @param {Function} [log.warn] A function that will accept __warning__ level logging messages (i.e. `warn('some message to log')`)
   * @param {Function} [log.error] A function that will accept __error__ level logging messages (i.e. `error('some message to log')`)
   */
  constructor(opts, readFormatter, writeFormatter, log) {
    const ns = internal(this);
    ns.at.cache = opts instanceof Cachier ? opts : new Cachier(opts, readFormatter, writeFormatter, log);
    ns.at.isInit = false;
    ns.at.prts = {};
    ns.at.prtlFuncs = {};
  }

  /**
   * Creates a new {@link Engine} from a {@link Cachier} instance
   * @param {Cachier} cachier The {@link Cachier} to use for persistence management
   * @returns {Engine} The generated {@link Engine}
   */
  static create(cachier) {
    if (!(cachier instanceof Cachier)) throw new Error(`cachier must be an instance of ${Cachier.name}, not ${cachier ? cachier.constructor.name : cachier}`);
    return new Engine(cachier);
  }

  /**
   * Compiles a template and returns a function that renders the template results using the passed `context` object
   * @param {String} content The raw template content
   * @param {Object} [opts] The options sent for compilation (omit to use the options set on the {@link Engine})
   * @param {URLSearchParams} [params] Any URL search parmeters that will be passed when capturing the primary `template` and/or
   * `context` when needed. Parameters can be excluded from the invocation by replacing `params` with a `callback` (e.g.
   * `compile(content, opts, callback)`).
   * @param {Function} [callback] Optional _callback style_ support __for LEGACY-ONLY APIs__:  
   * `compile(content, opts, (error, (ctx, opts, cb) => cb(error, results)) => {})` or omit to run via
   * `await compile(content, opts)`. __Omission will return the normal stand-alone renderer that can be serialized/deserialized.
   * When a _callback function_ is specified, serialization/deserialization of the rendering function will not be possible!__
   * @returns {Function} The rendering `async function` that returns a template result string based upon the provided context.
   * The following arguments apply:
   * 1. _{Object}_ `context` The context JSON that can be used as data during rendering
   * 1. _{TemplateOpts}_ `[renderOptions]` The rendering options that will superceed any options set on the {@link Engine}
   * 1. _{Function}_ `[readFormatter]` The function that will format read partials during include discovery (if any). The
   * formatting function takes 1 or 2 arguments with the first being the content that will be formatted and the second being
   * the `options.readFormatOptions`. The returned result should be a valid string.
   * 1. _{Function}_ `[writeFormatter]` The function that will format written sources during include discovery (if any). The
   * formatting function takes 1 or 2 arguments with the first being the content that will be formatted and the second being
   * the `options.writeFormatOptions`. The returned result should be a valid string.
   */
  async compile(content, opts, params, callback) { // ensures partials are included in the compilation
    const ns = internal(this);
    opts = opts || {};
    var fn, error;
    callback = typeof params === 'function' ? params : callback;
    params = params instanceof URLSearchParams ? params : null;
    if (callback) {
      if (ns.at.cache.log.info) {
        ns.at.cache.log.info('Compiling template w/callback style conventions');
      }
      try {
        fn = await compile(ns, content, params, ns.at.cache.options, opts, null, ns.at.cache);
      } catch (err) {
        error = err;
      }
      // legacy callback-style rendering :(
      callback(error, async (ctx, opts, cb) => {
        try {
          // opts.constructor.isPrototypeOf(ns.at.cache.options.constructor)
          if (!opts || !Object.getOwnPropertyNames(opts).length) {
            opts = ns.at.legacyRenderOptions;
          } else if (!(opts instanceof TemplateOpts)) opts = new ns.at.cache.options.constructor(opts);
          cb(null, await fn(ctx, opts));
        } catch (err) {
          cb(err);
        }
      });
    } else fn = compile(ns, content, params, ns.at.cache.options, opts, null, ns.at.cache);
    return fn;
  }

  /**
   * @returns {TemplateOpts} The __LEGACY-ONLY API__ {@link TemplateOpts} to use when no rendering options
   * are passed (or are empty) into the rendering function __and a callback function__ is specified when
   * calling {@link Engine.compile}
   * See {@link Engine.compile} for more details.
   */
  get legacyRenderOptions() {
    const ns = internal(this);
    return ns.at.legacyRenderOptions;
  }

  /**
   * The __LEGACY-ONLY API__ {@link TemplateOpts} to use when no rendering options
   * are passed (or are empty) into the rendering function __and a callback function__ is specified when
   * calling {@link Engine.compile}
   * @param {*} opts The options to set
   */
  set legacyRenderOptions(opts) {
    const ns = internal(this);
    ns.at.legacyRenderOptions = opts instanceof TemplateOpts ? opts : new ns.at.cache.options.constructor(opts);
  }

  /**
   * Registers a _directive_ function that can be used within template
   * [interpolations](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#Expression_interpolation)
   * @param {Function} func A __named__ `function` that has no external scope dependencies/closures other than those exposed
   * via templates during rendering
   */
  registerHelper(func) {
    const ns = internal(this);
    return ns.at.cache.registerHelper(func);
  }

  /**
   * Unregisters a partial template from cache
   * @param {String} name The template name that uniquely identifies the template content
   */
  unregister(name) {
    const ns = internal(this);
    return ns.at.cache.unregister(name);
  }

  /**
   * Registers and stores a partial template __in-memory__. Use {@link Engine.registerPartials} to write partials to cache ({@link Cachier})
   * @async
   * @param {String} name The template name that uniquely identifies the template content
   * @param {(String | URLSearchParams)} contentOrParams Either the partial template content __string__ to register _or_ the
   * `URLSearchParams` that will be passed during the content `read`
   * @param {String} [extension=options.defaultExtension] Optional override for a file extension designation for the partial
   * @returns {String} The partial content
   */
  registerPartial(name, contentOrParams, extension) {
    const ns = internal(this);
    return ns.at.cache.registerPartial(name, contentOrParams, extension);
  }

  /**
   * Registers and __caches__ one or more partial templates
   * @async
   * @param {Object[]} [partials] The partials to register
   * @param {String} partials[].name The template name that uniquely identifies the template content
   * @@param {String} [partials[].content] The partial template content to register. Omit when `read === true` to read content from cache
   * @param {URLSearchParams} [partials[].params] The `URLSearchParams` that will be passed during the content `read`
   * (__ignored when `content` is specified__)
   * @param {String} [partials[].extension] Optional override for a file extension designation for the partial
   * @param {Boolean} [read] When `true`, an attempt will be made to also {@link Cachier.read} any partials that __do not have__ a `content` property set
   * @param {Boolean} [write] When `true`, an attempt will be made to also {@link Cachier.write} any partials that __have__ a `content` property set
   * @returns {Object} An object that contains the registration results:
   * 
   * - `partials` The `partials` object that contains the fragments that have been registered
   *   - `name` The template name that uniquely identifies the template content
   *   - `content` The template content
   *   - `extension` The template file extension designation
   *   - `params` The URLSearchParams passed during the __initial__ content read
   *   - `fromRead` A flag that indicates that the 
   * - `dirs` Present __only__ when {@link Engine.filesEngine} was used. Contains the directories/sub-directories that were created
   */
  registerPartials(partials, read, write) {
    const ns = internal(this);
    return ns.at.cache.registerPartials(partials, read, write);
  }

  /**
   * @returns {Function} A reference safe `async` function to {@link Engine.renderPartial} that can be safely passed into other functions
   */
  renderPartialGenerate() {
    const ns = internal(this);
    return async (name, content) => ns.this.renderPartial(name, content);
  }

  /**
   * On-Demand compilation of a registered template
   * @param {String} name The name of the registered tempalte
   * @param {Object} [context={}] The object that contains contextual data used in the template
   * @returns {String} The compiled template
   */
  async renderPartial(name, context, renderOptions) {
    const ns = internal(this);
    const func = await ns.at.cache.compile(name);
    return func(context, renderOptions);
  }

  /**
   * Clears the underlying cache
   * @async
   * @param {Boolean} [all=false] `true` to clear __ALL unassociated cache instances__ when possible as well as any partials
   * that have been registered
   */
  clearCache(all = false) {
    const ns = internal(this);
    return ns.at.cache.clear(all);
  }

  /**
   * @returns {TemplateOpts} The engine options
   */
  get options() {
    const ns = internal(this);
    return ns.at.cache.options;
  }
}

// TODO : ESM remove the following lines...
module.exports = Engine;

/**
 * Compiles a templated segment and returns a redering function (__assumes partials are already transpiled- see {@link compile} for partial support__)
 * @private
 * @param {Object} ns The namespace of the template engine
 * @param {String} content The raw template content
 * @param {URLSearchParams} [params] Any URL search parmeters that will be passed when capturing the primary `template` and/or `context` when needed
 * @param {TemplateOpts} [options] The options that overrides the default engine options
 * @param {Object} [ropts] The object definition to be used in the template
 * @param {String} [ropts.filename] When the template name is omitted, an attempt will be made to extract a name from the `filename` using `options.filename`
 * regular expression
 * @param {String} [tname] Name to be given to the template (omit to use the one from `options.filename` or an auto generated name)
 * @param {Cachier} [cache] The {@link Cachier} instance that will handle the {@link Cachier.write} of the compiled template code. Defaults to in-memory
 * cache.
 * @returns {Function} The rendering function described in {@link Engine.compile}
 */
async function compile(ns, content, params, options, ropts, tname, cache) {
  const opts = options instanceof TemplateOpts ? options : new TemplateOpts(options);
  if (!ropts) ropts = opts; // use definitions from the options when none are supplied
  cache = cache instanceof Cachier ? cache : new Cachier(opts);
  const parts = ropts && ropts.filename && ropts.filename.match && ropts.filename.match(opts.filename);
  const tnm = tname || (parts && parts[2]) || (ropts && ropts.defaultTemplateName)
    || opts.defaultTemplateName || `template_${Sandbox.guid(null, false)}`;
  try {
    return await cache.compile(tnm, content, params, parts && parts[3]); // await in order to catch errors
  } catch (err) {
    if (ns.at.cache.log.error) {
      err.stack += `\nCAUSE: Unable to compile template ${tnm}:\n${content}`;
      ns.at.cache.log.error(err);
    }
    throw err;
  }
}

// private mapping substitute until the following is adopted: https://github.com/tc39/proposal-class-fields#private-fields
let map = new WeakMap();
let internal = function(object) {
  if (!map.has(object)) {
    if (object.module && map.has(object.module)) object = object.module;
    else map.set(object, {});
  }
  return {
    at: map.get(object),
    this: object
  };
};