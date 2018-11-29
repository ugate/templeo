'use strict';

const EngineFileOpts = require('./engine-file-opts');
const Cachier = require('./cachier');
const Os = require('os');
const Fs = require('fs');
const Path = require('path');
// TODO : ESM uncomment the following lines...
// import * as EngineFileOpts from './engine-file-opts.mjs';
// import * as Cachier from './cachier.mjs';
// import * as Os from 'os';
// import * as Fs from 'fs';
// import * as Path from 'path';

const Fsp = Fs.promises;

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
    ns.at.options = opts instanceof EngineFileOpts ? opts : new EngineFileOpts(opts);
    if (!ns.at.options.outputPath) ns.at.outputTempPrefix = 'templeo-cache-files-';
    ns.at.outputPath = ns.at.options.outputPath || Fs.mkdtempSync(Path.join(Os.tmpdir(), ns.at.outputTempPrefix));
    ns.at.pathPartials = Path.resolve(ns.at.options.pathPartials);
  }

  /**
   * Creates any missing directories/sub-directories within the {@link EngineFileOpts} `outputPath` directory from `outputSourcePath`
   * sub-directories. __Typically, only called by internal implementations.__
   * @override
   * @param {Function} [registerPartial] A `function(name, data)` that will register any partials found during the scan
   * @returns {Object|undefined} An object that contains: `{ partials: { name: String, content: String }, dirs: String[] }` where
   * `partials` are the fragments that have been registered (empty when `registerPartial` is omitted) and `dirs` are all the
   * directories/sub-directories that are created within the output directory.
   */
  async scan(registerPartial) {
    const ns = Cachier.internal(this), src = ns.at.options.outputSourcePath;
    if (src) {
      const prtlPrefix = (registerPartial && ns.at.options.pathPartials) || '';
      return mkdirpMirror(ns, src, ns.at.outputPath, registerPartial, prtlPrefix, true);
    } else if (ns.at.options.logger.warn) {
      ns.at.options.logger.warn('Template file scan cannot be performed due to missing "outputSourcePath" option'
        + ` (outputPath = ${ns.at.outputPath})`);
    }
    return null;
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
    const ns = Cachier.internal(this), fpth = pathify(ns, ns.this.identity(name, forContent), forContent);
    return Fsp.writeFile(fpth, data, ns.at.options);
  }

  /**
   * @override
   * @inheritdoc
   */
  get isWritable() {
    const ns = Cachier.internal(this);
    return !!ns.at.outputPath;
  }

  /**
   * @override
   * @inheritdoc
   */
  identity(name, forContent) {
    const ns = Cachier.internal(this);
    var id = name;
    if (!forContent && ns.at.options.outputExtension) id += '.' + ns.at.options.outputExtension;
    else id = super.identity(id, forContent);
    return id;
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
 * @param {Function} [registerPartial] A `function(name, data)` that will register a partial function
 * @param {String} [partialPrefix] A prefix path that will be excluded from the name of any partials discovered (ignored when `registerPartial` is omitted)
 * @param {Boolean} [cleanOutput=false] The flag that indicates that the specified __output__ directory (along with any __sub__ directories) will be
 * __removed__ within the output (if not present)
 * @param {Boolean} [createOutput=true] The flag that indicates that the specified __input__ directory (along with any __parent__ directories) will be
 * __created__ within the output (if not present)
 * @returns {Object} An object that contains: `{ partials: { name: String, content: String }, dirs: String[] }` where
 * `partials` are the fragments that have been registered (empty when `registerPartial` is omitted) and `dirs` are all the
 * directories/sub-directories that are created within the output directory.
 */
async function mkdirpMirror(ns, idir, odir, registerPartial, partialPrefix, cleanOutput = false, createOutput = true) {
  if (cleanOutput) {
    if (ns.at.outputTempPrefix) await cleanTempOutput(ns.at.outputTempPrefix);
    await rmrf(odir);
  }
  if (cleanOutput || createOutput) await Fsp.mkdir(odir, { recursive: true });
  const sdirs = await Fsp.readdir(idir), prtls = [], rtn = { partials: [], dirs: [] }, logger = ns.at.options.logger;
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
        if (logger && logger.info) logger.info(`Created template directory: ${outdir}`);
      }
      const rtnd = await mkdirpMirror(ns, indirx, outdir, registerPartial, partialPrefix, false, false);
      rtn.partials = rtnd.partials && rtnd.partials.length ? rtn.partials.concat(rtnd.partials) : rtn.partials;
      rtn.dirs = rtnd.dirs && rtnd.dirs.length ? rtn.dirs.concat(rtnd.dirs) : rtn.dirs;
    } else if (registerPartial && stat.isFile()) {
      let name = Path.parse(indirx);
      name = (name.ext ? indirx.replace(name.ext, '') : indirx).replace(/\\+/g, '/');
      name = partialPrefix ? name.replace(partialPrefix, '').replace(/^\\|\//, '') : name;
      if (logger && logger.debug) logger.debug(`Reading template partial "${name}" from: ${indir}`);
      prtls.push(ns.this.read(name, true));
    }
  }
  for (let prtl of prtls) {
    prtl = await prtl;
    rtn.partials.push(prtl);
    if (logger && logger.info) logger.info(`Registering template partial "${prtl.name}" (ID: ${prtl.id})`);
    registerPartial(prtl.name, prtl.content);
  }
  return rtn;
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
  const pths = [];
  const base = !Path.isAbsolute(id) && (forContent ? ns.at.options.pathBase : ns.at.outputPath);
  const prtl = forContent && ns.at.options.pathPartials;
  if (base) pths.push(base);
  if (prtl) pths.push(prtl);
  pths.push(id);
  const fpth = Path.join(...pths);
  return fpth;
}