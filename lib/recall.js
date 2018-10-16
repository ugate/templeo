'use strict';

const EngineOpts = require('./engine-opts');

//let engx = new WeakMap();

/**
 * Persistence for parsed templates
 */
class Recall {
// TODO : ESM use... export class Recall {

  /**
   * Constructor
   * @param {EngineOpts} [opts] the {@link EngineOpts}
   * @param {Function} [formatFunc] The `function(string, outputFormatting)` that will return a formatted string for reading/writting
   * data using the `outputFormatting` from {@link EngineOpts} as the formatting options.
   * @param {Boolean} [isFormatOnRead=true] `true` will format on {@link Recall.read}, `false` will format on {@link Recall.write}
   */
  constructor(opts, formatFunc, isFormatOnRead = true) {
    const ns = Recall.internal(this);
    ns.options = opts instanceof EngineOpts ? opts : new EngineOpts(opts);
    ns.formatter = typeof formatFunc === 'function' ? formatFunc : null;
    ns.isFormatOnRead = !!isFormatOnRead;
    ns.templatesName = 'templates';
    ns.partialsName = 'partials';
  }

  /**
   * Performs any setup required for initialization
   * @returns {(String[]|undefined)} an array of all the _paths_ that are created within the {@link EngineOpts} `outputPath` (if required)
   */
  async setup() {
    const ns = Recall.internal(this);
    if (typeof window === 'object' && window.indexedDB) {
      await new Promise((resolve, reject) => {
        const req = indexedDB.open('templeo');
        req.onerror = event => reject(event.error);
        req.onupgradeneeded = event => event.target.createObjectStore(ns.partialsName, { autoIncrement: true });
        req.onsuccess = event => resolve((ns.db = event.target.result) ? undefined : null);
      });
    }
    // sources are always stored in memory since they contain functions
    ns.dbx = { [ns.templatesName]: {}, [ns.partialsName]: {} };
  }

  /**
   * Gets a template by path
   * @param {String} path The template path/identifier
   * @returns {Object} An object containing the following properties:
   * - `code` The formatted or unformatted code, dependng on the formatting options set on the constructor
   * - `func` The template function generated from the code
   */
  getTemplate(path) {
    const ns = Recall.internal(this);
    const cached = ns.dbx[ns.templatesName][path];
    if (cached) return { code: cached.code, func: cached.func };
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
  generateTemplate(name, path, code, write = true) {
    const ns = Recall.internal(this);
    code = `${ns.options.useCommonJs ? 'module.exports=' : 'export'} function ${name.replace(/\\|\/|\./g, '_')}(${ns.options.varname}){ ${code} };`;
    const put = { name, path, code: !ns.isFormatOnRead && ns.formatter ? ns.formatter(code, ns.options.outputFormatting) : code };
    const rtn = { code: put.code };
    if (write) ns.dbx[ns.templatesName][put.path] = put;
    rtn.func = new Function(ns.options.varname, rtn.code);
    if (name) Object.defineProperty(rtn.func, 'name', { value: name });
    if (write) put.func = rtn.func; // simple function cache for recall
    return rtn;
  }

  /**
   * Reads a template partial content from internal cache
   * @param {String} path The path to the cached partial content
   * @returns {String} The partial content
   */
  readPartial(path) {
    const ns = Recall.internal(this);
    let data = '';
    if (ns.db) {
      data = await new Promise((resolve, reject) => {
        const tx = ns.db.transaction([ns.partialsName]), store = tx.objectStore(ns.partialsName), req = store.get(path);
        req.onerror = event => reject(event.error);
        req.onsuccess = event => {
          if (req.result) resolve(req.result.data);
          else reject(event.error || new Error(`IndexDB store = "${ns.partialsName}" with ID = "${path}" not found`));
        };
      });
    } else data = ns.dbx[ns.partialsName][path] && ns.dbx.partials[path].data;
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
  writePartial(name, path, data) {
    const ns = Recall.internal(this);
    const put = { name, path, data };
    if (ns.db) {
      await new Promise((resolve, reject) => {
        const tx = ns.db.transaction([ns.partialsName]), store = tx.objectStore(ns.partialsName), req = store.put(put, put.path);
        req.onerror = event => reject(event.error);
        req.onsuccess = () => resolve(put.data);
      });
    } else ns.dbx[ns.partialsName][path] = put;
    return put.data;
  }

  /**
   * Gets a module from cache
   * @param {String} path The path that identifies the template to get a compiled/parsed module for
   * @returns {Object} A compiled/parsed template module
   */
  module(path) {
    // TODO : ESM use... 
    // const new Promise((res, rej) => {
    //  import(path).then(mdl => res(mdl)).catch(err => rej(err));
    // };
    delete require.cache[require.resolve(path)];
    return require(path);
  }

  /**
   * Joins one or more paths that should be used for {@link Recall.read} and {@link Recall.write}
   * @param  {...String} paths The paths to join
   * @returns {String} The joined paths
   */
  join(...paths) {
    return paths.join('/');
  }

  /**
  * Generates formats a GUID
  * @arg {String} [value] when present, will add any missing hyphens (if `hyphenate=true`) instead of generating a new value
  * @arg {Boolean} [hyphenate=true] true to include hyphens in generated result
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
   * Internal memory-safe mapping of all available template engines
   * @param {Object} obj the object to get/set
   * @returns {(Engine | undefined)} the mapped engine
   */
  static internal(obj) {
    return obj._data || (Object.defineProperty(obj, '_data', { value: {}, writable: false }) && obj._data);
    // WeakMap causes issues when garbage collected
    //if (!engx.has(obj)) engx.set(obj, {});
    //return engx.get(obj);
  }
}

// TODO : ESM remove the following lines...
exports.Recall = Recall;