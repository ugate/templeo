'use strict';

const TemplateOpts = require('./template-options');
const Sandbox = require('./sandbox');
// TODO : ESM uncomment the following lines...
// TODO : import * as TemplateOpts from './template-options.mjs';
// TODO : import * as Sandbox from './sandbox.mjs';

//let engx = new WeakMap();

/**
 * The default persistence cache manager that uses a simple object mapping for {@link Cachier.read}/{@link Cachier.write}
 * operations. All caching is maintained in-memory. Partial {@link Cachier.read} operations use either `window.fetch`
 * (browsers) or the `https` module (Node.js) to capture partial template content. Compiled template {@link Cachier.read}
 * operations are handled via _dynamic_ `import`/`require`. {@link Cachier.write} operations are typically in-memory, but
 * can also be configured to `POST` partials over HTTP/S.
 */
class Cachier {
// TODO : ESM use... export class Cachier {

  /**
   * Constructor
   * @param {TemplateOpts} [opts] the {@link TemplateOpts}
   * @param {Function} [formatFunc] The `function(string, formatOptions)` that will return a formatted string for reading/writting
   * data using the `formatOptions` from {@link TemplateOpts} as the formatting options.
   * @param {Boolean} [isFormatOnRead=true] `true` will format when reading, `false` will format when writting
   * @param {Object} [logger] The logger for handling logging output
   * @param {Function} [logger.debug] A function that will accept __debug__ level logging messages (i.e. `debug('some message to log')`)
   * @param {Function} [logger.info] A function that will accept __info__ level logging messages (i.e. `info('some message to log')`)
   * @param {Function} [logger.warn] A function that will accept __warning__ level logging messages (i.e. `warn('some message to log')`)
   * @param {Function} [logger.error] A function that will accept __error__ level logging messages (i.e. `error('some message to log')`)
   */
  constructor(opts, formatFunc, isFormatOnRead = true, logger = {}) {
    const ns = internal(this);
    const options = opts instanceof TemplateOpts ? opts : new TemplateOpts(opts);
    ns.at.options = options;
    ns.at.logger = logger || {};
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
   * @param {String} [extension=options.defaultExtension] Optional override for a file extension designation for the partial
   * @returns {String} The partial content
   */
  registerPartial(name, content, extension) {
    const ns = internal(this), inm = ns.at.names.incls;
    ns.at.dbx[inm][name] = { name, content };
    ns.at.dbx[inm][name].extension = (extension && String(extension)) || ns.at.options.defaultExtension || '';
    return ns.at.dbx[inm][name].content;
  }

  /**
   * Registers and caches one or more partial templates
   * @param {Object[]} partials The partials to register
   * @param {String} partials[].name The template name that uniquely identifies the template content
   * @param {String} [partials[].content] The partial template content to register (omit when `read === true` to read content from cache)
   * @param {String} [partials[].extension] Optional override for a file extension designation for the partial
   * @param {Boolean} [read] When `true`, an attempt will be made to also _read_ any partials that do not have a `content` property
   * @returns {Object} An object that contains the registration results:
   * 
   * The returned registration results object that contains the following properties:
   * - `partials` The partials object that contains the template fragments that have been registered
   *   - `name` The template name that uniquely identifies the template content
   *   - `content` The template content
   *   - `extension` The template file extension designation
   *   - `read` A flag that indicates if the partial is from a read operation
   */
  async registerPartials(partials, read) {
    const ns = internal(this);
    const rtn = { partials: [] }; // partials should not be "new Array(partials.length)" since more may be added by extending classes
    if (!partials) return rtn;
    let content;
    for (let prtl of partials) {
      if (!prtl.hasOwnProperty('name')) {
        throw new Error(`Template partial "name" missing at index ${rtn.partials.length} for ${JSON.stringify(prtl)}`);
      } else if (!prtl.hasOwnProperty('content')) {
        if (read) {
          content = await ns.this.read(prtl.name, true, prtl.extension);
          if (content) content = content.content;
        } else content = null;
        if (!content) {
          const errMsg = `Template partial "content" missing at index ${rtn.partials.length} for ${JSON.stringify(prtl)}`
            + `${read && !ns.at.options.pathBase ? ' - "options.pathBase" should be set to a valid URL to fetch the content from' : ''}`;
          try {
            new URL(prtl.name, ns.at.options.pathBase || undefined); // validate the name/pathBase URL for consistency with render-time errors
          } catch (err) {
            err.message = `${err.message} <- ${errMsg}`;
            throw err;
          }
          throw new Error(errMsg);
        }
      } else content = prtl.content;
      ns.this.registerPartial(prtl.name, content, prtl.extension);
      rtn.partials.push({ name: prtl.name, content, extension: prtl.extension });
    }
    return rtn;
  }

  /**
   * Compiles a locally sandboxed `async` template rendering function and when applicable, stores the function in cache
   * @param {String} name The template name that uniquely identifies the template content
   * @param {String} template The template to be compiled
   * @param {String} [extension] The file extension designation for the template
   * @returns {Function} The return function from {@link Sandbox.compile}
   */
  async compile(name, template, extension) {
    const ns = internal(this), inm = ns.at.names.incls, rnm = ns.at.names.rndrs;
    const hasTmpl = typeof template === 'string';
    var content = template, func;
    if (!hasTmpl) { // partial template includes
      var rd;
      if (!ns.at.options.isCached || !ns.at.dbx[inm][name] || !ns.at.dbx[inm][name].hasOwnProperty('content')) {
        rd = await ns.this.read(name, true, extension);
        content = rd && rd.content;
        if (typeof content !== 'string') throw new Error(`Unable to find/read partial template @ ${name}`);
        ns.this.registerPartial(name, content);
      } else content = ns.at.dbx[inm][name].content;
      if (rd || !ns.at.options.isCached || !ns.at.dbx[rnm][name] || !ns.at.dbx[rnm][name].hasOwnProperty('func')) {
        const rd = await ns.this.read(name, false, extension);
        func = rd && rd.func;
      } else func = ns.at.dbx[rnm][name].func;
    }
    if (!func) {
      func = Sandbox.compile(name, content, ns.at.dbx[inm], ns.at.dbx[rnm], ns.at.options, ns.this.readWriteName, fetcher);
      if (ns.at.logger.debug) ns.at.logger.debug(`Created sandbox for: ${Sandbox.serialzeFunction(func)}`);
      if (func) {
        if (ns.at.logger.info) ns.at.logger.info(`Compiled ${func.name}`);
        if (ns.this.isWritable) await ns.this.write(name, func);
      }
    }
    return func;
  }

  /**
   * Reads either template content or template code from internal cache.
   * When `options.pathBase` is set to an HTTPS URL and the read is for partial content, A `GET` call to `window.fetch` is made when running
   * within browsers or to the `https` module when running on the server. The partial `name` will be appended to `options.pathBase` (e.g.
   * `https://example.com/some/id.html` where `some/id.html` is the the partial's {@link Cachier.readWriteName} and `options.pathBase` is set
   * to `https://example.com`). When `options.pathBase` is omitted _reading_ of template partial content will be limited to _reading_ from
   * memory. Compiled template source code is _always_ _read_ from memory __only__.
   * @param {String} name The template name that uniquely identifies the template content
   * @param {Boolean} [forContent] `true` to read a template content, `false` to read the template source code
   * @param {String} [extension] The file extension designation (only used when `forContent` is truthy)
   * @returns {Object} An object read from cache that contains either the template content or module.
   * 
   * Returned template content properties:
   * - `name` The template name that uniquely identifies the template content
   * - `content` The template content
   * - `extension` The template file extension designation
   * 
   * Returned module properties:
   * - `name` The template name that uniquely identifies the template content
   * - `func` The module function generated from the code
   */
  async read(name, forContent, extension) {
    const ns = internal(this), cacheName = forContent ? ns.at.names.incls : ns.at.names.rndrs;
    const url = forContent && isAbsName(name, ns.at.options) ? ns.this.readWriteName(name, ns.at.options, forContent, extension) : null;
    if (ns.at.logger.debug) {
      ns.at.logger.debug(`Loading template ${forContent ? 'partial' : 'code'} for "${name}" (name)`
        + ` from ${url ? `GET ${url}` :
        `${ns.at.options.useCommonJs ? 'CommonJS' : 'ECMAScript'} Module @ ${name}`}`);
    }
    if (forContent) {
      const content = url ? await fetcher(url, ns.at.options) : ns.at.dbx[cacheName][name] && ns.at.dbx[cacheName][name].content;
      ns.this.registerPartial(name, content, extension);
    } else {
      ns.at.dbx[cacheName][name] = { name, func: await ns.this.modularize(name, true) };
    }
    return ns.at.dbx[cacheName][name];
  }

  /**
   * Writes either template content or template code from internal cache.
   * When `options.pathBase` is set to an HTTPS URL and the read is for partial content, A `POST` call to `window.fetch` is made when running
   * within browsers or to the `https` module when running on the server. The partial `name` will be appended to `options.pathBase` (e.g.
   * `https://example.com/some/id.html` where `some/id.html` is the the partial's {@link Cachier.readWriteName} and `options.pathBase` is set
   * to `https://example.com`). When `options.pathBase` is omitted _writting_ of template partial content will be limited to _writes_ to
   * memory. Compiled template source code is _always_ _written_ to memory __only__.
   * @param {String} name The template name that uniquely identifies the template content
   * @param {(String|Function)} data The data to write. For content, `data` should be a string. Otherwise `data` should be a function or
   * a function string.
   * @param {Boolean} [forContent] `true` to read a template content, `false` to read the template source code
   * @param {String} [extension] The file extension designation (only used when `forContent` is truthy)
   */
  async write(name, data, forContent, extension) {
    if (!this.isWritable) return;
    data = data || '';
    const ns = internal(this), cacheName = forContent ? ns.at.names.incls : ns.at.names.rndrs;
    const url = forContent && isAbsName(name, ns.at.options) ? ns.this.readWriteName(name, ns.at.options, forContent, extension) : null;

    const dataType = typeof data;
    var writable = dataType === 'function' && (url || forContent) ? Sandbox.serialzeFunction(data) : null;
    if (writable && !ns.at.isFormatOnRead && ns.at.formatter) {
      writable = ns.at.formatter(writable, ns.at.options.formatOptions);
    }

    if (ns.at.logger.debug) {
      ns.at.logger.debug(`Writting template ${forContent ? 'partial' : 'code'} for "${name}" (name)`
        + ` to ${url ? `POST ${url}` : 'memory'}`);
    }
    if (url) await fetcher(url, ns.at.options, writable);
    if (forContent) {
      ns.this.registerPartial(name, writable, extension);
    } else {
      ns.at.dbx[cacheName][name] = {
        name,
        func: dataType === 'function' ? data : Sandbox.deserialzeFunction(data)
      };
    }
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
   * @returns {TemplateOpts} The template compile options
   */
  get options() {
    const ns = internal(this);
    return ns.at.options;
  }

  /**
   * @returns {Object} The optional logger used by the {@link Cachier}
   */
  get logger() {
    const ns = internal(this);
    return ns.at.logger;
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
   * `async function(partialName:String, optional:(TemplateOpts | Function(name:String):*), forContent:Boolean):String`
   * responsible for reading partial template content/modules/etc. when a template `include` cannot be found within the
   * compilation cache (_on-the-fly_ loading)
   */
  get reader() {
    return fetcher;
  }

  /**
   * @returns {Function} The 
   * `function(partialName:String, optional:(TemplateOpts | Function(name:String):*), forContent:Boolean, extension:String):String`
   * responsible for formatting template names into a full path name consumable by `read`/`write` operations
   */
  get readWriteName() {
    return readWriteName;
  }
}

// TODO : ESM remove the following lines...
module.exports = Cachier;

/**
 * Determines if a template name has an absolute path in it's name or can be converted to one
 * @private
 * @ignore
 * @param {String} name The template name that uniquely identifies the template content
 * @param {TemplateOpts} opts The options to use
 * @returns {Boolean} `true` when the template name has an absolute path in it's name or can be converted to one
 */
function isAbsName(name, opts) {
  const hasBase = opts.pathBaseBypass && name.match(opts.pathBaseBypass);
  return !!(hasBase || opts.pathBase);
}

/**
 * GETs or POSTs data via `window.fetch` in the browser or using the `https` module on the server
 * @private
 * @ignore
 * @param {String} url The URL to `GET` or `POST`
 * @param {(TemplateOpts | Function)} optional Either the options or a `function(name:String):*` that returns an option value by name
 * @param {String} [data] The data to `POST` or ommit to `GET`
 * @returns {String} The result
 */
async function fetcher(url, optional, data) {
  const isOptionFunc = typeof optional === 'function';
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
      throw new Error(`${res.status}: ${res.statusText || ''} <- template content ${fetchOpts.method} failed for: ${url}"`);
    }
    return res.text() || '';
  }
  return new Promise(function httpsFetcher(resolve, reject) {
    const useCommonJs = isOptionFunc ? optional('useCommonJs') : optional.useCommonJs;
    const rejectUnauthorized = (isOptionFunc ? optional('rejectUnauthorized') : optional.rejectUnauthorized) !== false;
    const https = useCommonJs ? require('https') : /* TODO : ESM use... await import('https')*/null;
    const req = https.request(url, { method, rejectUnauthorized }, res => {
      var data = '';
      if (res.statusCode < 200 || res.statusCode > 299) {
        return reject(new Error(`${res.statusCode}: ${res.statusMessage || ''} <- template content ${method} failed for: ${url}"`));
      }
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

/**
 * Generates the full name path for a given template name.
 * @private
 * @ignore
 * @param {String} name The template name that uniquely identifies the template content
 * @param {(TemplateOpts | Function)} optional Either the options or a `function(name:String):*` that returns an option value by name
 * @param {Boolean} [forContent] `true` to read a template content, `false` to read the template source code
 * @param {String} [extension] The file extension designation (only used when `forContent` is truthy)
 * @returns {String} The full template path
 */
function readWriteName(name, optional, forContent, extension) {
  const isOptionFunc = typeof optional === 'function';
  const pathBypass = isOptionFunc ? optional('pathBaseBypass') : optional.pathBaseBypass;
  const isBypass = pathBypass && name.match(pathBypass);
  var pathBase = (!isBypass && (isOptionFunc ? optional('pathBase') : optional.pathBase)) || '';
  pathBase = pathBase ? `${pathBase}${pathBase.endsWith('/') ? '' : '/'}` : '';
  var ext;
  if (/\..*$/.test(name)) {
    ext = ''; // already has extension
  } else if (forContent) {
    ext = typeof extension === 'string' ? extension : (isOptionFunc ? optional('defaultExtension') : optional.defaultExtension) || '';
  } else {
    ext = isOptionFunc ? optional('useCommonJs') : optional.useCommonJs ? 'js' : 'mjs';
  }
  if (ext) ext = `${/\..*$/.test(ext) ? '' : '.'}${ext}`;
  return `${pathBase}${name}${ext}`;
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