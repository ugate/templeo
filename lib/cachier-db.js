'use strict';

const EngineOpts = require('./engine-opts');
const Cachier = require('./cachier');
// TODO : ESM uncomment the following lines...
// import * as EngineOpts from './engine-opts.mjs';
// import * as Cachier from './cachier.mjs';

/**
 * IndexedDB persistence for compiled templates
 * @private
 */
class CachierDB extends Cachier {
// TODO : ESM use... export class CachierDB extends Cachier {

  /**
   * Constructor
   * @param {EngineOpts} [opts] The {@link EngineOpts}
   * @param {Object} [indexedDB] The `IndexedDB` implementation that will be used for caching (defaults to `window.indexedDB`)
   * @param {Function} [formatFunc] The `function(string, outputFormatting)` that will return a formatted string for reading/writting
   * data using the `outputFormatting` from {@link EngineOpts} as the formatting options.
   */
  constructor(opts, indexedDB, formatFunc) {
    super(opts, formatFunc, true);
    const ns = Cachier.internal(this);
    ns.at.options = opts instanceof EngineOpts ? opts : new EngineOpts(opts);
    ns.at.formatter = typeof formatFunc === 'function' ? formatFunc : null;
    ns.at.names = { content: 'templateContent', code: 'templateCode' };
    ns.at.dbx = { [ns.at.names.content]: {}, [ns.at.names.code]: {} }; // sources are always stored in memory since they contain functions
    ns.at.indexedDB = indexedDB || (typeof window === 'object' && window.indexedDB);
    const idbName = ns.at.indexedDB && ns.at.indexedDB.constructor && ns.at.indexedDB.constructor.name;
    if (idbName === 'IDBFactory') {
      ns.at.openIndexedDB = new Promise((resolve, reject) => {
        const req = ns.at.indexedDB.open('templeo');
        req.onerror = event => reject(event.error);
        req.onupgradeneeded = event => {
          event.target.createObjectStore(ns.at.names.content, { autoIncrement: true });
          event.target.createObjectStore(ns.at.names.code, { autoIncrement: true });
        };
        req.onsuccess = event => resolve((ns.at.db = event.target.result) ? undefined : null);
      });
    } else if (idbName === 'LevelUP') ns.at.dbUP = ns.at.indexedDB;
    else if (ns.at.indexedDB) throw new Error(`Unsupported IndexedDB implementation specified for: ${idbName || ns.at.indexedDB}`)
  }

  /**
   * @override
   * @inheritdoc
   */
  async scan(registerPartial) {
    const ns = Cachier.internal(this);
    if (ns.at.openIndexedDB) await ns.at.openIndexedDB;
    // TODO : scan indexes and register partials
  }

  /**
   * @override
   * @inheritdoc
   */
  async read(name, path, forContent) {
    const ns = Cachier.internal(this), cacheName = forContent ? ns.at.names.content : ns.at.names.code;
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
    } else {
      ns.at.dbUP;
    }
    return data;
  }

  /**
   * @override
   * @inheritdoc
   */
  async write(name, path, data, forContent) {
    const ns = Cachier.internal(this), put = { name, path, data }, cacheName = forContent ? ns.at.names.content : ns.at.names.code;
    if (ns.at.db) {
      return new Promise((resolve, reject) => {
        const tx = ns.at.db.transaction([cacheName]), store = tx.objectStore(cacheName), req = store.put(put, put.path);
        req.onerror = event => reject(event.error);
        req.onsuccess = () => resolve(put.data);
      });
    } else {
      ns.at.dbUP;
    }
    return put.data;
  }
}

// TODO : ESM remove the following lines...
module.exports = CachierDB;