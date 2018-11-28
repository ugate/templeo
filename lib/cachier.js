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
   * @param {Function} [formatFunc] The `function(string, outputFormatting)` that will return a formatted string for reading/writting
   * data using the `outputFormatting` from {@link EngineOpts} as the formatting options.
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
   * @returns {Object|undefined} An object that contains: `{ partials: { name: String, content: String } }` where
   * `partials` are the fragments that have been registered (empty when `registerPartial` is omitted).
   */
  async scan(registerPartial) {
    const ns = Cachier.internal(this);
    if (registerPartial) {
      for (let chd in ns.at.dbx[ns.at.names.content]) {
        registerPartial(chd.name, )
      }
    }
  }

  /**
   * Gets code for a specified template/partial ({@link Cachier.generateCode} when `read=true`)
   * @param {String} name The template name
   * @param {String} path The template path/identifier
   * @param {Boolean} [read=false] `true` to read the templatecode from internal cache, `false` to read from memory
   * @returns {Object} An object containing the following properties:
   * - `code` The formatted or unformatted code, dependng on the formatting options set on the constructor
   * - `coded` The modularized formatted or unformatted code, dependng on the formatting options set on the constructor
   * - `func` The template function generated from the code
   */
  async getCode(name, path, read = false) {
    const ns = Cachier.internal(this), mem = ns.at.dbx[ns.at.names.code][path];
    const chd = read ? await ns.this.read(path) : mem;
    if (read && chd && !chd.name) chd.name = name;
    return { code: chd && chd.code, coded: chd && chd.coded, func: chd && chd.func };
  }

  /**
   * Generates code for a specified template/partial and optionally writes it's content to internal cache
   * @param {String} name The template name
   * @param {String} path The template path/identifier
   * @param {String} code The template source code
   * @param {Boolean} [write=true] `true` to write the template code to internal cache
   * @param {Boolean} [store=true] `true` to store the template code in memory
   * @returns {Object} An object containing the following properties:
   * - `code` The formatted or unformatted code, dependng on the formatting options set on the constructor
   * - `coded` The modularized formatted or unformatted code, dependng on the formatting options set on the constructor
   * - `func` The template function generated from the code
   */
  async generateCode(name, path, code, write = true, store = true) {
    const ns = Cachier.internal(this), put = coder(ns, name, code, !ns.at.isFormatOnRead);
    const rtn = { code: put.code, coded: put.coded };
    put.name = name;
    put.path = path;
    rtn.func = new Function(ns.at.options.varname, put.code);
    if (name) Object.defineProperty(rtn.func, 'name', { value: name });
    if (write) await ns.this.write(name, path, put.coded);
    if (store) {
      put.func = rtn.func; // simple caching function
      ns.at.dbx[ns.at.names.code][put.path] = put; // store in memory
    }
    return rtn;
  }

  /**
   * Reads either template content or template code from internal cache
   * @param {String} name The template name
   * @param {String} path The path to the cached partial content
   * @param {Boolean} [forContent] `true` to read a template content, `false` to read the template source code
   * @param {Boolean} [forContent] `true` to read a template content, `false` to read the template source code
   * @returns {Object} An object read from cache that contains either the template content or module.
   * 
   * Returned template content properties:
   * - `name` The template name
   * - `path` The path identifier
   * - `content` The template content
   * 
   * Returned module properties:
   * - `name` The template name
   * - `path` The path identifier
   * - `func` The module function generated from the code
   */
  async read(name, path, forContent) {
    return this.load(name, path, forContent);
  }

  /**
   * Writes either template content or template code from internal cache
   * @param {String} name The template name
   * @param {String} path The path where the data will be written to
   * @param {*} data The data to write
   * @param {Boolean} [forContent] `true` to read a template content, `false` to read the template source code
   */
  async write(name, path, data, forContent) {
    throw new Error(`Unsupported operation "write" for name=${name}, path=${path}, forContent=${forContent} and data: ${data}`);
  }

  /**
   * Joins one or more paths used as a cache entry identifier
   * @param  {...String} paths The paths to join
   * @returns {String} The joined paths
   */
  join(...paths) {
    return paths.join('/');
  }

  /**
   * Loads either the contents of a template or a template module 
   * @param {String} path The path to the module that will be loaded
   * @param {Boolean} [forContent] `true` to load a template content, `false` to load the template module
   * @param {(Boolean|String)} [refresh] Set to `true` to refresh/reload the template contents or module (if possible).
   * A value of {@link Cachier.LOAD_REFRESH_NEVER} will _load_ from internal memory __only__. Any other value will always
   * attempt to _load_ from memory if available or externally when not in memory.
   * @returns {*} The loaded template content `{ name: String, path: String, content: String }` or module
   * `{ name: String, path: String, func: Function }`
   */
  async load(name, path, forContent, refresh) {
    const ns = Cachier.internal(this), cacheName = forContent ? ns.at.names.content : ns.at.names.code;
    if ((!refresh && ns.at.dbx[cacheName][path]) || refresh === Cachier.LOAD_REFRESH_NEVER) return ns.at.dbx[cacheName][path];
    if (forContent) {
      const res = await fetch(new Request(path), {
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'text/html; charset=utf-8'
        }
      });
      if (!res.ok && ns.at.options.logger && ns.at.options.logger.error) {
        ns.at.options.logger.error(new Error(`${res.status}: ${res.statusText || ''} CAUSE: template content fetch failed for: ${path}"`));
      }
      ns.at.dbx[cacheName][path] = { name, path, content: res.ok ? res.text() : '' };
    } else {
      if (refresh) clearModule(ns, path);
      ns.at.dbx[cacheName][path] = { name, path, func: ns.at.options.useCommonJs ? require(path) : await import(path) };
    }
    return ns.at.dbx[cacheName][path];
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
  const codeContent = code && format && ns.at.formatter ? ns.at.formatter(code, ns.at.options.outputFormatting) : code;
  const codedContent = coded && format && ns.at.formatter ? ns.at.formatter(coded, ns.at.options.outputFormatting) : coded;
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