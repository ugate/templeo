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
   * directories/sub-directories within the {@link TemplateFileOpts} `outputPath` directory from `sourcePath`
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
   * - `dirs` The directories/sub-directories that were created within the `outputPath` directory
   */
  async registerPartials(partials, read, write) {
    const ns = internal(this), opts = ns.this.options, log = ns.this.log, src = ns.this.options.sourcePath, dest = opts.outputPath;
    const srtn = await super.registerPartials(partials, false, false), hasSuperPrtls = srtn && srtn.partials && srtn.partials.length;
    var mkrtn;
    if (src && dest) {
      const prtlPrefix = opts.partialsPath || '';
      await fileStart(ns.at, opts, log);
      mkrtn = mkdirpMirror(ns.at, opts, ns.this, read, src, dest, prtlPrefix, true, true, log);
      if (hasSuperPrtls) mkrtn = await mkrtn;
      else return mkrtn;
    } else if (log.info) {
      log.info('Partials file read not performed since "sourcePath" and/or "outputPath" options have not been set'
        + ` (sourcePath = "${src}" outputPath = "${dest})"`);
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
    return readAndSet(name, path, forContent, extension, opts, ns.this, log);
  }

  /**
   * @override
   * @inheritdoc
   */
  async write(name, data, forContent, extension, params) {
    if (!this.isWritable) return;
    const ns = internal(this), opts = ns.this.options, log = ns.this.log;
    const fpth = await ns.this.readWriteName(name, opts, params, ns.at, forContent, extension);
    if (!forContent) await createPath(ns.at, fpth);
    if (log.debug) {
      log.debug(`${forContent ? 'Skipping write on' : 'Writting'} template ${forContent ? 'partial' : 'code'}`
        + ` for "${name}" (name)${extension ? ` "${extension}" (extension)` : ''} to file "${fpth}":${Os.EOL}${data}`);
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
    if (!forContent) data = `${opts.useCommonJs ? 'module.exports=' : 'export '}${data}`;
    return Fsp.writeFile(fpth, data, opts);
  }

  /**
   * @override
   * @inheritdoc
   */
  get isWritable() {
    return !!this.options.outputPath && super.isWritable;
  }

  /**
   * Clears the output directories and any file watchers
   * @override
   * @param {Boolean} [all=false] `true` to clear all temporary directories created over multiple instances
   */
  async clear(all = false) {
    const ns = internal(this), opts = ns.this.options, log = ns.this.log;
    if (ns.at.watchers) {
      for (let watcher of ns.at.watchers) {
        watcher.close();
      }
      ns.at.watchers.length = 0;
    }
    if (all && opts.outputPathTempPrefix) {
      if (log.info) {
        log.info(`Clearing ALL temporary dirs that are prefixed with "${opts.outputPathTempPrefix}"`);
      }
      await cleanTempOutput(opts.outputPathTempPrefix);
    } else if (opts.outputPath) {
      if (log.info) {
        log.info(`Clearing "${opts.outputPath}"`);
      }
      await rmrf(opts.outputPath);
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
    if (Array.isArray(nmrs)) nmrs.push(readWriteName);
    else return [nmrs, readWriteName];
    return nmrs;
  }

  /**
   * @override
   * @inheritdoc
   */
  get readers() {
    const ns = internal(this);
    const rdrs = super.readers;
    const rdr = Object.freeze({
      read: fileReader,
      start: fileStart,
      hasReadAllOnInit: !!ns.at.createdDirs, // only make dirs when not already created during registerPartials
      scopes: Object.freeze([
        mkdirpMirror,
        mkdir,
        readAndRegisterPartial,
        readAndSet,
        extractNameParts,
        createPath,
        cleanTempOutput,
        rmrf,
        clearModule
      ])
    });
    if (Array.isArray(rdrs)) rdrs.splice(0, 0, rdr);
    else return [rdr, rdrs];
    return rdrs;
  }
}

// TODO : ESM remove the following lines...
module.exports = CachierFiles;

/**
 * Initializes the file storage
 * @private
 * @ignore
 * @param {Object} storage The JSON storage space
 * @param {(TemplateDBOpts | Function)} optional Either the options or a `function(name:String):*` that returns an
 * option value by name
 * @param {Object} [log] The log that can contain functions for each of the following: `error`/`warn`/`info`/`debug`
 */
async function fileStart(storage, optional, log) {
  const isOptionFunc = typeof optional === 'function';
  if (storage.createdDirs) return;
  const cjs = isOptionFunc ? optional('useCommonJs') : optional.useCommonJs;
  const Path = cjs ? require('path') : /*await import('path')*/null;
  const watch = isOptionFunc ? optional('watchRegistrationSourcePaths') : optional.watchRegistrationSourcePaths;
  const tprefix = isOptionFunc ? optional('outputPathTempPrefix') : optional.outputPathTempPrefix;
  const opath = isOptionFunc ? optional('outputPath') : optional.outputPath;
  if (watch) storage.watchers = [];
  storage.createdDirs = tprefix && opath && opath.includes(tprefix) ? [Path.join(opath, Path.sep)] : [];
  if (log && log.info) log.info(`Files cache started with template destination set to: "${opath}"`);
}

async function fileReader(name, optional, params, storage, close, log) {
  const isOptionFunc = typeof optional === 'function';
  const cjs = isOptionFunc ? optional('useCommonJs') : optional.useCommonJs;
  const Os = cjs ? require('os') : /*await import('os')*/null;
  const Path = cjs ? require('path') : /*await import('path')*/null;
  const Fs = cjs ? require('fs') : /*await import('fs')*/null;
  const Fsp = Fs.promises;
  const prtl = isOptionFunc ? optional('partialsPath') : optional.partialsPath;
  const reg = {
    registerPartial: async (name, content, extension) => {
      storage[name] = { name, content, extension };
    },
    unregister: name => {
      delete storage[name];
    },
    modularize: async (id, clear) => {
      if (clear) clearModule(storage, optional, id);
      return cjs ? require(id) : /* TODO : ESM use... await import(id)*/null;
    }
  };
  if (!name) {
    const src = isOptionFunc ? optional('sourcePath') : optional.sourcePath;
    const dest = isOptionFunc ? optional('outputPath') : optional.outputPath;
    return mkdirpMirror(storage, optional, reg, true, src, dest, prtl, true, true, log);
  }
  const rtn = await readAndRegisterPartial(storage, optional, reg, name, prtl, log);
  return rtn.content;
}

/**
 * Creates any missing directories/sub-directories within an output directory from all input sub-directories
 * @private
 * @ignore
 * @param {Object} storage The JSON storage space
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
 * @returns {Object[]} `partials` The partial fragments that have been registered
 * @returns {String} `partials[].name` The partial name
 * @returns {String} `partials[].content` The partial template content
 * @returns {Boolean} `partials[].read` The flag indicated that the partial was loaded as a result of a read operation
 * @returns {String[]} `dirs` All the directories/sub-directories that are created within the output directory
 */
async function mkdirpMirror(storage, optional, registrant, read, idir, odir, partialPrefix, cleanOutput = false, createOutput = true, log = null) {
  if (cleanOutput) await rmrf(odir);
  const sdirs = await Fsp.readdir(idir), prtls = [], rtn = { partials: [], dirs: [] };
  if (cleanOutput || createOutput) {
    await mkdir(storage, odir, log);
    rtn.dirs.push(odir);
  }
  const isOptionFunc = typeof optional === 'function';
  const watch = isOptionFunc ? optional('watchRegistrationSourcePaths') : optional.watchRegistrationSourcePaths;
  const tbase = isOptionFunc ? optional('templatePathBase') : optional.templatePathBase;
  if (watch) watchPartialDir(storage, optional, registrant, idir, partialPrefix, log);
  let prtl, isRead;
  for (let sdir of sdirs) {
    const indirx = Path.join(idir, sdir), indir = Path.resolve(tbase, idir, sdir);
    const stat = await Fsp.stat(indir);
    if (stat.isDirectory()) {
      const outdir = Path.resolve(odir, sdir);
      var hasOut = false;
      try {
        hasOut = storage.createdDirs.includes(Path.join(outdir, Path.sep)) || (await Fsp.stat(outdir)).isDirectory();
      } catch (e) {
        hasOut = false;
      }
      if (!hasOut) {
        await mkdir(storage, outdir, log);
        rtn.dirs.push(outdir);
        if (log && log.info) log.info(`Created template directory: ${outdir}`);
      }
      const rtnd = await mkdirpMirror(storage, optional, read, indirx, outdir, partialPrefix, false, false);
      rtn.partials = rtnd.partials && rtnd.partials.length ? rtn.partials.concat(rtnd.partials) : rtn.partials;
      rtn.dirs = rtnd.dirs && rtnd.dirs.length ? rtn.dirs.concat(rtnd.dirs) : rtn.dirs;
      if (watch) watchPartialDir(storage, optional, registrant, indir, partialPrefix, log);
    } else if (stat.isFile()) {
      if (read) {
        prtl = readAndRegisterPartial(storage, optional, registrant, indirx, partialPrefix, log);
        prtls.push(prtl);
      } else {
        prtl = extractNameParts(storage, indirx, partialPrefix);
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
 * @param {Object} storage The JSON storage space
 * @param {String[]} storage.createdDirs The list of directories that have been created
 * @param {String} dir The directory to make when missing
 * @param {Object} [log] The log that can contain functions for each of the following: `error`/`warn`/`info`/`debug`
 */
async function mkdir(storage, dir, log) {
  const fdir = Path.join(dir, Path.sep); // always w/trailing separator
  if (!storage.createdDirs.includes(fdir)) {
    await Fsp.mkdir(dir, { recursive: true });
    if (log && log.info) log.info(`Created directory: ${dir}`);
    storage.createdDirs.push(fdir);
  }
}

/**
 * Extracts the partial name from a given path and initiates a {@link readAndSet} on the partial
 * @private
 * @ignore
 * @param {Object} storage The JSON storage space
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
function readAndRegisterPartial(storage, optional, registrant, path, partialPrefix, log) {
  const { name, extension } = extractNameParts(storage, path, partialPrefix);
  if (log && log.debug) log.debug(`Reading template partial "${name}" from: ${path}`);
  return readAndSet(name, path, true, extension, optional, registrant, log);
}

/**
 * Reads either a template partial or compiled source. When reading a partial, the content will also be registered
 * @private
 * @ignore
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
async function readAndSet(name, path, forContent, extension, optional, registrant, log) {
  if (log.debug) {
    log.debug(`Reading template ${forContent ? 'partial' : 'code'} for "${name}" (name) from file "${path}"`);
  }
  const isOptionFunc = typeof optional === 'function';
  const encoding = isOptionFunc ? optional('encoding') : optional.encoding;
  const rtn = { name, path, extension };
  if (forContent) {
    rtn.content = (await Fsp.readFile(name, !isOptionFunc ? optional : { encoding })).toString(encoding);
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
 * @param {Object} storage The JSON storage space
 * @param {String} path The path to the partial
 * @param {String} [partialPrefix] A prefix path that will be excluded from the name of the partial
 * @returns {Object} The parts `{ name:String, extension:String }`
 */
function extractNameParts(storage, path, partialPrefix) {
  let name = Path.parse(path), ppx = partialPrefix ? partialPrefix.replace(/\\/g, '/') : '';
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
 * @param {Object} storage The JSON storage space
 * @param {Object} registrant The registrant {@link CachierFiles} or similar object
 * @param {Function} registrant.registerPartial The {@link CachierFiles.registerPartial} or similar function
 * @param {Function} registrant.unregister The {@link CachierFiles.unregister} or similar function
 * @param {String} dir The directory that will be watched
 * @param {String} [partialPrefix] A prefix path that will be excluded from the name of the partial
 * @param {Object} [log] The log that can contain functions for each of the following: `error`/`warn`/`info`/`debug`
 * @returns {Function} The listener function used in the watch
 */
function watchPartialDir(storage, optional, registrant, dir, partialPrefix, log) {
  const files = {};
  const partialWatchListener = async (type, filename) => {
    if (!filename) return;
    if (files[filename] && files[filename][type] && files[filename][type].wait) return;
    files[filename] = files[filename] || {};
    files[filename][type] = files[filename][type] || {};
    files[filename][type].wait = setTimeout(() => files[filename][type].wait = false, 100);
    var stat, path = Path.join(dir, filename);
    try {
      stat = await Fsp.stat(path);
      if (!stat.isFile()) stat = null;
    } catch (err) {
      stat = null;
    }
    if (!stat && type === 'rename') {
      const { name, extension } = extractNameParts(storage, path, partialPrefix);
      if (log && log.info) {
        const extTxt = extension ? ` (extension: "${extension}")` : '';
        log.info(`Unregistering watched "${type}" template partial "${name}"${extTxt} from: ${path}`);
      }
      registrant.unregister(name);
    } else if (stat) {
      files[filename][type].wait = true;
      const prtl = await readAndRegisterPartial(storage, optional, registrant, path, partialPrefix, log);
      files[filename][type].wait = false;
      if (log && log.info) log.info(`Registering watched "${type}" template partial "${prtl.name}" from: ${path}`);
      await registrant.registerPartial(prtl.name, prtl.content);
    }
  };
  const watcher = Fs.watch(dir, partialWatchListener);
  if (storage.watchers) storage.watchers.push(watcher);
  if (log && log.info) log.info(`Watching template partial directory "${dir}"`);
  return partialWatchListener;
}

/**
 * Cleans any temporary directories that were previously generated by {@link CachierFiles}
 * @private
 * @ignore
 * @param {String} prefix The directory prefix used to designate that the temprorary directory was generated by {@link CachierFiles}
 */
async function cleanTempOutput(prefix) {
  if (!prefix) return;
  const tmp = Os.tmpdir(), tdirs = await Fsp.readdir(tmp), rmProms = [];
  for (let tdir of tdirs) {
    if (tdir.includes(prefix)) rmProms.push(rmrf(Path.join(tmp, tdir)));
  }
  return Promise.all(rmProms);
}

/**
 * Removes a directory and any sub directories/files (i.e. `rmdir -rf`)
 * @private
 * @ignore
 * @param {String} path the directory that will be removed along with any sub-directories/files
 */
async function rmrf(path) {
  var stats, subx;
  try {
    stats = await Fsp.stat(path);
  } catch (e) {
    stats = null;
  }
  if (stats && stats.isDirectory()) {
    for (let sub of await Fsp.readdir(path)) {
      subx = Path.resolve(path, sub);
      stats = await Fsp.stat(subx);
      if (stats.isDirectory()) await rmrf(subx);
      else if (stats.isFile() || stats.isSymbolicLink()) await Fsp.unlink(subx);
    }
    await Fsp.rmdir(path); // dir path should be empty
  } else if (stats && (stats.isFile() || stats.isSymbolicLink())) await Fsp.unlink(path);
}

/**
 * Generates a path from an partial template name
 * @private
 * @ignore
 * @param {Object} storage The JSON storage space
 * @param {String} path The path to create
 * @param {Object} [log] The log that can contain functions for each of the following: `error`/`warn`/`info`/`debug`
 */
async function createPath(storage, path, log) {
  const fprts = Path.parse(path);
  if (fprts.ext) fprts.base = fprts.ext = fprts.name = null;
  const fdir = Path.format(fprts);
  if (!storage.createdDirs.includes(fdir)) {
    if (log && log.info) log.info(`Creating template directory: ${fdir}`);
    await Fsp.mkdir(fdir, { recursive: true });
    storage.createdDirs.push(Path.join(fdir, Path.sep)); // always w/trailing separator
  }
}

/**
 * Generates the full name path for a given template name
 * @private
 * @ignore
 * @param {String} partialName The name of the partial that will be converted into a name suitable for a read operation
 * @param {(TemplateFileOpts | Function(name:String):*)} optional Either the {@link TemplateFileOpts} or a function that takes a
 * single name argument and returns the option value
 * @param {URLSearchParams} [params] The parameters that should be used in the converted name
 * @param {Object} storage The storage object that can contain metadata used by naming operations
 * @param {Boolean} forContent The flag indicating if the converted name is being used to capture partials
 * @param {String} extension The file extension override for the converted name (omit to use the default extension set in the options)
 * @param {Boolean} forContext The flag indicating if the converted name is being used to capture context
 * @param {String} [named] The name returned by a prior reader invocation from {@link CachierFiles.readers}
 */
async function readWriteName(name, optional, params, storage, forContent, extension, forContext, named) {
  const fullName = named || name;
  const isOptionFunc = typeof optional === 'function';
  const cjs = isOptionFunc ? optional('useCommonJs') : optional.useCommonJs;
  const Path = cjs ? require('path') : /*await import('path')*/null;
  if (Path.isAbsolute(fullName)) return fullName;

  const partialsPath = isOptionFunc ? optional('partialsPath') : optional.partialsPath;
  const pathOptName = forContext ? 'contextPathBase' : forContent ? 'templatePathBase' : 'outputPath';
  const bypassOptName = forContext ? 'contextPathBaseBypass' : forContent ? 'templatePathBaseBypass' : null;
  const pathBypass = bypassOptName ? isOptionFunc ? optional(bypassOptName) : optional[bypassOptName] : null;
  const isBypass = pathBypass && name.match(pathBypass);
  const isAbs = /^https?:\/?\/?/i.test(fullName), url = new URL(isAbs ? fullName : `http://example.com/${fullName}`);
  const path = url.pathname; // ignore params?

  const pths = [];
  const base = (!isBypass && (isOptionFunc ? optional(pathOptName) : optional[pathOptName])) || '';
  const prtl = forContent && path.indexOf(partialsPath) < 0 && partialsPath;
  if (base) pths.push(base);
  if (prtl) pths.push(prtl);
  pths.push(path);
  return Path.join(...pths);
}

/**
 * Clears a module from cache
 * @private
 * @ignore
 * @param {Object} storage The JSON storage space
 * @param {(TemplateFileOpts | Function(name:String):*)} optional Either the {@link TemplateFileOpts} or a function that takes a
 * single name argument and returns the option value
 * @param {String} path The path to a module that will be removed
 */
function clearModule(storage, optional, path) {
  if (storage.sources && storage.sources[path]) {
    delete storage.sources[path];
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

// private mapping substitute until the following is adopted: https://github.com/tc39/proposal-class-fields#private-fields
let map = new WeakMap();
let internal = function(object, parent) {
  if (!map.has(object)) map.set(object, {});
  return {
    at: map.get(object),
    this: object
  };
};