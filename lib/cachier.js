'use strict';

const TemplateOpts = require('./template-options');
const Sandbox = require('./sandbox');
// TODO : ESM uncomment the following lines...
// TODO : import * as TemplateOpts from './template-options.mjs';
// TODO : import * as Sandbox from './sandbox.mjs';

//let engx = new WeakMap();

/**
 * The default persistence cache that uses a simple object mapping for read/write operations. Partial reads/writes can be fetched/uploaded
 * depending on the flags set during instantiation. Generated template code reads are handled via dynamic `import`s or `require` (depending
 * on the CommonJS/ESM option).
 * @private
 */
class Cachier {
// TODO : ESM use... export class Cachier {

  /**
   * Constructor
   * @param {TemplateOpts} [opts] the {@link TemplateOpts}
   * @param {Function} [formatFunc] The `function(string, formatOptions)` that will return a formatted string for reading/writting
   * data using the `formatOptions` from {@link TemplateOpts} as the formatting options.
   * @param {Boolean} [isFormatOnRead=true] `true` will format when reading, `false` will format when writting
   * @param {Object} [servePartials] The options to detemine if partial content will be loaded/read or uploaded/write to an `HTTPS` server (omit
   * to serve template partials locally)
   * none) 
   * @param {Object} [servePartials.read] The configuration for reading/`GET` partial contents during reads. Uses `window.fetch` for browsers or
   * the `https` module when running on the server (omit to prevent retrieving template partial content)
   * @param {String} [servePartials.read.url] The __base__ URL used to `GET` template partials. The partial name will be appended to the URL (e.g.
   * `https://example.com/some/name.html` where `some/name.html` is the the partial name). When calling {@link registerPartial} the `name` should
   * _include_ the relative path on the server to the partial that will be captured.
   * @param {Object} [servePartials.write] The configuration for writting/`POST` partial contents during writes. Uses `window.fetch` to upload
   * content in browsers or the `https` module when running on the server
   * @param {Object} [postPartials.write.url] The __base__ URL used to `POST` template partials. The partial name will be appended to the URL (e.g.
   * `https://example.com/some/name.html` where `some/name.html` is the the partial name). When calling {@link registerPartial} the `name` should
   * _include_ the relative path on the server to the partial that will be uploaded.
   * @param {Boolean} [servePartials.rejectUnauthorized=true] A flag that indicates the client should reject unauthorized servers (__Node.js ONLY__)
   * @param {Object} [logger] The logger for handling logging output
   * @param {Function} [logger.debug] A function that will accept __debug__ level logging messages (i.e. `debug('some message to log')`)
   * @param {Function} [logger.info] A function that will accept __info__ level logging messages (i.e. `info('some message to log')`)
   * @param {Function} [logger.warn] A function that will accept __warning__ level logging messages (i.e. `warn('some message to log')`)
   * @param {Function} [logger.error] A function that will accept __error__ level logging messages (i.e. `error('some message to log')`)
   */
  constructor(opts, formatFunc, isFormatOnRead = true, servePartials = null, logger = {}) {
    if (!(opts instanceof TemplateOpts)) throw new Error(`Options must be of type ${TemplateOpts.constructor.name} not ${opts}`);
    const ns = internal(this);
    ns.at.options = opts;
    ns.at.logger = logger || {};
    ns.at.servePartials = servePartials || {};
    ns.at.formatter = typeof formatFunc === 'function' ? formatFunc : null;
    ns.at.isFormatOnRead = !!isFormatOnRead;
    ns.at.names = Object.freeze({ incls: 'partials', rndrs: 'renderers' });
    ns.at.dbx = { [ns.at.names.incls]: {}, [ns.at.names.rndrs]: {} };
  }

  /**
   * Unregisters a partial template from cache
   * @param {String} name The template name that uniquely identifies the template content
   */
  unregister(name) {
    const ns = internal(this), inm = ns.at.names.incls, rnm = ns.at.names.rndrs;
    if (ns.at.dbx[inm][name]) delete ns.at.dbx[inm][name];
    if (ns.at.dbx[rnm][name]) delete ns.at.dbx[rnm][name];
  }

  /**
   * Registers and caches a partial template
   * @param {String} name The template name that uniquely identifies the template content
   * @param {String} content The partial template content to register
   * @returns {String} The partial content
   */
  registerPartial(name, content) {
    const ns = internal(this), inm = ns.at.names.incls;
    ns.at.dbx[inm][name] = { name, content };
    ns.at.dbx[inm][name].ext = ns.at.options.defaultExtension || '';
    return ns.at.dbx[inm][name].content;
  }

  /**
   * Registers and caches one or more partial templates
   * @param {Object[]} partials The partials to register
   * @param {String} partials[].name The template name that uniquely identifies the template content
   * @param {String} partials[].content The partial template content to register
   * @param {Boolean} [read=true] When `true`, an attempt will be made to also _read_ any partials using option parameters
   * @returns {Object} An object that contains the registration results:
   * 
   * The returned registration results object that contains the following properties:
   * - `partials` The partials object that contains the template fragments that have been registered
   *   - `name` The template name that uniquely identifies the template content
   *   - `content` The template content
   *   - `read` A flag that indicates if the partial is from a read operation
   */
  async registerPartials(partials, read) {
    const ns = internal(this);
    const rtn = { partials: [] }; // partials should not be "new Array(partials.length)" since more may be added by extending classes
    for (let prtl of partials) {
      if (!prtl.hasOwnProperty('name')) {
        throw new Error(`Partial "name" missing at index ${rtn.partials.length} for ${JSON.stringify(prtl)}`);
      } else if (!prtl.hasOwnProperty('content')) {
        throw new Error(`Partial "content" missing at index ${rtn.partials.length} for ${JSON.stringify(prtl)}`);
      }
      ns.this.registerPartial(prtl.name, prtl.content);
      rtn.partials.push({ name: prtl.name, content: prtl.content });
    }
    return rtn;
  }

  /**
   * Compiles a locally sandboxed `async` template rendering function and when applicable, stores the function in cache
   * @param {String} name The template name that uniquely identifies the template content
   * @param {String} template The template to be compiled
   * @returns {Function} The return function from {@link Sandbox.compile}
   */
  async compile(name, template) {
    const ns = internal(this), inm = ns.at.names.incls, rnm = ns.at.names.rndrs;
    const hasTmpl = typeof template === 'string';
    var content = template, func;
    if (!hasTmpl) { // partial template includes
      var rd;
      if (!ns.at.options.isCached || !ns.at.dbx[inm][name] || !ns.at.dbx[inm][name].hasOwnProperty('content')) {
        rd = await ns.this.read(name, true);
        content = rd && rd.content;
        if (typeof content !== 'string') throw new Error(`Unable to find/read partial template @ ${name}`);
        ns.this.registerPartial(name, content);
      } else content = ns.at.dbx[inm][name].content;
      if (rd || !ns.at.options.isCached || !ns.at.dbx[rnm][name] || !ns.at.dbx[rnm][name].hasOwnProperty('func')) {
        const rd = await ns.this.read(name);
        func = rd && rd.func;
      } else func = ns.at.dbx[rnm][name].func;
    }
    if (!func) {
      func = Sandbox.compile(name, content, ns.at.dbx[inm], ns.at.dbx[rnm], ns.at.options, fetcher);
      if (ns.at.logger.debug) ns.at.logger.debug(`Created sandbox for: ${Sandbox.serialzeFunction(func)}`);
      if (func) {
        if (ns.at.logger.info) ns.at.logger.info(`Compiled ${func.name}`);
        if (ns.this.isWritable) await ns.this.write(name, func);
      }
    }
    return func;
  }

  /**
   * Reads either template content or template code from internal cache
   * @param {String} name The template name that uniquely identifies the template content
   * @param {Boolean} [forContent] `true` to read a template content, `false` to read the template source code
   * @returns {Object} An object read from cache that contains either the template content or module.
   * 
   * Returned template content properties:
   * - `name` The template name that uniquely identifies the template content
   * - `content` The template content
   * 
   * Returned module properties:
   * - `name` The template name that uniquely identifies the template content
   * - `func` The module function generated from the code
   */
  async read(name, forContent) {
    const ns = internal(this), cacheName = forContent ? ns.at.names.incls : ns.at.names.rndrs;
    const sopts = forContent && ns.at.servePartials.read;
    const url = sopts && sopts.url ? `${sopts.url}/${ns.this.fullName(name, forContent)}` : null;
    const rejUnauth = !ns.at.servePartials || ns.at.servePartials.rejectUnauthorized !== false;
    if (ns.at.logger.debug) {
      ns.at.logger.debug(`Loading template ${forContent ? 'partial' : 'code'} for "${name}" (name)`
        + ` from ${url ? `GET ${url}` :
        `${ns.at.options.useCommonJs ? 'CommonJS' : 'ECMAScript'} Module @ ${name}`}`);
    }
    ns.at.dbx[cacheName][name] = { name };
    if (forContent) ns.at.dbx[cacheName][name].content = url ? await fetcher(url, ns.at.options, null, null, rejUnauth) : data;
    else ns.at.dbx[cacheName][name].func = await ns.this.modularize(name, true);
    return ns.at.dbx[cacheName][name];
  }

  /**
   * Writes either template content or template code from internal cache
   * @param {String} name The template name that uniquely identifies the template content
   * @param {(String|Function)} data The data to write. For content, `data` should be a string. Otherwise `data` should be a function or
   * a function string.
   * @param {Boolean} [forContent] `true` to read a template content, `false` to read the template source code
   */
  async write(name, data, forContent) {
    if (!this.isWritable) return;
    data = data || '';
    const ns = internal(this), cacheName = forContent ? ns.at.names.incls : ns.at.names.rndrs;
    const sopts = forContent && ns.at.servePartials.write;
    const url = sopts && sopts.url ? `${sopts.url}/${ns.this.fullName(name, forContent)}` : null;
    const rejUnauth = !ns.at.servePartials || ns.at.servePartials.rejectUnauthorized !== false;

    const dataType = typeof data;
    var writable = dataType === 'function' && (url || forContent) ? Sandbox.serialzeFunction(data) : null;
    if (writable && !ns.at.isFormatOnRead && ns.at.formatter) {
      writable = ns.at.formatter(writable, ns.at.options.formatOptions);
    }

    if (ns.at.logger.debug) {
      ns.at.logger.debug(`Writting template ${forContent ? 'partial' : 'code'} for "${name}" (name)`
        + ` to ${url ? `POST ${url}` : 'memory'}`);
    }
    if (url) await fetcher(url, ns.at.options, null, writable, rejUnauth);
    ns.at.dbx[cacheName][name] = { name };
    if (forContent) ns.at.dbx[cacheName][name].content = writable;
    else ns.at.dbx[cacheName][name].func = dataType === 'function' ? data : Sandbox.deserialzeFunction(data);
  }

  /**
   * @returns {Boolean} `true` when the {@link Cachier} is writable via {@link Cachier.write}
   */
  get isWritable() {
    const ns = internal(this);
    return ns.at.options.isCached;
  }

  /**
   * @returns {Object} An __immutable__ object with each property name representing a cache namespace:
   * 
   * - `incls` - The name given for storing template partial content used in includes
   * - `rndrs` - The name given for storing compiled template rendering functions
   */
  get names() {
    const ns = internal(this);
    return ns.at.names;
  }

  /**
   * Clears the cache
   * @param {Boolean} [all=false] `true` to clear all unassociated cache instances when possible 
   */
  async clear(all = false) {
    const ns = internal(this);
    ns.at.dbx = { [ns.at.names.incls]: {}, [ns.at.names.rndrs]: {} };
  }

  /**
   * Generates the full name for a given template name
   * @param {String} name The template name that uniquely identifies the template content
   * @param {Boolean} [forContent] `true` to read a template content, `false` to read the template source code
   * @returns {String} The full template name
   */
  fullName(name, forContent) {
    const ns = internal(this);
    const ext = /\..*$/.test(name) ? '' : `.${forContent ? ns.at.options.defaultExtension : ns.at.options.useCommonJs ? 'js' : 'mjs'}`;
    return `${name}${ext}`;
  }

  /**
   * Dynamically loads/returns a module. How the module is loaded is dependent upon the {@link Cachier} options
   * @param {String} id The module ID to load (with or w/o the file extension)
   * @param {Boolean} [clear] `true` to clear the module from cache (when possible)
   */
  async modularize(id, clear) {
    const ns = internal(this);
    // not really much to do here since modules/functions are created/stored in memory
    return ns.at.dbx[ns.at.names.rndrs][id] && ns.at.dbx[ns.at.names.rndrs][id].func;
  }

  /**
   * @returns {Function} The
   * `async function(partialName:String, compileOptions:TemplateOpts, renderOptions:TemplateOpts, forContent:Boolean):String`
   * responsible for reading partial template content/modules/etc. when a template `include` cannot be found within the
   * compilation cache (_on-the-fly_ loading)
   */
  get reader() {
    return fetcher;
  }
}

// TODO : ESM remove the following lines...
module.exports = Cachier;

/**
 * GETs or POSTs data via `window.fetch` in the browser or using the `https` module on the server
 * @private
 * @ignore
 * @param {String} url The URL to `GET` or `POST`
 * @param {TemplateOpts} compileOptions The compile options to use
 * @param {TemplateOpts} [renderOptions] The rendering options to use
 * @param {String} [data] The data to `POST` or ommit to `GET`
 * @param {Boolean} [rejectUnauthorized=true] A flag that indicates the client should reject unauthorized servers (__Node.js ONLY__)
 * @returns {String} The result
 */
async function fetcher(url, compileOptions, renderOptions, data, rejectUnauthorized = true) {
  const hasData = typeof data === 'string', method = hasData ? 'POST' : 'GET';
  if (typeof fetch !== 'undefined') {
    const fetchOpts = {
      method: 'GET',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'text/html; charset=utf-8'
      }
    };
    if (hasData) {
      fetchOpts.method = method;
      fetchOpts.body = data;
    }
    const res = await fetch(new Request(url), fetchOpts);
    if (!res.ok) {
      throw new Error(`${res.status}: ${res.statusText || ''} CAUSE: template content ${fetchOpts.method} failed for: ${url}"`);
    }
    return res.text() || '';
  }
  return new Promise(async (resolve, reject) => {
    const https = compileOptions.useCommonJs ? require('https') : /* TODO : ESM use... await import('https')*/null;
    const req = https.request(url, { method, rejectUnauthorized }, res => {
      var data = '';
      res.on('data', chunk => {
        data += chunk;
      });
      res.on('end', () => {
        resolve(data);
      });
    });
    req.on('error', err => {
      reject(err);
    });
    req.end();
  });
}

// private mapping
let map = new WeakMap();
let internal = function(object) {
  if (!map.has(object)) map.set(object, {});
  return {
    at: map.get(object),
    this: object
  };
};

// NOTE : WeakMap may cause issues when garbage collected on old versions of Node
// static internal(obj) {
//   if (!obj._data) {
//     Object.defineProperty(obj, '_data', { value: {}, writable: false });
//     Object.defineProperty(obj._data, 'at', { value: {}, writable: false });
//     Object.defineProperty(obj._data, 'this', { value: obj, writable: false });
//   }
//   return obj._data;
// }