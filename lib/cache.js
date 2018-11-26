'use strict';

const EngineOpts = require('./engine-opts');

//let engx = new WeakMap();

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
  constructor(opts, formatFunc, indexedDB, isFormatOnRead = true) {
    const ns = Cache.internal(this);
    ns.at.options = opts instanceof EngineOpts ? opts : new EngineOpts(opts);
    ns.at.formatter = typeof formatFunc === 'function' ? formatFunc : null;
    ns.at.isFormatOnRead = !!isFormatOnRead;
    ns.at.templatesName = 'templates';
    ns.at.partialsName = 'partials';
    ns.at.indexedDB = indexedDB || (typeof window === 'object' && window.indexedDB);
  }

  /**
   * Performs any setup required for initialization. __Typically, only called by internal implementations.__
   * @param {Function} [registerPartial] A `function(name, data)` that will register a partial function
   * @returns {Object|undefined} An object that contains: `{ partials: { name: String, content: String } }` where
   * `partials` are the fragments that have been registered (empty when `registerPartial` is omitted).
   */
  async setup(registerPartial) {
    const ns = Cache.internal(this);
    if (ns.at.indexedDB) {
      await new Promise((resolve, reject) => {
        const req = ns.at.indexedDB.open('templeo');
        req.onerror = event => reject(event.error);
        req.onupgradeneeded = event => event.target.createObjectStore(ns.at.partialsName, { autoIncrement: true });
        req.onsuccess = event => resolve((ns.at.db = event.target.result) ? undefined : null);
      });
    }
    // sources are always stored in memory since they contain functions
    ns.at.dbx = { [ns.at.templatesName]: {}, [ns.at.partialsName]: {} };
  }

  /**
   * Gets a template by path
   * @param {String} path The template path/identifier
   * @returns {Object} An object containing the following properties:
   * - `code` The formatted or unformatted code, dependng on the formatting options set on the constructor
   * - `func` The template function generated from the code
   */
  async getTemplate(path) {
    const ns = Cache.internal(this);
    const cached = ns.at.dbx[ns.at.templatesName][path];
    const code = ns.at.isFormatOnRead && ns.at.formatter && cached && cached.code ? ns.at.formatter(cached.code, ns.at.options.outputFormatting) : cached && cached.code;
    return { code, func: cached ? cached.func : null };
  }

  /**
   * Generates a template function and optionally writes it's content to internal cache
   * @param {String} name The template name
   * @param {String} path The template path/identifier
   * @param {String} code The template source code
   * @param {Boolean} [write=true] `true` to write the template to internal cache
   * @returns {Object} An object containing the following properties:
   * - `code` The formatted or unformatted code, dependng on the formatting options set on the constructor
   * - `func` The template function generated from the code
   */
  async generateTemplate(name, path, code, write = true) {
    const ns = Cache.internal(this);
    const coded = `function ${name.replace(/\\|\/|\./g, '_')}(${ns.at.options.varname}){ ${code} };`;
    const codeContent = !ns.at.isFormatOnRead && ns.at.formatter ? ns.at.formatter(code, ns.at.options.outputFormatting) : code;
    const codedContent = !ns.at.isFormatOnRead && ns.at.formatter ? ns.at.formatter(coded, ns.at.options.outputFormatting) : coded;
    const put = { name, path, code: codeContent, coded: codedContent };
    const rtn = { code: put.code, coded: codedContent };
    if (write) ns.at.dbx[ns.at.templatesName][put.path] = put;
    rtn.func = new Function(ns.at.options.varname, rtn.code);
    if (name) Object.defineProperty(rtn.func, 'name', { value: name });
    if (write) put.func = rtn.func; // simple caching function
    return rtn;
  }

  /**
   * Reads a template partial content from internal cache
   * @param {String} path The path to the cached partial content
   * @returns {String} The partial content
   */
  async readPartial(path) {
    const ns = Cache.internal(this);
    let data = '';
    if (ns.at.db) {
      return new Promise((resolve, reject) => {
        const tx = ns.at.db.transaction([ns.at.partialsName]), store = tx.objectStore(ns.at.partialsName), req = store.get(path);
        req.onerror = event => reject(event.error);
        req.onsuccess = event => {
          if (req.result) resolve(req.result.data);
          else reject(event.error || new Error(`IndexDB store = "${ns.at.partialsName}" with ID = "${path}" not found`));
        };
      });
    } else data = ns.at.dbx[ns.at.partialsName][path] && ns.at.dbx.partials[path].data;
    return data;
  }

  /**
   * Reads a template partial from internal cache
   * @param {String} path The path where the data will be written to
   * @param {String} code The code that will be written
   * @returns {Object} An object containing the following properties:
   * - `code` The formatted or unformatted code, dependng on the formatting options set on the constructor
   * - `func` The template function generated from the code
   */
  async writePartial(name, path, data) {
    const ns = Cache.internal(this);
    const put = { name, path, data };
    if (ns.at.db) {
      return new Promise((resolve, reject) => {
        const tx = ns.at.db.transaction([ns.at.partialsName]), store = tx.objectStore(ns.at.partialsName), req = store.put(put, put.path);
        req.onerror = event => reject(event.error);
        req.onsuccess = () => resolve(put.data);
      });
    } else ns.at.dbx[ns.at.partialsName][path] = put;
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
   * @returns {*} The module
   */
  static async loadModule(path, refresh) {
    if (refresh) await clearModule(path);
    // TODO : ESM use... 
    // return import(path);
    return require(path);
  }

  /**
   * Clears a module from cache
   * @param {String} path The path to a module that will be removed
   */
  static async clearModule(path) {
    // TODO : ESM use... refresh import somehow???
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