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
 * [LevelDB](https://www.npmjs.com/package/level) store for partial content and compilation segments. The type of DB used
 * is first determined by the presence of an `indexedDB` on the _global/window_ reference that contains either an
 * [IDBFactory](https://developer.mozilla.org/en-US/docs/Web/API/IDBFactory) or other supported IndexedDB-like interface
 * (e.g. `LevelUP`). When an `indexedDB` reference is not present, an atempt to load a __module__ using the
 * `options.dbTypeName` as the module name/path that resolves into a function that takes a location path from
 * `options.dbLocName` as it's first argument.
 */
class CachierDB extends Cachier {
// TODO : ESM use... export class CachierDB extends Cachier {

  /**
   * Constructor
   * @param {TemplateDBOpts} [opts] The {@link TemplateDBOpts}
   * @param {Function} [formatFunc] The `function(string, formatOptions)` that will return a formatted string for reading/writting
   * data using the `formatOptions` from {@link TemplateDBOpts} as the formatting options.
   * @param {Object} [logger] The logger for handling logging output
   * @param {Function} [logger.debug] A function that will accept __debug__ level logging messages (i.e. `debug('some message to log')`)
   * @param {Function} [logger.info] A function that will accept __info__ level logging messages (i.e. `info('some message to log')`)
   * @param {Function} [logger.warn] A function that will accept __warning__ level logging messages (i.e. `warn('some message to log')`)
   * @param {Function} [logger.error] A function that will accept __error__ level logging messages (i.e. `error('some message to log')`)
   */
  constructor(opts, formatFunc, logger) {
    super(opts, formatFunc, true, logger);
    const ns = internal(this);
    ns.at.options = opts instanceof TemplateDBOpts ? opts : new TemplateDBOpts(opts);
    ns.at.logger = logger || {};
    ns.at.formatter = typeof formatFunc === 'function' ? formatFunc : null;
  }

  /**
   * @override
   * @inheritdoc
   */
  async registerPartials(partials, read, write) {
    const ns = internal(this);
    if (read) {
      const storage = { db: ns.at.db, idb: ns.at.idb };
      // read all keys in store and register any partials found
      await execDB(null, ns.at.options, null, storage, false, ns.at.logger, function recordDB(storeName, key, params, json) {
        if (!json && typeof json === 'undefined') {
          ns.this.unregister(key);
        } else if (storeName === 'partials')  {
          ns.this.registerPartial(key, json && typeof json.content === 'string' ? json.content : params, json.extension);
          if (json && partials && !partials.hasOwnProperty(key)) partials[key] = JSON.parse(JSON.stringify(json));
        }
      }, function openDB(storage) {
        ns.at.db = storage.db;
        ns.at.idb = storage.idb;
      });
    }
    await closeDB(ns.at, ns.at.logger);
    return super.registerPartials(partials, read, write);
  }

  /**
   * @override
   * @inheritdoc
   */
  async compile(name, template, extension) {
    const ns = internal(this);
    const fn = await super.compile(name, template, extension);
    await closeDB(ns.at, ns.at.logger);
    return fn;
  }

  /**
   * @override
   * @inheritdoc
   */
  async read(name, forContent, extension, params) {
    if (!name) throw new Error(`Missing "name" for value "${name}" on read from DB`);
    const ns = internal(this), rwname = ns.this.readWriteName(name, ns.at.options, params, forContent, extension);
    const cacheName = forContent ? 'partials' : 'sources';
    if (ns.at.logger.info) {
      ns.at.logger.info(`Reading template "${forContent ? 'partials' : 'sources'}" for "${name}" (full name: "${rwname}") from DB`);
    }
    const storage = { db: ns.at.db, idb: ns.at.idb }, rtn = { name: rwname, shortName: name };
    if (forContent) rtn.extension = extension;

    await execDB(rwname, ns.at.options, null, storage, false, ns.at.logger, null, function openDB(storage) {
      ns.at.db = storage.db;
      ns.at.idb = storage.idb;
    });
    if (storage[cacheName] && storage[cacheName][rwname]) {
      if (forContent) {
        rtn.content = storage[cacheName][rwname].content;
        rtn.extension = storage[cacheName][rwname].extension || rtn.extension;
        ns.this.registerPartial(rtn.name, rtn.content, rtn.extension);
      } else {
        try {
          if (storage[cacheName][rwname].func) rtn.func = Sandbox.deserialzeFunction(storage[cacheName][rwname].func, name, true);
        } catch (err) {
          err.message += ` <- ${storage.idb ? 'IndexedDB' : 'LevelDB'} store = "${cacheName}" with "${name}" (full name: "${rwname}") failed on read`
            + `deserialze of function: ${storage[cacheName][rwname].func}`;
          throw err;
        }
      }
    } else if (ns.at.logger.debug) {
      ns.at.logger.debug(`${storage.idb ? 'IndexedDB' : 'LevelDB'} store = "${cacheName}" with "${name}" (full name: "${rwname}") NOT FOUND`);
    }
    return rtn;
  }

  /**
   * @override
   * @inheritdoc
   */
  async write(name, data, forContent, extension, params) {
    if (!this.isWritable) return;
    if (!name) throw new Error(`Missing "name" for value "${name}" on write to DB`);
    const ns = internal(this), rwname = ns.this.readWriteName(name, ns.at.options, params, forContent, extension);
    if (ns.at.logger.info) {
      ns.at.logger.info(`Writting template "${forContent ? 'partials' : 'sources'}" for "${name}" (full name: "${rwname}") to DB`);
    }
    const dataType = typeof data, dataIsObj = dataType === 'object', put = { name: rwname, shortName: dataIsObj ? data.name : name };
    if (forContent) {
      put.content = dataIsObj ? data.content : data;
      put.extension = extension;
    } else if (dataIsObj) put.func = data.func;
    else put.func = data;
    if (!forContent) {
      if (typeof put.func === 'function') put.func = Sandbox.serialzeFunction(put.func);
      else if (typeof put.func === 'string') put.func = Sandbox.serialzeFunction(Sandbox.deserialzeFunction(put.func, name, true));
      else throw new Error(`Invalid template source function ("data.func") passed to IndexedDB write operation. It must contain`
        + ` a valid function or deserialized function string: ${put.func}`);
    }

    const storage = { db: ns.at.db, idb: ns.at.idb };
    await execDB(rwname, ns.at.options, null, storage, put, ns.at.logger, null, function openDB(storage) {
      ns.at.db = storage.db;
      ns.at.idb = storage.idb;
    });
  }

  /**
   * Clears templates that may reside in-memory, __optionally__ clears the IndexedDB keys in the cache store(s) and
   * __closes__ any lingering DB connections.
   * @param {Boolean} [all=true] When `true` all of the keys in the IndexedDB cache store(s) will be __removed__
   */
  async clear(all = true) {
    await super.clear(all);
    const ns = internal(this), storage = { db: ns.at.db, idb: ns.at.idb };
    // remove all keys from the DB
    if (all && ns.at.logger.info) ns.at.logger.info(`Clearing all DB keys...`);
    await execDB(null, ns.at.options, null, storage, true, ns.at.logger, function recordDB(storeName, key, params, json) {
      ns.this.unregister(key);
    }, function openDB(storage) {
      ns.at.db = storage.db;
      ns.at.idb = storage.idb;
    }, !all);
    await closeDB(storage, ns.at.logger);
    if (all) {
      delete ns.at.db;
      delete ns.at.idb;
    }
  }

  /**
   * @override
   * @inheritdoc
   */
  get readers() {
    const rdrs = super.readers, rdr = { read: execDB, finish: closeDB, readAllOnInitWhenEmpty: true };
    if (Array.isArray(rdrs)) rdrs.splice(0, 0, rdr);
    else return [rdr, rdrs];
    return rdrs;
  }
}

// TODO : ESM remove the following lines...
module.exports = CachierDB;

/**
 * When `name` is present, a single record that will be captured or deleted. Otherwise, captures or removes every DB key that
 * currently resides in the DB. Each key found will be set as `storage.partials[key]` or `storage.sources[key]`. When keys are
 * being removed, they are also removed from the provided `storage`. The type of DB used is first determined by the presence of
 * an `indexedDB` on the _global/window_ reference that contains either an
 * [IDBFactory](https://developer.mozilla.org/en-US/docs/Web/API/IDBFactory) or other supported IndexedDB-like interface (e.g.
 * `LevelUP`). When an `indexedDB` reference is not present, an atempt to load a __module__ using the `options.dbTypeName` as
 * the module name/path that resolves into a function that takes a location path from `options.dbLocName` as it's first
 * argument. At that point the underlying
 * [IndexedDB is opened](https://developer.mozilla.org/en-US/docs/Web/API/IDBFactory/open) (or
 * [LevelDB is opened](https://github.com/Level/level#dbopencallback)). However, it's important to note that __the DB is never__
 * __closed and should be handled accordingly__.
 * @private
 * @ignore
 * @param {String} [name] The name of the single record that will be captured or deleted. Omit to capture or remove all
 * keys in the DB store.
 * @param {(TemplateDBOpts | Function)} optional Either the options or a `function(name:String):*` that returns an
 * option value by name.
 * @param {(URLSearchParams | String)} [params] The URL parameters to use (JSON or URL encoded).
 * @param {Object} storage The object where the `db` (and `idb` for IndexedDB), `partials` and `sources` are stored.
 * @param {(String | Boolean)} [valueOrRemove] `true` when removing keys, `false` when capturing keys or a `string` when setting a key (using `name`)
 * @param {Object} [logger] The logger that can contain functions for each of the following: `error`/`warn`/`info`/`debug`.
 * @param {Function} [recordfunc] A `function(storeName:String, key:String[, params:(URLSearchParams | Object), json:Object])`
 * that will be called for each action taken on a record
 * @param {Function} [openFunc] A `function(storage:Object)` that will be called when the DB is opened
 * @param {Boolean} [openOnly] A flag that indicates that the DB will be opened, but will not process any data
 * @returns {Object} The passed `storage` object 
 */
async function execDB(name, optional, params, storage, valueOrRemove, logger, recordfunc, openFunc, openOnly) {
  const isOptionFunc = typeof optional === 'function';
  const dbTypeName = isOptionFunc ? optional('dbTypeName') : optional.dbTypeName;
  const dbLocName = isOptionFunc ? optional('dbLocName') : optional.dbLocName;
  const dbPStore = 'partials';
  const dbSStore = 'sources';
  const storeNames = [dbPStore, dbSStore];
  storage[dbPStore] = storage[dbPStore] || {};
  storage[dbSStore] = storage[dbSStore] || {};
  return new Promise(async (resolve, reject) => {
    if (!storage.db) {
      storage.db = dbTypeName === 'indexedDB' ? this && this[dbTypeName] :
        new Promise(async (resolveModule, rejectModule) => {
          if (logger && logger.info) logger.info(`Loading module "${dbTypeName}" passing location "${dbLocName}"${name ? ` (processing "${name}")` : ''}`);
          var rslt = (typeof require !== 'undefined' ? require(dbTypeName) : /*await import(dbTypeName)*/null);
          rslt = rslt(dbLocName, (err, db) => err ? (err.message += ` from ${name}`) && rejectModule(err) : resolveModule(db));
          if (rslt instanceof Promise) resolveModule(await rslt);
        });
      if (!storage.db) {
        return reject(new Error(`Unable to load "${dbTypeName}" ${dbTypeName === 'indexedDB' ? 'from global/window scope' :
          ` module "${dbTypeName}" passing location "${dbLocName}"`}`));
      }
      if (storage.db instanceof Promise) {
        storage.db = await storage.db;
        if (typeof openFunc === 'function') openFunc(storage);
      }
    }
    const idbName = storage.db && storage.db.constructor && storage.db.constructor.name, isIndexedDB = idbName === 'IDBFactory';
    const valType = typeof valueOrRemove, remove = valType === 'boolean' ? valueOrRemove : false, hasRecordfunc = typeof recordfunc === 'function';
    if (logger && logger.debug) logger.debug(`Using "${idbName}" from "${dbTypeName}"`);
    if (isIndexedDB) { // IndexedDB
      if (!storage.idb) {
        storage.idb = await new Promise((resolve, reject) => {
          const req = storage.db.open(dbLocName);
          req.onerror = event => reject(event.error);
          req.onupgradeneeded = event => {
            event.target.createObjectStore(dbPStore, { autoIncrement: true });
            event.target.createObjectStore(dbSStore, { autoIncrement: true });
          };
          req.onsuccess = event => resolve(event.target.result ? undefined : null);
        });
        if (logger && logger.info) logger.info(`Using "${idbName}" from "${dbTypeName}"`);
        if (typeof openFunc === 'function') openFunc(storage);
        if (openOnly) return resolve(storage);
      }
      if (name) { // single record processing
        let tx, store, req, reqCnt = 0, error, storeCount = storeNames.length;
        for (let storeName of storeNames) {
          if (valType !== 'undefined') { // put
            let hasContent = valueOrRemove.hasOwnProperty('content');
            if ((hasContent && storeName !== dbPStore) || (!hasContent && storeName !== dbSStore)) {
              storeCount--; // put should only go to one store
              continue;
            }
          }
          tx = storage.idb.transaction([storeName], 'readwrite');
          store = tx.objectStore(storeName);
          req = remove ? store.delete(name) : valType !== 'undefined' ? store.put(valueOrRemove, name) : store.get(name);
          req.onerror = event => {
            reqCnt++;
            if (error) return; // already had error
            error = event.error;
            error.message += ` <- Failed to "${remove ? 'delete' : valType !== 'undefined' ? 'put' : 'get'}" for IndexedDB key "${name}"`;
            if (logger && logger.error) logger.error(error);
            reject(error);
          };
          req.onsuccess = () => {
            reqCnt++;
            let val;
            if (remove) {
              delete storage[dbPStore][name];
              delete storage[dbSStore][name];
              if (hasRecordfunc) {
                recordfunc(dbPStore, name, params);
                recordfunc(dbSStore, name, params);
              }
            } else {
              val = req.hasOwnProperty('result') ? req.result : valueOrRemove;
              if (val) {
                storage[val.hasOwnProperty('content') ? dbPStore : dbSStore][name] = val;
                if (hasRecordfunc) recordfunc(val.hasOwnProperty('content') ? dbPStore : dbSStore, name, params, val);
              }
            }
            if (logger && (logger.info || logger.debug)) {
              (logger.debug || logger.info)(`Completed "${remove ? 'delete' : valType !== 'undefined' ? 'put' : 'get'}"`
                + ` for IndexedDB key "${name}"${logger.debug && !remove ? ` with: ${JSON.stringify(val)}` : ''}`);
            }
            if (!error && reqCnt >= storeCount) resolve(storage);
          };
          return;
        }
      } else if (logger && logger.info) logger.info(`${remove ? 'Removing' : 'Getting'} all IndexedDB keys from ${storeNames.join()}`);
      // multi-record processing
      const errors = [], dels = remove ? [] : null;
      var cnt = 0, done;
      const errd = (err, cacheName, msg) => {
        err.message = `${err.message || ''} - ${remove ? 'Removal' : 'Capture'} of template on "${cacheName}" failed for IndexedDB ${msg || ''}`;
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
              delete storage[del.cacheName][del.key];
              if (hasRecordfunc) recordfunc(del.cacheName, del.key, params);
              if (logger && logger.info) {
                logger.info(`Completed "delete" on "${del.cacheName}" for IndexedDB key "${del.key}"`);
              }
            } catch (err) {
              errd(err, del.cacheName, `Failed to "delete" on "${del.cacheName}" for IndexedDB key "${del.key}"`);
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
        } else resolve(storage);
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
          if (!cursor) return errors.push(new Error(`Failed to "${remove ? 'delete' : 'get'}" on "${cacheName}" for IndexedDB`
            + ' request due to missing cursor'));
          try {
            storage[cacheName][cursor.key] = cursor.value;
            if (cursor.value.content) storage[cacheName][cursor.key].content = cursor.value.content.toString();
            else cursor.value.func = storage[cacheName][cursor.key].func = cursor.value.func.toString();
            if (remove) {
              const reqDel = cursor.delete();
              dels.push({ cacheName, key: cursor.key, promise: new Promise((resolve, reject) => {
                reqDel.onerror = reject(event.error);
                reqDel.onsuccess = () => resolve();
              })});
            } else {
              if (logger && (logger.info || logger.debug)) {
                (logger.debug || logger.info)(`Completed "get" on "${cacheName}" for IndexedDB key "${cursor.key}"`
                  + `${logger.debug ? ` with: ${JSON.stringify(cursor.value)}` : ''}`);
              }
              if (hasRecordfunc) recordfunc(cacheName, cursor.key, params, storage[cacheName][cursor.key]);
            }
          } catch (err) {
            errd(err, cacheName);
          } finally {
            cursor.continue();
          }
        })(storeName);
      }
    } else if (idbName === 'LevelUP') {
      if (!storage.db.isOpen()) {
        if (logger && logger.info) logger.info(`Opening "${idbName}" from module "${dbTypeName}"`);
        try {
          await storage.db.open();
        } catch (err) {
          if (logger && logger.error) logger.error(err);
          return reject(err);
        }
        if (typeof openFunc === 'function') openFunc(storage);
      }
      if (openOnly) return resolve(storage);
      if (name) { // single record processing
        try {
          if (remove) {
            await storage.db.del(name);
            delete storage[dbPStore][name];
            delete storage[dbSStore][name];
            if (hasRecordfunc) {
              recordfunc(dbPStore, name, params);
              recordfunc(dbSStore, name, params);
            }
            if (logger && logger.info) logger.info(`Completed "delete" for LevelDB key "${name}"`);
            return resolve(storage);
          }
          let val;
          if (valType !== 'undefined') {
            val = valueOrRemove;
            await storage.db.put(name, JSON.stringify(val));
            if (logger && (logger.info || logger.debug)) {
              const hasContent = val.hasOwnProperty('content'), storeName = hasContent ? dbPStore : dbSStore;
              (logger.debug || logger.info)(`Completed "put" on "${storeName}" for LevelDB key "${name}"`
                + `${logger.debug ? ` with: ${JSON.stringify(val)}` : ''}`);
            }
          } else {
            let rcd = await storage.db.get(name);
            if (rcd) {
              try {
                val = JSON.parse(rcd);
                const hasContent = val.hasOwnProperty('content'), storeName = hasContent ? dbPStore : dbSStore;
                if (logger && (logger.info || logger.debug)) {
                  (logger.debug || logger.info)(`Completed "get" on "${storeName}" for LevelDB key "${name}"`
                    + `${logger.debug ? ` with: ${rcd}` : ''}`);
                }
              } catch (err) {
                err.message += ` <- The returned result did not contain valid JSON`;
                return reject(err);
              }
            } else if (logger && logger.info) logger.info(`Unable to "get" record for LevelDB key ${name}`);
          }
          if (val) {
            storage[val.hasOwnProperty('content') ? dbPStore : dbSStore][name] = val;
            if (hasRecordfunc) recordfunc(val.hasOwnProperty('content') ? dbPStore : dbSStore, name, params, val);
          }
        } catch (err) {
          err.message += ` <- ${remove ? 'Delete' : valType !== 'undefined' ? 'Put' : 'Get'} failed for LevelDB key "${name}"`;
          if (logger && logger.error) logger.error(err);
          return reject(err);
        }
        return resolve(storage);
      } else if (logger && logger.info) logger.info(`${remove ? 'Removing' : 'Getting'} all LevelDB keys from ${storeNames.join()}`);
      // multi-record processing
      const strm = storage.db.createReadStream(), errors = [];
      strm.on('data', async data => {
        try {
          const json = JSON.parse(data.value), hasContent = json.hasOwnProperty('content'), storeName = hasContent ? dbPStore : dbSStore;
          if (remove) {
            await storage.db.del(data.key);
            delete storage[storeName][data.key];
            if (logger && logger.info) {
              logger.info(`Completed "delete" on "${storeName}" for LevelDB key "${data.key}"`);
            }
            if (hasRecordfunc) recordfunc(storeName, data.key, params);
          } else {
            if (logger) {
              if (storage[storeName][data.key] && logger.warn){
                logger.warn(`The template  ${storeName} for "${data.key}" is overridden by LevelDB registration`);
              } else if (logger.info || logger.debug) {
                (logger.debug || logger.info)(`Completed "get" on "${storeName}" for LevelDB key "${data.key}"`
                  + `${logger.debug ? ` with: ${data.value}` : ''}`);
              }
            }
            storage[storeName][data.key] = json;
            if (hasRecordfunc) recordfunc(storeName, data.key, params, storage[storeName][data.key]);
          }
        } catch (err) {
          err.message = `${err.message || ''} <- ${remove ? 'Removal' : 'Capture'} of template partial or source failed for LevelDB key "${data.key}".`
            + ' The entry did not contain JSON or could not be set on return object';
          errors.push(err);
          if (logger && logger.error) {
            logger.error(err);
          }
        }
      });
      strm.on('error', err => {
        err.message = `${err.message || ''} <- ${remove ? 'Removal' : 'Capture'} of template partials and/or sources failed for when reading LevelDB keys`;
        errors.push(err);
        if (logger && logger.error) {
          logger.error(err);
        }
      });
      strm.on('end', () => {//console.log(`END::: Name: "${name}", remove: ${remove}, put: ${valType !== 'undefined'}, errors: ${errors}`);
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
        resolve(storage);
      });
    } else if (storage.db) reject(new Error(`Unsupported IndexedDB implementation specified for: ${idbName || storage.db}`));
  });
}

/**
 * Closes a DB connection
 * @private
 * @ignore
 * @param {Object} storage The storage that contains the DB
 * @param {Object} [logger] The logger that can contain functions for each of the following: `error`/`warn`/`info`/`debug`.
 */
async function closeDB(storage, logger) {
  const db = storage.idb || storage.db;
  if (db) {
    await db.close();
    if (logger && logger.info) logger.info(`Closed DB connection(s)`);
  }
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