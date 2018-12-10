'use strict';

const EngineFileOpts = require('./engine-file-opts');
const Cachier = require('./cachier');
const Os = require('os');
const Fs = require('fs');
const Path = require('path');
// TODO : ESM uncomment the following lines...
// TODO : import * as EngineFileOpts from './engine-file-opts.mjs';
// TODO : import * as Cachier from './cachier.mjs';
// TODO : import * as Os from 'os';
// TODO : import * as Fs from 'fs';
// TODO : import * as Path from 'path';

const Fsp = Fs.promises;
const TMP_PREFIX = 'templeo-cache-files-';

/**
 * Node.js [file]{@link https://nodejs.org/api/fs.html} persistence for compiled templates
 * @private
 */
class CachierFiles extends Cachier {
// TODO : ESM use... export class CachierFiles extends Cachier {

  /**
   * Constructor
   * @param {EngineFileOpts} [opts] The {@link EngineFileOpts}
   * @param {Function} [formatFunc] The `function(string, formatOptions)` that will return a formatted string when __writting__
   * data using the `formatOptions` from {@link EngineFileOpts} as the formatting options.
   */
  constructor(opts, formatFunc) {
    super(opts, formatFunc, false);
    const ns = Cachier.internal(this);
    ns.at.options = opts;
    ns.at.pathPartials = Path.resolve(ns.at.options.pathPartials);
    if (ns.at.options.pathScanSrcWatch) ns.at.watchers = [];
    ns.this.pathScanDest;
  }

  /**
   * Creates any missing directories/sub-directories within the {@link EngineFileOpts} `pathScanDest` directory from `pathScanSrc`
   * sub-directories
   * @override
   * @param {Function} [registerPartial] A `function(name, data)` that will register any partials found during the scan
   * @param {Function} [unregisterPartial] A `function(name)` that will unregister any partials that are removed after the scan
   * (ignored when `registerPartial` is missing or the option for `pathScanSrcWatch` is not true)
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
    const ns = Cachier.internal(this), src = ns.at.options.pathScanSrc, dest = ns.this.pathScanDest;
    const srtn = registerPartial && ns.at.options.partials ? await super.scan(registerPartial, unregisterPartial) : null;
    var mkrtn;
    if (src && dest) {
      const prtlPrefix = (registerPartial && ns.at.options.pathPartials) || '';
      mkrtn = mkdirpMirror(ns, src, dest, registerPartial, unregisterPartial, prtlPrefix, true);
      if (srtn) mkrtn = await mkrtn;
      else return mkrtn;
    } else if (ns.at.options.logger.info) {
      ns.at.options.logger.info('File scan not performed since "pathScanSrc" and/or "pathScanDest" options have not been set'
        + ` (pathScanSrc = "${src}" pathScanDest = "${dest})"`);
    }
    if (mkrtn && srtn) { // partials from file scans should always override any options.partials with the same name
      sloop:
      for (let prtl of srtn.partials) {
        for (let mprtl of mkrtn.partials) {
          if (mprtl.name === prtl.name) {
            if (ns.at.options.logger.warn) {
              ns.at.options.logger.warn(`The template partial for "${prtl.name}" in "options.partials" is overridden by the file scan`);
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
  async generateCode(name, code, write = true, store = true) {
    const ns = Cachier.internal(this);
    const rtn = await super.generateCode(name, code, false, store); // never write since the coded is written to file
    rtn.coded = `${ns.at.options.useCommonJs ? 'module.exports=' : 'export '}${rtn.coded}`;
    if (write) await ns.this.write(name, rtn.coded);
    return rtn;
  }

  /**
   * @override
   * @inheritdoc
   */
  async read(name, forContent) {
    const ns = Cachier.internal(this), id = ns.this.identity(name, forContent), fpth = pathify(ns, id, forContent);
    if (ns.at.options.logger.debug) {
      ns.at.options.logger.debug(`Reading template ${forContent ? 'partial' : 'code'} for "${name}" (name)/"${id}" (ID)`
        + ` from file "${fpth}"`);
    }
    const rtn = { name, id }, data = await Fsp.readFile(fpth, ns.at.options);
    if (forContent) rtn.content = data;
    else rtn.code = data;
    return rtn;
  }

  /**
   * @override
   * @inheritdoc
   */
  async write(name, data, forContent) {
    if (!this.isWritable) return;
    const ns = Cachier.internal(this), id = ns.this.identity(name, forContent), fpth = pathify(ns, id, forContent);
    if (ns.at.options.logger.debug) {
      ns.at.options.logger.debug(`${forContent ? 'Skipping write on' : 'Writting'} template ${forContent ? 'partial' : 'code'}`
        + ` for "${name}" (name)/"${id}" (ID) to file "${fpth}":${Os.EOL}${data.content || data}`);
      if (forContent) return; // partials are coming from the file system, no need to overwrite them
    }
    return Fsp.writeFile(fpth, data.content || data, ns.at.options);
  }

  /**
   * @override
   * @inheritdoc
   */
  get isWritable() {
    return !!this.pathScanDest;
  }

  /**
   * @override
   * @inheritdoc
   */
  identity(name, forContent) {
    const ns = Cachier.internal(this);
    var id = name;
    if (!forContent && ns.at.options.pathScanFileExt) id += '.' + ns.at.options.pathScanFileExt;
    else id = super.identity(id, forContent);
    return id;
  }

  /**
   * Clears the output directories and any file watchers
   * @override
   * @param {Boolean} [all=false] `true` to clear all temporary directories created over multiple instances
   */
  async clear(all = false) {
    const ns = Cachier.internal(this);
    if (ns.at.watchers) {
      for (let watcher of ns.at.watchers) {
        watcher.close();
      }
      ns.at.watchers.length = 0;
    }
    if (all) {
      if (ns.at.options.logger.info) {
        ns.at.options.logger.info(`Clearing all temporary dirs that start with "${TMP_PREFIX}"`);
      }
      await cleanTempOutput(TMP_PREFIX);
    }
    if (ns.this.pathScanDest) {
      if (ns.at.options.logger.info) {
        ns.at.options.logger.info(`Clearing "${ns.this.pathScanDest}"`);
      }
      await rmrf(ns.this.pathScanDest);
      ns.at.pathScanDest = null;
    }
  }

  /**
   * @returns {String} The destination path where files will be written to (typically during a {@link scan}, but also can occur
   * during {@link write})
   */
  get pathScanDest() {
    const ns = Cachier.internal(this);
    ns.at.pathScanDest = ns.at.pathScanDest || ns.at.options.pathScanDest || Fs.mkdtempSync(Path.join(Os.tmpdir(), TMP_PREFIX));
    return ns.at.pathScanDest;
  }
}

// TODO : ESM remove the following lines...
module.exports = CachierFiles;

/**
 * Creates any missing directories/sub-directories within an output directory from all input sub-directories
 * @private
 * @ignore
 * @param {Object} ns The {@link CachierFiles} namespace
 * @param {String} idir The input directory that contains the directories/sub-directories that will be built within the output directories
 * @param {String} odir Then output directory where directories/sub-directories will be created
 * @param {Function} [registerPartial] A `function(name, data)` that will register a partial
 * @param {Function} [unregisterPartial] A `function(name)` that will unregister a partial
 * @param {String} [partialPrefix] A prefix path that will be excluded from the name of any partials discovered (ignored when `registerPartial` is omitted)
 * @param {Boolean} [cleanOutput=false] The flag that indicates that the specified __output__ directory (along with any __sub__ directories) will be
 * __removed__ within the output (if not present)
 * @param {Boolean} [createOutput=true] The flag that indicates that the specified __input__ directory (along with any __parent__ directories) will be
 * __created__ within the output (if not present)
 * @returns {Object} An object that contains: `{ partials: [{ name: String, content: String }], dirs: String[] }` where
 * `partials` are the fragments that have been registered (empty when `registerPartial` is omitted) and `dirs` are all the
 * directories/sub-directories that are created within the output directory.
 */
async function mkdirpMirror(ns, idir, odir, registerPartial, unregisterPartial, partialPrefix, cleanOutput = false, createOutput = true) {
  if (cleanOutput) await rmrf(odir);
  if (cleanOutput || createOutput) await Fsp.mkdir(odir, { recursive: true });
  const sdirs = await Fsp.readdir(idir), prtls = [], rtn = { partials: [], dirs: [] }, logger = ns.at.options.logger;
  const watch = registerPartial && ns.at.options.pathScanSrcWatch;
  if (watch) watchPartialDir(ns, idir, registerPartial, unregisterPartial, partialPrefix);
  for (let sdir of sdirs) {
    const indirx = Path.join(idir, sdir), indir = Path.resolve(ns.at.options.pathBase, idir, sdir), stat = await Fsp.stat(indir);
    if (stat.isDirectory()) {
      const outdir = Path.resolve(odir, sdir);
      var hasOut = false;
      try {
        hasOut = (await Fsp.stat(outdir)).isDirectory();
      } catch (e) {
        hasOut = false;
      }
      if (!hasOut) {
        await Fsp.mkdir(outdir);
        rtn.dirs.push(outdir);
        if (logger.info) logger.info(`Created template directory: ${outdir}`);
      }
      const rtnd = await mkdirpMirror(ns, indirx, outdir, registerPartial, unregisterPartial, partialPrefix, false, false);
      rtn.partials = rtnd.partials && rtnd.partials.length ? rtn.partials.concat(rtnd.partials) : rtn.partials;
      rtn.dirs = rtnd.dirs && rtnd.dirs.length ? rtn.dirs.concat(rtnd.dirs) : rtn.dirs;
      if (watch) watchPartialDir(ns, indir, registerPartial, unregisterPartial, partialPrefix);
    } else if (registerPartial && stat.isFile()) prtls.push(readPartial(ns, indir, indirx, partialPrefix, registerPartial));
  }
  for (let prtl of prtls) {
    prtl = await prtl;
    rtn.partials.push(prtl);
    if (logger.info) logger.info(`Registering template partial "${prtl.name}" (ID: ${prtl.id})`);
    registerPartial(prtl.name, prtl.content);
  }
  return rtn;
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
  const name = extractPartialName(ns, path, partialPrefix), logger = ns.at.options.logger;
  if (logger.debug) logger.debug(`Reading template partial "${name}" from: ${dir}`);
  return ns.this.read(name, true);
}

/**
 * Extracts a partial name from a partial path
 * @private
 * @ignore
 * @param {Object} ns The {@link CachierFiles} namespace
 * @param {String} path The path to the partial
 * @param {String} [partialPrefix] A prefix path that will be excluded from the name of the partial
 * @returns {String} The partial name
 */
function extractPartialName(ns, path, partialPrefix) {
  let name = Path.parse(path), ppx = partialPrefix ? partialPrefix.replace(/\\/g, '/') : '';
  name = (name.ext ? path.replace(name.ext, '') : path).replace(/\\/g, '/');
  name = ppx ? name.substring(name.indexOf(ppx) + ppx.length).replace(/^\\|\//, '') : name;
  return name;
}

/**
 * Watches a partial directory for file adds, deletions, etc. and registers or unregisters the
 * partial accordingly
 * @private
 * @ignore
 * @param {Object} ns The {@link CachierFiles} namespace
 * @param {String} dir The directory that will be watched
 * @param {Function} registerPartial A `function(name, data)` that will register a partial
 * @param {Function} [unregisterPartial] A `function(name)` that will unregister a partial
 * @param {String} [partialPrefix] A prefix path that will be excluded from the name of the partial
 * @returns {Function} The listener function used in the watch
 */
function watchPartialDir(ns, dir, registerPartial, unregisterPartial, partialPrefix) {
  const files = {}, logger = ns.at.options.logger;
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
    if (!stat && type === 'rename' && unregisterPartial) {
      const name = extractPartialName(ns, path, partialPrefix);
      if (logger.info) logger.info(`Unregistering watched "${type}" template partial "${name}" from: ${path}`);
      unregisterPartial(name);
    } else if (stat) {
      files[filename][type].wait = true;
      const prtl = await readPartial(ns, dir, path, partialPrefix);
      files[filename][type].wait = false;
      if (logger.info) logger.info(`Registering watched "${type}" template partial "${prtl.name}" from: ${path}`);
      registerPartial(prtl.name, prtl.content);
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
 * Generates a path from an ID
 * @private
 * @ignore
 * @param {Object} ns The {@link CachierFiles} namespace
 * @param {String} id The ID from {@link CachierFiles.identity}
 * @param {Boolean} [forContent] `true` to load a template content, `false` to load the template module
 * @returns {String} The file path
 */
function pathify(ns, id, forContent) {
  if (Path.isAbsolute(id)) return id;
  const pths = [];
  const base = forContent ? ns.at.options.pathBase : ns.at.pathScanDest;
  const prtl = forContent && id.indexOf(ns.at.options.pathPartials) < 0 && ns.at.options.pathPartials;
  if (base) pths.push(base);
  if (prtl) pths.push(prtl);
  pths.push(id);
  const fpth = Path.join(...pths);
  return fpth;
}