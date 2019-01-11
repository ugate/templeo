'use strict';

const TemplateOpts = require('./lib/template-options');
const JsonEngine = require('./lib/json-engine');
const Cachier = require('./lib/cachier');
const Sandbox = require('./lib/sandbox');
// TODO : ESM remove the following lines...
exports.TemplateOpts = TemplateOpts;
exports.Cachier = Cachier;
exports.JsonEngine = JsonEngine;
// TODO : ESM uncomment the following lines...
// TODO : import * as TemplateOpts from './lib/template-options.mjs';
// TODO : import * as JsonEngine from './lib/json-engine.mjs';
// TODO : import * as Cachier from './lib/cachier.mjs';
// TODO : import * as Sandbox from './lib/sandbox.mjs';
// TODO : export * as TemplateOpts from TemplateOpts;
// TODO : export * as Cachier from Cachier;

//const includeMatch = /include`([\s\S]+?)(?<!\\)`/mg;

/**
 * Micro rendering template engine
 * @module templeo
 * @example
 * // Basic example in browser
 * const Tmpl = require('templeo');
 * const htmlEngine = new Tmpl.Engine();
 * @example
 * // Hapi.js example:
 * const Hapi = require('hapi');
 * const Vision = require('vision');
 * const JsFrmt = require('js-beautify').js;
 * const Tmpl = require('templeo');
 * const econf = {
 *   pathBase: '.',
 *   path: 'views',
 *   partialsPath: 'views/partials',
 *   defaultExtension: 'html' // can be HTML, JSON, etc.
 * };
 * const htmlEngine = await Tmpl.Engine.filesEngine(econf, JsFrmt);
 * // use the following instead if compiled templates don't need to be stored in files
 * // const htmlEngine = new Tmpl.Engine(econf, JsFrmt);
 * const server = Hapi.Server({});
 * await server.register(Vision);
 * server.views({
 *  compileMode: 'async',
 *  relativeTo: econf.pathBase,
 *  path: econf.path,
 *  partialsPath: econf.partialsPath,
 *  defaultExtension: econf.defaultExtension,
 *  layoutPath: 'views/layout',
 *  layout: true,
 *  helpersPath: 'views/helpers',
 *  engines: {
 *    html: htmlEngine,
 *    json: new Tmpl.JsonEngine()
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
exports.Engine = class Engine {
// TODO : ESM use... export class Engine {

  /**
   * Creates a template parsing engine
   * @param {TemplateOpts} [opts] The {@link TemplateOpts} to use
   * @param {Function} [formatFunc] The `function(string, formatOptions)` that will return a formatted string for a specified code block,
   * passing the formatting options from `opts.formatOptions` (e.g. minification and/or beautifying)
   * @param {Object} [servePartials] The options to detemine if partial content will be loaded/read or uploaded/write to an `HTTPS` server (omit
   * to serve template partials locally)
   * none) 
   * @param {Object} [servePartials.read] The configuration for reading/`GET` partial contents during reads. Uses `window.fetch` for browsers or
   * the `https` module when running on the server (omit to prevent retrieving template partial content)
   * @param {String} [servePartials.read.url] The __base__ URL used to `GET` template partials. The partial ID will be appended to the URL (e.g.
   * `https://example.com/some/id.html` where `some/id.html` is the the partial ID). When calling {@link registerPartial} the `name` should
   * _include_ the relative path on the server to the partial that will be captured.
   * @param {Object} [servePartials.write] The configuration for writting/`POST` partial contents during writes. Uses `window.fetch` to upload
   * content in browsers or the `https` module when running on the server
   * @param {Object} [postPartials.write.url] The __base__ URL used to `POST` template partials. The partial ID will be appended to the URL (e.g.
   * `https://example.com/some/id.html` where `some/id.html` is the the partial ID). When calling {@link registerPartial} the `name` should
   * _include_ the relative path on the server to the partial that will be uploaded.
   * @param {Boolean} [servePartials.rejectUnauthorized=true] A flag that indicates the client should reject unauthorized servers (__Node.js ONLY__)
   * @param {Object} [logger] The logger for handling logging output
   * @param {Function} [logger.debug] A function that will accept __debug__ level logging messages (i.e. `debug('some message to log')`)
   * @param {Function} [logger.info] A function that will accept __info__ level logging messages (i.e. `info('some message to log')`)
   * @param {Function} [logger.warn] A function that will accept __warning__ level logging messages (i.e. `warn('some message to log')`)
   * @param {Function} [logger.error] A function that will accept __error__ level logging messages (i.e. `error('some message to log')`)
   */
  constructor(opts, formatFunc, servePartials, logger) {
    const opt = opts instanceof TemplateOpts ? opts : new TemplateOpts(opts), ns = internal(this), hasCachier = formatFunc instanceof Cachier;
    ns.at.options = opt;
    ns.at.logger = logger || {};
    ns.at.cache = hasCachier ? formatFunc : new Cachier(ns.at.options, formatFunc, true, servePartials, ns.at.logger);
    ns.at.formatFunc = !hasCachier && formatFunc;
    ns.at.isInit = false;
    ns.at.prts = {};
    ns.at.prtlFuncs = {};
  }

  /**
   * An [IndexedDB]{@link https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API} template cached {@link Engine}
   * @param {TemplateOpts} [opts] The {@link TemplateOpts}
   * @param {Function} [formatFunc] The `function(string, formatOptions)` that will return a formatted string when __writting__
   * data, passing the formatting options from `opts.formatOptions`. Used when formatting compiled code.
   * @param {Object} [indexedDB] The `IndexedDB` implementation that will be used for caching (defaults to `window.indexedDB`).
   * Can be either a `IndexedDB` compilant instance or a `LevelDB`/`level` instance.
   * @returns {Engine} A new {@link Engine} instance with IndexedDB cache
   */
  static async indexedDBEngine(opts, formatFunc, indexedDB, logger) {
    opts = opts instanceof TemplateOpts ? opts : new TemplateOpts(opts);
    const CachierDB = opts.useCommonJs ? require('./lib/cachier-db.js') : /* TODO : ESM use... import('./lib/cachier-db.mjs') */null;
    return new Engine(opts, new CachierDB(opts, indexedDB, formatFunc, logger), null, logger);
  }

  /**
   * A [Node.js]{@link https://nodejs.org/api/fs.html} __only__ {@link Engine} to cache compiled template code in the file system for improved
   * debugging/caching capabilities
   * @param {TemplateOpts} [opts] The {@link TemplateFileOpts}
   * @param {Function} [formatFunc] The `function(string, formatOptions)` that will return a formatted string when __writting__
   * data, passing the formatting options from `opts.formatOptions`. Used when formatting compiled code.
   * @returns {Engine} A new {@link Engine} instance with file system cache
   */
  static async filesEngine(opts, formatFunc, logger) {
    const useCommonJs = (opts && opts.useCommonJs) || TemplateOpts.defaults.useCommonJs;
    const CachierFiles = useCommonJs ? require('./lib/cachier-files.js') : /* TODO : ESM use... await import('./lib/cachier-files.mjs')*/null;
    const TemplateFileOpts = useCommonJs ? require('./lib/template-file-options.js') : /* TODO : ESM use... await import('./lib/template-file-options.mjs')*/null;
    opts = opts instanceof TemplateFileOpts ? opts : new TemplateFileOpts(opts);
    return new Engine(opts, new CachierFiles(opts, formatFunc, logger), null, logger);
  }

  /**
   * Compiles a template and returns a function that renders the template results using the passed `context` object
   * @param {String} content The raw template content
   * @param {Object} [opts] The options sent for compilation (omit to use the options set on the {@link Engine})
   * @param {Function} [callback] Optional _callback style_ support __for legacy APIs__:  
   * `compile(content, opts, (error, (ctx, opts, cb) => cb(error, results)) => {})` or omit to run via
   * `await compile(content, opts)`
   * @returns {function} The rendering `function(context)` that returns a template result string based upon the provided context
   */
  async compile(content, opts, callback) { // ensures partials are included in the compilation
    const ns = internal(this);
    opts = opts || {};
    var fn, error;
    if (callback) {
      if (ns.at.logger.info) {
        ns.at.logger.info('Compiling template w/callback style conventions');
      }
      try {
        fn = await compile(ns, content, ns.at.options, opts, null, ns.at.cache);
      } catch (err) {
        error = err;
      }
      callback(error, async (ctx, opts, cb) => {
        try {
          cb(null, await fn(ctx, opts));
        } catch (err) {
          cb(err);
        }
      });
    } else fn = compile(ns, content, ns.at.options, opts, null, ns.at.cache);
    return fn;
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
   * Registers and caches a partial template
   * @param {String} name The template name that uniquely identifies the template content
   * @param {String} content The partial template content to register
   * @returns {String} The partial content
   */
  registerPartial(name, content) {
    const ns = internal(this);
    return ns.at.cache.registerPartial(name, content);
  }

  /**
   * Registers and caches partial compile-time partial templates
   * @async
   * @param {Object[]} [partials] The partials to register
   * @param {String} partials[].name The template name that uniquely identifies the template content
   * @param {String} partials[].content The partial template content to register
   * @param {Boolean} [read=true] When `true`, an attempt will be made to also _read_ any partials using option parameters
   * @returns {Object} An object that contains the registration results:
   * 
   * - `partials` The `partials` object that contains the fragments that have been registered
   *   - `name` The template name that uniquely identifies the template content
   *   - `content` The template content
   *   - `fromRead` A flag that indicates that the 
   * - `dirs` Present __only__ when {@link Engine.filesEngine} was used. Contains the directories/sub-directories that were created
   */
  registerPartials(partials, read) {
    const ns = internal(this);
    return ns.at.cache.registerPartials(partials, read);
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
    return ns.at.options;
  }
};

/**
 * Compiles a templated segment and returns a redering function (__assumes partials are already transpiled- see {@link compile} for partial support__)
 * @private
 * @param {Object} ns The namespace of the template engine
 * @param {String} content The raw template content
 * @param {TemplateOpts} [options] The options that overrides the default engine options
 * @param {Object} [def] The object definition to be used in the template
 * @param {String} [def.filename] When the template name is omitted, an attempt will be made to extract a name from the `filename` using `options.filename`
 * regular expression
 * @param {String} [tname] Name to be given to the template (omit to use the one from `options.filename` or an auto generated name)
 * @param {Cachier} [cache] The {@link Cachier} instance that will handle the {@link Cachier.write} of the compiled template code. Defaults to in-memory
 * cache.
 * @returns {Function} The rendering `function(context)` that returns a template result string based upon the provided context
 */
async function compile(ns, content, options, def, tname, cache) {
  const opts = options instanceof TemplateOpts ? options : new TemplateOpts(options);
  if (!def) def = opts; // use definitions from the options when none are supplied
  cache = cache instanceof Cachier ? cache : new Cachier(opts);
  const tnm = tname || (def && def.filename && def.filename.match && def.filename.match(opts.filename)[2]) || ('template_' + Sandbox.guid(null, false));
  try {
    return await cache.compile(tnm, content); // await in order to catch errors
  } catch (e) {
    if (ns.at.logger.error) ns.at.logger.error(`Could not compile template ${tnm} (ERROR: ${e.message}): ${content}`);
    throw e;
  }
}

// private mapping
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