'use strict';

const TemplateDBOpts = require('./template-db-options');
const Cachier = require('./cachier');
const Sandbox = require('./sandbox');
// TODO : ESM uncomment the following lines...
// TODO : import * as TemplateDBOpts from './template-db-options.mjs';
// TODO : import * as Cachier from './cachier.mjs';
// TODO : import * as Sandbox from './sandbox.mjs';

/**
 * Persistence cache manager that uses an [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) or
 * [LevelDB](https://www.npmjs.com/package/level) store for partial content and compilation segments. 
 */
class CachierDB extends Cachier {
// TODO : ESM use... export class CachierDB extends Cachier {

  /**
   * Constructor
   * @param {TemplateDBOpts} [opts] The {@link TemplateDBOpts}
   * @param {(Object | String)} [indexedDB] Either an [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
   * implementation like [LevelDB](https://www.npmjs.com/package/level) that will be used for caching or a name of the `IndexedDB`
   * database to [open](https://developer.mozilla.org/en-US/docs/Web/API/IDBFactory/open) (default database name is `templeo`).
   * Defaults to a global reference to `indexedDB` that may hold the
   * [IDBFactory](https://developer.mozilla.org/en-US/docs/Web/API/IDBFactory).
   * @param {Function} [formatFunc] The `function(string, formatOptions)` that will return a formatted string for reading/writting
   * data using the `formatOptions` from {@link TemplateDBOpts} as the formatting options.
   * @param {Object} [logger] The logger for handling logging output
   * @param {Function} [logger.debug] A function that will accept __debug__ level logging messages (i.e. `debug('some message to log')`)
   * @param {Function} [logger.info] A function that will accept __info__ level logging messages (i.e. `info('some message to log')`)
   * @param {Function} [logger.warn] A function that will accept __warning__ level logging messages (i.e. `warn('some message to log')`)
   * @param {Function} [logger.error] A function that will accept __error__ level logging messages (i.e. `error('some message to log')`)
   */
  constructor(opts, indexedDB, formatFunc, logger) {
    super(opts, formatFunc, true);
    const ns = internal(this);
    ns.at.options = opts instanceof TemplateDBOpts ? opts : new TemplateDBOpts(opts);
    ns.at.logger = logger || {};
    ns.at.formatter = typeof formatFunc === 'function' ? formatFunc : null;
    const dbName = typeof indexedDB === 'string' ? indexedDB : null;
    ns.at.indexedDB = (!dbName && indexedDB) || Sandbox.global.indexedDB;
    const idbName = ns.at.indexedDB && ns.at.indexedDB.constructor && ns.at.indexedDB.constructor.name;
    if (idbName === 'IDBFactory') {
      ns.at.openIndexedDB = new Promise((resolve, reject) => {
        const req = ns.at.indexedDB.open(dbName || 'templeo');
        req.onerror = event => reject(event.error);
        req.onupgradeneeded = event => {
          event.target.createObjectStore(ns.at.options.partialStoreName, { autoIncrement: true });
          event.target.createObjectStore(ns.at.options.sourceStoreName, { autoIncrement: true });
        };
        req.onsuccess = event => resolve((ns.at.db = event.target.result) ? undefined : null);
      });
    } else if (idbName === 'LevelUP') ns.at.dbUP = ns.at.indexedDB;
    else if (ns.at.indexedDB) throw new Error(`Unsupported IndexedDB implementation specified for: ${idbName || ns.at.indexedDB}`);
  }

  /**
   * @override
   * @inheritdoc
   */
  async registerPartials(partials, read) {
    const ns = internal(this), pnm = ns.at.options.partialStoreName, snm = ns.at.options.sourceStoreName;
    if (ns.at.openIndexedDB) {
      await ns.at.openIndexedDB;
      ns.at.openIndexedDB = null;
    }
    const rtn = (partials && await super.registerPartials(partials, read)) || {};
    rtn[pnm] = rtn[pnm] || {};
    rtn[snm] = rtn[snm] || {};
    // read all keys in store and register any partials found
    //return execDB(null, ns.at.options, null, ns.at, false, ns.at.logger)
    if (ns.at.db) return promisedIndexedDB(ns, rtn);
    return promisedLevelDB(ns, rtn);
  }

  /**
   * @override
   * @inheritdoc
   */
  async read(name, forContent, extension) {
    const ns = internal(this), id = ns.this.readWriteName(name, ns.at.options, null, forContent, extension);
    const cacheName = forContent ? ns.at.options.partialStoreName : ns.at.options.sourceStoreName;
    if (ns.at.logger.info) {
      ns.at.logger.info(`Reading template ${forContent ? 'partial' : 'code'} for "${name}" (name)/"${id}" (ID)`
        + ` from ${ns.at.db ? 'Indexed' : 'Level'}DB`);
    }
    const rtn = { name, id };
    if (forContent) rtn.extension = extension;
    if (ns.at.db) {
      return new Promise((resolve, reject) => {
        const tx = ns.at.db.transaction([cacheName]), store = tx.objectStore(cacheName), req = store.get(id);
        req.onerror = event => reject(event.error);
        req.onsuccess = event => {
          if (req.result) {
            rtn = req.result; // result should already be in JSON format
            try {
              if (rtn.func) rtn.func = Sandbox.deserialzeFunction(rtn.func, name, true);
            } catch (err) {
              err.message += ` <- IndexedDB store = "${cacheName}" with ID = "${id}" failed on read deserialze of function: ${rtn.func}`;
              return reject(err);
            }
            if (forContent) ns.this.registerPartial(rtn.name, rtn.content, rtn.hasOwnProperty('extension') ? rtn.extension : extension);
          } //else return reject(event.error || new Error(`IndexedDB store = "${cacheName}" with ID = "${id}" not found`));
          resolve(rtn);
        };
      });
    }
    const raw = await ns.at.dbUP.get(id);
    if (raw) {
      rtn = JSON.parse(raw);
      if (rtn.func) {
        try {
          rtn.func = Sandbox.deserialzeFunction(rtn.func, name, true);
        } catch (err) {
          err.message += ` <- LevelDB store = "${cacheName}" with ID = "${id}" failed on read deserialze of function: ${rtn.func}`;
          throw err;
        }
        if (forContent) ns.this.registerPartial(rtn.name, rtn.content, rtn.hasOwnProperty('extension') ? rtn.extension : extension);
      }
    } //else throw new Error(`LevelDB store = "${cacheName}" with ID = "${id}" not found`);
    return rtn;
  }

  /**
   * @override
   * @inheritdoc
   */
  async write(name, data, forContent, extension) {
    if (!this.isWritable) return;
    const ns = internal(this), id = ns.this.readWriteName(name, ns.at.options, null, forContent, extension);
    const cacheName = forContent ? ns.at.options.partialStoreName : ns.at.options.sourceStoreName;
    if (ns.at.logger.debug) {
      ns.at.logger.debug(`Writting template ${forContent ? 'partial' : 'code'} for "${name}" (name)/"${id}" (ID)`
        + ` to ${ns.at.db ? 'Indexed' : 'Level'}DB`);
    }
    const dataType = typeof data, dataIsObj = dataType === 'object', put = dataIsObj ? { name: data.name, id } : { name, id };
    if (forContent) {
      put.content = dataIsObj ? data.content : data;
      put.extension = extension;
    } else if (dataIsObj) put.func = data.func;
    else put.func = data;
    if (!forContent) {
      if (typeof put.func === 'function') put.func = Sandbox.serialzeFunction(put.func);
      else if (typeof put.func === 'string') put.func = Sandbox.serialzeFunction(Sandbox.deserialzeFunction(put.func, name, true));
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
   * Clears the IndexedDB keys
   * @param {Boolean} [all=true] Ignored for IndexedDB cache since all keys are always removed
   */
  async clear(all = true) {
    const ns = internal(this), rtn = { [ns.at.options.partialStoreName]: {}, [ns.at.options.sourceStoreName]: {} };
    if (ns.at.db) await promisedIndexedDB(ns, rtn, true);
    await promisedLevelDB(ns, rtn, true);
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
 * @param {Object} storage The resolved return object. There should be at least two properties that match the properties
 * designated by either `options.partialStoreName` or `options.sourceStoreName`. One where the template partial content
 * will be stored by DB key as properties and another where the compiled template `sources` will be stored by DB key as
 * properties.
 * @param {(String | Boolean)} [valueOrRemove] `true` when removing keys, `false` when capturing keys
 * @returns {Object} The passed retrun object 
 */
function execDB(name, optional, params, storage, valueOrRemove, logger, forContent = true) {
  const isOptionFunc = typeof optional === 'function';
  const dbTypeName = isOptionFunc ? optional('dbTypeName') : optional.dbTypeName;
  const dbLocName = isOptionFunc ? optional('dbLocName') : optional.dbLocName;
  const dbPStore = isOptionFunc ? optional('partialStoreName') : optional.partialStoreName;
  const dbSStore = isOptionFunc ? optional('sourceStoreName') : optional.sourceStoreName;
  const cacheName = forContent ? dbPStore : dbSStore;
  return new Promise(async (resolve, reject) => {
    if (!storage.db) {
      storage.db = this[dbTypeName] || (typeof require !== 'undefined' ? require(dbTypeName) : /*await import(dbTypeName)*/null)(dbLocName);
    }
    const idbName = storage.db && storage.db.constructor && storage.db.constructor.name, isIndexedDB = idbName === 'IDBFactory';
    if (isIndexedDB) { // IndexedDB
      if (!storage.idb) {
        storage.idb = await new Promise((resolve, reject) => {
          const req = storage.db.open(dbName || 'templeo');
          req.onerror = event => reject(event.error);
          req.onupgradeneeded = event => {
            event.target.createObjectStore(dbPStore, { autoIncrement: true });
            event.target.createObjectStore(dbSStore, { autoIncrement: true });
          };
          req.onsuccess = event => resolve(event.target.result ? undefined : null);
        });
        const valType = typeof valueOrRemove, remove = valType === 'boolean' ? valueOrRemove : false;
        if (name) {
          const tx = storage.idb.transaction([cacheName], 'readwrite'), store = tx.objectStore(cacheName);
          const req = remove ? store.delete(name) : valType !== 'undefined' ? store.put(valueOrRemove, name) : store.get(name);
          req.onerror = event => reject(event.error);
          req.onsuccess = () => resolve(valType !== 'undefined' ? valueOrRemove : req.result);
          return; // single record processed
        }
        // multi-record processing
        const storeNames = [dbPStore, dbSStore];
        const errors = [], dels = remove ? [] : null;
        var cnt = 0, done;
        const errd = (err, cacheName, msg) => {
          err.message = `${err.message || ''} - ${remove ? 'Removal' : 'Capture'} of template ${cacheName} failed for IndexedDB ${msg || ''}`;
          err.cache = cacheName;
          errors.push(err);
          if (logger && logger.error) {
            logger.error(err);
          }
        };
        const promd = async () => {
          if (!done && ++cnt < storeNames.length) return;
          done = true;
          if (remove && dels) {
            for (let del of dels) {
              try {
                await del.promise;
                if (logger && logger.info) {
                  logger.info(`Removal of template ${del.cacheName} deleted for IndexedDB for ${del.key}`);
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
            error.reads = { [dbPStore]: storage[dbPStore], [dbSStore]: storage[dbSStore] };
            reject(error);
          } else resolve({ [dbPStore]: storage[dbPStore], [dbSStore]: storage[dbSStore] });
        };
        for (let storeName of storeNames) {
          const tx = storage.idb.transaction([storeName]), store = tx.objectStore(storeName), req = store.openCursor();
          tx.onerror = (cacheName => event => {
            errd(event.error, cacheName);
            promd();
          })(storeName);
          tx.oncomplete = () => promd();
          req.onerror = (cacheName => event => {
            errd(event.error, cacheName);
          })(storeName);
          req.onsuccess = (cacheName => event => {
            const cursor = event.target.result;
            if (!cursor) return errors.push(new Error(`${remove ? 'Removal' : 'Capture'} of template ${cacheName} failed for IndexedDB request`
              + 'due to missing cursor'));
            try {
              storage[cacheName][cursor.key] = cursor.value;
              if (cursor.value.content) storage[cacheName][cursor.key].content = cursor.value.content.toString();
              else storage[cacheName][cursor.key].func = Sandbox.deserialzeFunction(req.result.data, storage[cacheName][cursor.key].name, true);
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
          })(storeName);
        }
      }
    } else if (idbName === 'LevelUP') {
      const strm = storage.db.createReadStream(), errors = [];
      strm.on('data', async data => {
        try {
          const json = JSON.parse(data.value), hasContent = json.hasOwnProperty('content'), store = hasContent ? dbPStore : dbSStore;
          if (remove) {
            if (logger && logger.info) {
              logger.info(`Removing template ${store} for LevelDB key ${data.key}`);
            }
            await storage.db.del(data.key);
            delete storage[dbPStore][data.key];
            delete storage[dbSStore][data.key];
          } else {
            const store = hasContent ? dbPStore : dbSStore;
            if (storage[store][data.key] && logger && logger.warn) {
              logger.warn(`The template  ${store} for "${data.key}" is overridden by LevelDB registration`);
            }
            storage[store][data.key] = json;
          }
        } catch (err) {
          err.message = `${err.message || ''} <- ${remove ? 'Removal' : 'Capture'} of template partial or code failed for LevelDB key "${data.key}".`
            + ' The entry did not contain JSON or could not be set on return object';
          errors.push(err);
          if (logger && logger.error) {
            logger.error(err);
          }
        }
      });
      strm.on('error', err => {
        err.message = `${err.message || ''} <- ${remove ? 'Removal' : 'Capture'} of template partails and/or codes failed for when reading LevelDB keys`;
        errors.push(err);
        if (logger && logger.error) {
          logger.error(err);
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
          error.reads = { [dbPStore]: storage[dbPStore], [dbSStore]: storage[dbSStore] };
          return reject(error);
        }
        resolve({ [dbPStore]: storage[dbPStore], [dbSStore]: storage[dbSStore] });
      });
    } else if (storage.db) reject(new Error(`Unsupported IndexedDB implementation specified for: ${idbName || storage.db}`));
  });
}

/**
 * Either captures or removes every IndexedDB key that currently reside in the DB. When the key is for partial content
 * an attempt to `register` (for captures) or `unregister` (for removals) the partial will be made.
 * @private
 * @ignore
 * @param {Object} ns The {@link CachierDB} namespace
 * @param {Object} storage The resolved return object. There should be at least two properties that match the properties
 * designated by either `partials` or `sources`. One where the template partial content will be stored by DB key as properties
 * and another where the compiled template `sources` will be stored by DB key as properties.
 * @param {(String | Boolean)} [valueOrRemove] `true` when removing keys, `false` when capturing keys
 * @returns {Object} The passed retrun object 
 */
function promisedIndexedDB(ns, rtn, remove) {
  return new Promise((resolve, reject) => {
    const stores = ['partials', 'sources'];
    const errors = [], dels = remove ? [] : null;
    var cnt = 0, done;
    const errd = (err, cacheName, msg) => {
      err.message = `${err.message || ''} - ${remove ? 'Removal' : 'Capture'} of template ${cacheName} failed for IndexedDB ${msg || ''}`;
      err.cache = cacheName;
      errors.push(err);
      if (ns.at.logger.error) {
        ns.at.logger.error(err);
      }
    };
    const promd = async () => {
      if (!done && ++cnt < stores.length) return;
      done = true;
      if (remove && dels) {
        for (let del of dels) {
          try {
            await del.promise;
            if (ns.at.logger.info) {
              ns.at.logger.info(`Removal of template ${del.cacheName} deleted for IndexedDB for ${del.key}`);
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
          else rtn[cacheName][cursor.key].func = Sandbox.deserialzeFunction(req.result.data, rtn[cacheName][cursor.key].name, true);
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
 * designated by either `partials` or `sources`. One where the template partial content will be stored by DB key as properties
 * and another where the compiled template `sources` will be stored by DB key as properties.
 * @param {Boolean} [remove] `true` when removing keys, `false` when capturing keys
 * @returns {Object} The passed retrun object 
 */
function promisedLevelDB(ns, rtn, remove) {
  return new Promise((resolve, reject) => {
    const strm = ns.at.dbUP.createReadStream(), errors = [], pnm = ns.at.options.partialStoreName, snm = ns.at.options.sourceStoreName;
    strm.on('data', async data => {
      try {
        const json = JSON.parse(data.value);
        if (remove && ns.at.logger.info) {
          ns.at.logger.info(`Removing template ${json.content ? 'partial' : 'code'} for LevelDB key ${data.key}`);
        }
        if (remove) await ns.at.dbUP.del(data.key);
        if (json.content) {
          if (!remove && rtn[pnm][data.key] && ns.at.logger.warn) {
            ns.at.logger.warn(`The template partial for "${data.key}" is overridden by LevelDB registration`);
          }
          rtn[pnm][data.key] = json;
        } else {
          if (!remove && rtn[snm][data.key] && ns.at.logger.warn) {
            ns.at.logger.warn(`The template code for "${data.key}" is overridden by LevelDB registration`);
          }
          rtn[snm][data.key] = json;
        }
        if (!remove && json.content) {
          ns.this.registerPartial(json.name, json.content);
        } else if (remove && json.content) {
          ns.this.unregister(json.name);
        }
      } catch (err) {
        err.message = `${err.message || ''} - ${remove ? 'Removal' : 'Capture'} of template partial or code failed for LevelDB key "${data.key}".`
          + ' The entry did not contain JSON or could not be set on return object';
        errors.push(err);
        if (ns.at.logger.error) {
          ns.at.logger.error(err);
        }
      }
    });
    strm.on('error', err => {
      err.message = `${err.message || ''} - ${remove ? 'Removal' : 'Capture'} of template partails and/or codes failed for when reading LevelDB keys`;
      errors.push(err);
      if (ns.at.logger.error) {
        ns.at.logger.error(err);
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

// private mapping substitute until the following is adopted: https://github.com/tc39/proposal-class-fields#private-fields
let map = new WeakMap();
let internal = function(object) {
  if (!map.has(object)) map.set(object, {});
  return {
    at: map.get(object),
    this: object
  };
};