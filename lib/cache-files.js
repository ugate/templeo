'use strict';

const EngineOpts = require('./engine-opts');
const Cache = require('./cache');
const Os = require('os');
const Fs = require('fs').promises;
const Path = require('path');

/**
 * Node.js [file]{@link https://nodejs.org/api/fs.html} persistence for compiled templates
 * @private
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
    super(opts, formatFunc, null, false);
  }

  /**
   * Creates any missing directories/sub-directories within the {@link EngineOpts} `outputPath` directory from `outputSourcePath`
   * sub-directories. __Typically, only called by internal implementations.__
   * @override
   * @param {Function} [registerPartial] A `function(name, data)` that will register a partial function
   * @returns {Object|undefined} An object that contains: `{ partials: { name: String, content: String }, dirs: String[] }` where
   * `partials` are the fragments that have been registered (empty when `registerPartial` is omitted) and `dirs` are all the
   * directories/sub-directories that are created within the output directory.
   */
  async setup(registerPartial) {
    const ns = Cache.internal(this), src = ns.at.options.outputSourcePath;
    ns.at.outputPath = ns.at.options.outputPath || await Fs.mkdtemp(Path.join(Os.tmpdir(), 'templeo-files-'));
    if (src) {
      let prtlPrefix = (registerPartial && ns.at.options.partialsPath) || '';
      return mkdirpMirror(src, ns.at.outputPath, registerPartial, prtlPrefix, ns.at.options, true);
    }
    return null;
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
 * @ignore
 * @param {String} idir The input directory that contains the directories/sub-directories that will be built within the output directories
 * @param {String} odir Then output directory where directories/sub-directories will be created
 * @param {Function} [registerPartial] A `function(name, data)` that will register a partial function
 * @param {String} [partialPrefix] A prefix path that will be excluded from the name of any partials discovered (ignored when `registerPartial` is omitted)
 * @param {Boolean} [cleanOutput=true] The flag that indicates that the specified __output__ directory (along with any __sub__ directories) will be
 * __removed__ within the output (if not present)
 * @param {Boolean} [createOutput=true] The flag that indicates that the specified __input__ directory (along with any __parent__ directories) will be
 * __created__ within the output (if not present)
 * @returns {Object} An object that contains: `{ partials: { name: String, content: String }, dirs: String[] }` where
 * `partials` are the fragments that have been registered (empty when `registerPartial` is omitted) and `dirs` are all the
 * directories/sub-directories that are created within the output directory.
 */
async function mkdirpMirror(idir, odir, registerPartial, partialPrefix, opts, cleanOutput = false, createOutput = true) {
  if (cleanOutput) await rmrf(odir);
  if (cleanOutput || createOutput) await Fs.mkdir(odir, { recursive: true });
  const sdirs = await Fs.readdir(idir), prtls = [], rtn = { partials: [], dirs: [] };
  for (let sdir of sdirs) {
    const indirx = Path.join(idir, sdir), indir = Path.resolve(idir, sdir), stat = await Fs.stat(indir);
    if (stat.isDirectory()) {
      const outdir = Path.resolve(odir, sdir);
      var hasOut = false;
      try {
        hasOut = (await Fs.stat(outdir)).isDirectory();
      } catch (e) {
        hasOut = false;
      }
      if (!hasOut) {
        await Fs.mkdir(outdir);
        rtn.dirs.push(outdir);
        if (opts && opts.logger && opts.logger.info) opts.logger.info(`Created template directory: ${outdir}`);
      }
      const rtnd = await mkdirpMirror(indirx, outdir, registerPartial, partialPrefix, opts, false, false);
      rtn.partials = rtnd.partials && rtnd.partials.length ? rtn.partials.concat(rtnd.partials) : rtn.partials;
      rtn.dirs = rtnd.dirs && rtnd.dirs.length ? rtn.dirs.concat(rtnd.dirs) : rtn.dirs;
    } else if (registerPartial && stat.isFile()) {
      let name = Path.parse(indirx);
      name = (name.ext ? indirx.replace(name.ext, '') : indirx).replace(/\\+/g, '/');
      name = partialPrefix ? name.replace(partialPrefix, '').replace(/^\\|\//, '') : name;
      prtls.push({ name, content: Fs.readFile(indir) });
    }
  }
  for (let prtl of prtls) {
    prtl.content = (await prtl.content).toString();
    rtn.partials.push(prtl);
    if (opts && opts.logger && opts.logger.info) opts.logger.info(`Registering template partial: ${prtl.name}`);
    registerPartial(prtl.name, prtl.content);
  }
  return rtn;
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