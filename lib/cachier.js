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
  constructor(opts, formatFunc, isFormatOnRead = true, servePartials = null, logger = {}) {
    if (!(opts instanceof TemplateOpts)) throw new Error(`Options must be of type ${TemplateOpts.constructor.name} not ${opts}`);
    const ns = internal(this);
    ns.at.options = opts;
    ns.at.logger = logger || {};
    ns.at.servePartials = servePartials || {};
    ns.at.formatter = typeof formatFunc === 'function' ? formatFunc : null;
    ns.at.isFormatOnRead = !!isFormatOnRead;
    ns.at.names = Object.freeze({ partials: 'partials', code: 'code' });
    ns.at.dbx = { [ns.at.names.partials]: {}, [ns.at.names.code]: {} };
  }

  /**
   * Scans `options.partials` and performs registration/writes on each partial
   * @param {Function} [registerPartial] A `function(name, data)` that will register any partials found during the scan
   * @param {Function} [unregisterPartial] A `function(name)` that will unregister any partials found after the scan when
   * the partial is determined to no longer be valid (if possible)
   * @returns {Object|undefined} An object that contains the scan results (`undefined` when `registerPartial` is omitted):
   * 
   * The returned scan results object contains the following properties:
   * - `partials` The partials object that contains the template fragments that have been registered
   * - - `name` The template name
   * - - `id` The template identifier
   * - - `content` The template content
   */
  async scan(registerPartial, unregisterPartial) {
    const ns = internal(this);
    if (registerPartial && Array.isArray(ns.at.options.partials) && ns.at.options.partials.length) {
      const ps = ns.at.options.partials, pln = ps.length, rtn = { partials: new Array(pln) }, rds = [];
      for (let i = 0; i < pln; i++) {
        if (!ps[i].name) throw new Error(`Template partial at index ${i} must contain a "name" property`);
        if (ns.at.servePartials.read && ns.at.servePartials.read.url) {
          rds.push({ index: i, name: ps[i].name, promise: ns.this.read(ps[i].name, true) });
          continue;
        }
        if (!ps[i].content) {
          throw new Error(`Template partial at index ${i} must contain a "content" property or provide a "servePartials.read"`);
        }
        registerPartial(ps[i].name, ps[i].content);
        rtn.partials[i] = { name: ps[i].name, id: ns.this.identity(ps[i].name, true), content: ps[i].content };
        ns.this.write(rtn.partials[i].name, rtn.partials[i], true);
      }
      for (let rd of rds) {
        rtn.partials[rd.index] = await rd.promise;
        registerPartial(rtn.partials[rd.index].name, rtn.partials[rd.index].content);
      }
      return rtn;
    } else if (ns.at.logger.info) ns.at.logger.info(`No options.partials to process`);
  }

  /**
   * Gets code for a specified template/partial
   * @param {String} name The template name
   * @param {Boolean} [read=false] `true` to read the templatecode from internal cache, `false` to read from memory
   * @returns {Object} An object containing the following properties:
   * - `name` The template name
   * - `id` The template identifier
   * - `content` The template content
   */
  async getPartial(name, read = false) {
    const ns = internal(this), id = ns.this.identity(name, true);
    if (read) ns.at.dbx[ns.at.names.partials][id] = await ns.this.read(name, true);
    return ns.at.dbx[ns.at.names.partials][id];
  }

  /**
   * Reads either template content or template code from internal cache
   * @param {String} name The template name
   * @param {Boolean} [forContent] `true` to read a template content, `false` to read the template source code
   * @returns {Object} An object read from cache that contains either the template content or module.
   * 
   * Returned template content properties:
   * - `name` The template name
   * - `id` The template identifier
   * - `content` The template content
   * 
   * Returned module properties:
   * - `name` The template name
   * - `id` The template identifier
   * - `func` The module function generated from the code
   */
  async read(name, forContent) {
    const ns = internal(this), id = ns.this.identity(name, forContent), cacheName = forContent ? ns.at.names.partials : ns.at.names.code;
    const sopts = forContent && ns.at.servePartials.read, url = sopts && sopts.url;
    const rejUnauth = !ns.at.servePartials || ns.at.servePartials.rejectUnauthorized !== false;
    if (ns.at.logger.debug) {
      ns.at.logger.debug(`Loading template ${forContent ? 'partial' : 'code'} for "${name}" (name)/"${id}" (ID)`
        + ` from ${url ? `GET ${url}/${id}` :
        `${ns.at.options.useCommonJs ? 'CommonJS' : 'ECMAScript'} Module @ ${id}`}`);
    }
    ns.at.dbx[cacheName][id] = { name, id };
    if (forContent) ns.at.dbx[cacheName][id].content = url ? await fetcher(ns, `${url}/${id}`, null, rejUnauth) : data;
    else {
      clearModule(ns, id);
      ns.at.dbx[cacheName][id].func = await ns.this.modularize(id);
    }
    return ns.at.dbx[cacheName][id];
  }

  /**
   * Writes either template content or template code from internal cache
   * @param {String} name The template name
   * @param {(String|Function)} data The data to write. For content, `data` should be a string. Otherwise `data` should be a function or
   * a function string.
   * @param {Boolean} [forContent] `true` to read a template content, `false` to read the template source code
   */
  async write(name, data, forContent) {
    if (!this.isWritable) return;
    data = data || '';
    const ns = internal(this), id = ns.this.identity(name, forContent), cacheName = forContent ? ns.at.names.partials : ns.at.names.code;
    const sopts = forContent && ns.at.servePartials.write, url = sopts && sopts.url;
    const rejUnauth = !ns.at.servePartials || ns.at.servePartials.rejectUnauthorized !== false;

    const dataType = typeof data;
    var writable = dataType === 'function' && (url || forContent) ? Sandbox.serialzeFunction(data) : null;
    if (writable && !ns.at.isFormatOnRead && ns.at.formatter) {
      writable = ns.at.formatter(writable, ns.at.options.formatOptions);
    }

    if (ns.at.logger.debug) {
      ns.at.logger.debug(`Writting template ${forContent ? 'partial' : 'code'} for "${name}" (name)/"${id}" (ID)`
        + ` to ${url ? `POST ${url}/${id}` : 'memory'}`);
    }
    if (url) await fetcher(ns, `${url}/${id}`, writable, rejUnauth);
    ns.at.dbx[cacheName][id] = { name, id };
    if (forContent) ns.at.dbx[cacheName][id].content = writable;
    else ns.at.dbx[cacheName][id].func = dataType === 'function' ? data : Sandbox.deserialzeFunction(data);
  }

  /**
   * Creates an identity from a given template name
   * @param {String} name The name to generate an identity from
   * @param {Boolean} [forContent] `true` to load a template content, `false` to load the template module
   * @returns {String} The generated ID
   */
  identity(name, forContent) {
    const ns = internal(this);
    var id = name;
    if (forContent && ns.at.options.defaultExtension && !/\..*$/.test(id)) id += '.' + ns.at.options.defaultExtension;
    return id;
  }

  /**
   * @returns {Boolean} `true` when the {@link Cachier} is writable via {@link Cachier.write}
   */
  get isWritable() {
    const ns = internal(this);
    return ns.at.options.isCached;
  }

  /**
   * @returns {Object} An object with each property name representing a cache namespace:
   * 
   * - `partials` - The name given for storing template partial content
   * - `code` - The name given for storing compiled template code 
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
    ns.at.dbx = { [ns.at.names.partials]: {}, [ns.at.names.code]: {} };
  }

  /**
   * Dynamically loads/returns a module. How the module is loaded is dependent upon the {@link Cachier} options
   * @param {String} path The module path to load
   */
  async modularize(path) {
    const ns = internal(this);
    return ns.at.options.useCommonJs ? require(path) : /* TODO : ESM use... await import(path)*/null;
  }
}

// TODO : ESM remove the following lines...
module.exports = Cachier;

/**
 * Clears a module from cache
 * @private
 * @ignore
 * @param {String} path The path to a module that will be removed
 */
function clearModule(ns, path) {
  if (ns.at.dbx[ns.at.names.code][path]) delete ns.at.dbx[ns.at.names.code][path];
  if (!ns.at.options.useCommonJs) return;
  const rpth = require.resolve(path);
  if (require.cache[rpth] && require.cache[rpth].parent) {
    let i = require.cache[rpth].parent.children.length;
    while (i--) {
      if (require.cache[rpth].parent.children[i].id === rpth) {
        require.cache[rpth].parent.children.splice(i, 1);
      }
    }
  }
  delete require.cache[rpth];
}

/**
 * GETs or POSTs data via `window.fetch` in the browser or using the `https` module on the server
 * @private
 * @ignore
 * @param {Object} ns The {@link Cachier} namespace 
 * @param {String} url The URL to `GET` or `POST`
 * @param {String} [data] The data to `POST` or ommit to `GET`
 * @param {Boolean} [rejectUnauthorized=true] A flag that indicates the client should reject unauthorized servers (__Node.js ONLY__)
 * @returns {String} The result
 */
async function fetcher(ns, url, data, rejectUnauthorized = true) {
  const hasData = typeof data === 'string', method = hasData ? 'POST' : 'GET';
  if (ns.at.logger.info) {
    ns.at.logger.info(`Template ${method} request: ${url}`);
  }
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
    const https = ns.at.options.useCommonJs ? require('https') : /* TODO : ESM use... await import('https')*/null;
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