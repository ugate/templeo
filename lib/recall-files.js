'use strict';

const EngineOpts = require('./engine-opts');
const Recall = require('./recall');
const Fs = require('fs');
const Path = require('path');
const { promisify } = require('util');
const readdir = promisify(Fs.readdir);
const stat = promisify(Fs.stat);
const mkdir = promisify(Fs.mkdir);
const rmdir = promisify(Fs.rmdir);
const unlink = promisify(Fs.unlink);

/**
 * Node.js file persistence for compiled templates
 */
class RecallFiles extends Recall {
// TODO : ESM use... export class RecallFile {

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
    const ns = Recall.internal(this), src = ns.options.outputSourcePath, dest = ns.options.outputPath;
    return src && dest ? await Files.mkdirpMirror(src, dest, true) : null;
  }

  /**
   * Writes data to the file system
   * @override
   * @param {String} path The path where the data will be written to
   * @param {String} data The data that will be written
   * @returns {String} The formatted or unformatted data, dependng on the formatting options set on the constructor
   */
  write(path, data) {
    const ns = Recall.internal(this);
    const str = !ns.isFormatOnRead && ns.formatter ? ns.formatter(data, ns.options.outputFormatting) : data;
    Fs.writeFileSync(path, str, ns.options);
    return str;
  }

  /**
   * Reads data from internal cache
   * @override
   * @param {String} path The path to the cached data
   * @returns {String} The formatted or unformatted data, dependng on the formatting options set on the constructor
   */
  read(path) {
    const ns = Recall.internal(this), data = Fs.readFileSync(path);
    return ns.isFormatOnRead && ns.formatter ? ns.formatter(data, ns.options.outputFormatting) : data;
  }

  /**
   * Joins one or more paths that should be used for {@link RecallFile.read} and {@link RecallFile.write}
   * @override
   * @param  {...String} paths The paths to join
   * @returns {String} The joined paths
   */
  join(...paths) {
    return Path.join(...paths);
  }
}

// TODO : ESM remove the following lines...
module.exports = RecallFiles;

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
      proc = !(await stat(dir)).isDirectory();
    } catch (e) {
      proc = true;
    }
    if (proc) {
      try {
        await mkdir(dir);
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
  const sdirs = await readdir(idir), rdirs = [];
  const promises = sdirs.map(async (sdir) => {
    const indir = Path.resolve(idir, sdir);
    if ((await stat(indir)).isDirectory()) {
      const outdir = Path.resolve(odir, sdir);
      var hasOut = false;
      try {
        hasOut = (await stat(outdir)).isDirectory();
      } catch (e) {
        hasOut = false;
      }
      if (!hasOut) await mkdir(outdir);
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
    stats = await stat(path);
  } catch (e) {
    stats = null;
  }
  if (stats && stats.isDirectory()) {
    for (let sub of await readdir(path)) {
      subx = Path.resolve(path, sub);
      stats = await stat(subx);
      if (stats.isDirectory()) await rmrf(subx);
      else if (stats.isFile() || stats.isSymbolicLink()) await unlink(subx);
    }
    await rmdir(path); // dir path should be empty
  } else if (stats && (stats.isFile() || stats.isSymbolicLink())) await unlink(path);
}