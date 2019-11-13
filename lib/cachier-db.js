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
   * @param {Function} [readFormatter] The `function(string, readFormatOptions)` that will return a formatted string for __reading__
   * data using the `options.readFormatOptions` from {@link TemplateOpts} as the formatting options. Typically reads are for __HTML__
   * _minification_ and/or _beautifying_. __NOTE: Use with caution as syntax errors may result depending on the formatter used and the
   * complexity of the data being formatted!__ 
   * @param {Function} [writeFormatter] The `function(string, writeFormatOptions)` that will return a formatted string for __writting__
   * data using the `options.writeFormatOptions` from {@link TemplateOpts} as the formatting options. Typically reads are for __JS__
   * _minification_ and/or _beautifying_. __NOTE: Use with caution as syntax errors may result depending on the formatter used and the
   * complexity of the data being formatted!__ 
   * @param {Object} [log] The log for handling logging output
   * @param {Function} [log.debug] A function that will accept __debug__ level logging messages (i.e. `debug('some message to log')`)
   * @param {Function} [log.info] A function that will accept __info__ level logging messages (i.e. `info('some message to log')`)
   * @param {Function} [log.warn] A function that will accept __warning__ level logging messages (i.e. `warn('some message to log')`)
   * @param {Function} [log.error] A function that will accept __error__ level logging messages (i.e. `error('some message to log')`)
   */
  constructor(opts, readFormatter, writeFormatter, log) {
    super(opts instanceof TemplateDBOpts ? opts : new TemplateDBOpts(opts), readFormatter, writeFormatter, log);
  }

  /**
   * @override
   * @inheritdoc
   */
  async register(data, read, write) {
    const ns = internal(this), opts = ns.this.options, log = ns.this.log;
    var rtn;
    const storage = read || write ? { db: ns.at.db } : null;
    try {
      if (read) {
        // read all keys in store and register any template, partials and/or context found
        let proms;
        await execDB(null, opts, null, storage, ns.this.readFormatter, true, log, true, undefined, async function recordDB(storage, storeName, key, params, json) {
          if (!json && typeof json === 'undefined') {
            if (!proms) proms = [ns.this.unregister(key)];
            else proms.push(ns.this.unregister(key));
          } else if (storeName === 'data')  {
            const jsonType = json && typeof json;
            await ns.this.registerPartial(key, jsonType === 'object' && json.hasOwnProperty('content') ? json.content : params, json.extension);
            //if (json && data && !data.hasOwnProperty(key)) data[key] = JSON.parse(JSON.stringify(json));
          }
        }, function openDB(store) {
          storage.db = store.db;
        });
        if (proms) await Cachier.waiter(proms, 'Failed to unregister one or more template contents', false);
      }
      rtn = await super.register(data, read, write); // calls this.write as-needed
      storage.db = storage.db || ns.at.db;
    } finally {
      if (read || write) await closeDB(storage, opts, log, true);
    }
    return rtn;
  }

  /**
   * @override
   * @inheritdoc
   */
  async compile(name, template, extension) {
    const ns = internal(this), log = ns.this.log;
    var fn;
    try {
      fn = await super.compile(name, template, extension);
    } finally {
      const storage = { db: ns.at.db };
      await closeDB(storage, ns.this.options, log, true);
    }
    return fn;
  }

  /**
   * @override
   * @inheritdoc
   */
  async read(name, forContent, extension, params) {
    if (!name) throw new Error(`Missing "name" for value "${name}" on pre-compile read from DB`);
    const ns = internal(this), opts = ns.this.options, store = ns.at, log = ns.this.log, formatter = ns.this.readFormatter;
    const path = await ns.this.readWriteName(name, opts, params, store, forContent, extension);
    return dbReader(name, path, extension, forContent, opts, params,store, formatter, false, log, true);
  }

  /**
   * @override
   * @inheritdoc
   */
  async write(name, data, forContent, extension, params) {
    const ns = internal(this), opts = ns.this.options, store = ns.at, log = ns.this.log, formatter = ns.this.writeFormatter;
    const path = await ns.this.readWriteName(name, opts, params, store, forContent, extension);
    return dbWriter(name, path, extension, forContent, opts, params, store, data, formatter, false, log, true);
  }

  /**
   * Clears templates that may reside in-memory, __optionally__ clears the IndexedDB keys in the cache store(s) and
   * __closes__ any lingering DB connections.
   * @override
   * @param {Boolean} [all=true] When `true` all of the keys in the IndexedDB cache store(s) will be __removed__
   */
  async clear(all = true) {
    await super.clear(all);
    const ns = internal(this), opts = ns.this.options, log = ns.this.log, storage = { db: ns.at.db };
    // remove all keys from the DB
    if (all && log.info) log.info(`DB: Clearing all stored keys...`);
    let proms;
    await execDB(null, opts, null, storage, null, true, log, true, true, function recordDB(store, storeName, key, params, json) {
      if (!proms) proms = [ns.this.unregister(key)];
      else proms.push(ns.this.unregister(key));
    }, function openDB(store) {
      storage.db = store.db;
    }, true);
    if (all) delete ns.at.db;
    if (proms) await Cachier.waiter(proms, 'Failed to unregister one or more template contents while clearing cache', false);
  }

  /**
   * @override
   * @inheritdoc
   */
  get operations() {
    const ops = super.operations;
    const op = Object.freeze({
      read: dbReader,
      write: dbWriter,
      finish: dbFinish,
      scopes: Object.freeze([
        execDB,
        closeDB
      ])
    });
    if (Array.isArray(ops)) ops.splice(0, 0, op);
    else return [op, ops];
    return ops;
  }
}

// TODO : ESM remove the following lines...
module.exports = CachierDB;

/**
 * File reader that reads the contents of a file during compile-time or render-time
 * @private
 * @ignore
 * @param {String} name The name of template that will be read
 * @param {String} path The path to the template that will be read
 * @param {String} ext The path extension
 * @param {Boolean} forContent The flag indicating that the read is for content. Otherwise, the read is for rendering functions.
 * @param {(TemplateDBOpts | Function)} optional Either the options or a `function(name:String):*` that returns an
 * option value by name
 * @param {URLSearchParams} [params] The search parameters to use for the read 
 * @param {Object} store The JSON storage space
 * @param {Function} [readFormatter] The formatting function to use to format the read content
 * @param {Boolean} [close] When `true`, the resources will be closed after execution is complete
 * @param {Object} [log] The log that can contain functions for each of the following: `error`/`warn`/`info`/`debug`
 * @param {Boolean} [isCompile] `true` when execution is for compilation, _falsy_ when rendering
 * @param {Function} [recordfunc] A `function(store:Object, storeName:String, key:String[, params:(URLSearchParams | Object), json:Object])`
 * that will be called for each action taken on a record.
 * @param {Function} [openFunc] A `function(store:Object)` that will be called when the DB is opened.
 * @returns {(String | undefined)} The read file template content or `undefined` when reading all partial content
 */
async function dbReader(name, path, ext, forContent, optional, params, store, readFormatter, close, log, isCompile, recordFunc, openFunc) {
  let rtn;
  if (log.info && name) {
    log.info(`DB: 📖 Reading template "${forContent ? 'data' : 'sources'}" for "${name}" @ "${path}" (${isCompile ? 'compile' : 'render'}-time)`);
  }
  try {
    rtn = await execDB(path, optional, params, store, readFormatter, close, log, isCompile, undefined, recordFunc, openFunc);
  } catch (err) {
    try {
      await closeDB(store, optional, log, isCompile);
    } catch (errc) {}
    throw err;
  }
  return rtn;
}

/**
 * File writer that writes the contents of a file during compile-time or render-time
 * @private
 * @ignore
 * @param {String} name The name of template that will be write
 * @param {String} path The path to the template that will be write
 * @param {String} ext The path extension
 * @param {Boolean} forContent The flag indicating that the write is for content. Otherwise, the write is for rendering functions.
 * @param {(TemplateDBOpts | Function)} optional Either the options or a `function(name:String):*` that returns an
 * option value by name
 * @param {URLSearchParams} [params] The search parameters to use for the write 
 * @param {Object} store The JSON storage space
 * @param {*} data The value that will be stored (cannot be `undefined`)
 * @param {Function} [writeFormatter] The formatting function to use to format the write content
 * @param {Boolean} [close] When `true`, the resources will be closed after execution is complete
 * @param {Object} [log] The log that can contain functions for each of the following: `error`/`warn`/`info`/`debug`
 * @param {Boolean} [isCompile] `true` when execution is for compilation, _falsy_ when rendering
 * @param {Function} [recordfunc] A `function(store:Object, storeName:String, key:String[, params:(URLSearchParams | Object), json:Object])`
 * that will be called for each action taken on a record.
 * @param {Function} [openFunc] A `function(store:Object)` that will be called when the DB is opened.
 * @returns {(String | undefined)} The written file template content or `undefined` when writting all partial content
 */
async function dbWriter(name, path, ext, forContent, optional, params, store, data, writeFormatter, close, log, isCompile, recordFunc, openFunc) {
  let rtn;
  if (typeof data === 'undefined') return rtn;
  const isOptionFunc = typeof optional === 'function', useCache = isOptionFunc ? optional('cacheRawTemplates') : optional.cacheRawTemplates;
  if (!useCache) return;
  if (!name) throw new Error(`Missing "name" for value "${name}" on write to DB`);
  if (!path) throw new Error(`Missing "path" for value "${path}" on write to DB`);
  if (log.info) {
    log.info(`DB: ✏️ Writting template "${forContent ? 'data' : 'sources'}" for "${name}" @ "${path}" (${isCompile ? 'compile' : 'render'}-time)`);
  }
  const dataType = typeof data, dataIsObj = dataType === 'object', put = { name: path, shortName: dataIsObj && ext !== 'json' ? data.name : name };
  if (forContent) {
    put.content = dataIsObj && ext !== 'json' ? data.content : data;
    put.extension = ext;
  } else if (dataIsObj) put.func = data.func;
  else put.func = data;
  if (!forContent) {
    if (typeof put.func === 'function') {
      if (!put.func.name) throw new Error('Rendering function must be named, but found anonymous');
      put.func = put.func.toString();
    } else if (typeof put.func === 'string') {
      try { // validate string is in fact a valid function
        put.func = (new Function(`return ${put.func}`))();
        if (typeof put.func !== 'function') throw new Error('Invalid function string');
        if (!put.func.name) throw new Error('String must contain a named function, but found anonymous');
        put.func = put.func.toString();
      } catch (err) {
        err.message += ` <- Unable to validate rendering function string for DB storage: ${put.func}`;
        throw err;
      }
    } else throw new Error('Invalid template rendering function passed to IndexedDB write operation. It must contain'
      + ` a valid function or deserialized function string rather than the supplied "${put.func}"`);
  }
  try {
    rtn = await execDB(path, optional, params, store, writeFormatter, close, log, isCompile, put, recordFunc, openFunc);
  } catch (err) {
    try {
      await closeDB(store, optional, log, isCompile);
    } catch (errc) {}
    throw err;
  }
  return rtn;
}

/**
 * Releases any DB resources that have been used after finishing DB operations
 * @private
 * @ignore
 * @param {Object} store The JSON storage space
 * @param {(TemplateDBOpts | Function)} optional Either the options or a `function(name:String):*` that returns an
 * option value by name
 * @param {Object} [log] The log that can contain functions for each of the following: `error`/`warn`/`info`/`debug`
 */
async function dbFinish(store, optional, log) {
  const isOptionFunc = typeof optional === 'function', policy = isOptionFunc ? optional('renderTimePolicy') : optional.renderTimePolicy;
  if (policy === 'read-write-and-close') return;
  if (log.info) log.info('DB: ❌ Releasing resources for DB (render-time)');
  return closeDB(store, optional, log);
}

/**
 * When `name` is present, a single record that will be captured or deleted. Otherwise, captures or removes every DB key that
 * currently resides in the DB. Each key found will be set as `storage.data[key]` or `storage.sources[key]`. When keys are
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
 * @param {Object} storage The object where the `db` (and `idb` for IndexedDB), `data` and `sources` are stored.
 * @param {Function} [formatter] The function that will format written sources during include discovery (if any). The formatting function
 * takes 1 or 2 arguments with the first being the content that will be formatted and the second being
 * @param {Boolean} [close] When `true`, the DB connection will be closed after execution is complete.
 * @param {Object} [log] The log that can contain functions for each of the following: `error`/`warn`/`info`/`debug`.
 * @param {Boolean} [isCompile] `true` when execution is for compilation, _falsy_ when rendering
 * @param {(String | Boolean)} [valueOrRemove] `true` when removing keys, `undefined` when capturing keys or any other value
 * when setting a key (using `name` as the key).
 * @param {Function} [recordfunc] A `function(store:Object, storeName:String, key:String[, params:(URLSearchParams | Object), json:Object])`
 * that will be called for each action taken on a record.
 * @param {Function} [openFunc] A `function(store:Object)` that will be called when the DB is opened.
 * @param {Boolean} [openOnly] A flag that indicates that the DB will be opened, but will not process any data
 * @returns {Object} The passed `storage` object.
 */
async function execDB(name, optional, params, storage, formatter, close, log, isCompile, valueOrRemove, recordfunc, openFunc, openOnly) {
  const isOptionFunc = typeof optional === 'function';
  const policy = isOptionFunc ? optional('renderTimePolicy') : optional.renderTimePolicy;
  if (!name) { // init all key read?
    const noInit = !policy.includes('read-all-on-init-when-empty'), sdata = !noInit && storage.data ? Object.getOwnPropertyNames(storage.data) : null;
    let sdcnt = 0;
    if (sdata && sdata.length) { // exclude the default template from the count for determining emptiness
      const dnm = isOptionFunc ? optional('defaultTemplateName') : optional.defaultTemplateName, rx = /\.([0-9a-z]+)(?:[\?#]|$)/i;
      sdcnt = sdata.reduce((a, cnm) => (cnm && cnm.name || cnm).replace(rx, '') !== dnm ? a + 1 : a, 0);
    }
    if (noInit || sdcnt) {
      if (log && log.info) {
        log.info(`DB: ${valueOrRemove === true ? '❌ Remove' : valueOrRemove ? '✔️ Put' : '📖 Capture' } for all keys will be skipped for policy`
          + ` "${policy}"${sdcnt ? ` on ${sdcnt} non-empty records` : ''} (${isCompile ? 'compile' : 'render'}-time)`);
      }
      return;
    }
  }
  const dbTypeName = isOptionFunc ? optional('dbTypeName') : optional.dbTypeName;
  const dbLocName = isOptionFunc ? optional('dbLocName') : optional.dbLocName;
  const encoding = isOptionFunc ? optional('encoding') : optional.encoding;
  const dbDStore = 'data';
  const dbSStore = 'sources';
  const storeNames = [dbDStore, dbSStore];
  storage[dbDStore] = storage[dbDStore] || {};
  storage[dbSStore] = storage[dbSStore] || {};
  return new Promise(async (resolve, reject) => {
    const end = async error => {
      if (close) {
        const db = storage.db && (storage.db.idb || storage.db.dbs);
        if (db && typeof db.close === 'function') {
          try {
            await closeDB(storage, optional, log, isCompile);
          } catch (err) {
            if (log && log.error) log.error(`DB: ⚠️ Failed to close connection (${isCompile ? 'compile' : 'render'}-time)`);
            return reject(err);
          }
        } else if (log && log.info) {
          log.info(`DB: 🔌 Connection may already be closed or manual "close" functionality is not implemented (${isCompile ? 'compile' : 'render'}-time)`);
        }
      }
      if (error) reject(error);
      else resolve(storage);
    };
    if (!storage.db) {
      storage.db = {
        toJSON: () => '', // prevent serialization via JSON.stringify
        dbs: dbTypeName === 'indexedDB' ? this && this[dbTypeName] :
          new Promise(async (resolveModule, rejectModule) => {
            if (log && log.info) {
              log.info(`DB: 🎬 Loading module "${dbTypeName}" passing location "${dbLocName}"${name ? ` while processing "${name}"` : ''}`
              + ` using policy "${policy}" (${isCompile ? 'compile' : 'render'}-time)`);
            }
            try {
              const initFunc = (typeof require !== 'undefined' ? require(dbTypeName) : /*TODO : ESM use... await import(dbTypeName)*/null);
              const db = initFunc(dbLocName, (err, db) => {
                if (err) {
                  const nerr = new err.constructor();
                  nerr.stack = `Failed to initialize module "${dbTypeName}" passing location "${dbLocName}"${name ? ` while processing "${name}"` : ''}`
                  + ` using policy "${policy}" (${isCompile ? 'compile' : 'render'}-time)\n${err.stack}`;
                  rejectModule(nerr);
                } else resolveModule(db);
              });
              if (db instanceof Promise) resolveModule(await db);
            } catch (err) {
              const nerr = new err.constructor();
              nerr.stack = `Failed to load module "${dbTypeName}" with location "${dbLocName}"${name ? ` while processing "${name}"` : ''}`
              + ` using policy "${policy}" (${isCompile ? 'compile' : 'render'}-time)\n${err.stack}`;
              rejectModule(nerr);
            }
          })
      };
      if (!storage.db.dbs) {
        return end(new Error(`Unable to load "${dbTypeName}" ${dbTypeName === 'indexedDB' ? 'from global/window scope' :
          ` module "${dbTypeName}" passing location "${dbLocName}"`}`));
      }
      if (storage.db.dbs instanceof Promise) {
        try {
          storage.db.dbs = await storage.db.dbs;
        } catch (err) {
          return end(err);
        }
      }
      if (typeof openFunc === 'function') openFunc(storage);
    }
    const idbName = storage.db && storage.db.dbs && storage.db.dbs.constructor && storage.db.dbs.constructor.name, isIndexedDB = idbName === 'IDBFactory';
    const valType = valueOrRemove === null ? 'undefined' : typeof valueOrRemove, remove = valType === 'boolean' && valueOrRemove ? true : false;
    const hasRecordfunc = typeof recordfunc === 'function';
    if (log && log.debug) log.debug(`DB: 🆔 Using "${idbName}" from "${dbTypeName}"`);
    if (isIndexedDB) {
      if (!storage.db.idb) { // set idb to IDBDatabase instance
        storage.db.idb = await new Promise((resolve, reject) => {
          const req = storage.db.dbs.open(dbLocName); // IDBOpenDBRequest
          req.onerror = event => reject(event.error);
          req.onupgradeneeded = event => {
            event.target.createObjectStore(dbDStore, { autoIncrement: true });
            event.target.createObjectStore(dbSStore, { autoIncrement: true });
          };
          req.onsuccess = event => resolve(event.target.result ? undefined : null);
        });
        if (log && log.info) log.info(`DB: 🆔 Using "${idbName}" from "${dbTypeName}"`);
        if (typeof openFunc === 'function') openFunc(storage);
        if (openOnly) return end();
      }
      if (name) { // single record processing
        let tx, store, req, reqCnt = 0, error, storeCount = storeNames.length;
        for (let storeName of storeNames) {
          if (valType !== 'undefined') { // put
            let hasContent = valueOrRemove.hasOwnProperty('content');
            if ((hasContent && storeName !== dbDStore) || (!hasContent && storeName !== dbSStore)) {
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
            if (log && log.error) log.error(error);
            return end(error);
          };
          req.onsuccess = () => {
            reqCnt++;
            let val;
            if (remove) {
              delete storage[dbDStore][name];
              delete storage[dbSStore][name];
              if (hasRecordfunc) {
                recordfunc(storage, dbDStore, name, params);
                recordfunc(storage, dbSStore, name, params);
              }
            } else {
              val = req.hasOwnProperty('result') ? req.result : valueOrRemove;
              if (val) {
                const hasContent = val.hasOwnProperty('content'), valStoreName = hasContent ? dbDStore : dbSStore;
                storage[valStoreName][name] = val;
                if (typeof storage[valStoreName][name].func === 'string') {
                  try {
                    storage[valStoreName][name].func = (new Function(`return ${storage[valStoreName][name].func}`))();
                  } catch (errf) {
                    error = errf;
                    error.message += ` while deserializing function "${storage[valStoreName][name].func.name}"`
                    + ` <- Failed to "${remove ? 'delete' : valType !== 'undefined' ? 'put' : 'get'}" for IndexedDB key "${name}"`;
                    if (log && log.error) log.error(error);
                    return end(error);
                  }
                }
                if (hasRecordfunc) recordfunc(storage, valStoreName, name, params, val);
              }
            }
            if (log && (log.info || log.debug)) {
              (log.debug || log.info)(`DB: Completed "${remove ? '❌ delete' : valType !== 'undefined' ? '✔️ put' : '📖 get'}"`
                + ` for IndexedDB key "${name}" (${isCompile ? 'compile' : 'render'}-time)${log.debug && !remove ? ` with: ${JSON.stringify(val)}` : ''}`);
            }
            if (!error && reqCnt >= storeCount) end();
          };
          return;
        }
      } else if (log && log.info) log.info(`DB: ${remove ? '❌ Removing' : '📖 Getting'} all IndexedDB keys from ${storeNames.join()}`);
      // multi-record processing
      const errors = [], dels = remove ? [] : null;
      var cnt = 0, done;
      const errd = (err, cacheName, msg) => {
        err.message = `${err.message || ''} - ${remove ? 'Removal' : 'Capture'} of template on "${cacheName}" failed for IndexedDB ${msg || ''}`;
        err.cache = cacheName;
        errors.push(err);
        if (log && log.error) {
          log.error(err);
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
              if (hasRecordfunc) recordfunc(storage, del.cacheName, del.key, params);
              if (log && log.info) {
                log.info(`DB: Completed "❌ delete" on "${del.cacheName}" for IndexedDB key "${del.key}" (${isCompile ? 'compile' : 'render'}-time)`);
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
          error.reads = { [dbDStore]: storage[dbDStore], [dbSStore]: storage[dbSStore] };
          return end(error);
        } else await end();
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
            if (cursor.value.content) storage[cacheName][cursor.key].content = cursor.value.content.toString(encoding);
            else cursor.value.func = storage[cacheName][cursor.key].func = cursor.value.func.toString(encoding);
            if (remove) {
              const reqDel = cursor.delete();
              dels.push({ cacheName, key: cursor.key, promise: new Promise((resolve, reject) => {
                reqDel.onerror = reject(event.error);
                reqDel.onsuccess = () => resolve();
              })});
            } else {
              if (log && (log.info || log.debug)) {
                (log.debug || log.info)(`DB: 📖 Completed "get" on "${cacheName}" for IndexedDB key "${cursor.key}"`
                  + ` (${isCompile ? 'compile' : 'render'}-time)${log.debug ? ` with: ${JSON.stringify(cursor.value)}` : ''}`);
              }
              if (typeof storage[cacheName][cursor.key].func === 'string') {
                try {
                  storage[cacheName][cursor.key].func = (new Function(`return ${storage[cacheName][cursor.key].func}`))();
                } catch (errf) {
                  errd(errf, cacheName, `Unable to deserialize function "${storage[cacheName][cursor.key].func.name}"`);
                }
              }
              if (hasRecordfunc) recordfunc(storage, cacheName, cursor.key, params, storage[cacheName][cursor.key]);
            }
          } catch (err) {
            errd(err, cacheName);
          } finally {
            cursor.continue();
          }
        })(storeName);
      }
    } else if (idbName === 'LevelUP') {
      if (!storage.db.dbs.isOpen()) {
        if (log && log.info) log.info(`DB: 🏦 Opening "${idbName}" from module "${dbTypeName}" using policy "${policy}"${name ? ` while processing "${name}"` : ''}`);
        try {
          await storage.db.dbs.open();
        } catch (err) {
          if (log && log.error) log.error(err);
          return end(err);
        }
        if (typeof openFunc === 'function') openFunc(storage);
      }
      if (openOnly) return end();
      if (name) { // single record processing
        try {
          if (remove) {
            await storage.db.dbs.del(name);
            delete storage[dbDStore][name];
            delete storage[dbSStore][name];
            if (hasRecordfunc) {
              recordfunc(storage, dbDStore, name, params);
              recordfunc(storage, dbSStore, name, params);
            }
            if (log && log.info) log.info(`DB: ❌ Completed "delete" for LevelDB key "${name}" (${isCompile ? 'compile' : 'render'}-time)`);
            return end();
          }
          let val;
          if (valType !== 'undefined') {
            val = valueOrRemove;
            await storage.db.dbs.put(name, JSON.stringify(val));
            if (log && (log.info || log.debug)) {
              const hasContent = val.hasOwnProperty('content'), storeName = hasContent ? dbDStore : dbSStore;
              (log.debug || log.info)(`DB: ✔️ Completed "put" on "${storeName}" for LevelDB key "${name}"`
                + ` (${isCompile ? 'compile' : 'render'}-time)${log.debug ? ` with: ${JSON.stringify(val)}` : ''}`);
            }
          } else {
            let rcd = await storage.db.dbs.get(name);
            if (rcd) {
              try {
                val = JSON.parse(rcd);
                const hasContent = val.hasOwnProperty('content'), storeName = hasContent ? dbDStore : dbSStore;
                if (log && (log.info || log.debug)) {
                  (log.debug || log.info)(`DB: 📖 Completed "get" on "${storeName}" for LevelDB key "${name}"`
                    + ` (${isCompile ? 'compile' : 'render'}-time)${log.debug ? ` with: ${rcd}` : ''}`);
                }
              } catch (err) {
                err.message += ` <- The returned result did not contain valid JSON`;
                return end(err);
              }
              if (val && typeof val.func === 'string') {
                try {
                  val.func = (new Function(`return ${val.func}`))();
                } catch (err) {
                  err.message += ` <- Deserialization of function "${val.func.name}" failed`;
                  return end(err);
                }
              }
            } else if (log && log.info) log.info(`DB: ⚠️ Unable to "get" record for LevelDB key ${name}`);
          }
          if (val) {
            storage[val.hasOwnProperty('content') ? dbDStore : dbSStore][name] = val;
            if (hasRecordfunc) recordfunc(storage, val.hasOwnProperty('content') ? dbDStore : dbSStore, name, params, val);
          }
        } catch (err) {
          const nerr = new Error(`${err.message} <- ${remove ? 'Delete' : valType !== 'undefined' ? 'Put' : 'Get'} failed for LevelDB key "${name}"`);
          nerr.message += `${err.message} <- ${remove ? 'Delete' : valType !== 'undefined' ? 'Put' : 'Get'} failed for LevelDB key "${name}"`;
          nerr.stack = err.stack;
          nerr.code = err.code;
          nerr.type = err.type || err.constructor.name;
          if (log && log.error) log.error(nerr);
          return end(nerr);
        }
        return end();
      } else if (log && log.info) log.info(`DB: ${remove ? '❌ Removing' : '📖 Getting'} all LevelDB keys from ${storeNames.join()} using policy "${policy}"`);
      // multi-record processing
      const strm = storage.db.dbs.createReadStream(), errors = [];
      strm.on('data', async data => {
        try {
          const json = JSON.parse(data.value), hasContent = json.hasOwnProperty('content'), storeName = hasContent ? dbDStore : dbSStore;
          if (remove) {
            await storage.db.dbs.del(data.key);
            delete storage[storeName][data.key];
            if (log && log.info) {
              log.info(`DB: ❌ Completed "delete" on "${storeName}" for LevelDB key "${data.key}" (${isCompile ? 'compile' : 'render'}-time)`);
            }
            if (hasRecordfunc) recordfunc(storage, storeName, data.key, params);
          } else {
            if (log) {
              if (storage[storeName][data.key] && log.warn){
                log.warn(`DB: ⚠️ The template  ${storeName} for "${data.key}" is overridden by LevelDB registration`);
              } else if (log.info || log.debug) {
                (log.debug || log.info)(`DB: 📖 Completed "get" on "${storeName}" for LevelDB key "${data.key}"`
                  + ` (${isCompile ? 'compile' : 'render'}-time)${log.debug ? ` with: ${data.value}` : ''}`);
              }
            }
            storage[storeName][data.key] = json;
            if (json && typeof storage[storeName][data.key].func === 'string') {
              try {
                storage[storeName][data.key].func = (new Function(`return ${storage[storeName][data.key].func}`))();
              } catch (err) {
                err.message += ` <- Deserialization of function "${storage[storeName][data.key].func.name}" failed`;
                throw err;
              }
            }
            if (hasRecordfunc) recordfunc(storage, storeName, data.key, params, storage[storeName][data.key]);
          }
        } catch (err) {
          err.message = `${err.message || ''} <- ${remove ? 'Removal' : 'Capture'} of template partial or source failed for LevelDB key "${data.key}".`
            + ' The entry did not contain JSON or could not be set on return object';
          errors.push(err);
          if (log && log.error) log.error(err);
        }
      });
      strm.on('error', err => {
        err.message = `${err.message || ''} <- ${remove ? 'Removal' : 'Capture'} of template data and/or sources failed for when reading LevelDB keys`;
        errors.push(err);
        if (log && log.error) log.error(err);
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
          error.reads = { [dbDStore]: storage[dbDStore], [dbSStore]: storage[dbSStore] };
          return end(error);
        }
        return end();
      });
    } else if (storage.db && storage.dbs) {
      return end(new Error(`Unsupported IndexedDB implementation specified for: ${idbName}`));
    }
  });
}

/**
 * Closes a DB connection and clears the DB in the `store`
 * @private
 * @ignore
 * @param {Object} store The storage that contains the DB
 * @param {(TemplateDBOpts | Function)} optional Either the options or a `function(name:String):*` that returns an
 * option value by name
 * @param {Object} [log] The log that can contain functions for each of the following: `error`/`warn`/`info`/`debug`.
 * @param {Boolean} [isCompile] `true` when execution is for compilation, _falsy_ when rendering
 */
async function closeDB(store, optional, log, isCompile) {
  const db = store.db && (store.db.idb || store.db.dbs);
  if (db && typeof db.close === 'function') {
    await db.close();
    if (log && log.info) log.info(`DB: 🔌 Closed connection (${isCompile ? 'compile' : 'render'}-time)`);
  }
  store.db = null; // need to clear the DB to prevent possible serialization of the DB store
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