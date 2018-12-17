'use strict';

const EngineOpts = require('./lib/engine-opts');
const JsonEngine = require('./lib/json-engine');
const Cachier = require('./lib/cachier');
// TODO : ESM uncomment the following lines...
// TODO : import * as EngineOpts from './lib/engine-opts.mjs';
// TODO : import * as JsonEngine from './lib/json-engine.mjs';
// TODO : import * as Cachier from './lib/cachier.mjs';
// TODO : export * as EngineOpts from EngineOpts;
// TODO : export * as Cachier from Cachier;

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
class Engine {
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
        fn = await compile(ns, tmpl, opts);
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
    } else fn = compile(ns, tmpl, opts);
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
  if (ns.at.prts[name].tmpl) return ns.at.prts[name].fn = await templFuncPartial(ns, eng, ns.at.prts[name].tmpl, null, name);
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
async function templFuncPartial(ns, eng, content, context, name) { // generates a template function that accounts for nested partials
  const prtl = await rplPartial(ns, eng, content, context, name);
  return compileSegment(prtl, ns.at.options, context, name, ns.at.cache);
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

/**
 * Unescapes a code segment and tracks line/column numbers when enabled
 * @private
 * @param {String} code The code that will be escaped
 * @param {Object} [c] The template options
 * @param {String} [tmpl] The original/unaltered template source that will be used to determine the line number of
 * the code execution
 * @param {Object} [args] The arguments that are passed into the function from the originating String.replace call
 * @param {Boolean} [cond] When `true` the line number variable and unescaped code will be formatted as if it was
 * being used within a conditional statement
 * `(lnCol={ln:123,CAL_LINE_NUMBER:CALC_COLUMN_NUMBER} && (SOME_UNESCAPED_CODE_HERE))`
 * @returns {String} The unescaped value
 */
function coded(code, c, tmpl, args, cond) {
  var strt = '', end = code.replace(/\\('|\\)/g, '$1');//.replace(/[\r\t\n]/g, ' ');
  // NOTE : Removed erroLine option since accuracy is oftentimes skewed
  if (tmpl && c && c.errorLine) {
    var offset = args[args.length - 2]; // replace offset
    if (offset !== '' && !isNaN(offset) && (offset = parseInt(offset)) >= 0) {
      strt = tmpl.substring(0, offset).split(c.errorLine);
      strt = ((cond && '(') || '') + 'lnCol={ln:' + strt.length + ',col:' + (strt[strt.length - 1].length + 1) + '}' + ((cond && (end += ')') && ') && (') || ';');
    }
  }
  return strt + end;
}

/**
 * Compiles a template and returns a redering function
 * @private
 * @param {Object} ns The namespace of the template engine
 * @param {String} tmpl The raw template source
 * @param {Object} [opts] The options sent for compilation
 * @returns {function} The rendering `function(context)` that returns a template result string based upon the provided context
 */
async function compile(ns, tmpl, opts) {
  // when caching some of the partials may reference other partials that were loaded after the parent partial that uses it
  if (!ns.at.isInit && (ns.at.isInit = true)) {
    const promises = new Array(Object.keys(ns.at.prts).length);
    var idx = -1; // set functions in parallel
    for (let name in ns.at.prts) promises[idx++] = await setFn(ns, ns.this, name);
    for (let promise of promises) {
      await promise;
    }
  }
  const fn = await templFuncPartial(ns, ns.this, tmpl, opts);
  if (fn && ns.at.options.logger.debug) ns.at.options.logger.debug(`Compiled ${fn.name}`);
  return function processTemplate() {
    arguments[0] = arguments[0] || {}; // template context
    return fn.apply(this, arguments);
  };
}

/**
 * Compiles a templated segment and returns a redering function (__assumes partials are already transpiled- see {@link compile} for partial support__)
 * @private
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
async function compileSegment(tmpl, options, def, tname, cache) {
  const c = options instanceof EngineOpts ? options : new EngineOpts(options);
  cache = cache instanceof Cachier ? cache : new Cachier(c);
  const tnm = tname || (def && def.filename && def.filename.match && def.filename.match(c.filename)[2]) || ('template_' + Cachier.guid(null, false));
  const startend = {
    append: { start: "'+(", end: ")+'", startencode: "'+encodeHTML(" },
    split:  { start: "';out+=(", end: ");out+='", startencode: "';out+=encodeHTML(" }
  }, cse = c.append ? startend.append : startend.split, ostr = tmpl.replace(/'|\\/g, '\\$&');
  var needhtmlencode, sid = 0, indv, str = ostr;
  if (c.include) {
    str = str.replace(c.include, function rplInclude(match) {
      if (c.logger.warn) c.logger.warn(`No partial registered for include ${match} in: ${ostr}`);
      return '';
    });
  }
  if (c.comment) {
    str = str.replace(c.comment, function rplComment() {
      return '';
    });
  }
  if (c.encode) {
    str = str.replace(c.encode, function rplEncode(m, code) {
      needhtmlencode = true;
      return cse.startencode + coded(code, c, ostr, arguments, true) + cse.end;
    });
  }
  if (c.interpolate) {
    str = str.replace(c.interpolate, function rplInterpolate(m, code) {
      return cse.start + coded(code, c, ostr, arguments, true) + cse.end;
    });
  }
  if (c.conditional) {
    str = str.replace(c.conditional, function rplConditional(m, elsecase, code) {
      return elsecase ?
        (code ? `';}else if(${coded(code, c, ostr, arguments, true)}){out+='` : "';}else{out+='") :
        (code ? `';if(${coded(code, c, ostr, arguments, true)}){out+='` : "';}out+='");
    });
  }
  if (c.iterate) {
    str = str.replace(c.iterate, function rplIterate(m, iterate, vname, iname) {
      if (!iterate) return "';} } out+='";
      sid += 1;
      indv = iname || 'i' + sid; // w/o duplicate iterator validation there is a potential for endless loop conditions
      iterate = coded(`var arr${sid}=${iterate}`, c, ostr, arguments);
      return `';${iterate};if(arr${sid}){var ${vname},${indv}=-1,l${sid}=arr${sid}.length-1;while(${indv}<l${sid}){${vname}=arr${sid}[${indv}+=1];out+='`;
    });
  }
  if (c.iterateIn) {
    str = str.replace(c.iterateIn, function rplIterateIn(m, iterate, vname, iname) {
      if (!iterate) return "';} } out+='";
      sid += 1;
      indv = iname || 'i' + sid; // w/o duplicate iterator validation there is a potential for endless loop conditions
      iterate = coded(`var arr${sid}=${iterate}`, c, ostr, arguments);
      return `';${iterate};if(arr${sid}){var ${vname}=arr${sid};for(var ${indv} in ${vname}){out+='`;
    });
  }
  if (c.assign) {
    str = str.replace(c.assign, function rplAssign(m, name, oper, value) {
      if (!oper) return `${cse.start}_assigns['${coded(name, c, ostr, arguments, true)}']${cse.end}`;
      return `';_assigns['${coded(name, c, ostr, arguments, true)}']${oper ? `=${coded(value, c, ostr, arguments)}` : ''};out+='`;
    });
  }
  str = `const _assigns={};var out='${str}';return out;`;
  if (c.errorLine) {
    str = `var lnCol={};try{${str}}catch(e){e.message+=' at template ${((tnm && '"' + tnm + '" ') || '')}line '+lnCol.ln+' column '+lnCol.col;throw e;}`;
  }
  if (c.strip) str = str.replace(/(?:^|\r|\n)\t* +| +\t*(?:\r|\n|$)/g, ' ').replace(/\r|\n|\t|\/\*[\s\S]*?\*\//g, '');
  str = str.replace(/(\n|\t|\r)/g, '\\$1').replace(/(\s|;|\}|^|\{)out\+='';/g, '$1').replace(/\+''|(\s){2,}/g, '$1');
  if (needhtmlencode) {
    str = (function encodeHTML(code) {
      try {
        const encMap = { '&': '&#38;', '<': '&#60;', '>': '&#62;', '"': '&#34;', "'": '&#39;', '/': '&#47;' };
        return code ? code.toString().replace(((c.doNotSkipEncoded && /[&<>"'\/]/g) || /&(?!#?\w+;)|<|>|"|'|\//g), function(m) {return encMap[m] || m;}) : '';
      } catch (e) {
        e.message += ` While encoding HTML at: ${code}`;
        throw e;
      }
    }).toString().replace('c.doNotSkipEncoded', c.doNotSkipEncoded) + str;
  }
  try {
    const { func } = await cache.generateCode(tnm, str, cache.isWritable);
    return func;
  } catch (e) {
    if (c.logger.error) c.logger.error(`Could not create a template function (ERROR: ${e.message}): ${str}`);
    throw e;
  }
}

// TODO : ESM remove the following lines...
exports.Engine = Engine;
exports.EngineOpts = EngineOpts;
exports.Cachier = Cachier;
exports.JsonEngine = JsonEngine;

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