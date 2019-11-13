'use strict';

const TemplateFileOpts = require('./template-file-options');
const Cachier = require('./cachier');
const Sandbox = require('./sandbox');
const Os = require('os');
const Fs = require('fs');
const Path = require('path');
// TODO : ESM uncomment the following lines...
// TODO : import * as TemplateFileOpts from './template-file-options.mjs';
// TODO : import * as Cachier from './cachier.mjs';
// TODO : import * as Sandbox from './sandbox.mjs';
// TODO : import * as Os from 'os';
// TODO : import * as Fs from 'fs';
// TODO : import * as Path from 'path';

const Fsp = Fs.promises;

/**
 * Node.js [file]{@link https://nodejs.org/api/fs.html} persistence manager that uses the file system for improved debugging/caching
 * capabilities
 */
class CachierFiles extends Cachier {
// TODO : ESM use... export class CachierFiles extends Cachier {

  /**
   * Constructor
   * @param {TemplateFileOpts} [opts] The {@link TemplateFileOpts}
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
    super(opts instanceof TemplateFileOpts ? opts : new TemplateFileOpts(opts), readFormatter, writeFormatter, log);
  }

  /**
   * Registers and caches the tempalte, one or more partials and/or context within the internal file system. Also creates any missing
   * directories/sub-directories within the {@link TemplateFileOpts} `outputPath` directory from `partialsPath`
   * sub-directories.
   * @override
   * @param {Boolean} [read] When `true`, an attempt will be made to also _read_ any partials using option parameter
   * @param {Object[]} [data] The template, partials and/or context to register.
   * @param {String} partials[].name The name that uniquely identifies the template, partial or context
   * @param {String} [partials[].content] The raw content that will be registered. Omit when `read === true` to read content from cache.
   * @param {URLSearchParams} [partials[].params] The `URLSearchParams` that will be passed during the content `read`
   * (__ignored when `content` is specified__).
   * @param {String} [partials[].extension] Optional override for a file extension designated for a template, partial or context.
   * @param {Boolean} [read] When `true`, an attempt will be made to also {@link Cachier.read} the template, partials and context that
   * __do not have__ a `content` property set.
   * @param {Boolean} [write] When `true`, an attempt will be made to also {@link Cachier.write} the template, partials and context that
   * __have__ a `content` property set.
   * @returns {Object} An object that contains the registration results:
   * 
   * - `data` The object that contains the template, partial fragments and/or context that have been registered
   *   - `name` The name that uniquely identifies the template, partial or context
   *   - `content` The raw content of the template, partial or context
   *   - `extension` The template file extension designation
   *   - `params` The URLSearchParams passed during the __initial__ content read
   *   - `fromRead` A flag that indicates that the data was set from a read operation
   *   - `overrideFromFileRead` A flag that indicates if the passed partial content was overridden by content from a file read
   * - `dirs` Contains the directories/sub-directories that were created
   */
  async register(data, read, write) {
    const ns = internal(this), opts = ns.this.options, log = ns.this.log, src = ns.this.options.partialsPath, dest = opts.outputPath;
    const srtn = await super.register(data, !src || !dest, write), hasSuperPrtls = srtn && srtn.data && srtn.data.length;
    let mkrtn;
    if (src && dest) {
      const prtlPrefix = opts.partialsPath || '';
      await fileStart(ns.at, opts, log, true);
      mkrtn = mkdirpMirror({ Os, Path, Fs, Fsp }, ns.at, opts, ns.this, read, src, dest, prtlPrefix, true, true, log, true);
      if (hasSuperPrtls) mkrtn = await mkrtn;
      else return mkrtn;
    } else if (log.info) {
      log.info('FS: ↩️ Partials read not performed since "partialsPath" and/or "outputPath" options have not been set'
        + ` (partialsPath = "${src}" outputPath = "${dest}")`);
    }
    if (mkrtn && hasSuperPrtls) { // template, partial or context from file reads should always override anything with the same name
      let urld;
      sloop:
      for (let dta of srtn.data) {
        for (let mdta of mkrtn.data) {
          if (mdta.name === dta.name) {
            dta.overrideFromFileRead = true;
            if (log.warn) {
              urld = Cachier.contentURL(dta.name, opts);
              log.warn(`FS: ⚠️ The "options.${urld.optionName}" URL for "${dta.name}" is overridden by the file read`);
            }
            continue sloop;
          }
        }
        mkrtn.data.push(dta);
      }
    } else return mkrtn || srtn;
  }

  /**
   * @override
   * @inheritdoc
   */
  async compile(name, template, params, extension) {
    const ns = internal(this), opts = ns.this.options, log = ns.this.log;
    await fileStart(ns.at, opts, log, true);
    return super.compile(name, template, params, extension);
  }

  /**
   * @override
   * @inheritdoc
   */
  async read(name, forContent, extension, params) {
    const ns = internal(this), opts = ns.this.options, log = ns.this.log;
    const path = await ns.this.readWriteName(name, opts, params, ns.at, forContent, extension);
    return readAndSet({ Os, Path, Fs, Fsp }, name, path, ns.this, forContent, extension, opts, ns.this, log, true);
  }

  /**
   * @override
   * @inheritdoc
   */
  async write(name, data, forContent, extension, params) {
    const ns = internal(this), opts = ns.this.options, log = ns.this.log;
    if (!opts.outputPath || !opts.cacheRawTemplates) return;
    const path = await ns.this.readWriteName(name, opts, params, ns.at, forContent, extension);
    if (log.info && forContent) {
      if (log.info) log.info(`FS: ↩️ Skipping write on template data for "${name}" (name)${extension ? ` "${extension}" (extension)` : ''}`
      + ` to file "${path}"${log.debug ? `:${Os.EOL}${data}` : ''} (compile-time)`);
      return; // template, partial or context is coming from the file system, no need to overwrite any of them
    }
    return writeAndSet({ Os, Path, Fs, Fsp }, name, path, data, ns.at, forContent, extension, opts, ns.this, log, true);
  }

  /**
   * @override
   * @inheritdoc
   */
  get metadata() {
    const ns = internal(this), md = super.metadata;
    md.originDirs = ns.at.originDirs ? [...ns.at.originDirs] : null;
    md.createdDirs = ns.at.createdDirs ? [...ns.at.createdDirs] : null;
    //md.watchedDirs = ns.at.watchedDirs ? [...ns.at.watchedDirs] : null;
    return md;
  }

  /**
   * Clears the output directories and any file watchers
   * @override
   * @param {Boolean} [all=false] `true` to clear all temporary directories created over multiple instances
   */
  async clear(all = false) {
    const ns = internal(this), opts = ns.this.options, log = ns.this.log;
    unwatchers(ns.at.watchers, ns.at.watchedDirs, log, true);
    if (all && opts.outputPathTempPrefix) {
      await cleanTempOutput({ Os, Path, Fs, Fsp }, opts.outputPathTempPrefix, log);
    } else if (opts.outputPath) {
      if (log.info) {
        log.info(`FS: ❌ Clearing "${opts.outputPath}"`);
      }
      await rmrf({ Os, Path, Fs, Fsp }, opts.outputPath);
    }
  }

  /**
   * @override
   * @inheritdoc
   */
  get readWriteNames() {
    const nmrs = super.readWriteNames;
    nmrs.namerSuper = nmrs.namer;
    nmrs.namer = readWriteName;
    return nmrs;
  }

  /**
   * @override
   * @inheritdoc
   */
  get operations() {
    const ops = super.operations;
    const op = Object.freeze({
      read: fileRenderReader,
      write: fileRenderWriter,
      scopes: Object.freeze([
        modules,
        createPath,
        rmrf,
        cleanTempOutput,
        mkdir,
        createReadAndSet,
        readAndSet,
        writeAndSet,
        extractNameParts,
        modularize,
        clearModule,
        watchPartialDir,
        unwatchers,
        mkdirpMirror,
        fileStart
      ])
    });
    if (Array.isArray(ops)) ops.splice(0, 0, op);
    else return [op, ops];
    return ops;
  }
}

// TODO : ESM remove the following lines...
module.exports = CachierFiles;

/**
 * Initializes the file storage
 * @private
 * @ignore
 * @param {Object} store The JSON storage space
 * @param {String[]} [store.createdDirs] The list of directories that have been created (set during invocation)
 * @param {(TemplateFileOpts | Function)} optional Either the options or a `function(name:String):*` that returns an
 * option value by name
 * @param {Object} [log] The log that can contain functions for each of the following: `error`/`warn`/`info`/`debug`
 * @param {Boolean} [isCompile] `true` when compiling, _falsy_ when rendering
 * @returns {Boolean} `true` when `store.createdDirs` already contains directory paths
 */
async function fileStart(store, optional, log, isCompile) {
  const isOptionFunc = typeof optional === 'function';
  const watch = isOptionFunc ? optional('watchPaths') : optional.watchPaths;
  const unwatch = isOptionFunc ? optional('unwatchPaths') : optional.unwatchPaths;
  const opath = isOptionFunc ? optional('outputPath') : optional.outputPath;
  if (unwatch) {
    return true;
  }
  if (!Array.isArray(store.originDirs)) store.originDirs = [];
  if (watch) {
    if (!Array.isArray(store.watchedDirs)) store.watchedDirs = [];
    if (!Array.isArray(store.watchers)) store.watchers = [];
  }
  let hasDirs;
  if (!Array.isArray(store.createdDirs)) {
    const tprefix = isOptionFunc ? optional('outputPathTempPrefix') : optional.outputPathTempPrefix;
    store.createdDirs = tprefix && opath && opath.replace(/\\/g, '/').includes(tprefix.replace(/\\/g, '/')) ? [opath + '/'] : [];
  } else if (store.createdDirs.length) hasDirs = true;
  if (log && log.info) {
    log.info(`FS: 📁 Started cache with template destination set to: "${opath}"`
    + `${hasDirs ? ` with ${store.createdDirs.length} preexisting output directories` : ''} (${isCompile ? 'compile' : 'render'}-time)`);
  }
  return hasDirs;
}

/**
 * File reader that reads the contents of a file during compile-time or render-time
 * @private
 * @ignore
 * @param {String} name The name of template that will be read
 * @param {String} path The path to the template that will be read
 * @param {String} ext The path extension
 * @param {Boolean} forContent The flag indicating that the read is for content. Otherwise, the read is for rendering functions.
 * @param {(TemplateFileOpts | Function)} optional Either the options or a `function(name:String):*` that returns an
 * option value by name
 * @param {URLSearchParams} [params] The search parameters to use for the read 
 * @param {Object} store The JSON storage space
 * @param {String[]} store.createdDirs The list of directories that have been created
 * @param {Function} [readFormatter] The formatting function to use to format the read content
 * @param {Boolean} [close] When `true`, the resources will be closed after execution is complete
 * @param {Object} [log] The log that can contain functions for each of the following: `error`/`warn`/`info`/`debug`
 * @returns {(String | undefined | Boolean)} The read file template content, `undefined` when reading all partial content or `true`
 * to indicate further rendering should __not__ take place
 */
async function fileRenderReader(name, path, ext, forContent, optional, params, store, readFormatter, close, log) {
  const isOptionFunc = typeof optional === 'function';
  const mods = await modules(optional);
  const src = isOptionFunc ? optional('partialsPath') : optional.partialsPath;
  const reg = {
    registerPartial: async (path, content, extension) => {
      if (log && log.info) log.info(`FS: 🗂️ Registering template "${name}" @ "${path}" (render-time)`);
      store[path] = { path, content, extension };
    },
    unregister: path => {
      return Promise.resolve(delete store[path]);
    },
    readFormatter,
    modularize
  };
  if (!path) {
    const watch = isOptionFunc ? optional('watchPaths') : optional.watchPaths
    const unwatch = isOptionFunc ? optional('unwatchPaths') : optional.unwatchPaths;
    if (unwatch) {
      const watchCnt = (store.watchers && store.watchers.length) || 0;
      if (log && log.info) log.info(`FS: 👁️ File unwatch detected (for ${watchCnt} watchers), skipping rendering`);
      if (watchCnt) unwatchers(store.watchers, store.watchedDirs, log);
      return true;
    }
    const dest = isOptionFunc ? optional('outputPath') : optional.outputPath;
    const policy = isOptionFunc ? optional('renderTimePolicy') : optional.renderTimePolicy;
    const readAll = policy.includes('read-all-on-init-when-empty');
    const hadDirs = await fileStart(store, optional, log);
    if (hadDirs) {
      if (watch && src) {
        for (let dir of store.originDirs) {
          if (store.watchedDirs.includes(dir)) continue;
          watchPartialDir(mods, store, optional, reg, dir, src, log);
        }
      }
      return;
    }
    if (!readAll && !watch && Object.getOwnPropertyNames(store.data).length) {
      if (log && log.debug) {
        log.debug(`FS: 📁 Cache initialization from source "${src}" to "${dest}" will be skipped for policy "${optional('renderTimePolicy')}"`);
      }
      return;
    }
    if (src && dest) await mkdirpMirror(mods, store, optional, reg, readAll, src, dest, src, true, true, log);
    return;
  }
  const rtn = await createReadAndSet(mods, forContent, store, optional, reg, path, src, ext, log);
  return rtn.content;
}

/**
 * File writer that writes the contents of a file during compile-time or render-time
 * @private
 * @ignore
 * @param {String} name The name of template that will be written
 * @param {String} path The path to the template that will be written
 * @param {String} ext The path extension
 * @param {Boolean} forContent The flag indicating that the write is for content. Otherwise, the write is for rendering functions.
 * @param {(TemplateFileOpts | Function)} optional Either the options or a `function(name:String):*` that returns an
 * option value by name
 * @param {URLSearchParams} [params] The search parameters to use for the write 
 * @param {Object} store The JSON storage space
 * @param {String[]} store.createdDirs The list of directories that have been created
 * @param {String} data The code block that will be written
 * @param {Function} [writeFormatter] The formatting function to use to format the write content
 * @param {Boolean} [close] When `true`, the resources will be closed after execution is complete
 * @param {Object} [log] The log that can contain functions for each of the following: `error`/`warn`/`info`/`debug`
 * @returns {Function} The rendering function
 */
async function fileRenderWriter(name, path, ext, forContent, optional, params, store, data, writeFormatter, close, log) {
  const isOptionFunc = typeof optional === 'function';
  const src = isOptionFunc ? optional('partialsPath') : optional.partialsPath;
  const mods = await modules(optional);
  const extr = extractNameParts(mods, store, path, src);
  const registrant = { writeFormatter, modularize };
  const rtn = await writeAndSet(mods, extr.name, path, data, store, forContent, extr.extension || ext, optional, registrant, log);
  return rtn && rtn.func;
}

/**
 * Creates an object with all the modules required by {@link CachierFiles}
 * @private
 * @ignore
 * @param {(TemplateFileOpts | Function)} optional Either the options or a `function(name:String):*` that returns an
 * option value by name
 * @returns {Object} mods The modules required by {@link CachierFiles}
 * @returns {Object} mods.Os The [os](https://nodejs.org/docs/latest/api/os.html) module
 * @returns {Object} mods.Path The [path](https://nodejs.org/docs/latest/api/path.html) module
 * @returns {Object} mods.Fs The [fs](https://nodejs.org/docs/latest/api/fs.html) module
 * @returns {Object} mods.Fsp The [fs promises](https://nodejs.org/docs/latest/api/fs.htmll#fs_fs_promises_api) module
 */
async function modules(optional) {
  const cjs = typeof optional === 'function' ? optional('useCommonJs') : optional.useCommonJs;
  const mods = {
    Os: cjs ? require('os') : /*await import('os')*/null,
    Path: cjs ? require('path') : /*await import('path')*/null,
    Fs: cjs ? require('fs') : /*await import('fs')*/null
  };
  mods.Fsp = mods.Fs.promises;
  return mods;
}

/**
 * Creates any missing directories/sub-directories within an output directory from all input sub-directories
 * @private
 * @ignore
 * @param {Object} mods The modules that will be used
 * @param {Object} mods.Os The [os](https://nodejs.org/api/os.html) module
 * @param {Object} mods.Path The [path](https://nodejs.org/api/path.html) module
 * @param {Object} mods.Fs The [fs](https://nodejs.org/api/fs.html) module
 * @param {Object} mods.Fsp The [fs.promises](https://nodejs.org/api/fs.html#fs_fs_promises_api) API
 * @param {Object} store The JSON storage space
 * @param {String[]} storage.createdDirs The list of directories that have been created
 * @param {(TemplateFileOpts | Function)} optional Either the options or a `function(name:String):*` that returns an
 * option value by name
 * @param {Object} registrant The registrant {@link CachierFiles} or similar object
 * @param {Function} registrant.registerPartial The {@link CachierFiles.registerPartial} or similar function
 * @param {Function} registrant.unregister The {@link CachierFiles.unregister} or similar function
 * @param {Function} [registrant.readFormatter] The {@link CachierFiles.readFormatter} or similar function
 * @param {Function} [registrant.writeFormatter] The {@link CachierFiles.writeFormatter} or similar function
 * @param {Function} registrant.modularize The {@link CachierFiles.modularize} or similar function
 * @param {Boolean} read When `true`, an attempt to read parials will be made
 * @param {String} idir The input directory that contains the directories/sub-directories that will be built within the output directories
 * @param {String} odir Then output directory where directories/sub-directories will be created
 * @param {String} [partialPrefix] A prefix path that will be excluded from the name of any partials discovered
 * @param {Boolean} [cleanOutput=false] The flag that indicates that the specified __output__ directory (along with any __sub__ directories) will be
 * __removed__ within the output (if not present)
 * @param {Boolean} [createOutput=true] The flag that indicates that the specified __input__ directory (along with any __parent__ directories) will be
 * __created__ within the output (if not present)
 * @param {Object} [log] The log that can contain functions for each of the following: `error`/`warn`/`info`/`debug`
 * @param {Boolean} [isCompile] `true` when execution is for compilation, _falsy_ when rendering
 * @returns {Object[]} `data` The partial fragments that have been registered
 * @returns {String} `data[].name` The partial name
 * @returns {String} `data[].content` The partial template content
 * @returns {Boolean} `data[].read` The flag indicated that the partial was loaded as a result of a read operation
 * @returns {String[]} `dirs` All the directories/sub-directories that are created within the output directory
 */
async function mkdirpMirror(mods, store, optional, registrant, read, idir, odir, partialPrefix, cleanOutput = false, createOutput = true, log = null, isCompile = false) {
  if (cleanOutput) await rmrf(mods, odir);
  const isOptionFunc = typeof optional === 'function';
  const base = isOptionFunc ? optional('relativeTo') : optional.relativeTo;
  const tbase = (idir.replace(/\\/g, '/').indexOf(partialPrefix) < 0 && partialPrefix) || '';
  const idirResolved = mods.Path.resolve(base, tbase, idir);
  const sdirs = await mods.Fsp.readdir(idirResolved), prtls = [], rtn = { data: [], dirs: [] };
  if (cleanOutput || createOutput) {
    await mkdir(mods, store, odir, log, isCompile);
    rtn.dirs.push(odir);
  }
  const watch = isOptionFunc ? optional('watchPaths') : optional.watchPaths;
  if (watch) watchPartialDir(mods, store, optional, registrant, idirResolved, partialPrefix, log, isCompile);
  if (!store.originDirs.includes(idirResolved)) store.originDirs.push(idirResolved);
  let prtl;
  for (let sdir of sdirs) {
    const indirx = mods.Path.join(idir, sdir), indir = mods.Path.resolve(idirResolved, sdir);
    const stat = await mods.Fsp.stat(indir);
    if (stat.isDirectory()) {
      const outdir = mods.Path.resolve(odir, sdir);
      var hasOut = false;
      try {
        hasOut = store.createdDirs.includes(mods.Path.join(outdir, mods.Path.sep)) || (await mods.Fsp.stat(outdir)).isDirectory();
      } catch (e) {
        hasOut = false;
      }
      if (!hasOut) {
        await mkdir(mods, store, outdir, log, isCompile);
        rtn.dirs.push(outdir);
      }
      const rtnd = await mkdirpMirror(mods, store, optional, registrant, read, indirx, outdir, partialPrefix, false, false, log, isCompile);
      rtn.data = rtnd.data && rtnd.data.length ? rtn.data.concat(rtnd.data) : rtn.data;
      rtn.dirs = rtnd.dirs && rtnd.dirs.length ? rtn.dirs.concat(rtnd.dirs) : rtn.dirs;
      if (watch) watchPartialDir(mods, store, optional, registrant, indir, partialPrefix, log, isCompile);
      if (!store.originDirs.includes(indir)) store.originDirs.push(indir);
    } else if (stat.isFile()) {
      if (read) {
        prtl = createReadAndSet(mods, true, store, optional, registrant, indirx, partialPrefix, null, log, isCompile);
        prtls.push(prtl);
      } else {
        prtl = extractNameParts(mods, store, indirx, partialPrefix);
        prtl.path = indirx;
        rtn.data.push(prtl);
      }
    }
  }
  for (let prtl of prtls) {
    prtl = await prtl;
    rtn.data.push(prtl);
    await registrant.registerPartial(prtl.name, prtl.content, prtl.extension);
  }
  return rtn;
}

/**
 * Calls `Fs.mkdir` when the directory hasn't already been created
 * @private
 * @ignore
 * @param {Object} mods The modules that will be used
 * @param {Object} mods.Os The [os](https://nodejs.org/api/os.html) module
 * @param {Object} mods.Path The [path](https://nodejs.org/api/path.html) module
 * @param {Object} mods.Fs The [fs](https://nodejs.org/api/fs.html) module
 * @param {Object} mods.Fsp The [fs.promises](https://nodejs.org/api/fs.html#fs_fs_promises_api) API
 * @param {Object} store The JSON storage space
 * @param {String[]} storage.createdDirs The list of directories that have been created
 * @param {String} dir The directory to make when missing
 * @param {Object} [log] The log that can contain functions for each of the following: `error`/`warn`/`info`/`debug`
 * @param {Boolean} [isCompile] `true` when execution is for compilation, _falsy_ when rendering
 */
async function mkdir(mods, store, dir, log, isCompile) {
  const fdir = mods.Path.join(dir, mods.Path.sep); // always w/trailing separator
  if (!store.createdDirs.includes(fdir)) {
    if (log && log.info) log.info(`FS: 📁 Creating directory: ${dir} (${isCompile ? 'compile' : 'render'}-time)`);
    await mods.Fsp.mkdir(dir, { recursive: true });
    store.createdDirs.push(fdir);
  }
}

/**
 * Extracts the partial name from a given path and initiates a {@link readAndSet} on the partial
 * @private
 * @ignore
 * @param {Object} mods The modules that will be used
 * @param {Object} mods.Os The [os](https://nodejs.org/api/os.html) module
 * @param {Object} mods.Path The [path](https://nodejs.org/api/path.html) module
 * @param {Object} mods.Fs The [fs](https://nodejs.org/api/fs.html) module
 * @param {Object} mods.Fsp The [fs.promises](https://nodejs.org/api/fs.html#fs_fs_promises_api) API
 * @param {Boolean} forContent The flag indicating that the read is for content. Otherwise, the read is for rendering functions.
 * @param {Object} store The JSON storage space
 * @param {(TemplateFileOpts | Function)} optional Either the options or a `function(name:String):*` that returns an
 * option value by name
 * @param {Object} registrant The registrant {@link CachierFiles} or similar object
 * @param {Function} registrant.registerPartial The {@link CachierFiles.registerPartial} or similar function
 * @param {Function} registrant.unregister The {@link CachierFiles.unregister} or similar function
 * @param {Function} [registrant.readFormatter] The {@link CachierFiles.readFormatter} or similar function
 * @param {Function} registrant.modularize The {@link CachierFiles.modularize} or similar function
 * @param {String} path The path to the partial
 * @param {String} [partialPrefix] A prefix path that will be excluded from the name of the partial
 * @param {String} ext The path extension
 * @param {Object} [log] The log that can contain functions for each of the following: `error`/`warn`/`info`/`debug`
 * @param {Boolean} [isCompile] `true` when execution is for compilation, _falsy_ when rendering
 * @returns {Promise} The promise from {@link readAndSet}
 */
function createReadAndSet(mods, forContent, store, optional, registrant, path, partialPrefix, ext, log, isCompile) {
  const { name, extension } = extractNameParts(mods, store, path, partialPrefix);
  return readAndSet(mods, name, path, store, forContent, extension || ext, optional, registrant, log, isCompile);
}

/**
 * Reads either a template partial or compiled source. When reading a partial, the content will also be registered
 * @private
 * @ignore
 * @param {Object} mods The modules that will be used
 * @param {Object} mods.Os The [os](https://nodejs.org/api/os.html) module
 * @param {Object} mods.Path The [path](https://nodejs.org/api/path.html) module
 * @param {Object} mods.Fs The [fs](https://nodejs.org/api/fs.html) module
 * @param {Object} mods.Fsp The [fs.promises](https://nodejs.org/api/fs.html#fs_fs_promises_api) API
 * @param {String} name The name of the template partial or source to read
 * @param {String} path The full file path to the template partial or source that will be read
 * @param {Object} store The JSON storage space
 * @param {Boolean} forContent `true` for template, partials or context, `false` for sources
 * @param {String} extension The file extension to the file 
 * @param {(TemplateFileOpts | Function)} optional Either the options or a `function(name:String):*` that returns an
 * option value by name
 * @param {Object} registrant The registrant {@link CachierFiles} or similar object
 * @param {Function} registrant.registerPartial The {@link CachierFiles.registerPartial} or similar function
 * @param {Function} registrant.unregister The {@link CachierFiles.unregister} or similar function
 * @param {Function} [registrant.readFormatter] The {@link CachierFiles.readFormatter} or similar function
 * @param {Object} [log] The log that can contain functions for each of the following: `error`/`warn`/`info`/`debug`
 * @param {Boolean} [isCompile] `true` when execution is for compilation, _falsy_ when rendering
 * @returns {Object} [read] The read metadata
 * @returns {String} [read.name] The passed name
 * @returns {String} [read.path] The passed path
 * @returns {String} [read.extension] The file extension used
 * @returns {String} [read.content] The partial content when reading a partial
 * @returns {Boolean} [read.read] `true` when reading a partial
 * @returns {Function} [read.func] The compiled source rendering function when `forContent` is _falsy_
 */
async function readAndSet(mods, name, path, store, forContent, extension, optional, registrant, log, isCompile) {
  if (log && log.info) {
    log.info(`FS: 📖 Reading template ${forContent ? 'partial' : 'code'} for "${name}" (name) from "${path}" (${isCompile ? 'compile' : 'render'}-time)`);
  }
  const isOptionFunc = typeof optional === 'function';
  const encoding = isOptionFunc ? optional('encoding') : optional.encoding;
  const rtn = { name, path, extension };
  if (forContent) {
    rtn.content = (await mods.Fsp.readFile(path, !isOptionFunc ? optional : { encoding })).toString(encoding);
    rtn.read = true;
    if (typeof registrant.readFormatter === 'function' && typeof rtn.content === 'string') {
      const ropts = isOptionFunc ? optional('readFormatOptions') : optional.readFormatOptions;
      rtn.content = registrant.readFormatter(rtn.content, ropts);
    }
    await registrant.registerPartial(rtn.name, rtn.content, rtn.extension);
  } else {
    rtn.func = await modularize(mods, path, true, optional, store);
  }
  return rtn;
}

/**
 * Reads either a template partial or compiled source. When reading a partial, the content will also be registered
 * @private
 * @ignore
 * @param {Object} mods The modules that will be used
 * @param {Object} mods.Os The [os](https://nodejs.org/api/os.html) module
 * @param {Object} mods.Path The [path](https://nodejs.org/api/path.html) module
 * @param {Object} mods.Fs The [fs](https://nodejs.org/api/fs.html) module
 * @param {Object} mods.Fsp The [fs.promises](https://nodejs.org/api/fs.html#fs_fs_promises_api) API
 * @param {String} name The name of the template partial or source to read
 * @param {String} path The full file path to the template partial or source that will be read
 * @param {(String | Function)} data Either the template content (string) or template code (string or function) that will be written
 * @param {Object} store The JSON storage space
 * @param {Boolean} forContent `true` for template, partials or context, `false` for sources
 * @param {String} extension The file extension to the file 
 * @param {(TemplateFileOpts | Function)} optional Either the options or a `function(name:String):*` that returns an
 * option value by name
 * @param {Object} registrant The registrant {@link CachierFiles} or similar object
 * @param {Function} [registrant.writeFormatter] The {@link CachierFiles.writeFormatter} or similar function
 * @param {Object} [log] The log that can contain functions for each of the following: `error`/`warn`/`info`/`debug`
 * @param {Boolean} [isCompile] `true` when execution is for compilation, _falsy_ when rendering
 * @returns {Object} [write] The read metadata
 * @returns {String} [write.name] The passed name
 * @returns {String} [write.path] The passed path
 * @returns {String} [write.extension] The file extension used
 * @returns {String} [write.content] The partial content when writting a partial
 * @returns {Function} [write.func] The compiled source rendering function when `forContent` is _falsy_
 */
async function writeAndSet(mods, name, path, data, store, forContent, extension, optional, registrant, log, isCompile) {
  const isOptionFunc = typeof optional === 'function', logLabel = log ? ` (${isCompile ? 'compile' : 'render'}-time)` : undefined;
  const useCache = isOptionFunc ? optional('cacheRawTemplates') : optional.cacheRawTemplates;
  if (!useCache) {
    if (log && log.info) {
      log.info(`FS: ↩️ Skipping write due to "options.cacheRawTemplates" is turned off for template "${name}" @ "${path}"${logLabel}`);
    }
    return;
  }
  let writePath = mods.Path.isAbsolute(path) ? path : null;
  if (!writePath) {
    if (/^https?:\/?\/?/i.test(path)) return;
    const opath = isOptionFunc ? optional('outputPath') : optional.outputPath;
    writePath = mods.Path.join(opath, path);
  }
  if (log && log.info) {
    log.info(`FS: ✏️ Writting template ${forContent ? 'partial' : 'code'} for "${name}" (name) to file "${writePath}"${logLabel}`);
  }
  const encoding = isOptionFunc ? optional('encoding') : optional.encoding;
  data = !forContent && typeof data === 'function' ? data.toString() : data;
  const dataType = typeof data;
  if (typeof registrant.writeFormatter === 'function' && dataType === 'string') {
    const wopts = isOptionFunc ? optional('writeFormatOptions') : optional.writeFormatOptions;
    data = registrant.writeFormatter(data, wopts);
  }
  if (dataType !== 'string') {
    if (log.info) {
      log.info(`FS: ↩️ Skipping write for unsupported type=${dataType} on template code for "${name}" (name)`
      + ` to file "${writePath}" (forContent? ${forContent})${logLabel}${log.debug ? `: ${mods.Os.EOL}${data}` : ''}`);
    }
    return;
  }
  if (!forContent) {
    const cjs = isOptionFunc ? optional('useCommonJs') : optional.useCommonJs;
    data = `${cjs ? 'module.exports=' : 'export '}${data}`;
  }
  await createPath(mods, store, writePath, log, isCompile);
  await mods.Fsp.writeFile(writePath, data, !isOptionFunc ? optional : { encoding });
  const rtn = { name, path, extension };
  if (forContent) {
    rtn.content = data;
  } else {
    rtn.func = await modularize(writePath, true, optional, store);
  }
  return rtn;
}

/**
 * Extracts a partial name from a partial path
 * @private
 * @ignore
 * @param {Object} mods The modules that will be used
 * @param {Object} mods.Os The [os](https://nodejs.org/api/os.html) module
 * @param {Object} mods.Path The [path](https://nodejs.org/api/path.html) module
 * @param {Object} mods.Fs The [fs](https://nodejs.org/api/fs.html) module
 * @param {Object} mods.Fsp The [fs.promises](https://nodejs.org/api/fs.html#fs_fs_promises_api) API
 * @param {Object} store The JSON storage space
 * @param {String} path The path to the partial
 * @param {String} [partialPrefix] A prefix path that will be excluded from the name of the partial
 * @returns {Object} The parts `{ name:String, extension:String }`
 */
function extractNameParts(mods, store, path, partialPrefix) {
  let name = mods.Path.parse(path), ppx = partialPrefix ? partialPrefix.replace(/\\/g, '/') : '';
  let extension = name.ext;
  name = (extension ? path.replace(extension, '') : path).replace(/\\/g, '/');
  name = ppx ? name.substring(name.indexOf(ppx) + ppx.length).replace(/^\\|\//, '') : name;
  return { name, extension };
}

/**
 * Watches a partial directory for file adds, deletions, etc. and registers or unregisters the
 * partial accordingly
 * @private
 * @ignore
 * @param {Object} mods The modules that will be used
 * @param {Object} mods.Os The [os](https://nodejs.org/api/os.html) module
 * @param {Object} mods.Path The [path](https://nodejs.org/api/path.html) module
 * @param {Object} mods.Fs The [fs](https://nodejs.org/api/fs.html) module
 * @param {Object} mods.Fsp The [fs.promises](https://nodejs.org/api/fs.html#fs_fs_promises_api) API
 * @param {Object} store The JSON storage space
 * @param {Object} registrant The registrant {@link CachierFiles} or similar object
 * @param {Function} registrant.registerPartial The {@link CachierFiles.registerPartial} or similar function
 * @param {Function} registrant.unregister The {@link CachierFiles.unregister} or similar function
 * @param {Function} [registrant.readFormatter] The {@link CachierFiles.readFormatter} or similar function
 * @param {Function} registrant.modularize The {@link CachierFiles.modularize} or similar function
 * @param {String} dir The directory that will be watched
 * @param {String} [partialPrefix] A prefix path that will be excluded from the name of the partial
 * @param {Object} [log] The log that can contain functions for each of the following: `error`/`warn`/`info`/`debug`
 * @param {Boolean} [isCompile] `true` when execution is for compilation, _falsy_ when rendering
 * @returns {Function} The listener function used in the watch
 */
function watchPartialDir(mods, store, optional, registrant, dir, partialPrefix, log, isCompile) {
  const logLabel = log && `(${isCompile ? 'compile' : 'render'}-time)`;
  if (store.watchedDirs.includes(dir)) {
    if (log && log.info) {
      log.info(`FS: 👁️ Watch directory ${dir} already being watched (watching ${store.watchedDirs.length} dirs) ${logLabel}`);
    }
    return;
  }
  const files = {};
  let watcher;
  const filesCachierWatchListener = async (type, filename) => {
    if (!filename) return;
    // throttle multiple changes
    if (files[filename] && files[filename][type] && files[filename][type].wait) return;
    files[filename] = files[filename] || {};
    files[filename][type] = files[filename][type] || {};
    files[filename][type].wait = setTimeout(() => files[filename][type].wait = false, 100);
    var stat, path = mods.Path.join(dir, filename);
    if (!store.watchedDirs || !store.watchedDirs.includes(dir)) {
      if (log && log.info) {
        log.info(`FS: 👁️ Stopping watch directory ${dir} from: "${type}" on ${path} ${logLabel}`);
      }
      watcher.close();
    }
    try {
      stat = await mods.Fsp.stat(path);
      if (!stat.isFile()) stat = null;
    } catch (err) {
      stat = null;
    }
    if (!stat && type === 'rename') { // file has been removed
      const { name, extension } = extractNameParts(mods, store, path, partialPrefix);
      if (log && log.info) {
        const extTxt = extension ? ` (extension: "${extension}")` : '';
        log.info(`FS: 👁️ Watch detected "${type}" unregistering template partial "${name}"${extTxt} from: ${path} ${logLabel}`);
      }
      await registrant.unregister(name);
    } else if (stat) {
      files[filename][type].wait = true;
      if (log && log.info) log.info(`FS: 👁️ Watch detected "${type}" registering template partial from: ${path} ${logLabel}`);
      const prtl = await createReadAndSet(mods, true, store, optional, registrant, path, partialPrefix, null, log, isCompile);
      if (log && log.debug) log.debug(`FS: 👁️ Watch detected "${type}" registering template partial "${prtl.name}" from: ${path} ${logLabel}`);
      files[filename][type].wait = false;
    }
  };
  watcher = mods.Fs.watch(dir, { persistent: false }, filesCachierWatchListener);
  store.watchedDirs.push(dir);
  store.watchers.push(Object.freeze({ dir, isCompile, watcher }));
  if (log && log.info) log.info(`FS: 👁️ Watching template partial directory "${dir}" (watching ${store.watchedDirs.length} dirs) ${logLabel}`);
  return filesCachierWatchListener;
}

/**
 * Unwatches any watchers that may have been set
 * @private
 * @ignore
 * @param {Object[]} [watchers] The watchers set during {@link watchPartialDir}
 * @param {String[]} [watchedDirs] The directories created during {@link watchPartialDir}
 * @param {Object} [log] The log that can contain functions for each of the following: `error`/`warn`/`info`/`debug`
 * @param {Boolean} [isCompile] `true` when execution is for compilation, _falsy_ when rendering
 * @returns {Integer} The number of closed file watchers
 */
function unwatchers(watchers, watchedDirs, log, isCompile) {
  let cnt = 0;
  if (watchers) {
    for (let wtch of watchers) {
      wtch.watcher.close();
      cnt++;
    }
    watchers.length = 0;
  }
  if (watchedDirs) watchedDirs.length = 0;
  if (log && log.info) log.info(`FS: 👁️ Closed ${cnt} file watchers (${isCompile ? 'compile' : 'render'}-time)`);
  return cnt;
}

/**
 * Cleans any temporary directories that were previously generated by {@link CachierFiles}
 * @private
 * @ignore
 * @param {Object} mods The modules that will be used
 * @param {Object} mods.Os The [os](https://nodejs.org/api/os.html) module
 * @param {Object} mods.Path The [path](https://nodejs.org/api/path.html) module
 * @param {Object} mods.Fs The [fs](https://nodejs.org/api/fs.html) module
 * @param {Object} mods.Fsp The [fs.promises](https://nodejs.org/api/fs.html#fs_fs_promises_api) API
 * @param {String} prefix The directory prefix used to designate that the temprorary directory was generated by {@link CachierFiles}
 * @param {Object} [log] The log that can contain functions for each of the following: `error`/`warn`/`info`/`debug`
 */
async function cleanTempOutput(mods, prefix, log) {
  if (!prefix) return;
  if (log && log.info) log.info(`FS: ❌ Clearing ALL temporary dirs that are prefixed with "${prefix}"`);
  const tmp = mods.Os.tmpdir(), tdirs = await mods.Fsp.readdir(tmp), rmProms = [];
  for (let tdir of tdirs) {
    if (tdir.includes(prefix)) {
      if (log && log.info) log.info(`FS: ❌ Removing "${mods.Path.join(tmp, tdir)}"`);
      rmProms.push(rmrf(mods, mods.Path.join(tmp, tdir)));
    }
  }
  return Promise.all(rmProms);
}

/**
 * Removes a directory and any sub directories/files (i.e. `rmdir -rf`)
 * @private
 * @ignore
 * @param {Object} mods The modules that will be used
 * @param {Object} mods.Os The [os](https://nodejs.org/api/os.html) module
 * @param {Object} mods.Path The [path](https://nodejs.org/api/path.html) module
 * @param {Object} mods.Fs The [fs](https://nodejs.org/api/fs.html) module
 * @param {Object} mods.Fsp The [fs.promises](https://nodejs.org/api/fs.html#fs_fs_promises_api) API
 * @param {String} path the directory that will be removed along with any sub-directories/files
 */
async function rmrf(mods, path) {
  var stats, subx;
  try {
    stats = await mods.Fsp.stat(path);
  } catch (e) {
    stats = null;
  }
  if (stats && stats.isDirectory()) {
    for (let sub of await mods.Fsp.readdir(path)) {
      subx = mods.Path.resolve(path, sub);
      stats = await mods.Fsp.stat(subx);
      if (stats.isDirectory()) await rmrf(mods, subx);
      else if (stats.isFile() || stats.isSymbolicLink()) await mods.Fsp.unlink(subx);
    }
    await mods.Fsp.rmdir(path); // dir path should be empty
  } else if (stats && (stats.isFile() || stats.isSymbolicLink())) await mods.Fsp.unlink(path);
}

/**
 * Generates the full name path for a given template name
 * @private
 * @ignore
 * @param {Object} nmrs The naming functions container defined by {@link CachierFiles.readWriteNames}
 * @param {Function} nmrs.namerSuper The naming function defined by the `default` naming function from
 * {@link Cachier.readWriteNames}
 * @param {String} partialName The name of the partial that will be converted into a name suitable for a read operation
 * @param {(TemplateFileOpts | Function(name:String):*)} optional Either the {@link TemplateFileOpts} or a function that takes a
 * single name argument and returns the option value
 * @param {URLSearchParams} [params] The parameters that should be used in the converted name
 * @param {Object} store The storage object that can contain metadata used by naming operations
 * @param {Boolean} forContent The flag indicating if the converted name is being used to capture template, partials or context
 * @param {String} extension The file extension override for the converted name (omit to use the default extension set in the options)
 * @param {Boolean} forContext The flag indicating if the converted name is being used to capture context
 * @returns {String} An name suitable for read/write operations
 */
async function readWriteName(nmrs, name, optional, params, store, forContent, extension, forContext) {
  const fullName = (await nmrs.namerSuper.apply(this, arguments)) || name;
  const isOptionFunc = typeof optional === 'function';
  forContext = forContext || (name === (isOptionFunc ? optional('defaultContextName') : optional.defaultContextName));
  const forTempl = !forContext && (name === (isOptionFunc ? optional('defaultTemplateName') : optional.defaultTemplateName));
  const cjs = isOptionFunc ? optional('useCommonJs') : optional.useCommonJs;
  const Path = cjs ? require('path') : null;/*await import('path')*/
  if (Path.isAbsolute(fullName)) return fullName;

  const isAbs = /^https?:\/?\/?/i.test(fullName), url = new URL(isAbs ? fullName : `http://example.com/${fullName}`);
  const path = url.pathname; // ignore params?

  const bypass = forContext || forContent ? isOptionFunc ? optional('bypassUrlRegExp') : optional.bypassUrlRegExp : null;
  const isBypass = bypass && fullName.match(bypass);
  const base = (!isBypass && (isOptionFunc ? optional('relativeTo') : optional.relativeTo)) || '';
  const pathOpt = forContext ? 'contextPath' : forTempl ? 'templatePath' : 'partialsPath';
  let contentPath = isOptionFunc ? optional(pathOpt) : optional[pathOpt];
  contentPath = forContent && contentPath && path.replace(/\\/g, '/').indexOf(contentPath) < 0 ? contentPath : '';
  let dir = '';
  if (!isBypass && !forContext && !contentPath) {
    dir = (isOptionFunc ? optional('outputPath') : optional.outputPath) || '';
    dir = dir ? `${dir}${dir.endsWith('/') ? '' : '/'}` : '';
  }
  
  const pths = [];
  if (base) pths.push(base);
  if (dir) pths.push(dir);
  if (contentPath) pths.push(contentPath);
  pths.push(path);
  return Path.join(...pths).replace(/\\+|(?:\/\/+)/g, '/');
}

/**
 * Dynamically loads/returns a module from an
 * [`import`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import#Dynamic_Imports)
 * or [`require`](https://nodejs.org/api/modules.html#modules_require_id)
 * @private
 * @ignore
 * @param {String} path The module path to load (with or w/o the file extension)
 * @param {Boolean} [clear] `true` to clear the module from cache (when possible)
 * @param {(TemplateFileOpts | Function(name:String):*)} optional Either the {@link TemplateFileOpts} or a function that takes a
 * single name argument and returns the option value
 * @param {Object} store The storage object that can contain metadata used by naming operations
 * @returns {Function} The modularized function
 */
async function modularize(path, clear, optional, store) {
  if (clear) clearModule(store, optional, path);
  const isOptionFunc = typeof optional === 'function';
  const cjs = isOptionFunc ? optional('useCommonJs') : optional.useCommonJs;
  return cjs ? require(path) : /* TODO : ESM use... await import(path)*/null;
}

/**
 * Clears a module from cache
 * @private
 * @ignore
 * @param {Object} store The JSON storage space
 * @param {(TemplateFileOpts | Function(name:String):*)} optional Either the {@link TemplateFileOpts} or a function that takes a
 * single name argument and returns the option value
 * @param {String} path The path to a module that will be removed
 */
function clearModule(store, optional, path) {
  if (store.sources && store.sources[path]) {
    delete store.sources[path];
  }
  const isOptionFunc = typeof optional === 'function';
  const cjs = isOptionFunc ? optional('useCommonJs') : optional.useCommonJs;
  if (!cjs) return;
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
}

/**
 * Generates a path from an partial template name
 * @private
 * @ignore
 * @param {Object} mods The modules that will be used
 * @param {Object} mods.Os The [os](https://nodejs.org/api/os.html) module
 * @param {Object} mods.Path The [path](https://nodejs.org/api/path.html) module
 * @param {Object} mods.Fs The [fs](https://nodejs.org/api/fs.html) module
 * @param {Object} mods.Fsp The [fs.promises](https://nodejs.org/api/fs.html#fs_fs_promises_api) API
 * @param {Object} store The JSON storage space
 * @param {String[]} store.createdDirs The list of directories that have been created
 * @param {String} path The path to create
 * @param {Object} [log] The log that can contain functions for each of the following: `error`/`warn`/`info`/`debug`
 * @param {Boolean} [isCompile] `true` when execution is for compilation, _falsy_ when rendering
 */
async function createPath(mods, store, path, log, isCompile) {
  const fprts = mods.Path.parse(path);
  if (fprts.ext) fprts.base = fprts.ext = fprts.name = null;
  const fdir = mods.Path.format(fprts);
  if (!store.createdDirs.includes(fdir)) {
    if (log && log.info) log.info(`FS: 📁 Creating directory path (when nonexistent): ${fdir} (${isCompile ? 'compile' : 'render'}-time)`);
    await mods.Fsp.mkdir(fdir, { recursive: true });
    store.createdDirs.push(mods.Path.join(fdir, mods.Path.sep)); // always w/trailing separator
  }
}

// private mapping substitute until the following is adopted: https://github.com/tc39/proposal-class-fields#private-fields
let map = new WeakMap();
let internal = function(object, parent) {
  if (!map.has(object)) map.set(object, {});
  return {
    at: map.get(object),
    this: object
  };
};