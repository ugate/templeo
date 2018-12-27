'use strict';

const EngineOpts = require('./lib/engine-opts');
const JsonEngine = require('./lib/json-engine');
const Cachier = require('./lib/cachier');
const Director = require('./lib/director');
// TODO : ESM remove the following lines...
exports.EngineOpts = EngineOpts;
exports.Cachier = Cachier;
exports.JsonEngine = JsonEngine;
exports.Director = Director;
// TODO : ESM uncomment the following lines...
// TODO : import * as EngineOpts from './lib/engine-opts.mjs';
// TODO : import * as JsonEngine from './lib/json-engine.mjs';
// TODO : import * as Cachier from './lib/cachier.mjs';
// TODO : import * as Director from './lib/director.mjs';
// TODO : export * as EngineOpts from EngineOpts;
// TODO : export * as Cachier from Cachier;
// TODO : export * as Director from Director;

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
   * @param {EngineOpts} [opts] The {@link EngineOpts} to use
   * @param {Function} [formatFunc] The `function(string, formatOptions)` that will return a formatted string when __writting__
   * data, passing the formatting options from `opts.formatOptions`. Used when formatting compiled code.
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
   */
  constructor(opts, formatFunc, servePartials) {
    const opt = opts instanceof EngineOpts ? opts : new EngineOpts(opts), ns = internal(this);
    ns.at.options = opt;
    ns.at.cache = formatFunc instanceof Cachier ? formatFunc : new Cachier(ns.at.options, formatFunc, true, servePartials);
    ns.at.isInit = false;
    ns.at.prts = {};
    // Each partial replacement is flagged with the engine marker so that line/column detection can be performed
    // const max = 1e10, min = 0;
    // ns.at.marker = Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * An [IndexedDB]{@link https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API} template cached {@link Engine}
   * @param {EngineOpts} [opts] The {@link EngineOpts}
   * @param {Function} [formatFunc] The `function(string, formatOptions)` that will return a formatted string when __writting__
   * data, passing the formatting options from `opts.formatOptions`. Used when formatting compiled code.
   * @param {Object} [indexedDB] The `IndexedDB` implementation that will be used for caching (defaults to `window.indexedDB`).
   * Can be either a `IndexedDB` compilant instance or a `LevelDB`/`level` instance.
   * @returns {Engine} A new {@link Engine} instance with IndexedDB cache
   */
  static async indexedDBEngine(opts, formatFunc, indexedDB) {
    opts = opts instanceof EngineOpts ? opts : new EngineOpts(opts);
    const CachierDB = opts.useCommonJs ? require('./lib/cachier-db.js') : /* TODO : ESM use... import('./lib/cachier-db.mjs') */null;
    return new Engine(opts, new CachierDB(opts, indexedDB, formatFunc));
  }

  /**
   * A [Node.js]{@link https://nodejs.org/api/fs.html} __only__ {@link Engine} to cache compiled template code in the file system for improved
   * debugging/caching capabilities
   * @param {EngineOpts} [opts] The {@link EngineFileOpts}
   * @param {Function} [formatFunc] The `function(string, formatOptions)` that will return a formatted string when __writting__
   * data, passing the formatting options from `opts.formatOptions`. Used when formatting compiled code.
   * @returns {Engine} A new {@link Engine} instance with file system cache
   */
  static async filesEngine(opts, formatFunc) {
    const useCommonJs = (opts && opts.useCommonJs) || EngineOpts.defaultOptions.useCommonJs;
    const CachierFiles = useCommonJs ? require('./lib/cachier-files.js') : /* TODO : ESM use... await import('./lib/cachier-files.mjs')*/null;
    const EngineFileOpts = useCommonJs ? require('./lib/engine-file-opts.js') : /* TODO : ESM use... await import('./lib/engine-file-opts.mjs')*/null;
    opts = opts instanceof EngineFileOpts ? opts : new EngineFileOpts(opts);
    return new Engine(opts, new CachierFiles(opts, formatFunc));
  }

  /**
   * Compiles a template and returns a function that renders the template results using the passed `context` object
   * @param {String} tmpl The raw template source
   * @param {Object} [opts] The options sent for compilation (omit to use the options set on the {@link Engine})
   * @param {Function} [callback] Optional _callback style_ support __for legacy APIs__:  
   * `compile(tmpl, opts, (error, (ctx, opts, cb) => cb(error, results)) => {})` or omit to run via
   * `await compile(tmpl, opts)`
   * @returns {function} The rendering `function(context)` that returns a template result string based upon the provided context
   */
  async compile(tmpl, opts, callback) { // ensures partials are included in the compilation
    const ns = internal(this);
    opts = opts || ns.at.options;
    var fn, error;
    if (callback) {
      if (ns.at.options.logger.info) {
        ns.at.options.logger.info('Compiling template w/callback style conventions');
      }
      try {
        fn = await compile(ns, ns.this, tmpl, opts);
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
    } else fn = compile(ns, ns.this, tmpl, opts);
    return fn;
  }

  /**
   * Unregisters a partial template from cache
   * @param {String} name The template name that uniquely identifies the template content
   */
  unregisterPartial(name) {
    const ns = internal(this);
    if (ns.at.prts[name]) delete ns.at.prts[name];
  }

  /**
   * Registers and caches a partial template
   * @param {String} name The template name that uniquely identifies the template content
   * @param {String} partial The partial template content to register
   */
  registerPartial(name, partial) {
    const ns = internal(this);
    ns.at.prts[name] = { tmpl: partial, name: name };
    ns.at.prts[name].ext = ns.at.options.defaultExtension || '';
  }

  /**
   * On-Demand compilation of a registered template
   * @param {String} name The name of the registered tempalte
   * @param {Object} context The object that contains contextual data used in the template
   * @returns {String} The compiled template (will return `&nbsp;` when no partial is found to prevent potential errors when used in external plugins)
   */
  async processPartial(name, context) {
    const ns = internal(this);
    if (!ns.at.options.isCached) await refreshPartial(ns, this, name);
    // prevent "No partial found" errors
    return (context && ns.at.prts[name] && (typeof ns.at.prts[name].fn === 'function' || await setFn(ns, this, name)) && ns.at.prts[name].fn(context)) || '&nbsp;';
  }

  /**
   * Scans the {@link Cachier} for templates/partials and generates a reference safe function for on-demand compilation of a registered templates
   * @param {Boolean} [registerPartials] `true` __and when supported__, indicates that the {@link Cachier} implementation should attempt to
   * {@link Engine.registerPartial} for any partials found during {@link Cachier.scan}. __NOTE: If the {@link Engine} is being used as pulgin, there
   * typically isn't a need to register partials during initialization since {@link Engine.registerPartial} is normally part of the plugin contract and
   * will be handled automatically/internally, negating the need to explicitly do it during the scan. Doing so may duplicate the partial registration
   * procedures.__
   * @returns {Object|undefined} An object that contains the scan results:
   * 
   * - `created` The metadata object that contains details about the scan
   *  - `partials` The `partials` object that contains the fragments that have been registered
   *    - `name` The template name
   *    - `id` The template identifier
   *    - `content` The template content
   *  - `dirs` Present __only__ when {@link Engine.filesEngine} was used. Contains the directories/sub-directories that were created
   * - `partialFunc` A reference safe `async` function to {@link Engine.processPartial} that can be safely passed into other functions
   */
  async scan(registerPartials) {
    const ns = internal(this);
    const rptrl = registerPartials ? (name, content) => ns.this.registerPartial(name, content) : null;
    const urptrl = registerPartials ? (name) => ns.this.unregisterPartial(name) : null;
    return {
      created: await ns.at.cache.scan(rptrl, urptrl),
      partialFunc: ns.this.genPartialFunc()
    };
  }

  /**
   * @returns {Function} A reference safe `async` function to {@link Engine.processPartial} that can be safely passed into other functions
   */
  genPartialFunc() {
    const ns = internal(this);
    return async (name, content) => ns.this.processPartial(name, content);
  }

  /**
   * Clears the underlying cache
   * @param {Boolean} [all=false] `true` to clear __ALL unassociated cache instances__ when possible as well as any partials
   * that have been registered
   */
  async clearCache(all = false) {
    const ns = internal(this);
    if (all) ns.at.prts = {};
    return ns.at.cache.clear(all);
  }

  /**
   * @returns {EngineOpts} The engine options
   */
  get options() {
    const ns = internal(this);
    return ns.at.options;
  }
};

/**
 * Sets a template function on a partial namespace
 * @private
 * @param {Object} ns The namespace of the template engine
 * @param {Engine} eng The template engine
 * @param {String} name The template name where the function will be set
 * @returns {function} The set template function
 */
async function setFn(ns, eng, name) {
  if (ns.at.prts[name].tmpl) return ns.at.prts[name].fn = await compile(ns, eng, ns.at.prts[name].tmpl, null, name);
}

/**
 * Refreshes template partial content by reading the contents of the partial file
 * @private
 * @param {Object} ns The namespace of the template engine
 * @param {Engine} eng The template engine
 * @param {String} name The template name where the function will be set
 */
async function refreshPartial(ns, eng, name) {
  const partial = (await ns.at.cache.read(name, true)).content;
  eng.registerPartial(name, partial.toString(ns.at.options.encoding), true);
  if (ns.at.options.logger.info) ns.at.options.logger.info(`Refreshed template partial "${name}"`);
}

/**
 * Generats a template function for a partial
 * @private
 * @param {Object} ns The namespace of the template engine
 * @param {Engine} eng The template engine
 * @param {String} content The template content
 * @param {Object} context The object that contains the contextual data used in the template
 * @param {String} name The template name that uniquely identifies the template content
 * @returns {function} The {@link Engine.template} function
 */
async function compile(ns, eng, content, context, name) { // generates a template function that accounts for nested partials
  const prtl = await rplPartial(ns, eng, content, context, name);
  return compileToFunc(ns, prtl, ns.at.options, context, name, ns.at.cache);
}

/**
 * Replaces any included partials that may be nested within other tempaltes with the raw template content
 * @private
 * @param {Object} ns The namespace of the template engine
 * @param {Engine} eng The template engine
 * @param {String} content The template content
 * @param {Object} context The object that contains the contextual data used in the template
 * @param {String} name The template name that uniquely identifies the template content
 * @returns {String} The template with replaced raw partials
 */
async function rplPartial(ns, eng, content, context, name) {
  const cntnt = await replace(content, ns.at.options.include, async function partialRpl(match, pname) {
    var nm = (pname && pname.trim().replace(/\./g, '/')) || '';
    if (ns.at.prts[nm]) {
      if (!ns.at.options.isCached) await refreshPartial(ns, eng, nm);
      return await rplPartial(ns, eng, ns.at.prts[nm].tmpl, context, name); // any nested partials?
    }
    return match; // leave untouched so error will be thrown (if subsiquent calls cannot find partial)
  });
  return !cntnt.length ? '&nbsp;' : cntnt; // nbsp prevents "No partial found" errors
}

/**
 * `String.prototype.replace` alternative that supports `async` _replacer_ functions
 * @private
 * @ignore
 * @param {String} str The string to perform a replace on
 * @param {RegExp} regex The regular expression that the replace will match
 * @param {Function} replacer An `async` function that operates the same way as the function passed into `String.prototype.replace`
 */
async function replace(str, regex, replacer) {
  const mtchs = [];
  str.replace(regex, function asyncReplacer(match) {
    mtchs.push({ args: arguments, thiz: this });
    return match;
  });
  var offset = 0, beg, end, rtn;
  for (let mtch of mtchs) {
    rtn = replacer.apply(mtch.thiz, mtch.args);
    if (rtn instanceof Promise) rtn = await rtn;
    if (rtn !== mtch.args[0]) {
      if (!rtn) rtn = String(rtn); // same as async version
      beg = mtch.args[mtch.args.length - 2] + offset;
      end = beg + mtch.args[0].length;
      str = str.substring(0, beg) + rtn + str.substring(end);
      offset += rtn.length - mtch.args[0].length;
    }
  }
  return str;
}

function codedDirectives(directives) {
  const directors = Director.directives;
  const rtn = { names: '', code: '' };
  for (let drv of directors) {
    rtn.code += `${drv.code.toString()}`;
    rtn.names += (rtn.names ? ',' : '') + drv.name;
  }
  if (directives) {
    var di = -1;
    for (let drv of directives) {
      di++;
      if (typeof drv !== 'function') throw new Error(`Directive option at index ${di} must be a named function, not ${drv}`);
      else if (!drv.name) throw new Error(`Directive option at index ${di} must be a named function`);
      rtn.code += `${drv.toString()}`;
      rtn.names += `,${drv.name}`;
    }
  }
  rtn.names = `[${rtn.names}]`;
  return rtn;
}

/**
 * Generates a locally sandboxed environment compilation for template rendering
 * @private
 * @param {String} code The compilation that will be coded/appened to the compilation sequence
 * @param {(String|Object)} includes Either the coded includes string or the includes JSON
 * @param {String} varName The name given to the context that will be coded
 * @param {Function[]} directives Any additional directive functions
 * @returns {String} A coded representation to be used by a template engine
 */
function coded(code, includes, varName, directives) {
  const inclsx = `const includes=${JSON.stringify(includes)};`, varx = `const varName='${varName}';`;
  const dirsx = `const directives=${JSON.stringify(directives)};`, codedx = `const coded=${coded.toString()};`;
  // the context object is contained in a separate code block in order to isolate it from the directives
  const incl = `var include;{${inclsx}${varx}${dirsx}${codedx}include=${include.toString()};}`;
  return `${directives.code};{const ${varName}=arguments[0];${incl}${code}}`;
}

/**
 * Compiles a templated segment and returns a redering function (__assumes partials are already transpiled- see {@link compile} for partial support__)
 * @private
 * @param {Object} ns The namespace of the template engine
 * @param {String} tmpl The raw template source
 * @param {EngineOpts} [options] The options that overrides the default engine options
 * @param {Object} [def] The object definition to be used in the template
 * @param {String} [def.filename] When the template name is omitted, an attempt will be made to extract a name from the `filename` using `options.filename`
 * regular expression
 * @param {String} [tname] Name to be given to the template (omit to use the one from `options.filename` or an auto generated name)
 * @param {Cachier} [cache] The {@link Cachier} instance that will handle the {@link Cachier.write} of the compiled template code. Defaults to in-memory
 * cache.
 * @returns {Function} The rendering `function(context)` that returns a template result string based upon the provided context
 */
async function compileToFunc(ns, tmpl, options, def, tname, cache) {
  const opts = options instanceof EngineOpts ? options : new EngineOpts(options);
  cache = cache instanceof Cachier ? cache : new Cachier(opts);
  const tnm = tname || (def && def.filename && def.filename.match && def.filename.match(opts.filename)[2]) || ('template_' + Cachier.guid(null, false));
  var str = '';
  try {
    str = coded(`return \`${tmpl}\``, ns.at.prts, opts.varName, codedDirectives(opts.directives));
    const { func } = await cache.generateCode(tnm, str, cache.isWritable);
    if (func && ns.at.options.logger.debug) ns.at.options.logger.debug(`Compiled ${func.name}`);
    return func;
  } catch (e) {
    if (opts.logger.error) opts.logger.error(`Could not compile template ${tnm} (ERROR: ${e.message}): ${str || tmpl}`);
    throw e;
  }
}

/**
 * Template literal tag that will include partials. __Assumes an `includes` object that contains the partials by property name,
 * `varName` and `directives` (from {@link Director.directives}) are within scope__.
 * @private
 * @param {String[]} strs The string passed into template literal tag
 * @param  {String[]} exps The expressions passed into template literal tag
 */
function include(strs, ...exps) {
  var rtn = '';
  for (let str of strs) {
    if (includes[str] && includes[str].tmpl) {
      try {
        rtn += (new Function(coded(`return \`${includes[str].tmpl}\``, includes, varName, directives)))();
      } catch (err) {
        err.message += ` CAUSE: Unable to include template @ ${str} (string)`;
        throw err;
      }
    }
  }
  for (let exp of exps) {
    if (includes[exp] && includes[exp].tmpl) {
      try {
        rtn += (new Function(coded(`return \`${includes[exp].tmpl}\``, includes, varName, directives)))();
      } catch (err) {
        err.message += ` CAUSE: Unable to include template @ ${exp} (expression)`;
        throw err;
      }
    }
  }
  return rtn;
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