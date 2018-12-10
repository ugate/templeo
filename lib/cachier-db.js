'use strict';

const EngineOpts = require('./engine-opts');
const Cachier = require('./cachier');
// TODO : ESM uncomment the following lines...
// TODO : import * as EngineOpts from './engine-opts.mjs';
// TODO : import * as Cachier from './cachier.mjs';

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
    ns.at.options = opts;
    ns.at.formatter = typeof formatFunc === 'function' ? formatFunc : null;
    ns.at.indexedDB = indexedDB || (typeof window === 'object' && window.indexedDB);
    const idbName = ns.at.indexedDB && ns.at.indexedDB.constructor && ns.at.indexedDB.constructor.name;
    if (idbName === 'IDBFactory') {
      ns.at.openIndexedDB = new Promise((resolve, reject) => {
        const names = ns.this.names;
        const req = ns.at.indexedDB.open('templeo');
        req.onerror = event => reject(event.error);
        req.onupgradeneeded = event => {
          event.target.createObjectStore(names.partials, { autoIncrement: true });
          event.target.createObjectStore(names.code, { autoIncrement: true });
        };
        req.onsuccess = event => resolve((ns.at.db = event.target.result) ? undefined : null);
      });
    } else if (idbName === 'LevelUP') ns.at.dbUP = ns.at.indexedDB;
    else if (ns.at.indexedDB) throw new Error(`Unsupported IndexedDB implementation specified for: ${idbName || ns.at.indexedDB}`);
  }

  /**
   * Scans the IndexedDB for existing keys and registers found partials.
   * @override
   * @param {Function} [registerPartial] A `function(name, data)` that will register any partials found during the scan
   * @param {Function} [unregisterPartial] A `function(name)` that will unregister any partials that are removed after the scan
   * (ignored when `registerPartial` is missing)
   * @returns {Object|undefined} An object that contains the scan results (`undefined` when the `pathScanSrc` or `pathScanDest` and
   * options are omitted and `registerPartial` is omitted):
   * 
   * The returned scan results object contains the following properties:
   * - `partials` The partials object that contains the template fragments that have been registered
   * - - `name` The template name
   * - - `id` The template identifier
   * - - `content` The template content
   * - `code` The code object that contains the compiled template code
   * - - `name` The template name
   * - - `id` The template identifier
   * - - `func` The compiled template function
   * - `dirs` The directories/sub-directories that were created within the `pathScanDest` directory
   */
  async scan(registerPartial, unregisterPartial) {
    const ns = Cachier.internal(this);
    ns.at.impartial = { register: registerPartial, unregister: unregisterPartial };
    if (ns.at.openIndexedDB) {
      await ns.at.openIndexedDB;
      ns.at.openIndexedDB = null;
    }
    const rtn = (registerPartial && ns.at.options.partials && await super.scan(registerPartial, unregisterPartial)) || {};
    const names = this.names;
    rtn[names.partials] = rtn[names.partials] || {};
    rtn[names.code] = {};
    if (ns.at.db) return promisedIndexedDB(ns, rtn);
    return promisedLevelDB(ns, rtn);
  }

  /**
   * @override
   * @inheritdoc
   */
  async read(name, forContent) {
    const ns = Cachier.internal(this), id = ns.this.identity(name, forContent), cacheName = forContent ? ns.this.names.partials : ns.this.names.code;
    if (ns.at.options.logger.info) {
      ns.at.options.logger.info(`Reading template ${forContent ? 'partial' : 'code'} for "${name}" (name)/"${id}" (ID)`
        + ` from ${ns.at.db ? 'Indexed' : 'Level'}DB`);
    }
    const rtn = { name, id };
    if (ns.at.db) {
      return new Promise((resolve, reject) => {
        const tx = ns.at.db.transaction([cacheName]), store = tx.objectStore(cacheName), req = store.get(id);
        req.onerror = event => reject(event.error);
        req.onsuccess = event => {
          if (req.result) {
            if (forContent) rtn.content = req.result.data.toString();
            else rtn.func = Cachier.deserialzeFunction(req.result.data);
            resolve(rtn);
          } else reject(event.error || new Error(`IndexedDB store = "${cacheName}" with ID = "${id}" not found`));
        };
      });
    }
    const raw = await ns.at.dbUP.get(id);
    if (raw) {
      rtn = JSON.parse(raw);
      if (rtn.func) rtn.func = Cachier.deserialzeFunction(rtn.func);
    }
    return rtn;
  }

  /**
   * @override
   * @inheritdoc
   */
  async write(name, data, forContent) {
    if (!this.isWritable) return;
    const ns = Cachier.internal(this), id = ns.this.identity(name, forContent), cacheName = forContent ? ns.this.names.partials : ns.this.names.code;
    if (ns.at.options.logger.debug) {
      ns.at.options.logger.debug(`Writting template ${forContent ? 'partial' : 'code'} for "${name}" (name)/"${id}" (ID)`
        + ` to ${ns.at.db ? 'Indexed' : 'Level'}DB`);
    }
    const dataType = typeof data, dataIsObj = dataType === 'object', put = dataIsObj ? { name: data.name, id } : { name, id };
    if (forContent) put.content = dataIsObj ? data.content : data;
    else if (dataIsObj) put.func = data.func;
    else put.func = data;
    if (!forContent) {
      if (typeof put.func === 'function') put.func = Cachier.serialzeFunction(put.func);
      else if (typeof put.func === 'string') put.func = Cachier.serialzeFunction(Cachier.deserialzeFunction(put.func));
      else throw new Error(`Invalid template code function ("data.func") passed to IndexedDB write operation. It must contain`
        + ` a valid function or deserialized function string: ${put.func}`);
    }
    if (ns.at.db) {
      return new Promise((resolve, reject) => {
        const tx = ns.at.db.transaction([cacheName], 'readwrite'), store = tx.objectStore(cacheName), req = store.put(put, put.id);
        req.onerror = event => reject(event.error);
        req.onsuccess = () => resolve(put);
      });
    }
    return ns.at.dbUP.put(put.id, JSON.stringify(put));
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
    const ns = Cachier.internal(this), names = ns.this.names, rtn = { [names.partials]: {}, [names.code]: {} };
    if (ns.at.db) return promisedIndexedDB(ns, rtn, true);
    return promisedLevelDB(ns, rtn, true);
  }
}

// TODO : ESM remove the following lines...
module.exports = CachierDB;

/**
 * Either captures or removes every IndexedDB key that currently reside in the DB. When the key is for partial content
 * an attempt to `register` (for captures) or `unregister` (for removals) the partial will be made.
 * @private
 * @ignore
 * @param {Object} ns The {@link CachierDB} namespace
 * @param {Object} rtn The resolved return object. There should be at least two properties that match the properties
 * designated by {@link Cachier.names}. One where the template partial content will be stored by DB key as properties
 * and another where the compiled template `code` will be stored by DB key as properties.
 * @param {Boolean} [remove] `true` when removing keys, `false` when capturing keys
 * @returns {Object} The passed retrun object 
 */
function promisedIndexedDB(ns, rtn, remove) {
  return new Promise((resolve, reject) => {
    const names = ns.this.names;
    const stores = [names.partials, names.code];
    const errors = [], dels = remove ? [] : null;
    var cnt = 0, done;
    const errd = (err, cacheName, msg) => {
      err.message = `${err.message || ''} - ${remove ? 'Removal' : 'Capture'} of template ${cacheName} failed for IndexedDB ${msg || ''}`;
      err.cache = cacheName;
      errors.push(err);
      if (ns.at.options.logger.error) {
        ns.at.options.logger.error(err);
      }
    };
    const promd = async () => {
      if (!done && ++cnt < stores.length) return;
      done = true;
      if (remove && dels) {
        for (let del of dels) {
          try {
            await del.promise;
            if (ns.at.options.logger.info) {
              ns.at.options.logger.info(`Removal of template ${del.cacheName} deleted for IndexedDB for ${del.key}`);
            }
          } catch (err) {
            errd(err, del.cacheName, `DELETE operation failed for ${del.key}`);
          }
        }
      }
      var errCnt = errors.length;
      if (errCnt) {
        var error;
        if (errCnt === 1) error = errors[0];
        else {
          error = new Error(`${errCnt} errors occurred during IndexedDB ${remove ? 'removal' : 'capture'}`
            + '(see "error.errors" and "error.reads" for more details)');
          error.errors = errors;
        }
        error.reads = rtn;
        reject(error);
      } else resolve(rtn);
    };
    for (let snm of stores) {
      const tx = ns.at.db.transaction([snm]), store = tx.objectStore(snm), req = store.openCursor();
      tx.onerror = (cacheName => event => {
        errd(event.error, cacheName);
        promd();
      })(snm);
      tx.oncomplete = () => promd();
      req.onerror = (cacheName => event => {
        errd(event.error, cacheName);
      })(snm);
      req.onsuccess = (cacheName => event => {
        const cursor = event.target.result;
        if (!cursor) return errors.push(new Error(`${remove ? 'Removal' : 'Capture'} of template ${cacheName} failed for IndexedDB request`
          + 'due to missing cursor'));
        try {
          rtn[cacheName][cursor.key] = cursor.value;
          if (cursor.value.content) rtn[cacheName][cursor.key].content = cursor.value.content.toString();
          else rtn[cacheName][cursor.key].func = Cachier.deserialzeFunction(req.result.data);
          if (remove) {
            const reqDel = cursor.delete();
            dels.push({ cacheName, key: cursor.key, promise: new Promise((resolve, reject) => {
              reqDel.onerror = reject(event.error);
              reqDel.onsuccess = () => resolve();
            })});
          }
        } catch (err) {
          errd(err, cacheName);
        } finally {
          cursor.continue();
        }
      })(snm);
    }
  });
}

/**
 * Either captures or removes every LevelDB key that currently reside in the DB. When the key is for partial content
 * an attempt to `register` (for captures) or `unregister` (for removals) the partial will be made.
 * @private
 * @ignore
 * @param {Object} ns The {@link CachierDB} namespace
 * @param {Object} rtn The resolved return object. There should be at least two properties that match the properties
 * designated by {@link Cachier.names}. One where the template partial content will be stored by DB key as properties
 * and another where the compiled template `code` will be stored by DB key as properties.
 * @param {Boolean} [remove] `true` when removing keys, `false` when capturing keys
 * @returns {Object} The passed retrun object 
 */
function promisedLevelDB(ns, rtn, remove) {
  return new Promise((resolve, reject) => {
    const names = ns.this.names;
    const strm = ns.at.dbUP.createReadStream(), errors = [];
    strm.on('data', async data => {
      try {
        const json = JSON.parse(data.value);
        if (remove && ns.at.options.logger.info) {
          ns.at.options.logger.info(`Removing template ${json.content ? 'partial' : 'code'} for LevelDB key ${data.key}`);
        }
        if (remove) await ns.at.dbUP.del(data.key);
        if (json.content) {
          if (!remove && rtn[names.partials][data.key] && ns.at.options.logger.warn) {
            ns.at.options.logger.warn(`The template partial for "${data.key}" in "options.partials" is overridden by the LevelDB scan`);
          }
          rtn[names.partials][data.key] = json;
        } else {
          if (!remove && rtn[names.code][data.key] && ns.at.options.logger.warn) {
            ns.at.options.logger.warn(`The template code for "${data.key}" in "options.partials" is overridden by the LevelDB scan`);
          }
          rtn[names.code][data.key] = json;
        }
        if (!remove && json.content && ns.at.impartial && ns.at.impartial.register) {
          ns.at.impartial.register(json.name, json.content);
        } else if (remove && json.content && ns.at.impartial && ns.at.impartial.unregister) {
          ns.at.impartial.unregister(json.name);
        }
      } catch (err) {
        err.message = `${err.message || ''} - ${remove ? 'Removal' : 'Capture'} of template partial or code failed for LevelDB key "${data.key}".`
          + ' The entry did not contain JSON or could not be set on return object';
        errors.push(err);
        if (ns.at.options.logger.error) {
          ns.at.options.logger.error(err);
        }
      }
    });
    strm.on('error', err => {
      err.message = `${err.message || ''} - ${remove ? 'Removal' : 'Capture'} of template partails and/or codes failed for when reading LevelDB keys`;
      errors.push(err);
      if (ns.at.options.logger.error) {
        ns.at.options.logger.error(err);
      }
    });
    strm.on('end', () => {
      if (errors.legnth) {
        var error;
        if (errors.legnth === 1) error = errors[0];
        else {
          error = new Error(`${errors.legnth} errors occurred during LevelDB ${remove ? 'removal' : 'capture'}`
            + '(see "error.errors" and "error.reads" for more details)');
          error.errors = errors;
        }
        error.reads = rtn;
        return reject(error);
      }
      resolve(rtn);
    });
  });
}