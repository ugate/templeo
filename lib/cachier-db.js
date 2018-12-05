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
   * @param {Function} [formatFunc] The `function(string, formatOptions)` that will return a formatted string for reading/writting
   * data using the `formatOptions` from {@link EngineOpts} as the formatting options.
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
  async scan(registerPartial, unregisterPartial) {
    const ns = Cachier.internal(this);
    if (ns.at.openIndexedDB) await ns.at.openIndexedDB;
    const rtn = (await super.scan(registerPartial, unregisterPartial)) || { partials: {} };
    rtn.codes = {};
    if (ns.at.db) {

    }
    return new Promise((resolve, reject) => {
      const strm = ns.at.dbUP.createReadStream();
      strm.on('data', function (data) {
        console.log(`${data.key} =`);
        console.dir(data.value);
        if (data.value.content) {
          if (rtn.partials[data.key] && ns.at.options.logger.warn) {
            ns.at.options.logger.warn(`The template partial for "${data.key}" in "options.partials" is overridden by the IndexedDB scan`);
          }
          rtn.partials[data.key] = JSON.parse(data.value);
        } else {
          if (rtn.codes[data.key] && ns.at.options.logger.warn) {
            ns.at.options.logger.warn(`The template code for "${data.key}" in "options.partials" is overridden by the IndexedDB scan`);
          }
          rtn.codes[data.key] = JSON.parse(data.value);
        }
      });
      strm.on('error', function (err) {
        reject(err);
      });
      strm.on('end', function () {
        resolve(rtn);
      });
    });
  }

  /**
   * @override
   * @inheritdoc
   */
  async read(name, forContent) {
    const ns = Cachier.internal(this), id = ns.this.identity(name, forContent), cacheName = forContent ? ns.at.names.content : ns.at.names.code;
    const rslt = { name, id };
    if (ns.at.db) {
      return new Promise((resolve, reject) => {
        const tx = ns.at.db.transaction([cacheName]), store = tx.objectStore(cacheName), req = store.get(id);
        req.onerror = event => reject(event.error);
        req.onsuccess = event => {
          if (req.result) {
            if (forContent) rslt.content = req.result.data;
            else rslt.func = req.result.data;// TODO : translate function
            resolve(rslt);
          } else reject(event.error || new Error(`IndexedDB store = "${cacheName}" with ID = "${id}" not found`));
        };
      });
    }
    const raw = await ns.at.dbUP.get(id);
    if (raw) {
      rslt = JSON.parse(raw);
      if (rslt.func) rslt.func = rslt.func;// TODO : translate function
    }
    return rslt;
  }

  /**
   * @override
   * @inheritdoc
   */
  async write(name, data, forContent) {
    const ns = Cachier.internal(this), id = ns.this.identity(name, forContent), cacheName = forContent ? ns.at.names.content : ns.at.names.code;
    const put = { name, id };
    if (forContent) put.content = data;
    else put.func = data;// TODO : translate function
    if (ns.at.db) {
      return new Promise((resolve, reject) => {
        const tx = ns.at.db.transaction([cacheName]), store = tx.objectStore(cacheName), req = store.put(put, put.id);
        req.onerror = event => reject(event.error);
        req.onsuccess = () => resolve(put);
      });
    }
    await ns.at.dbUP.put(put.id, JSON.stringify(put));
    if (forContent) put.content = data;
    else put.func = data;// TODO : translate function
    return put;
  }

  /**
   * @override
   * @inheritdoc
   */
  get isWritable() {
    return true;
  }

  /**
   * Clears the IndexedDB keys
   * @param {Boolean} [all=true] Ignored for IndexedDB cache since all keys are always removed
   */
  async clear(all = true) {
    const ns = Cachier.internal(this);
    if (ns.at.db) {

    }
    return new Promise((resolve, reject) => {
      const strm = ns.at.dbUP.createReadStream(), rtn = { partials: {}, code: {} };
      var hasRes;
      strm.on('data', async data => {
        try {
          const json = JSON.parse(data.value);
          if (ns.at.options.logger.info) {
            ns.at.options.logger.info(`Removing template ${json.content ? 'partial' : 'code'} for IndexedDB key ${data.key}`);
          }
          await ns.at.dbUP.del(data.key);
        } catch (err) {
          if (!hasRes) {
            hasRes = true;
            reject(err);
          } else if (ns.at.options.logger.error) {
            ns.at.options.logger.error(err);
          }
        }
      });
      strm.on('error', err => {
        if (!hasRes) {
          hasRes = true;
          reject(err);
        } else if (ns.at.options.logger.error) {
          ns.at.options.logger.error(err);
        }
      });
      strm.on('end', () => {
        if (!hasRes) {
          hasRes = true;
          resolve(rtn);
        }
      });
    });
  }
}

// TODO : ESM remove the following lines...
module.exports = CachierDB;