'use strict';

const EngineOpts = require('./engine-opts');

//let engx = new WeakMap();

/**
 * Persistence for parsed templates
 */
class Recall {
// TODO : ESM use... export class Recall {

  /**
   * Constructor
   * @param {EngineOpts} [opts] the {@link EngineOpts}
   * @param {Function} [formatFunc] The `function(string, outputFormatting)` that will return a formatted string for reading/writting
   * data using the `outputFormatting` from {@link EngineOpts} as the formatting options.
   * @param {Boolean} [isFormatOnRead=true] `true` will format on {@link Recall.read}, `false` will format on {@link Recall.write}
   */
  constructor(opts, formatFunc, isFormatOnRead = true) {
    const ns = Recall.internal(this);
    ns.options = opts instanceof EngineOpts ? opts : new EngineOpts(opts);
    ns.formatter = typeof formatFunc === 'function' ? formatFunc : null;
    ns.isFormatOnRead = !!isFormatOnRead;
  }

  /**
   * Performs any setup required for initialization
   * @returns {(String[]|undefined)} an array of all the _paths_ that are created within the {@link EngineOpts} `outputPath` (if required)
   */
  async setup() {
    return null;
  }

  /**
   * Writes data to internal cache
   * @param {String} path The path where the data will be written to
   * @param {String} data The data that will be written
   * @returns {String} The formatted or unformatted data, dependng on the formatting options set on the constructor
   */
  write(path, data) {
    const ns = Recall.internal(this);
    const str = !ns.isFormatOnRead && ns.formatter ? ns.formatter(data, ns.options.outputFormatting) : data;
    // TODO : IndexDB write
    return str;
  }

  /**
   * Reads data from internal cache
   * @param {String} path The path to the cached data
   * @returns {String} The formatted or unformatted data, dependng on the formatting options set on the constructor
   */
  read(path) {
    const ns = Recall.internal(this);
    // TODO : IndexDB read
    const data = '';
    return ns.isFormatOnRead && ns.formatter ? ns.formatter(data, ns.options.outputFormatting) : data;
  }

  /**
   * Gets a module from cache
   * @param {String} path The path that identifies the template to get a compiled/parsed module for
   * @returns {Object} A compiled/parsed template module
   */
  module(path) {
    // TODO : ESM use... 
    // const new Promise((res, rej) => {
    //  import(path).then(mdl => res(mdl)).catch(err => rej(err));
    // };
    delete require.cache[require.resolve(path)];
    return require(path);
  }

  /**
   * Joins one or more paths that should be used for {@link Recall.read} and {@link Recall.write}
   * @param  {...String} paths The paths to join
   * @returns {String} The joined paths
   */
  join(...paths) {
    return paths.join('/');
  }

  /**
  * Generates formats a GUID
  * @arg {String} [value] when present, will add any missing hyphens (if `hyphenate=true`) instead of generating a new value
  * @arg {Boolean} [hyphenate=true] true to include hyphens in generated result
  * @returns {String} the generated GUID
  */
  guid(value, hyphenate = true) {
    const hyp = hyphenate ? '-' : '';
    if (value) return hyphenate ? value.replace(/(.{8})-?(.{4})-?(.{4})-?(.{4})-?(.{12})/gi, `$1${hyp}$2${hyp}$3${hyp}$4${hyp}$5`) : value;
    return `xxxxxxxx${hyp}xxxx${hyp}4xxx${hyp}yxxx${hyp}xxxxxxxxxxxx`.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Internal memory-safe mapping of all available template engines
   * @param {Object} obj the object to get/set
   * @returns {(Engine | undefined)} the mapped engine
   */
  static internal(obj) {
    return obj._data || (Object.defineProperty(obj, '_data', { value: {}, writable: false }) && obj._data);
    // WeakMap causes issues when garbage collected
    //if (!engx.has(obj)) engx.set(obj, {});
    //return engx.get(obj);
  }
}

// TODO : ESM remove the following lines...
exports.Recall = Recall;