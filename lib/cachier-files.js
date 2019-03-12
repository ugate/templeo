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
   * @param {Function} [formatFunc] The `function(string, formatOptions)` that will return a formatted string when __writting__
   * data using the `formatOptions` from {@link TemplateFileOpts} as the formatting options.
   * @param {Object} [log] The log for handling logging output
   * @param {Function} [log.debug] A function that will accept __debug__ level logging messages (i.e. `debug('some message to log')`)
   * @param {Function} [log.info] A function that will accept __info__ level logging messages (i.e. `info('some message to log')`)
   * @param {Function} [log.warn] A function that will accept __warning__ level logging messages (i.e. `warn('some message to log')`)
   * @param {Function} [log.error] A function that will accept __error__ level logging messages (i.e. `error('some message to log')`)
   */
  constructor(opts, formatFunc, log) {
    super(opts instanceof TemplateFileOpts ? opts : new TemplateFileOpts(opts), formatFunc, false, log);
  }

  /**
   * Registers and caches one or more partial templates within the internal file system. Also creates any missing
   * directories/sub-directories within the {@link TemplateFileOpts} `compiledPath` directory from `partialsPath`
   * sub-directories.
   * @override
   * @param {Object[]} partials The partials to register
   * @param {String} partials[].name The template name that uniquely identifies the template content
   * @param {String} partials[].content The partial template content to register
   * @param {String} [partials[].extension] Optional override for a file extension designation for the partial
   * @param {Object} [includes[].params] The JSON parameters that will be added to scope as `options.includesParametersName` when
   * the template is parsed
   * @param {Boolean} [read] When `true`, an attempt will be made to also _read_ any partials using option parameter
   * @returns {Object} An object that contains the registration results:
   * 
   * The returned registration results object that contains the following properties:
   * - `partials` The partials object that contains the template fragments that have been registered
   *   - `name` The template name that uniquely identifies the template content
   *   - `content` The template content
   *   - `extension` The template file extension designation
   *   - `params` The JSON template parameters added to the partial's scope
   *   - `read` A flag that indicates if the partial is from a read operation
   *   - `overrideFromFileRead` A flag that indicates if the passed partial content was overridden by content from a file read
   * - `dirs` The directories/sub-directories that were created within the `compiledPath` directory
   */
  async registerPartials(partials, read, write) {
    const ns = internal(this), opts = ns.this.options, log = ns.this.log, src = ns.this.options.partialsPath, dest = opts.compiledPath;
    const srtn = await super.registerPartials(partials, !src || !dest, write), hasSuperPrtls = srtn && srtn.partials && srtn.partials.length;
    var mkrtn;
    if (src && dest) {
      const prtlPrefix = opts.partialsPath || '';
      await fileStart(ns.at, opts, log, true);
      mkrtn = mkdirpMirror({ Os, Path, Fs, Fsp }, ns.at, opts, ns.this, read, src, dest, prtlPrefix, true, true, log);
      if (hasSuperPrtls) mkrtn = await mkrtn;
      else return mkrtn;
    } else if (log.info) {
      log.info('Partials file read not performed since "partialsPath" and/or "compiledPath" options have not been set'
        + ` (partialsPath = "${src}" compiledPath = "${dest})"`);
    }
    if (mkrtn && hasSuperPrtls) { // partials from file reads should always override any partials with the same name
      sloop:
      for (let prtl of srtn.partials) {
        for (let mprtl of mkrtn.partials) {
          if (mprtl.name === prtl.name) {
            prtl.overrideFromFileRead = true;
            if (log.warn) {
              log.warn(`The template partial for "${prtl.name}" is overridden by the file read`);
            }
            continue sloop;
          }
        }
        mkrtn.partials.push(prtl);
      }
    } else return mkrtn || srtn;
  }

  /**
   * @override
   * @inheritdoc
   */
  async read(name, forContent, extension, params) {
    const ns = internal(this), opts = ns.this.options, log = ns.this.log;
    const path = await ns.this.readWriteName(name, opts, params, ns.at, forContent, extension);
    return readAndSet({ Os, Path, Fs, Fsp }, name, path, forContent, extension, opts, ns.this, log);
  }

  /**
   * @override
   * @inheritdoc
   */
  async write(name, data, forContent, extension, params) {
    if (!this.isWritable) return;
    const ns = internal(this), opts = ns.this.options, log = ns.this.log;
    const fpth = await ns.this.readWriteName(name, opts, params, ns.at, forContent, extension);
    if (!forContent) { // writing source code file/module
      fileStart(ns.at, opts, log, true);
      await createPath(ns.at, fpth);
    }
    if (log.info) {
      log.info(`${forContent ? 'Skipping write on' : 'Writting'} template ${forContent ? 'partial' : 'code'}`
        + ` for "${name}" (name)${extension ? ` "${extension}" (extension)` : ''} to file "${fpth}"${log.debug ? `:${Os.EOL}${data}` : ''}`);
    }
    if (forContent) return; // partials are coming from the file system, no need to overwrite them

    const dataType = typeof data;
    var writable = dataType === 'function' ? Sandbox.serialzeFunction(data) : null;
    if (writable && !ns.at.isFormatOnRead && ns.at.formatter) {
      writable = ns.at.formatter(writable, opts.formatOptions);
    }

    if (!writable && dataType !== 'string') {
      if (log.debug) {
        log.debug(`Skipping write for unsupported type=${dataType} on template ${forContent ? 'partial' : 'code'}`
          + ` for "${name}" (name) to file "${fpth}":${Os.EOL}${data}`);
      }
      return;
    }

    data = writable || data;
    if (!forContent) {
      data = `${opts.useCommonJs ? 'module.exports=' : 'export '}${data}`;
      await Fsp.writeFile(fpth, data, opts);
      return ns.this.modularize(fpth, true);
    }
    return Fsp.writeFile(fpth, data, opts);
  }

  /**
   * @override
   * @inheritdoc
   */
  get isWritable() {
    return !!this.options.compiledPath && super.isWritable;
  }

  /**
   * @override
   * @inheritdoc
   */
  get metadata() {
    const ns = internal(this);
    return {
      createdDirs: ns.at.createdDirs,
      watchedDirs: ns.at.watchedDirs
    };
  }

  /**
   * Clears the output directories and any file watchers
   * @override
   * @param {Boolean} [all=false] `true` to clear all temporary directories created over multiple instances
   */
  async clear(all = false) {
    const ns = internal(this), opts = ns.this.options, log = ns.this.log;
    if (ns.at.watchers) {
      for (let wtch of ns.at.watchers) {
        wtch.watcher.close();
      }
      ns.at.watchers.length = 0;
    }
    if (all && opts.compiledPathTempPrefix) {
      await cleanTempOutput({ Os, Path, Fs, Fsp }, opts.compiledPathTempPrefix, log);
    } else if (opts.compiledPath) {
      if (log.info) {
        log.info(`Clearing "${opts.compiledPath}"`);
      }
      await rmrf({ Os, Path, Fs, Fsp }, opts.compiledPath);
    }
  }

  /**
   * @override
   * @inheritdoc
   */
  async modularize(id, clear) {
    const ns = internal(this), opts = ns.this.options;
    if (clear) clearModule(ns.at, opts, id);
    return opts.useCommonJs ? require(id) : /* TODO : ESM use... await import(id)*/null;
  }

  /**
   * @override
   * @inheritdoc
   */
  get readWriteNames() {
    const nmrs = super.readWriteNames;
    nmrs.cachier = nmrs.namer;
    nmrs.namerOnReadError = nmrs.namer;
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
      read: fileReader,
      start: fileStart,
      scopes: Object.freeze([
        mkdirpMirror,
        mkdir,
        readAndRegisterPartial,
        readAndSet,
        extractNameParts,
        cleanTempOutput,
        rmrf,
        clearModule
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
 * @param {String[]} [store.watchers] The list of `FSWatcher`s added when watching files/dirsfor changes
 * @param {(TemplateDBOpts | Function)} optional Either the options or a `function(name:String):*` that returns an
 * option value by name
 * @param {Object} [log] The log that can contain functions for each of the following: `error`/`warn`/`info`/`debug`
 * @param {Boolean} [isCompile] `true` when compiling, _falsy_ when rendering
 * @returns {Boolean} `true` when rendering should __not__ continue
 */
async function fileStart(store, optional, log, isCompile) {
  const isOptionFunc = typeof optional === 'function';
  const cjs = isOptionFunc ? optional('useCommonJs') : optional.useCommonJs;
  const Path = cjs ? require('path') : /*await import('path')*/null;
  const watch = isOptionFunc ? optional('watchPartials') : optional.watchPartials;
  const unwatch = isOptionFunc ? optional('unwatchPartials') : optional.unwatchPartials;
  const opath = isOptionFunc ? optional('compiledPath') : optional.compiledPath;
  if (unwatch) {
    return true;
  }
  if (watch) {
    store.watchers = [];
    if (!Array.isArray(store.watchedDirs)) store.watchedDirs = [];
  }
  if (!Array.isArray(store.createdDirs)) {
    const tprefix = isOptionFunc ? optional('compiledPathTempPrefix') : optional.compiledPathTempPrefix;
    store.createdDirs = tprefix && opath && opath.replace(/\\/g, '/').includes(tprefix.replace(/\\/g, '/')) ? [Path.join(opath, Path.sep)] : [];
  }
  if (log && log.info) log.info(`Starting Files Cache with template destination set to: "${opath}" (${isCompile ? 'compile' : 'render'}-time)`);
}

/**
 * File reader that reads the contents of a file during compile-time or render-time
 * @param {String} name The name of template that will be read
 * @param {(TemplateDBOpts | Function)} optional Either the options or a `function(name:String):*` that returns an
 * option value by name
 * @param {URLSearchParams} [params] The search parameters to use for the read 
 * @param {Object} store The JSON storage space
 * @param {String[]} store.createdDirs The list of directories that have been created
 * @param {String[]} [store.watchers] The list of `FSWatcher`s added when watching files/dirsfor changes
 * @param {Boolean} [close] When `true`, the resources will be closed after execution is complete
 * @param {Object} [log] The log that can contain functions for each of the following: `error`/`warn`/`info`/`debug`
 * @returns {(String | undefined)} The read file template content or `undefined` when reading all partial content
 */
async function fileReader(name, optional, params, store, close, log) {
  const isOptionFunc = typeof optional === 'function';
  const cjs = isOptionFunc ? optional('useCommonJs') : optional.useCommonJs;
  const mods = {
    Os: cjs ? require('os') : /*await import('os')*/null,
    Path: cjs ? require('path') : /*await import('path')*/null,
    Fs: cjs ? require('fs') : /*await import('fs')*/null
  };
  mods.Fsp = mods.Fs.promises;
  const src = isOptionFunc ? optional('partialsPath') : optional.partialsPath;
  const reg = {
    registerPartial: async (name, content, extension) => {
      store[name] = { name, content, extension };
    },
    unregister: name => {
      delete store[name];
    },
    modularize: async (id, clear) => {
      if (clear) clearModule(store, optional, id);
      return cjs ? require(id) : /* TODO : ESM use... await import(id)*/null;
    }
  };
  if (!name) {
    const dest = isOptionFunc ? optional('compiledPath') : optional.compiledPath;
    const readAll = optional('renderTimeReadPolicy') === 'read-all-on-init-when-empty';
    if (!readAll && !optional('watchPartials') && Object.getOwnPropertyNames(store.partials).length) {
      if (log && log.debug) {
        log.debug(`Files cache initialization from source "${src}" to "${dest}" will be skipped for policy "${optional('renderTimeReadPolicy')}"`);
      }
      return;
    }
    await mkdirpMirror(mods, store, optional, reg, readAll, src, dest, src, true, true, log, true);
    return;
  }
  const rtn = await readAndRegisterPartial(mods, store, optional, reg, name, src, log);
  return rtn.content;
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
 * @param {String[]} [storage.watchers] The list of `FSWatcher`s added when watching files/dirsfor changes
 * @param {(TemplateDBOpts | Function)} optional Either the options or a `function(name:String):*` that returns an
 * option value by name
 * @param {Object} registrant The registrant {@link CachierFiles} or similar object
 * @param {Function} registrant.registerPartial The {@link CachierFiles.registerPartial} or similar function
 * @param {Function} registrant.unregister The {@link CachierFiles.unregister} or similar function
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
 * @param {Boolean} [rendering=false] `true` when rendering, _falsy_ when compiling
 * @returns {Object[]} `partials` The partial fragments that have been registered
 * @returns {String} `partials[].name` The partial name
 * @returns {String} `partials[].content` The partial template content
 * @returns {Boolean} `partials[].read` The flag indicated that the partial was loaded as a result of a read operation
 * @returns {String[]} `dirs` All the directories/sub-directories that are created within the output directory
 */
async function mkdirpMirror(mods, store, optional, registrant, read, idir, odir, partialPrefix, cleanOutput = false, createOutput = true, log = null, rendering = false) {
  if (cleanOutput) await rmrf(mods, odir);
  const isOptionFunc = typeof optional === 'function';
  const base = isOptionFunc ? optional('relativeTo') : optional.relativeTo;
  const tbase = (idir.replace(/\\/g, '/').indexOf(partialPrefix) < 0 && partialPrefix) || '';
  const idirResolved = mods.Path.resolve(base, tbase, idir);
  const sdirs = await mods.Fsp.readdir(idirResolved), prtls = [], rtn = { partials: [], dirs: [] };
  if (cleanOutput || createOutput) {
    await mkdir(mods, store, odir, log);
    rtn.dirs.push(odir);
  }
  const watch = isOptionFunc ? optional('watchPartials') : optional.watchPartials;
  if (watch) watchPartialDir(mods, store, optional, registrant, idirResolved, partialPrefix, log, rendering);
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
        await mkdir(mods, store, outdir, log);
        rtn.dirs.push(outdir);
        if (log && log.info) log.info(`Created template directory: ${outdir}`);
      }
      const rtnd = await mkdirpMirror(mods, store, optional, registrant, read, indirx, outdir, partialPrefix, false, false, log, rendering);
      rtn.partials = rtnd.partials && rtnd.partials.length ? rtn.partials.concat(rtnd.partials) : rtn.partials;
      rtn.dirs = rtnd.dirs && rtnd.dirs.length ? rtn.dirs.concat(rtnd.dirs) : rtn.dirs;
      if (watch) watchPartialDir(mods, store, optional, registrant, indir, partialPrefix, log, rendering);
    } else if (stat.isFile()) {
      if (read) {
        prtl = readAndRegisterPartial(mods, store, optional, registrant, indirx, partialPrefix, log);
        prtls.push(prtl);
      } else {
        prtl = extractNameParts(mods, store, indirx, partialPrefix);
        prtl.path = indirx;
        rtn.partials.push(prtl);
      }
    }
  }
  for (let prtl of prtls) {
    prtl = await prtl;
    rtn.partials.push(prtl);
    if (log && log.info) log.info(`Registering template partial "${prtl.name}"`);
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
 */
async function mkdir(mods, store, dir, log) {
  const fdir = mods.Path.join(dir, mods.Path.sep); // always w/trailing separator
  if (!store.createdDirs.includes(fdir)) {
    if (log && log.info) log.info(`Creating directory: ${dir}\nPreviously created directories:\n${store.createdDirs.join('\n')})`);
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
 * @param {Object} store The JSON storage space
 * @param {(TemplateDBOpts | Function)} optional Either the options or a `function(name:String):*` that returns an
 * option value by name
 * @param {Object} registrant The registrant {@link CachierFiles} or similar object
 * @param {Function} registrant.registerPartial The {@link CachierFiles.registerPartial} or similar function
 * @param {Function} registrant.unregister The {@link CachierFiles.unregister} or similar function
 * @param {Function} registrant.modularize The {@link CachierFiles.modularize} or similar function
 * @param {String} path The path to the partial
 * @param {String} [partialPrefix] A prefix path that will be excluded from the name of the partial
 * @param {Object} [log] The log that can contain functions for each of the following: `error`/`warn`/`info`/`debug`
 * @returns {Promise} The promise from {@link readAndSet}
 */
function readAndRegisterPartial(mods, store, optional, registrant, path, partialPrefix, log) {
  const { name, extension } = extractNameParts(mods, store, path, partialPrefix);
  if (log && log.debug) log.debug(`Reading template partial "${name}" from: ${path}`);
  return readAndSet(mods, name, path, true, extension, optional, registrant, log);
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
 * @param {Boolean} forContent `true` for partials, `false` for sources
 * @param {String} extension The file extension to the file 
 * @param {(TemplateDBOpts | Function)} optional Either the options or a `function(name:String):*` that returns an
 * option value by name
 * @param {Object} registrant The registrant {@link CachierFiles} or similar object
 * @param {Function} registrant.registerPartial The {@link CachierFiles.registerPartial} or similar function
 * @param {Function} registrant.unregister The {@link CachierFiles.unregister} or similar function
 * @param {Function} registrant.modularize The {@link CachierFiles.modularize} or similar function
 * @param {Object} [log] The log that can contain functions for each of the following: `error`/`warn`/`info`/`debug`
 * @returns {Object} [read] The read metadata
 * @returns {String} [read.name] The passed name
 * @returns {String} [read.path] The passed path
 * @returns {String} [read.extension] The file extension used
 * @returns {String} [read.content] The partial content when reading a partial
 * @returns {Boolean} [read.read] `true` when reading a partial
 * @returns {Function} [read.func] The compiled source rendering function when `forContent` is _falsy_
 */
async function readAndSet(mods, name, path, forContent, extension, optional, registrant, log) {
  if (log && log.info) {
    log.info(`Reading template ${forContent ? 'partial' : 'code'} for "${name}" (name) from file "${path}"`);
  }
  const isOptionFunc = typeof optional === 'function';
  const encoding = isOptionFunc ? optional('encoding') : optional.encoding;
  const rtn = { name, path, extension };
  if (forContent) {
    rtn.content = (await mods.Fsp.readFile(path, !isOptionFunc ? optional : { encoding })).toString(encoding);
    rtn.read = true;
    await registrant.registerPartial(rtn.name, rtn.content, rtn.extension);
  } else {
    rtn.func = await registrant.modularize(path, true);
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
 * @param {String[]} [store.watchers] The list of `FSWatcher`s added when watching files/dirsfor changes
 * @param {Object} registrant The registrant {@link CachierFiles} or similar object
 * @param {Function} registrant.registerPartial The {@link CachierFiles.registerPartial} or similar function
 * @param {Function} registrant.unregister The {@link CachierFiles.unregister} or similar function
 * @param {String} dir The directory that will be watched
 * @param {String} [partialPrefix] A prefix path that will be excluded from the name of the partial
 * @param {Object} [log] The log that can contain functions for each of the following: `error`/`warn`/`info`/`debug`
 * @param {Boolean} [rendering] `true` when rendering, _falsy_ when compiling
 * @returns {Function} The listener function used in the watch
 */
function watchPartialDir(mods, store, optional, registrant, dir, partialPrefix, log, rendering) {
  const isOptionFunc = typeof optional === 'function';
  const files = {};
  let watcher;
  const partialWatchListener = async (type, filename) => {
    if (!filename) return;
    // throttle multiple changes
    if (files[filename] && files[filename][type] && files[filename][type].wait) return;
    files[filename] = files[filename] || {};
    files[filename][type] = files[filename][type] || {};
    files[filename][type].wait = setTimeout(() => files[filename][type].wait = false, 100);
    var stat, path = mods.Path.join(dir, filename);
    if (!store.watchedDirs || !store.watchedDirs.includes(dir)) {
      if (log && log.info) {
        log.info(`Stopping watch directory ${dir}${store.watchedDirs ? ` in ${store.watchedDirs.join()}` : ''} (from: "${type}" on ${path})`);
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
        log.info(`Unregistering watched "${type}" template partial "${name}"${extTxt} from: ${path}`);
      }
      registrant.unregister(name);
    } else if (stat) {
      files[filename][type].wait = true;
      const prtl = await readAndRegisterPartial(mods, store, optional, registrant, path, partialPrefix, log);
      files[filename][type].wait = false;
      if (log && log.info) log.info(`Registered watched "${type}" template partial "${prtl.name}" from: ${path}`);
    }
  };
  watcher = mods.Fs.watch(dir, { persistent: false }, partialWatchListener);
  store.watchers.push({ dir, watcher });
  store.watchedDirs.push(dir);
  if (log && log.info) log.info(`Watching template partial directory "${dir}"`);
  return partialWatchListener;
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
  if (log && log.info) log.info(`Clearing ALL temporary dirs that are prefixed with "${prefix}"`);
  const tmp = mods.Os.tmpdir(), tdirs = await mods.Fsp.readdir(tmp), rmProms = [];
  for (let tdir of tdirs) {
    if (tdir.includes(prefix)) {
      if (log && log.info) log.info(`Removing "${mods.Path.join(tmp, tdir)}"`);
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
 * @param {Function} nmrs.cachier The naming function defined by the `default` naming function from {@link Cachier.readWriteNames}
 * @param {String} partialName The name of the partial that will be converted into a name suitable for a read operation
 * @param {(TemplateFileOpts | Function(name:String):*)} optional Either the {@link TemplateFileOpts} or a function that takes a
 * single name argument and returns the option value
 * @param {URLSearchParams} [params] The parameters that should be used in the converted name
 * @param {Object} store The storage object that can contain metadata used by naming operations
 * @param {Boolean} forContent The flag indicating if the converted name is being used to capture partials
 * @param {String} extension The file extension override for the converted name (omit to use the default extension set in the options)
 * @param {Boolean} forContext The flag indicating if the converted name is being used to capture context
 * @returns {String} An name suitable for read/write operations
 */
async function readWriteName(nmrs, name, optional, params, store, forContent, extension, forContext) {
  const fullName = (await nmrs.cachier.apply(this, arguments)) || name;
  const isOptionFunc = typeof optional === 'function';
  const cjs = isOptionFunc ? optional('useCommonJs') : optional.useCommonJs;
  const Path = cjs ? require('path') : /*await import('path')*/null;
  if (Path.isAbsolute(fullName)) return fullName;

  const isAbs = /^https?:\/?\/?/i.test(fullName), url = new URL(isAbs ? fullName : `http://example.com/${fullName}`);
  const path = url.pathname; // ignore params?

  const bypass = forContext || forContent ? isOptionFunc ? optional('bypassUrlRegExp') : optional.bypassUrlRegExp : null;
  const isBypass = bypass && fullName.match(bypass);
  const base = (!isBypass && (isOptionFunc ? optional('relativeTo') : optional.relativeTo)) || '';
  const partialsPath = isOptionFunc ? optional('partialsPath') : optional.partialsPath;
  const prtl = forContent && path.replace(/\\/g, '/').indexOf(partialsPath) < 0 && partialsPath;
  let dir = '';
  if (!isBypass && !forContext && !forContext && !prtl) {
    dir = (isOptionFunc ? optional('compiledPath') : optional.compiledPath) || '';
    dir = dir ? `${dir}${dir.endsWith('/') ? '' : '/'}` : '';
  }
  
  const pths = [];
  if (base) pths.push(base);
  if (dir) pths.push(dir);
  if (prtl) pths.push(prtl);
  pths.push(path);
  return Path.join(...pths);
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
 * @param {Object} store The JSON storage space
 * @param {String[]} store.createdDirs The list of directories that have been created
 * @param {String} path The path to create
 * @param {Object} [log] The log that can contain functions for each of the following: `error`/`warn`/`info`/`debug`
 */
async function createPath(store, path, log) {
  const fprts = Path.parse(path);
  if (fprts.ext) fprts.base = fprts.ext = fprts.name = null;
  const fdir = Path.format(fprts);
  if (!store.createdDirs.includes(fdir)) {
    if (log && log.info) log.info(`Creating template directory: ${fdir}`);
    await Fsp.mkdir(fdir, { recursive: true });
    store.createdDirs.push(Path.join(fdir, Path.sep)); // always w/trailing separator
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