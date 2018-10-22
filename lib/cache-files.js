'use strict';

const EngineOpts = require('./engine-opts');
const Cache = require('./cache');
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
   * sub-directories.
   * @override
   * @returns {String[]} an array of all the directories/sub-directories that are created within the output directory
   */
  async setup() {
    const ns = Cache.internal(this), src = ns.at.options.outputSourcePath, dest = ns.at.options.outputPath;
    return src && dest ? mkdirpMirror(src, dest, true) : null;
  }

  /**
   * @override
   * @inheritdoc
   */
  async getTemplate(path) {
    const ns = Cache.internal(this);
    var code = await Fs.readFile(path, ns.at.options);
    code = code && ns.at.isFormatOnRead && ns.at.formatter ? ns.at.formatter(code, ns.at.options.outputFormatting) : code;
    return { code, func: Cache.loadModule(path, true) };
  }

  /**
   * @override
   * @inheritdoc
   */
  async generateTemplate(name, path, code, write = true) {
    const ns = Cache.internal(this);
    const coded = outputPath
    const promise = super.generateTemplate(name, path, code, false);
    if (write) {
      const rtn = await promise;
      rtn.code = `${ns.at.options.useCommonJs ? 'module.exports=' : 'export '}${rtn.code}`;
      await Fs.writeFile(path, rtn.code, ns.at.options);
      return this.getTemplate(path); // function from module file
    } else return promise;
  }

  /**
   * @override
   * @inheritdoc
   */
  async readPartial(path) {
    const ns = Cache.internal(this);
    return Fs.readFile(path, ns.at.options);
  }

  /**
   * @override
   * @inheritdoc
   */
  async writePartial(name, path, data) {
    const ns = Cache.internal(this);
    return Fs.writeFile(path, data, ns.at.options);
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
 * Makes parent and sub directories if they do not already exist (i.e. `mkdir -p`)
 * @arg {String} path the path that will be created
 */
async function mkdirp(path) {
  for (let i = 0, paths = path.split(/\\|\//), dir = '', proc; i < paths.length; ++i) {
    if (!paths[i] || (i === 0 && paths[i].indexOf(':') >= 0)) {
      dir = !paths[i] ? Path.sep : paths[i];
      continue;
    }
    dir = Path.resolve(dir, paths[i]);
    try {
      proc = !(await Fs.stat(dir)).isDirectory();
    } catch (e) {
      proc = true;
    }
    if (proc) {
      try {
        await Fs.mkdir(dir);
      } catch (e) {
        throw e;
      }
    }
  }
}

/**
 * Creates any missing directories/sub-directories within an output directory from all input sub-directories
 * @arg {String} idir input directory that contains the directories/sub-directories that will be built within the output directories
 * @arg {String} odir output directory where directories/sub-directories will be created
 * @arg {Boolean} [cleanOutput=true] flag that indicates that the specified **output** directory (along with any **sub** directories) will be
 * **removed** within the output (if not present)
 * @arg {Boolean} [createOutput=true] flag that indicates that the specified **input** directory (along with any **parent** directories) will be
 * **created** within the output (if not present)
 * @returns {String[]} an array of all the directories/sub-directories that are created within the output directory
 */
async function mkdirpMirror(idir, odir, cleanOutput = false, createOutput = true) {
  if (cleanOutput) await rmrf(odir);
  if (cleanOutput || createOutput) await mkdirp(odir);
  const sdirs = await Fs.readdir(idir), rdirs = [];
  const promises = sdirs.map(async (sdir) => {
    const indir = Path.resolve(idir, sdir);
    if ((await Fs.stat(indir)).isDirectory()) {
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
    }
  });
  var dir;
  for (let promise of promises) {
    dir = await promise;
    dir = dir && Array.isArray(dir) ? dir.length === 1 ? dir[0] : !dir.length ? null : dir : dir;
    if (dir) rdirs.push(dir);
  }
  return rdirs;
}

/**
 * Removes a directory and any sub directories/files (i.e. `rmdir -rf`)
 * @arg {String} path the directory that will be removed along with any sub-directories/files
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