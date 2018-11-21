'use strict';

const EngineOpts = require('./engine-opts');
const Cache = require('./cache');
const Os = require('os');
const Fs = require('fs').promises;
const Path = require('path');

/**
 * Node.js file persistence for compiled templates
 */
class CacheFiles extends Cache {
// TODO : ESM use... export class CacheFiles {

  /**
   * Constructor
   * @param {EngineOpts} [opts] the {@link EngineOpts}
   * @param {Function} [formatFunc] The `function(string, outputFormatting)` that will return a formatted string when __writting__
   * data using the `outputFormatting` from {@link EngineOpts} as the formatting options.
   */
  constructor(opts, formatFunc) {
    super(opts, formatFunc, false);
  }

  /**
   * Creates any missing directories/sub-directories within the {@link EngineOpts} `outputPath` directory from `outputSourcePath`
   * sub-directories. __Typically, only called by internal implementations.__
   * @override
   * @param {Function} [registerPartial] A `function(name, data)` that will register a partial function
   * @returns {String[]} An array of all the directories/sub-directories that are created within the output directory
   */
  async setup(registerPartial) {
    const ns = Cache.internal(this), src = ns.at.options.outputSourcePath;
    ns.at.outputPath = ns.at.options.outputPath || await Fs.mkdtemp(Path.join(Os.tmpdir(), 'templeo-files-'));
    var dirs = null;
    if (src) dirs = mkdirpMirror(src, ns.at.outputPath, registerPartial, true);
    return dirs;
  }

  /**
   * @override
   * @inheritdoc
   */
  async getTemplate(path) {
    const ns = Cache.internal(this), fpth = Path.join(ns.at.outputPath, path);
    var code = await Fs.readFile(fpth, ns.at.options);
    code = code && ns.at.isFormatOnRead && ns.at.formatter ? ns.at.formatter(code, ns.at.options.outputFormatting) : code;
    return { code, func: Cache.loadModule(fpth, true) };
  }

  /**
   * @override
   * @inheritdoc
   */
  async generateTemplate(name, path, code, write = true) {
    const ns = Cache.internal(this), fpth = Path.join(ns.at.outputPath, path);
    const promise = super.generateTemplate(name, fpth, code, false);
    if (write) {
      const rtn = await promise;
      rtn.coded = `${ns.at.options.useCommonJs ? 'module.exports=' : 'export '}${rtn.coded}`;
      await Fs.writeFile(fpth, rtn.coded, ns.at.options);
      return this.getTemplate(path); // function from module file
    } else return promise;
  }

  /**
   * @override
   * @inheritdoc
   */
  async readPartial(path) {
    const ns = Cache.internal(this), fpth = Path.join(ns.at.outputPath, path);;
    return Fs.readFile(fpth, ns.at.options);
  }

  /**
   * @override
   * @inheritdoc
   */
  async writePartial(name, path, data) {
    const ns = Cache.internal(this), fpth = Path.join(ns.at.outputPath, path);;
    return Fs.writeFile(fpth, data, ns.at.options);
  }

  /**
   * @override
   * @inheritdoc
   */
  join(...paths) {
    return Path.join(...paths);
  }
}

// TODO : ESM remove the following lines...
module.exports = CacheFiles;

/**
 * Creates any missing directories/sub-directories within an output directory from all input sub-directories
 * @private
 * @param {String} idir input directory that contains the directories/sub-directories that will be built within the output directories
 * @param {String} odir output directory where directories/sub-directories will be created
 * @param {Function} [registerPartial] A `function(name, data)` that will register a partial function
 * @param {Boolean} [cleanOutput=true] Flag that indicates that the specified **output** directory (along with any **sub** directories) will be
 * **removed** within the output (if not present)
 * @param {Boolean} [createOutput=true] Flag that indicates that the specified **input** directory (along with any **parent** directories) will be
 * **created** within the output (if not present)
 * @returns {Object} An `{ files: { content: String, parts: Path.parse() }, dirs: String[] }` that contains any partial files registered and an array of
 * all the directories/sub-directories that were created within the output directory
 */
async function mkdirpMirror(idir, odir, registerPartial, cleanOutput = false, createOutput = true) {
  if (cleanOutput) await rmrf(odir);
  if (cleanOutput || createOutput) await Fs.mkdir(odir, { recursive: true });
  const sdirs = await Fs.readdir(idir), rdirs = [], files = [];
  const promises = sdirs.map(async (sdir) => {
    const indir = Path.resolve(idir, sdir), stat = await Fs.stat(indir);
    if (stat.isDirectory()) {
      const outdir = Path.resolve(odir, sdir);
      var hasOut = false;
      try {
        hasOut = (await Fs.stat(outdir)).isDirectory();
      } catch (e) {
        hasOut = false;
      }
      if (!hasOut) await Fs.mkdir(outdir);
      const odirs = await mkdirpMirror(indir, outdir, false, false);
      return hasOut ? odirs : odirs && odirs.length ? [outdir].concat(odirs) : outdir;
    } else if (registerPartial && stat.isFile()) {
      files.push({ parts: Path.parse(indir), content: Fs.readFile(indir) });
    }
  });
  var dir;
  for (let promise of promises) {
    dir = await promise;
    dir = dir && Array.isArray(dir) ? dir.length === 1 ? dir[0] : !dir.length ? null : dir : dir;
    if (dir) rdirs.push(dir);
  }
  for (let file of files) {
    file.content = await file.content;
    registerPartial(file.parts.name, file.content); 
  }
  return { files, dirs: rdirs };
}

/**
 * Removes a directory and any sub directories/files (i.e. `rmdir -rf`)
 * @private
 * @param {String} path the directory that will be removed along with any sub-directories/files
 */
async function rmrf(path) {
  var stats, subx;
  try {
    stats = await Fs.stat(path);
  } catch (e) {
    stats = null;
  }
  if (stats && stats.isDirectory()) {
    for (let sub of await Fs.readdir(path)) {
      subx = Path.resolve(path, sub);
      stats = await Fs.stat(subx);
      if (stats.isDirectory()) await rmrf(subx);
      else if (stats.isFile() || stats.isSymbolicLink()) await Fs.unlink(subx);
    }
    await Fs.rmdir(path); // dir path should be empty
  } else if (stats && (stats.isFile() || stats.isSymbolicLink())) await Fs.unlink(path);
}