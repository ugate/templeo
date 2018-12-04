'use strict';

const EngineOpts = require('./engine-opts');
// TODO : ESM uncomment the following lines...
// import * as EngineOpts from './engine-opts.mjs';

//let engx = new WeakMap();

/**
 * Persistence for parsed templates
 * @private
 */
class Cachier {
// TODO : ESM use... export class Cachier {

  /**
   * Constructor
   * @param {EngineOpts} [opts] the {@link EngineOpts}
   * @param {Function} [formatFunc] The `function(string, formatOptions)` that will return a formatted string for reading/writting
   * data using the `formatOptions` from {@link EngineOpts} as the formatting options.
   * @param {Boolean} [isFormatOnRead=true] `true` will format on {@link Cachier.getCode}, `false` will format on {@link Cachier.generateCode}
   */
  constructor(opts, formatFunc, isFormatOnRead = true) {
    const ns = Cachier.internal(this);
    ns.at.options = opts instanceof EngineOpts ? opts : new EngineOpts(opts);
    ns.at.formatter = typeof formatFunc === 'function' ? formatFunc : null;
    ns.at.isFormatOnRead = !!isFormatOnRead;
    ns.at.names = { content: 'templateContent', code: 'templateCode' };
    ns.at.dbx = { [ns.at.names.content]: {}, [ns.at.names.code]: {} };
  }

  /**
   * Performs any setup required for initialization. __Typically, only called by internal implementations.__
   * @param {Function} [registerPartial] A `function(name, data)` that will register any partials found during the scan
   * @param {Function} [unregisterPartial] A `function(name, data)` that will unregister any partials found after the scan
   * when the partial is determined to no longer be valid (if possible)
   * @returns {Object|undefined} An object that contains the scan results (`undefined` when `registerPartial` is omitted):
   * 
   * The returned scan results object contains the following properties:
   * - `partials` The `partials` object that contains the template fragments that have been registered
   * - - `name` The template name
   * - - `id` The template identifier
   * - - `content` The template content
   */
  async scan(registerPartial, unregisterPartial) {
    const ns = Cachier.internal(this);
    if (registerPartial && Array.isArray(ns.at.options.partials) && ns.at.options.partials.length) {
      const ps = ns.at.options.partials, pln = ps.length, rtn = { partials: new Array(pln) };
      for (let i = 0; i < pln; i++) {
        if (!ps[i].name || !ps[i].content) {
          throw new Error(`Template partial at index ${i} must contain both "name" and "content" properties`);
        }
        registerPartial(ps[i].name, ps[i].content);
        rtn.partials[i] = { name: ps[i].name, id: ns.this.identity(ps[i].name, true), content: ps[i].content };
      }
      return rtn;
    } else if (ns.at.options.logger.debug) ns.at.options.logger.debug(`No options.partials to process`);
  }

  /**
   * Gets code for a specified template/partial ({@link Cachier.generateCode} when `read=true`)
   * @param {String} name The template name
   * @param {Boolean} [read=false] `true` to read the templatecode from internal cache, `false` to read from memory
   * @returns {Object} An object containing the following properties:
   * - `code` The formatted or unformatted code, dependng on the formatting options set on the constructor
   * - `coded` The modularized formatted or unformatted code, dependng on the formatting options set on the constructor
   * - `func` The template function generated from the code
   */
  async getCode(name, read = false) {
    const ns = Cachier.internal(this), id = ns.this.identity(name), mem = ns.at.dbx[ns.at.names.code][id];
    const chd = read ? await ns.this.read(name) : mem;
    if (read && chd && !chd.name) chd.name = name;
    return { code: chd && chd.code, coded: chd && chd.coded, func: chd && chd.func };
  }

  /**
   * Generates code for a specified template/partial and optionally writes it's content to internal cache
   * @param {String} name The template name
   * @param {String} code The template source code
   * @param {Boolean} [write=true] `true` to write the template code to internal cache
   * @param {Boolean} [store=true] `true` to store the template code in memory
   * @returns {Object} An object containing the following properties:
   * - `code` The formatted or unformatted code, dependng on the formatting options set on the constructor
   * - `coded` The modularized formatted or unformatted code, dependng on the formatting options set on the constructor
   * - `func` The template function generated from the code
   */
  async generateCode(name, code, write = true, store = true) {
    const ns = Cachier.internal(this), id = ns.this.identity(name), put = coder(ns, name, code, !ns.at.isFormatOnRead);
    const rtn = { code: put.code, coded: put.coded };
    put.name = name;
    put.id = id;
    rtn.func = new Function(ns.at.options.varname, put.code);
    if (name) Object.defineProperty(rtn.func, 'name', { value: name });
    if (write) await ns.this.write(name, put.coded);
    if (store) {
      put.func = rtn.func; // simple caching function
      ns.at.dbx[ns.at.names.code][put.id] = put; // store in memory
    }
    return rtn;
  }

  /**
   * Reads either template content or template code from internal cache
   * @param {String} name The template name
   * @param {Boolean} [forContent] `true` to read a template content, `false` to read the template source code
   * @returns {Object} An object read from cache that contains either the template content or module.
   * 
   * Returned template content properties:
   * - `name` The template name
   * - `id` The identifier
   * - `content` The template content
   * 
   * Returned module properties:
   * - `name` The template name
   * - `id` The identifier
   * - `func` The module function generated from the code
   */
  async read(name, forContent) {
    return ns.this.load(name, forContent);
  }

  /**
   * Writes either template content or template code from internal cache
   * @param {String} name The template name
   * @param {*} data The data to write
   * @param {Boolean} [forContent] `true` to read a template content, `false` to read the template source code
   */
  async write(name, data, forContent) {
    const ns = Cachier.internal(this);
    throw new Error(`Unsupported operation "write" for name=${name}, id=${ns.identity(name)}, forContent=${forContent} and data: ${data}`);
  }

  /**
   * Loads either the contents of a template or a template module 
   * @param {String} name The template name
   * @param {Boolean} [forContent] `true` to load a template content, `false` to load the template module
   * @param {(Boolean|String)} [refresh] Set to `true` to refresh/reload the template contents or module (if possible).
   * A value of {@link Cachier.LOAD_REFRESH_NEVER} will _load_ from internal memory __only__. Any other value will always
   * attempt to _load_ from memory if available or externally when not in memory.
   * @returns {*} The loaded template content `{ name: String, id: String, content: String }` or module
   * `{ name: String, id: String, func: Function }`
   */
  async load(name, forContent, refresh) {
    const ns = Cachier.internal(this), id = ns.this.identity(name), cacheName = forContent ? ns.at.names.content : ns.at.names.code;
    if ((!refresh && ns.at.dbx[cacheName][id]) || refresh === Cachier.LOAD_REFRESH_NEVER) return ns.at.dbx[cacheName][id];
    if (forContent) {
      const res = await fetch(new Request(id), {
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'text/html; charset=utf-8'
        }
      });
      if (!res.ok && ns.at.options.logger.error) {
        ns.at.options.logger.error(new Error(`${res.status}: ${res.statusText || ''} CAUSE: template content fetch failed for: ${id}"`));
      }
      ns.at.dbx[cacheName][id] = { name, id, content: res.ok ? res.text() : '' };
    } else {
      if (refresh) clearModule(ns, id);
      ns.at.dbx[cacheName][id] = { name, id, func: ns.at.options.useCommonJs ? require(id) : await import(id) };
    }
    return ns.at.dbx[cacheName][id];
  }

  /**
   * Creates an identity from a given template name
   * @param {String} name The name to generate an identity from
   * @param {Boolean} [forContent] `true` to load a template content, `false` to load the template module
   * @returns {String} The generated ID
   */
  identity(name, forContent) {
    const ns = Cachier.internal(this);
    var id = name;
    if (forContent && ns.at.options.defaultExtension) id += '.' + ns.at.options.defaultExtension;
    return id;
  }

  /**
   * @returns {Boolean} `true` when the {@link Cachier} is writable via {@link Cachier.write}
   */
  get isWritable() {
    return false;
  }

  /**
  * Generates formats a GUID
  * @param {String} [value] when present, will add any missing hyphens (if `hyphenate=true`) instead of generating a new value
  * @param {Boolean} [hyphenate=true] true to include hyphens in generated result
  * @returns {String} the generated GUID
  */
  static guid(value, hyphenate = true) {
    const hyp = hyphenate ? '-' : '';
    if (value) return hyphenate ? value.replace(/(.{8})-?(.{4})-?(.{4})-?(.{4})-?(.{12})/gi, `$1${hyp}$2${hyp}$3${hyp}$4${hyp}$5`) : value;
    return `xxxxxxxx${hyp}xxxx${hyp}4xxx${hyp}yxxx${hyp}xxxxxxxxxxxx`.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * @returns {String} A string that indicates that {@link Cachier.load} should __only__ _load_ from memory
   */
  static get LOAD_REFRESH_NEVER() {
    return 'NEVER';
  }

  /**
   * Internal memory-safe mapping of all available template engines
   * @ignore
   * @param {Object} obj the object to get/set
   * @returns {(Engine | undefined)} the mapped engine
   */
  static internal(obj) {
    if (!obj._data) {
      Object.defineProperty(obj, '_data', { value: {}, writable: false });
      Object.defineProperty(obj._data, 'at', { value: {}, writable: false });
      Object.defineProperty(obj._data, 'this', { value: obj, writable: false });
    }
    return obj._data;
    // WeakMap causes issues when garbage collected
    //if (!engx.has(obj)) engx.set(obj, {});
    //return engx.get(obj);
  }
}

// TODO : ESM remove the following lines...
module.exports = Cachier;

/**
 * Sanitizes `code` and wraps the code with a function (i.e `coded`) and optionally formats each of them
 * @private
 * @ignore
 * @param {Object} ns The {@link Cachier} namespace
 * @param {String} [name] The function name (generated when omitted)
 * @param {String} code The code
 * @param {Boolean} format `true` to format (if available)
 * @returns {Object} An `{ code: String, coded: String }`
 */
function coder(ns, name, code, format) {
  const coded = code ? `function ${name ? name.replace(/\\|\/|\./g, '_') : `template_${Cachier.guid(null, false)}`}(${ns.at.options.varname}){ ${code} };` : '';
  const codeContent = code && format && ns.at.formatter ? ns.at.formatter(code, ns.at.options.formatOptions) : code;
  const codedContent = coded && format && ns.at.formatter ? ns.at.formatter(coded, ns.at.options.formatOptions) : coded;
  return { code: codeContent, coded: codedContent };
}

/**
 * Clears a module from cache
 * @private
 * @ignore
 * @param {String} path The path to a module that will be removed
 */
function clearModule(ns, path) {
  if (ns.at.dbx[ns.at.names.code][path]) delete ns.at.dbx[ns.at.names.code][path];
  if (!ns.at.options.useCommonJs) return false;
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
  return true;
}