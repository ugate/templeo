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
const TMP_PREFIX = 'templeo-cache-files-';

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
   * @param {Object} [logger] The logger for handling logging output
   * @param {Function} [logger.debug] A function that will accept __debug__ level logging messages (i.e. `debug('some message to log')`)
   * @param {Function} [logger.info] A function that will accept __info__ level logging messages (i.e. `info('some message to log')`)
   * @param {Function} [logger.warn] A function that will accept __warning__ level logging messages (i.e. `warn('some message to log')`)
   * @param {Function} [logger.error] A function that will accept __error__ level logging messages (i.e. `error('some message to log')`)
   */
  constructor(opts, formatFunc, logger) {
    super(opts, formatFunc, false);
    const ns = internal(this);
    ns.at.options = opts instanceof TemplateFileOpts ? opts : new TemplateFileOpts(opts);
    ns.at.logger = logger || {};
    ns.at.partialsPath = Path.resolve(ns.at.options.partialsPath);
    if (ns.at.options.watchRegistrationSourcePaths) ns.at.watchers = [];
    ns.at.createdDirs = [];
    const dest = ns.this.outputPath;
    if (ns.at.logger.info) ns.at.logger.info(`Template destination set to: "${dest}"`);
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
    const ns = internal(this), src = ns.at.options.sourcePath, dest = ns.this.outputPath;
    const srtn = await super.registerPartials(partials, false, false), hasSuperPrtls = srtn && srtn.partials && srtn.partials.length;
    var mkrtn;
    if (src && dest) {
      const prtlPrefix = ns.at.options.partialsPath || '';
      mkrtn = mkdirpMirror(ns, read, src, dest, prtlPrefix, true);
      if (hasSuperPrtls) mkrtn = await mkrtn;
      else return mkrtn;
    } else if (ns.at.logger.info) {
      ns.at.logger.info('Partials file read not performed since "sourcePath" and/or "outputPath" options have not been set'
        + ` (sourcePath = "${src}" outputPath = "${dest})"`);
    }
    if (mkrtn && hasSuperPrtls) { // partials from file reads should always override any partials with the same name
      sloop:
      for (let prtl of srtn.partials) {
        for (let mprtl of mkrtn.partials) {
          if (mprtl.name === prtl.name) {
            prtl.overrideFromFileRead = true;
            if (ns.at.logger.warn) {
              ns.at.logger.warn(`The template partial for "${prtl.name}" is overridden by the file read`);
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
  async read(name, forContent, extension) {
    const ns = internal(this), fpth = readWriteName(ns, name, forContent, extension);
    if (ns.at.logger.debug) {
      ns.at.logger.debug(`Reading template ${forContent ? 'partial' : 'code'} for "${name}" (name)`
        + ` from file "${fpth}"`);
    }
    const rtn = { name, extension };
    if (forContent) {
      rtn.content = (await Fsp.readFile(fpth, ns.at.options)).toString(ns.at.options.encoding);
      ns.this.registerPartial(rtn.name, rtn.content, rtn.extension);
    } else {
      rtn.func = await ns.this.modularize(fpth, true);
    }
    return rtn;
  }

  /**
   * @override
   * @inheritdoc
   */
  async write(name, data, forContent, extension) {
    if (!this.isWritable) return;
    const ns = internal(this), fpth = readWriteName(ns, name, forContent, extension);
    if (!forContent) await createPath(ns, fpth);
    if (ns.at.logger.debug) {
      ns.at.logger.debug(`${forContent ? 'Skipping write on' : 'Writting'} template ${forContent ? 'partial' : 'code'}`
        + ` for "${name}" (name)${extension ? ` "${extension}" (extension)` : ''} to file "${fpth}":${Os.EOL}${data}`);
    }
    if (forContent) return; // partials are coming from the file system, no need to overwrite them

    const dataType = typeof data;
    var writable = dataType === 'function' ? Sandbox.serialzeFunction(data) : null;
    if (writable && !ns.at.isFormatOnRead && ns.at.formatter) {
      writable = ns.at.formatter(writable, ns.at.options.formatOptions);
    }

    if (!writable && dataType !== 'string') {
      if (ns.at.logger.debug) {
        ns.at.logger.debug(`Skipping write for unsupported type=${dataType} on template ${forContent ? 'partial' : 'code'}`
          + ` for "${name}" (name) to file "${fpth}":${Os.EOL}${data}`);
      }
      return;
    }

    data = writable || data;
    if (!forContent) data = `${ns.at.options.useCommonJs ? 'module.exports=' : 'export '}${data}`;
    return Fsp.writeFile(fpth, data, ns.at.options);
  }

  /**
   * @override
   * @inheritdoc
   */
  get isWritable() {
    return !!this.outputPath && super.isWritable;
  }

  /**
   * Clears the output directories and any file watchers
   * @override
   * @param {Boolean} [all=false] `true` to clear all temporary directories created over multiple instances
   */
  async clear(all = false) {
    const ns = internal(this);
    if (ns.at.watchers) {
      for (let watcher of ns.at.watchers) {
        watcher.close();
      }
      ns.at.watchers.length = 0;
    }
    if (all) {
      if (ns.at.logger.info) {
        ns.at.logger.info(`Clearing ALL temporary dirs that start with "${TMP_PREFIX}"`);
      }
      await cleanTempOutput(TMP_PREFIX);
    }
    if (ns.this.outputPath) {
      if (ns.at.logger.info) {
        ns.at.logger.info(`Clearing "${ns.this.outputPath}"`);
      }
      await rmrf(ns.this.outputPath);
      ns.at.outputPath = null;
    }
  }

  /**
   * @override
   * @inheritdoc
   */
  async modularize(id, clear) {
    const ns = internal(this);
    if (clear) clearModule(ns, id);
    return ns.at.options.useCommonJs ? require(id) : /* TODO : ESM use... await import(id)*/null;
  }

  /**
   * @returns {String} The destination path where files will be written to (typically during a {@link registerPartials},
   * but also can occur during {@link write})
   */
  get outputPath() {
    const ns = internal(this);
    ns.at.outputPath = ns.at.outputPath || ns.at.options.outputPath;
    if (!ns.at.outputPath) {
      const tpth = Fs.mkdtempSync(Path.join(Os.tmpdir(), TMP_PREFIX));
      ns.at.outputPath = tpth;
      ns.at.createdDirs.push(Path.join(tpth, Path.sep));
    }
    return ns.at.outputPath;
  }
}

// TODO : ESM remove the following lines...
module.exports = CachierFiles;

/**
 * Creates any missing directories/sub-directories within an output directory from all input sub-directories
 * @private
 * @ignore
 * @param {Object} ns The {@link CachierFiles} namespace
 * @param {Boolean} read When `true`, an attempt to read parials will be made
 * @param {String} idir The input directory that contains the directories/sub-directories that will be built within the output directories
 * @param {String} odir Then output directory where directories/sub-directories will be created
 * @param {String} [partialPrefix] A prefix path that will be excluded from the name of any partials discovered
 * @param {Boolean} [cleanOutput=false] The flag that indicates that the specified __output__ directory (along with any __sub__ directories) will be
 * __removed__ within the output (if not present)
 * @param {Boolean} [createOutput=true] The flag that indicates that the specified __input__ directory (along with any __parent__ directories) will be
 * __created__ within the output (if not present)
 * @returns {Object} An object that contains: `{ partials: [{ name: String, content: String, read: String }], dirs: String[] }` where
 * `partials` are the fragments that have been registered and `dirs` are all the
 * directories/sub-directories that are created within the output directory.
 */
async function mkdirpMirror(ns, read, idir, odir, partialPrefix, cleanOutput = false, createOutput = true) {
  if (cleanOutput) await rmrf(odir);
  const sdirs = await Fsp.readdir(idir), prtls = [], rtn = { partials: [], dirs: [] }, logger = ns.at.logger;
  if (cleanOutput || createOutput) {
    await mkdir(ns, odir);
    rtn.dirs.push(odir);
  }
  const watch = ns.at.options.watchRegistrationSourcePaths;
  if (watch) watchPartialDir(ns, idir, partialPrefix);
  let prtl;
  for (let sdir of sdirs) {
    const indirx = Path.join(idir, sdir), indir = Path.resolve(ns.at.options.templatePathBase, idir, sdir);
    const stat = await Fsp.stat(indir);
    if (stat.isDirectory()) {
      const outdir = Path.resolve(odir, sdir);
      var hasOut = false;
      try {
        hasOut = ns.at.createdDirs.includes(Path.join(outdir, Path.sep)) || (await Fsp.stat(outdir)).isDirectory();
      } catch (e) {
        hasOut = false;
      }
      if (!hasOut) {
        await mkdir(ns, outdir);
        rtn.dirs.push(outdir);
        if (logger.info) logger.info(`Created template directory: ${outdir}`);
      }
      const rtnd = await mkdirpMirror(ns, read, indirx, outdir, partialPrefix, false, false);
      rtn.partials = rtnd.partials && rtnd.partials.length ? rtn.partials.concat(rtnd.partials) : rtn.partials;
      rtn.dirs = rtnd.dirs && rtnd.dirs.length ? rtn.dirs.concat(rtnd.dirs) : rtn.dirs;
      if (watch) watchPartialDir(ns, indir, partialPrefix);
    } else if (stat.isFile()) {
      if (read) {
        prtl = readPartial(ns, indir, indirx, partialPrefix);
        prtl.read = true;
        prtls.push(prtl);
      } else {
        prtl = extractNameParts(ns, indirx, partialPrefix);
        prtl.path = indirx;
        prtl.read = false;
        rtn.partials.push(prtl);
      }
    }
  }
  for (let prtl of prtls) {
    prtl = await prtl;
    rtn.partials.push(prtl);
    if (logger.info) logger.info(`Registering template partial "${prtl.name}"`);
    ns.this.registerPartial(prtl.name, prtl.content);
  }
  return rtn;
}

/**
 * Calls `Fs.mkdir` when the directory hasn't already been created
 * @private
 * @ignore
 * @param {Object} ns The {@link CachierFiles} namespace
 * @param {String} dir The directory to make when missing
 */
async function mkdir(ns, dir) {
  const fdir = Path.join(dir, Path.sep); // always w/trailing separator
  if (!ns.at.createdDirs.includes(fdir)) {
    await Fsp.mkdir(dir, { recursive: true });
    ns.at.createdDirs.push(fdir);
  }
}

/**
 * Extracts the partial name from a given path and initiates a {@link CachierFiles.read} on the partial
 * @private
 * @ignore
 * @param {Object} ns The {@link CachierFiles} namespace
 * @param {String} dir The directory path where the partial resides
 * @param {String} path The path to the partial
 * @param {String} [partialPrefix] A prefix path that will be excluded from the name of the partial
 * @returns {Promise} The promise from {@link CachierFiles.read}
 */
function readPartial(ns, dir, path, partialPrefix) {
  const { name, extension } = extractNameParts(ns, path, partialPrefix), logger = ns.at.logger;
  if (logger.debug) logger.debug(`Reading template partial "${name}" from: ${dir}`);
  return ns.this.read(name, true, extension);
}

/**
 * Extracts a partial name from a partial path
 * @private
 * @ignore
 * @param {Object} ns The {@link CachierFiles} namespace
 * @param {String} path The path to the partial
 * @param {String} [partialPrefix] A prefix path that will be excluded from the name of the partial
 * @returns {Object} The parts `{ name:String, extension:String }`
 */
function extractNameParts(ns, path, partialPrefix) {
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
 * @param {Object} ns The {@link CachierFiles} namespace
 * @param {String} dir The directory that will be watched
 * @param {String} [partialPrefix] A prefix path that will be excluded from the name of the partial
 * @returns {Function} The listener function used in the watch
 */
function watchPartialDir(ns, dir, partialPrefix) {
  const files = {}, logger = ns.at.logger;
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
      const { name, extension } = extractNameParts(ns, path, partialPrefix);
      if (logger.info) {
        const extTxt = extension ? ` (extension: "${extension}")` : '';
        logger.info(`Unregistering watched "${type}" template partial "${name}"${extTxt} from: ${path}`);
      }
      ns.this.unregister(name);
    } else if (stat) {
      files[filename][type].wait = true;
      const prtl = await readPartial(ns, dir, path, partialPrefix);
      files[filename][type].wait = false;
      if (logger.info) logger.info(`Registering watched "${type}" template partial "${prtl.name}" from: ${path}`);
      ns.this.registerPartial(prtl.name, prtl.content);
    }
  };
  const watcher = Fs.watch(dir, partialWatchListener);
  if (ns.at.watchers) ns.at.watchers.push(watcher);
  if (logger.info) logger.info(`Watching template partial directory "${dir}"`);
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
 * @param {Object} ns The {@link CachierFiles} namespace
 * @param {String} name The template name that uniquely identifies the template content
 * @param {Boolean} [forContent] `true` to load a template content, `false` to load the template module
 * @param {Boolean} [create] `true` to create the output directory path when not already created
 */
async function createPath(ns, path) {
  const fprts = Path.parse(path);
  if (fprts.ext) fprts.base = fprts.ext = fprts.name = null;
  const fdir = Path.format(fprts);
  if (!ns.at.createdDirs.includes(fdir)) {
    if (ns.at.logger.info) ns.at.logger.info(`Creating template directory: ${fdir}`);
    await Fsp.mkdir(fdir, { recursive: true });
    ns.at.createdDirs.push(Path.join(fdir, Path.sep)); // always w/trailing separator
  }
}

/**
 * Clears a module from cache
 * @private
 * @ignore
 * @param {Object} ns The {@link CachierFiles} namespace
 * @param {String} path The path to a module that will be removed
 */
function clearModule(ns, path) {
  if (ns.at.dbx.sources[path]) delete ns.at.dbx.partials[path];
  if (!ns.at.options.useCommonJs) return;
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
 * Generates the full name path for a given template name (__internal use only__).
 * @private
 * @ignore
 * @param {Object} ns The {@link CachierFiles} namespace
 * @param {String} fpth The template path that uniquely identifies the template content
 * @param {Boolean} [forContent] `true` to read a template content, `false` to read the template source code
 * @param {String} [extension] The file extension designation for the template
 * @returns {String} The full template path
 */
function readWriteName(ns, name, forContent, extension) {
  const fpth = ns.this.readWriteName(name, ns.at.options, forContent, extension);
  if (Path.isAbsolute(fpth)) return fpth;
  const pths = [];
  const base = forContent ? ns.at.options.templatePathBase : ns.at.outputPath;
  const prtl = forContent && fpth.indexOf(ns.at.options.partialsPath) < 0 && ns.at.options.partialsPath;
  if (base) pths.push(base);
  if (prtl) pths.push(prtl);
  pths.push(fpth);
  return Path.join(...pths);
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