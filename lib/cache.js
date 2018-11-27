'use strict';

const EngineOpts = require('./engine-opts');

//let engx = new WeakMap();

const MODULES = {};

/**
 * Persistence for parsed templates
 * @private
 */
class Cache {
// TODO : ESM use... export class Cache {

  /**
   * Constructor
   * @param {EngineOpts} [opts] the {@link EngineOpts}
   * @param {Function} [formatFunc] The `function(string, outputFormatting)` that will return a formatted string for reading/writting
   * data using the `outputFormatting` from {@link EngineOpts} as the formatting options.
   * @param {Object} [indexedDB] The `IndexedDB` implementation that will be used for caching (defaults to `window.indexedDB`)
   * @param {Boolean} [isFormatOnRead=true] `true` will format on {@link Cache.getTemplate}, `false` will format on {@link Cache.generateTemplate}
   */
  constructor(opts, formatFunc, indexedDB, isFormatOnRead = true, esm = true) {
    const ns = Cache.internal(this);
    ns.at.options = opts instanceof EngineOpts ? opts : new EngineOpts(opts);
    ns.at.formatter = typeof formatFunc === 'function' ? formatFunc : null;
    ns.at.isFormatOnRead = !!isFormatOnRead;
    ns.at.tmplContentName = 'templateContent';
    ns.at.tmplCodeName = 'templateCode';
    ns.at.dbx = { [ns.at.tmplContentName]: {}, [ns.at.tmplCodeName]: {} }; // sources are always stored in memory since they contain functions
    ns.at.indexedDB = indexedDB || (typeof window === 'object' && window.indexedDB);
    const idbName = ns.at.indexedDB && ns.at.indexedDB.constructor && ns.at.indexedDB.constructor.name;
    if (idbName === 'IDBFactory') {
      ns.at.openIndexedDB = new Promise((resolve, reject) => {
        const req = ns.at.indexedDB.open('templeo');
        req.onerror = event => reject(event.error);
        req.onupgradeneeded = event => {
          event.target.createObjectStore(ns.at.tmplContentName, { autoIncrement: true });
          event.target.createObjectStore(ns.at.tmplCodeName, { autoIncrement: true });
        };
        req.onsuccess = event => resolve((ns.at.db = event.target.result) ? undefined : null);
      });
    } else if (idbName === 'LevelUP') ns.at.dbUP = ns.at.indexedDB;
    else if (ns.at.indexedDB) throw new Error(`Unsupported IndexedDB implementation specified for: ${idbName || ns.at.indexedDB}`)
  }

  /**
   * Performs any setup required for initialization. __Typically, only called by internal implementations.__
   * @param {Function} [registerPartial] A `function(name, data)` that will register any partials found during the scan
   * @returns {Object|undefined} An object that contains: `{ partials: { name: String, content: String } }` where
   * `partials` are the fragments that have been registered (empty when `registerPartial` is omitted).
   */
  async scan(registerPartial) {
    const ns = Cache.internal(this);
    if (ns.at.openIndexedDB) await ns.at.openIndexedDB;
  }

  /**
   * Gets a template by path
   * @param {String} name The template name
   * @param {String} path The template path/identifier
   * @param {Boolean} [read=false] `true` to read the template from internal cache, `false` to read from memory
   * @returns {Object} An object containing the following properties:
   * - `code` The formatted or unformatted code, dependng on the formatting options set on the constructor
   * - `coded` The modularized formatted or unformatted code, dependng on the formatting options set on the constructor
   * - `func` The template function generated from the code
   */
  async getTemplate(name, path, read = false) {
    const ns = Cache.internal(this), mem = ns.at.dbx[ns.at.tmplContentName][path];
    var code = read ? await this.readTemplate(path) : mem ? mem.code : '';
    if (code && read) return this.generateTemplate(name, path, code, false, true); // never write during read
    const codes = coder(ns, name, code, ns.at.isFormatOnRead);
    return { code: codes.code, coded: codes.coded, func: mem ? mem.func : null };
  }

  /**
   * Generates a template function and optionally writes it's content to internal cache
   * @param {String} name The template name
   * @param {String} path The template path/identifier
   * @param {String} code The template source code
   * @param {Boolean} [write=true] `true` to write the template to internal cache
   * @param {Boolean} [store=true] `true` to store the template in memory
   * @returns {Object} An object containing the following properties:
   * - `code` The formatted or unformatted code, dependng on the formatting options set on the constructor
   * - `coded` The modularized formatted or unformatted code, dependng on the formatting options set on the constructor
   * - `func` The template function generated from the code
   */
  async generateTemplate(name, path, code, write = true, store = true) {
    const ns = Cache.internal(this), codes = coder(ns, name, code, !ns.at.isFormatOnRead);
    const put = { name, path, code: codes.code, coded: codes.coded };
    const rtn = { code: put.code, coded: codes.coded };
    rtn.func = new Function(ns.at.options.varname, rtn.code);
    if (name) Object.defineProperty(rtn.func, 'name', { value: name });
    if (write) await this.writeTemplate(name, path, codes.coded);
    if (store) {
      put.func = rtn.func; // simple caching function
      ns.at.dbx[ns.at.tmplContentName][put.path] = put; // store in memory
    }
    return rtn;
  }

  /**
   * Reads either template content or template source code from internal cache
   * @param {String} path The path to the cached partial content
   * @param {Boolean} forContent `true` to read a template content, `false` to read the template source code
   * @returns {String} The read result
   */
  async read(path, forContent) {
    const ns = Cache.internal(this), cacheName = forContent ? ns.at.tmplContentName : ns.at.tmplCodeName;
    let data = '';
    if (ns.at.db) {
      return new Promise((resolve, reject) => {
        const tx = ns.at.db.transaction([cacheName]), store = tx.objectStore(cacheName), req = store.get(path);
        req.onerror = event => reject(event.error);
        req.onsuccess = event => {
          if (req.result) resolve(req.result.data);
          else reject(event.error || new Error(`IndexedDB store = "${cacheName}" with ID = "${path}" not found`));
        };
      });
    }
    return data;
  }

  /**
   * Writes either template content or template source code from internal cache
   * @param {String} path The path where the data will be written to
   * @param {String} code The code that will be written
   * @param {*} data The data to write
   * @param {Boolean} forContent `true` to read a template content, `false` to read the template source code
   * @returns {Object} An object containing the following properties:
   * - `code` The formatted or unformatted code, dependng on the formatting options set on the constructor
   * - `func` The template function generated from the code
   */
  async write(name, path, data, forContent) {
    const ns = Cache.internal(this), put = { name, path, data }, cacheName = forContent ? ns.at.tmplContentName : ns.at.tmplCodeName;
    if (ns.at.db) {
      return new Promise((resolve, reject) => {
        const tx = ns.at.db.transaction([cacheName]), store = tx.objectStore(cacheName), req = store.put(put, put.path);
        req.onerror = event => reject(event.error);
        req.onsuccess = () => resolve(put.data);
      });
    }
    return put.data;
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
  * Generates formats a GUID
  * @param {String} [value] when present, will add any missing hyphens (if `hyphenate=true`) instead of generating a new value
  * @param {Boolean} [hyphenate=true] true to include hyphens in generated result
  * @returns {String} the generated GUID
  */
  guid(value, hyphenate = true) {
    const hyp = hyphenate ? '-' : '';
    if (value) return hyphenate ? value.replace(/(.{8})-?(.{4})-?(.{4})-?(.{4})-?(.{12})/gi, `$1${hyp}$2${hyp}$3${hyp}$4${hyp}$5`) : value;
    return `xxxxxxxx${hyp}xxxx${hyp}4xxx${hyp}yxxx${hyp}xxxxxxxxxxxx`.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Loads a module
   * @param {String} path The path to the module that will be loaded
   * @param {Boolean} refresh `true` to clear the module before loading (if possible)
   * @param {Boolean} [asm=true] `true` to read partial as an __ECMAScript Module__, `false` to read partial as an  __CommonJS Module__
   * @returns {*} The module
   */
  static async loadModule(path, refresh, asm = true) {
    if (!refresh && MODULES[path]) return MODULES[path];
    if (refresh) await clearModule(path);
    MODULES[path] = asm ? await import(path) : require(path);
    return MODULES[path];
  }

  /**
   * Clears a module from cache
   * @param {String} path The path to a module that will be removed
   */
  static async clearModule(path) {
    if (MODULES[path]) delete MODULES[path];
    if (typeof require === 'undefined') return false;
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
module.exports = Cache;

/**
 * Sanitizes `code` and wraps the code with a function (i.e `coded`) and optionally formats each of them
 * @private
 * @ignore
 * @param {Object} ns The {@link Cache} namespace
 * @param {String} [name] The function name (generated when omitted)
 * @param {String} code The code
 * @param {Boolean} format `true` to format (if available)
 * @returns {Object} An `{ code: String, coded: String }`
 */
function coder(ns, name, code, format) {
  const coded = code ? `function ${name ? name.replace(/\\|\/|\./g, '_') : `template_${ns.this.guid(null, false)}`}(${ns.at.options.varname}){ ${code} };` : '';
  const codeContent = code && format && ns.at.formatter ? ns.at.formatter(code, ns.at.options.outputFormatting) : code;
  const codedContent = coded && format && ns.at.formatter ? ns.at.formatter(coded, ns.at.options.outputFormatting) : coded;
  return { code: codeContent, coded: codedContent };
}