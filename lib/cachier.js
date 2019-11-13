'use strict';

const TemplateOpts = require('./template-options');
const Sandbox = require('./sandbox');
const Director = require('./director');
// TODO : ESM uncomment the following lines...
// TODO : import * as TemplateOpts from './template-options.mjs';
// TODO : import * as Sandbox from './sandbox.mjs';
// TODO : import * as Director from './director.mjs';

//let engx = new WeakMap();

/**
 * The default persistence cache manager that uses a simple object mapping for {@link Cachier.read}/{@link Cachier.write}
 * operations. All caching is maintained in-memory. Template, partial and context {@link Cachier.read} operations use
 * either `window.fetch` (browsers) or the `https` module (Node.js) to capture partial template content. Compiled template
 * {@link Cachier.read} operations are handled via _dynamic_ `import`/`require` (if used). {@link Cachier.write} operations
 * are typically written to memory, but can also be configured to `POST` template, partials and/or context over HTTP/S.
 */
class Cachier {
// TODO : ESM use... export class Cachier {

  /**
   * Constructor
   * @param {TemplateOpts} [opts] the {@link TemplateOpts}
   * @param {Function} [readFormatter] The `function(string, readFormatOptions)` that will return a formatted string for __reading__
   * data using the `options.readFormatOptions` from {@link TemplateOpts} as the formatting options. Typically reads are for __HTML__
   * _minification_ and/or _beautifying_. __NOTE: Use with caution as syntax errors may result depending on the formatter used and the
   * complexity of the data being formatted!__ 
   * @param {Function} [writeFormatter] The `function(string, writeFormatOptions)` that will return a formatted string for __writting__
   * data using the `options.writeFormatOptions` from {@link TemplateOpts} as the formatting options. Typically reads are for __JS__
   * _minification_ and/or _beautifying_. __NOTE: Use with caution as syntax errors may result depending on the formatter used and the
   * complexity of the data being formatted!__ 
   * @param {Object} [log] The log for handling logging output
   * @param {Function} [log.debug] A function that will accept __debug__ level logging messages (i.e. `debug('some message to log')`)
   * @param {Function} [log.info] A function that will accept __info__ level logging messages (i.e. `info('some message to log')`)
   * @param {Function} [log.warn] A function that will accept __warning__ level logging messages (i.e. `warn('some message to log')`)
   * @param {Function} [log.error] A function that will accept __error__ level logging messages (i.e. `error('some message to log')`)
   */
  constructor(opts, readFormatter, writeFormatter, log = {}) {
    const ns = internal(this);
    const options = opts instanceof TemplateOpts ? opts : new TemplateOpts(opts);
    ns.at.options = options;
    ns.at.log = log || {};
    ns.at.readFormatter = typeof readFormatter === 'function' ? readFormatter : null;
    ns.at.writeFormatter = typeof writeFormatter === 'function' ? writeFormatter : null;
    initCache(ns.at);
  }

  /**
   * Registers a _directive_ function that can be used within template
   * [interpolations](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#Expression_interpolation)
   * @param {Function} func A __named__ `function` that has no external scope dependencies/closures other than those exposed
   * via templates during rendering
   */
  registerHelper(func) {
    const ns = internal(this);
    ns.at.helpers.add(func);
  }

  /**
   * Unregisters a partial template from cache
   * @param {String} name The template name that uniquely identifies the template content
   */
  async unregister(name) {
    const ns = internal(this);
    if (ns.at.data[name]) delete ns.at.data[name];
    if (ns.at.sources[name]) delete ns.at.sources[name];
  }

  /**
   * Registers and stores a partial template __in-memory__. Use {@link Cachier.register} to write partials to cache ({@link Cachier})
   * @param {String} name The __raw__ template name (i.e. not from {@link Cachier.readWriteName})
   * @param {(String | URLSearchParams)} contentOrParams Either the partial template content __string__ to register _or_ the
   * `URLSearchParams` that will be passed during the content `read`
   * @param {String} [extension=options.defaultExtension] Optional override for a file extension designation for the partial
   * @returns {String} The partial content
   */
  async registerPartial(name, contentOrParams, extension) {
    const ns = internal(this), opts = ns.this.options, ext = (extension && String(extension)) || opts.defaultExtension || '', log = ns.this.log;
    const params = contentOrParams instanceof URLSearchParams ? params : null;
    const contentType = !params && typeof contentOrParams;
    const path = await ns.this.readWriteName(name, opts, params, ns.at, true, extension);
    if (log.info) log.info(`CACHE: 🏧 Registering template "${name}" @ "${path}" (compile-time)`);
    ns.at.data[path] = { name: path };
    ns.at.data[path].extension = ext;
    if (params) {
      ns.at.data[path].params = contentOrParams;
    } else if (contentType === 'string') {
      ns.at.data[path].content = contentOrParams;
    } else if (contentType === 'object' && extension === 'json') {
      ns.at.data[path].content = JSON.parse(JSON.stringify(contentOrParams));
    }
    return ns.at.data[path].content;
  }

  /**
   * Retrieves a template, partial or context that resides __in-memory__.
   * @param {String} name The __raw__ template name (i.e. not from {@link Cachier.readWriteName})
   * @param {URLSearchParams} [params] Any parameters designated during {@link Cachier.registerPartial}
   * @param {String} [extension=options.defaultExtension] Optional override for a file extension designation
   * for the template, partial or context designated during {@link Cachier.registerPartial}
   * @returns {Object} A copy of the generated data from {@link Cachier.registerPartial}
   */
  async getRegistered(name, params, extension) {
    const ns = internal(this), opts = ns.this.options, prms = params instanceof URLSearchParams ? params : null;
    const path = await ns.this.readWriteName(name, opts, prms, ns.at, true, extension);
    return (path && ns.at.data[path] && JSON.parse(JSON.stringify(ns.at.data[path]))) || null;
  }

  /**
   * Registers and __caches__ the template, one or more partial templates and/or context JSON.
   * @param {Object[]} [data] The template, partials and/or context to register.
   * @param {String} data[].name The name that uniquely identifies the template, partial or context
   * @param {String} [data[].content] The raw content that will be registered. Omit when `read === true` to read content from cache.
   * @param {URLSearchParams} [data[].params] The `URLSearchParams` that will be passed during the content `read`
   * (__ignored when `content` is specified__).
   * @param {String} [data[].extension] Optional override for a file extension designated for a template, partial or context.
   * @param {Boolean} [read] When `true`, an attempt will be made to also {@link Cachier.read} the template, partials and context that
   * __do not have__ a `content` property set.
   * @param {Boolean} [write] When `true`, an attempt will be made to also {@link Cachier.write} the template, partials and context that
   * __have__ a `content` property set.
   * @returns {Object} An object that contains the registration results:
   * 
   * - `data` The object that contains the template, partial fragments and/or context that have been registered
   *   - `name` The name that uniquely identifies the template, partial or context
   *   - `content` The raw content of the template, partial or context
   *   - `extension` The template file extension designation
   *   - `params` The URLSearchParams passed during the __initial__ content read
   *   - `fromRead` A flag that indicates that the data was set from a read operation
   */
  async register(data, read, write) {
    const ns = internal(this), opts = ns.this.options;
    const rtn = { data: [] }; // data should not be "new Array(data.length)" since more may be added by extending classes
    if (!data) return rtn;
    let content, params, pidx = -1, ext;
    for (let dta of data) {
      pidx++;
      ext = dta.extension && String(dta.extension) || (dta.name === opts.defaultContextName ? opts.defaultContextExtension : opts.defaultExtension) || '';
      if (!dta.hasOwnProperty('name')) {
        throw new Error(`Template, partial or context "name" missing at index ${pidx} for ${JSON.stringify(dta)}`);
      }
      params = dta.params instanceof URLSearchParams ? dta.params : null;
      if (!dta.hasOwnProperty('content')) {
        if (read) {
          content = await ns.this.read(dta.name, true, ext, params);
          content = content ? content.content : undefined;
        } else content = null;
        if (typeof content !== 'string') {
          const urld = Cachier.contentURL(dta.name, opts);
          const errMsg = `Template, partial or context "content" missing at index ${pidx} for ${JSON.stringify(dta)}`
            + `${read && !urld.url ? ` - "options.${urld.optionName}" should be set to a valid URL to fetch the content from` : ''}`;
          try {
            // validate the name/URL for consistency with render-time errors
            new URL(dta.name, urld.url || undefined);
          } catch (err) {
            err.message = `${err.message} <- ${errMsg}`;
            throw err;
          }
          throw new Error(errMsg);
        }
      } else {
        content = dta.content;
        if (write) await ns.this.write(dta.name, content, true, ext);
      }
      await ns.this.registerPartial(dta.name, typeof content !== 'undefined' ? content : dta.params, ext);
      rtn.data.push({ name: dta.name, content, extension: ext, params });
    }
    return rtn;
  }

  /**
   * Compiles a locally sandboxed `async` template rendering function and when applicable, stores the function in cache
   * @param {String} name The template name that uniquely identifies the primary template content
   * @param {(String | Boolean)} [template] The raw template content, `true` to read from cache before compilation.
   * Omit to load the template content from cache when the returned rendering function is called.
   * @param {URLSearchParams} [params] Any URL search parmeters that will be passed when capturing the primary `template` and/or `context` when needed
   * @param {String} [extension] The file extension designation for the template
   * @returns {Function} The return function from {@link Sandbox.compile}
   */
  async compile(name, template, params, extension) {
    const ns = internal(this), opts = ns.this.options, log = ns.this.log;
    let content = template, cnm, func;
    if (template === true) { // read/load primary template source
      let rd;
      cnm = await ns.this.readWriteName(name, opts, params, ns.at, true, extension);
      if (!opts.cacheRawTemplates || !ns.at.data[cnm] || !ns.at.data[cnm].hasOwnProperty('content')) {
        rd = await ns.this.read(name, true, extension, params);
        content = rd && (rd.hasOwnProperty('content') ? rd.content : rd.data && rd.data[cnm] ? rd.data[cnm].content : null);
        if (typeof content !== 'string') {
          throw new Error(`Unable to find/read primary template @ "${name}" (full name: "${cnm}") using options: ${JSON.stringify(opts)}`);
        }
        await ns.this.registerPartial(cnm, content);
      } else content = ns.at.data[cnm].content;
      if (content) { // only read rendering function when there is corresponding content
        const snm = await ns.this.readWriteName(name, opts, params, ns.at, false);
        if (!opts.cacheRawTemplates || !ns.at.sources[snm] || !ns.at.sources[snm].hasOwnProperty('func')) {
          try {
            rd = await ns.this.read(name, false, extension, params);
            func = rd && rd.func;
          } catch (err) {
            if (log.warn) log.warn(err);
          }
        } else func = ns.at.sources[snm].func;
      }
    }
    if (!func) { // no rendering function requires a fresh compile
      func = Sandbox.compile(name, content, opts, ns.this.readWriteNames, ns.this.operations, ns.at.helpers, ns.this.metadata, log);
      if (log.debug) log.debug(`CACHE: 📦 Created sandbox for: ${Sandbox.serialzeFunction(func)}`);
      if (func) {
        if (opts.renderTimePolicy.includes('write')) {
          const cmod = await ns.this.write(name, func, false, null, params);
          if (typeof cmod === 'function') func = cmod;
        }
        if (log.info) log.info(`CACHE: 📦 Compiled template named "${func.name}"${cnm ? ` @ "${cnm}"` : ''}`);
      }
    }
    return func;
  }

  /**
   * Reads either template content or template code from internal cache.
   * When `options.partialsURL` is set to an HTTPS URL and the read is for partial content, A `GET` call to `window.fetch` is made
   * when running within browsers or to the `https` module when running on the server. The partial `name` will be appended to
   * `options.partialsURL` (e.g. `https://example.com/some/id.html` where `some/id.html` is the the partial's
   * {@link Cachier.readWriteName} and `options.partialsURL` is set to `https://example.com`). When `options.partialsURL` is
   * omitted _reading_ of template partial content will be limited to _reading_ from memory. Compiled template source code is _always_
   * _read_ from memory __only__.
   * @param {String} name The template name that uniquely identifies the template content
   * @param {Boolean} [forContent] `true` to read a template content, `false` to read the template source code
   * @param {String} [extension] The file extension designation (only used when `forContent` is truthy)
   * @param {URLSearchParams} [params] The `URLSearchParams` to pass for the read (only used when `forContent` is truthy)
   * @returns {Object} An object read from cache that contains either the template content or module.
   * 
   * Returned template content properties:
   * - `name` The template name that uniquely identifies the template content
   * - `content` The template content
   * - `extension` The template file extension designation
   * 
   * Returned module properties:
   * - `name` The template name that uniquely identifies the template content
   * - `func` The module function generated from the code
   */
  async read(name, forContent, extension, params) {
    const ns = internal(this), opts = ns.this.options, log = ns.this.log;
    const path = await ns.this.readWriteName(name, opts, params, ns.at, forContent, extension);
    return readAndSet(await modules(opts), name, path, ns.at, forContent, extension, opts, params, false, ns.this, log, true);
  }

  /**
   * Writes either template content or template code from internal cache.
   * When `options.partialsURL` is set to an HTTPS URL and the read is for partial content, A `POST` call to `window.fetch` is made
   * when running within browsers or to the `https` module when running on the server. The partial `name` will be appended to
   * `options.partialsURL` (e.g. `https://example.com/some/id.html` where `some/id.html` is the the partial's
   * {@link Cachier.readWriteName} and `options.partialsURL` is set to `https://example.com`). When `options.partialsURL` is
   * omitted _writting_ of template partial content will be limited to _writes_ to memory. Compiled template source code is _always_
   * _written_ to memory __only__.
   * @param {String} name The template name that uniquely identifies the template content
   * @param {(String|Function)} data The data to write. For content, `data` should be a string. Otherwise `data` should be a function or
   * a function string.
   * @param {Boolean} [forContent] `true` to read a template content, `false` to read the template source code
   * @param {String} [extension] The file extension designation (only used when `forContent` is truthy)
   * @param {URLSearchParams} [params] The `URLSearchParams` to pass for the write (only used when `forContent` is truthy)
   * @returns {(Function | undefined)} Optionally return the compiled/written module function
   */
  async write(name, data, forContent, extension, params) {
    const ns = internal(this), opts = ns.this.options, log = ns.this.log;
    const path = await ns.this.readWriteName(name, opts, params, ns.at, forContent, extension);
    return writeAndSet(await modules(opts), name, path, opts, params, ns.at, data, forContent, extension, ns.this, log, true);
  }

  /**
   * @returns {TemplateOpts} The template compile options
   */
  get options() {
    const ns = internal(this);
    return ns.at.options;
  }

  /**
   * @protected
   * @returns {Object} The compilation metadata that will be passed into {@link Sandbox.compile}
   */
  get metadata() {
    const ns = internal(this);
    return {
      data: JSON.parse(JSON.stringify(ns.at.data))
      //,sources: JSON.parse(JSON.stringify(ns.at.sources))
    };
  }

  /**
   * @returns {Function} The __read__ formatting function that takes 1 or 2 arguments with the first being the content
   * that will be formatted and the second being `options.readFormatOptions`
   */
  get readFormatter() {
    const ns = internal(this);
    return ns.at.readFormatter;
  }

  /**
   * @returns {Function} The __write__ formatting function that takes 1 or 2 arguments with the first being the content
   * that will be formatted and the second being `options.writeFormatOptions`
   */
  get writeFormatter() {
    const ns = internal(this);
    return ns.at.writeFormatter;
  }

  /**
   * @returns {Object} The optional log used by the {@link Cachier}
   */
  get log() {
    const ns = internal(this);
    return ns.at.log;
  }

  /**
   * Clears the cache
   * @param {Boolean} [all=false] `true` to clear all unassociated cache instances when possible
   */
  async clear(all = false) {
    const ns = internal(this);
    initCache(ns.at);
  }

  /**
   * @param {(TemplateOpts | Function(name:String):*)} optional Either the {@link TemplateOpts} or a function that takes a
   * single name argument and returns the option value
   * @returns {Object} The object that contains the modules used by the {@link Cachier} implementation
   */
  async modules(optional) {
    return modules;
  }

  /**
   * @returns {(Object | Object[])} [operations] One or more operation objects that will handle render-time reads/writes
   * @returns {Function} [operations[].read] The reader is an `async function` responsible for reading partial template content/modules/etc
   * during render-time when a partial template cannot be found within `includes`. When `options.cacheRawTemplates` is _truthy_ an
   * attempt will be made to add any missing/read partials into `storage.data` in order to prevent unnecessary template partial
   * reads for repeated includes. Read functions should not reference any external scope other than the global object space.
   * The following arguments will be passed:
   * 1. _{String}_ `name` The name of the partial that will be read. The read function may be invoked without a _name_ parameter when
   * the intent is to capture all partials in a single read opteration that will be included.
   * 1. _{String}_ `path` The path to the partial that will be read. The read function may be invoked without a _path_ parameter when
   * the intent is to capture all partials in a single read opteration that will be included.
   * 1. _{String}_ `ext` The path file extension to the partial that will be read. The read function may be invoked without an _ext_
   * parameter when the intent is to capture all partials in a single read opteration that will be included.
   * 1. _{Boolean}_ `forContent` The flag indicating that the read is for content. Otherwise, the read is for rendering functions.
   * 1. _{(TemplateOpts | Function(name:String):*)}_ `optional` Either the {@link TemplateOpts} or a function that takes a single name
   * argument and returns the option value.
   * 1. _{URLSearchParams}_ `[params]` The URLSearchParams that should be used during the read
   * 1. _{Object}_ `storage` The storage object that can contain metadata for read operations and should contain a __data__ object
   * that stores each of the read paratial template content/metadata.
   * 1. _{Function}_ `[formatter]` The function that will format reads/writes during include discovery (if any). The formatting function
   * takes 1 or 2 arguments with the first being the content that will be formatted and the second being `options.readFormatOptions` for
   * reads and `options.writeFormatOptions` for writes.
   * The returned result should be a valid string.
   * 1. _{Boolean}_ `[close]` A flag indicating whether or not any resources used during the read should be closed/cleaned up after the
   * read completes. Closure may be dependent upon the policy set on the options.
   * 1. _{Object}_ `[log]` A logger that can contain functions for each of the following: `error`/`warn`/`info`/`debug`.
   * 
   * Read functions can return the partial template content and/or it can be set on the `storage.data`.
   * Returning `true` will stop any further rendering from processing resulting in the rendering function returning a _blank_ string.
   * @returns {Function} [operations[].write] The write function that will be used for writting newly discovered template sources.
   * Accepts the same arguments as `operations[].read` and all _scoped_ functions will be available. Can return a __rendering__
   * function that will prevent further iteration of any subsequent `operations[].write` invocations.
   * @returns {Function} [operations[].finish] An `async function` that can perform cleanup tasks for a reader. Arguments passed are
   * `storage`, `optional` and `log` as described for `operations[].read`.
   * @returns {Function[]} [operations[].scopes] Zero or more functions that will be in scope when the read function is called.
   * Scoped functions can assit with complex read/write operations that can benefit from separate supporting functions. For example,
   * `[myFunc(){}]` could be referenced like `async function myReader(){ myFunc(); ... }`.
   */
  get operations() {
    return Object.freeze({
      read: defaultRenderReader,
      write: defaultRenderWriter,
      scopes: Object.freeze([
        fetcher,
        isAbsName,
        modules,
        initRegistrant,
        readAndSet,
        writeAndSet
      ])
    });
  }

  /**
   * Converts template names into a full path name consumable by `read`/`write` oprtations. Each function from
   * {@link Cachier.readWriteNames} will be executed in order using the same arguments as {@link Cachier.readWriteName} as well as an
   * additional last agument being the return value from the previous function invocation.
   * @param {String} name The name of the template, partial or context that will be converted into a name suitable for a read operation
   * @param {(TemplateOpts | Function(name:String):*)} optional Either the {@link TemplateOpts} or a function that takes a single name
   * argument and returns the option value
   * @param {URLSearchParams} [params] The parameters that should be used in the converted name
   * @param {Object} store The storage object that can contain metadata used by naming operations
   * @param {Boolean} forContent The flag indicating if the converted name is being used to capture partials
   * @param {String} [extension] The file extension override for the converted name (omit to use the default extension set in the options)
   * @param {Boolean} forContext The flag indicating if the converted name is being used to capture context
   * @returns {String} The full template name
   */
  async readWriteName(name, optional, params, store, forContent, extension, forContext) {
    let nmrs = this.readWriteNames;
    return nmrs.namer(nmrs, name, optional, params, store, forContent, extension, forContext);
  }

  /**
   * @see {@link Cachier.readWriteName} for parameter details
   * @returns {Object} `namers` One or more async functions responsible for formatting template names into a full path name
   * consumable by `read`/`write` oprtations
   * @returns {Object} `namers.namer` The default naming function
   * @returns {Object} `namers.namerSuper` The naming function to use when a {@link Cachier.operations} function throws an error. The next
   * reader called in the {@link Cachier.operations} list will use the name generated by this reader.
   */
  get readWriteNames() {
    return { namer: readWriteName };
  }

  /**
   * Extracts the proper URL and option name used for a particular template, partial or context
   * @param {String} name The template, partial or context name
   * @param {TemplateOpts} opts The template options
   * @returns {Object} The extracted content that contains a `url` property and a `optionName` that describes the option used for the URL
   */
  static contentURL(name, opts) {
    const rtn = {};
    if (name === opts.defaultTemplateName) {
      rtn.url = opts.templateURL;
      rtn.optionName = 'templateURL';
    } else if (name === opts.defaultContextName) {
      rtn.url = opts.contextURL;
      rtn.optionName = 'contextURL';
    } else {
      rtn.url = opts.partialsURL;
      rtn.optionName = 'partialsURL';
    }
    return rtn;
  }

  /**
   * Waits for promises to finish and throws commulative errors into a single meaningful stack while continuing to process
   * subsequent promises in the array. When an error is thrown and `capture === true`, it will also contain a `results`
   * property that contains either each result from an awaited promise or an error thrown when waiting for the promise to
   * complete.
   * @param {Promise[]} proms The promises to wait for.
   * @param {String} [errMsg='One or more pomises failed'] The message to use when any errors occur.
   * @param {Boolean} [capture=true] When `true` each promise results/errors will be captured and returned. Otherwise,
   * nothing will be captured
   * @returns {(Array | undefined)} When `capture === true`, the awaited promise results are retuend. When an error occurs,
   * the value at the given index will contain the error instead. When `capture !== true` nothing is captured/returned.
   */
  static async waiter(proms, errMsg = 'One or more pomises failed', capture = true) {
    let error, pcnt = 0, results = capture ? [] : undefined;
    for (let prom of proms) {
      pcnt++;
      try {
        if (results) results.push(await prom);
        else await prom;
      } catch (err) {
        nerr = new Error(err.constructor.name !== 'Error' ? `${err.constructor.name || 'PromiseError'}:` : '');
        nerr.code = err.code;
        nerr.stack = `${err.message}${error && error.message ? ` <- ${error.message}` : ''}`
        + (pcnt >= proms.length ? ` <- ${errMsg}` : '')
        + `\nPROMISE #${pcnt} of ${proms.length}: \n${err.stack}${error ? `\n${error.stack}` : ''}`;
        error = nerr;
        if (results) results.push(nerr);
      }
    }
    if (error) {
      if (results) error.results = results;
      throw error;
    }
    return results;
  }
}

// TODO : ESM remove the following lines...
module.exports = Cachier;

/**
 * Default reader that reads the contents of from cache
 * @private
 * @ignore
 * @param {String} name The name of template that will be read
 * @param {String} path The path to the template that will be read
 * @param {String} ext The path extension
 * @param {Boolean} forContent The flag indicating that the read is for content. Otherwise, the read is for rendering functions.
 * @param {(TemplateDBOpts | Function)} optional Either the options or a `function(name:String):*` that returns an
 * option value by name
 * @param {URLSearchParams} [params] The search parameters to use for the read 
 * @param {Object} store The JSON storage space
 * @param {Function} [readFormatter] The formatting function to use to format the read content
 * @param {Boolean} [close] When `true`, the resources will be closed after execution is complete
 * @param {Object} [log] The log that can contain functions for each of the following: `error`/`warn`/`info`/`debug`
 * @returns {(String | undefined)} The return value from {@link readAndSet}
 */
async function defaultRenderReader(name, path, ext, forContent, optional, params, store, readFormatter, close, log) {
  if (!path) return;
  const mods = await modules(optional), reg = initRegistrant(path, optional, store, readFormatter);
  return readAndSet(mods, name, path, store, forContent, ext, optional, params, close, reg, log);
}

/**
 * Default writer that writes the contents to cache
 * @private
 * @ignore
 * @param {String} name The name of template that will be written
 * @param {String} path The path to the template that will be written
 * @param {String} ext The path extension
 * @param {Boolean} forContent The flag indicating that the write is for content. Otherwise, the write is for rendering functions.
 * @param {(TemplateDBOpts | Function)} optional Either the options or a `function(name:String):*` that returns an
 * option value by name
 * @param {URLSearchParams} [params] The search parameters to use for the write 
 * @param {Object} store The JSON storage space
 * @param {String} data The code block that will be written
 * @param {Function} [writeFormatter] The formatting function to use to format the written content
 * @param {Boolean} [close] When `true`, the resources will be closed after execution is complete
 * @param {Object} [log] The log that can contain functions for each of the following: `error`/`warn`/`info`/`debug`
 * @returns {(Function | undefined)} The return value from {@link writeAndSet}
 */
async function defaultRenderWriter(name, path, ext, forContent, optional, params, store, data, writeFormatter, close, log) {
  const mods = await modules(optional), reg = initRegistrant(path, optional, store, null, writeFormatter);
  return writeAndSet(mods, name, path, optional, params, store, data, forContent, ext, reg, log);
}

/**
 * Reads/Captures a partial template or generated rendering function
 * @private
 * @ignore
 * @param {Object} mods The return object from {@link modules}
 * @param {String} name The name of template that will be read
 * @param {String} path The path to the template that will be read
 * @param {Object} store The JSON storage space
 * @param {Boolean} forContent The flag indicating if the converted name is being used to capture partials
 * @param {String} [extension] The file extension override for the converted name (omit to use the default extension set in the options)
 * @param {(TemplateDBOpts | Function)} optional Either the options or a `function(name:String):*` that returns an
 * option value by name
 * @param {URLSearchParams} [params] The search parameters to use for the read
 * @param {Boolean} close `true` when no further reads are required
 * @param {Object} registrant The registrant {@link CachierFiles} or similar object
 * @param {Function} registrant.registerPartial The {@link CachierFiles.registerPartial} or similar function
 * @param {Function} registrant.unregister The {@link CachierFiles.unregister} or similar function
 * @param {Function} [registrant.readFormatter] The {@link CachierFiles.readFormatter} or similar function
 * @param {Function} [registrant.writeFormatter] The {@link CachierFiles.writeFormatter} or similar function
 * @param {Object} [log] The log that can contain functions for each of the following: `error`/`warn`/`info`/`debug`
 * @param {Boolean} [isCompile] `true` when execution is for compilation, _falsy_ when rendering
 * @returns {Object} The read/cached entry 
 */
async function readAndSet(mods, name, path, store, forContent, extension, optional, params, close, registrant, log, isCompile) {
  const isOptionFunc = typeof optional === 'function', isFetch = forContent && (!isCompile || isAbsName(name, optional));
  if (log.info) {
    log.info(`CACHE: ${isFetch ? '📡 HTTPS' : '🏧 MEMORY'}- Reading template ${forContent ? 'partial' : 'code'} `
      + `from ${isFetch ? `GET ${path}${params ? `?${params.toString()}"` : ''}` : `module "${name}" @ "${path}"`} (${isCompile ? 'compile' : 'render'}-time)`);
  }
  const cacheName = forContent ? 'data' : 'sources';
  if (forContent) {
    let content = isFetch ? await fetcher(mods, path, optional, params, store, null, registrant.readFormatter, close, log) : 
      store[cacheName][path] && store[cacheName][path].content;
    const ctype = typeof content;
    if (!isFetch && ctype === 'string' && registrant.readFormatter) {
      const rfopts = isOptionFunc ? optional('readFormatOptions') : optional.readFormatOptions;
      content = registrant.readFormatter(content, rfopts);
    }
    await registrant.registerPartial(name, ctype !== 'string' ? params : content, extension);
  } else {
    store[cacheName][path] = {
      name: path,
      shortName: name,
      func: store[cacheName][path] && store[cacheName][path].func
    };
  }
  return store[cacheName][path];
}

/**
 * Writes/Sets a partial template or generated rendering function
 * @private
 * @ignore
 * @param {Object} mods The return object from {@link modules}
 * @param {String} name The name of template that will be written
 * @param {String} path The path to the template that will be written
 * @param {(TemplateDBOpts | Function)} optional Either the options or a `function(name:String):*` that returns an
 * option value by name
 * @param {URLSearchParams} [params] The search parameters to use for the write 
 * @param {Object} store The JSON storage space
 * @param {String} data The code block that will be written
 * @param {Boolean} forContent The flag indicating if the converted name is being used to capture partials
 * @param {String} [extension] The file extension override for the converted name (omit to use the default extension set in the options)
 * @param {Object} registrant The registrant {@link CachierFiles} or similar object
 * @param {Function} registrant.registerPartial The {@link CachierFiles.registerPartial} or similar function
 * @param {Function} registrant.unregister The {@link CachierFiles.unregister} or similar function
 * @param {Function} [registrant.readFormatter] The {@link CachierFiles.readFormatter} or similar function
 * @param {Function} [registrant.writeFormatter] The {@link CachierFiles.writeFormatter} or similar function
 * @param {Function} registrant.modularize The {@link CachierFiles.modularize} or similar function
 * @param {Object} [log] The log that can contain functions for each of the following: `error`/`warn`/`info`/`debug`
 * @param {Boolean} [isCompile] `true` when execution is for compilation, _falsy_ when rendering
 * @returns {Function | undefined} The written rendering function or `undefined` when writing partial template content
 */
async function writeAndSet(mods, name, path, optional, params, store, data, forContent, extension, registrant, log, isCompile) {
  const isOptionFunc = typeof optional === 'function', logLabel = log ? ` (${isCompile ? 'compile' : 'render'}-time)` : undefined;
  const useCache = isOptionFunc ? optional('cacheRawTemplates') : optional.cacheRawTemplates;
  if (!useCache) {
    if (log && log.info) {
      log.info(`CACHE: ↩️ Skipping memory write due to "options.cacheRawTemplates" is turned off for template "${name}" @ "${path}"${logLabel}`);
    }
    return;
  }
  data = data || '';
  const cacheName = forContent ? 'data' : 'sources';
  const isFetch = forContent && isAbsName(name, optional);
  const dataType = typeof data, isContentJSON = forContent && extension === 'json' && dataType === 'object';
  const writable = isContentJSON ? data : dataType === 'function' && ((isFetch && name) || forContent) ? data.toString() : null;
  if (log.info) {
    log.info(`CACHE: ${isFetch ? '📡 HTTPS' : '🏧 MEMORY'}- Writting template ${forContent ? 'partial' : 'code'} `
    + `${isFetch ? `POST "${path}"` : `for "${name}" @ "${path}" to memory`}${logLabel}`);
  }
  if (writable && isFetch) {
    await fetcher(mods, path, optional, params, store, writable, registrant.writeFormatter, true, log);
  } else if (writable && !forContent && typeof registrant.writeFormatter === 'function') {
    writable = registrant.writeFormatter(writable, opts.writeFormatOptions);
  }
  if (forContent) {
    await registrant.registerPartial(path, isContentJSON ? JSON.stringify(writable) : typeof writable !== 'string' ? params : writable, extension);
  } else {
    store[cacheName] = store[cacheName] || {};
    store[cacheName][path] = {
      name: path,
      shortName: name,
      func: dataType === 'function' ? writable || data : (new Function(`return ${writable || data}`))()
    };
    return store[cacheName][path].func;
  }
}

/**
 * Determines if a template name has an absolute path in it's name or can be converted to one
 * @private
 * @ignore
 * @param {String} name The template name that uniquely identifies the template content
 * @param {(TemplateOpts | Function(name:String):*)} optional Either the {@link TemplateOpts} or a function that takes a
 * single name argument and returns the option value
 * @returns {Boolean} `true` when the template name has an absolute path in it's name or can be converted to one
 */
function isAbsName(name, optional) {
  const isOptionFunc = typeof optional === 'function';
  const bypassExp = isOptionFunc ? optional('bypassUrlRegExp') : optional.bypassUrlRegExp;
  const hasBase = bypassExp && name.match(bypassExp);
  if (hasBase) return true;
  const partialsURL = isOptionFunc ? optional('partialsURL') : optional.partialsURL;
  return !!partialsURL;
}

/**
 * Loads and/or sets all of the modules that will be used
 * @private
 * @ignore
 * @param {(TemplateOpts | Function(name:String):*)} optional Either the {@link TemplateOpts} or a function that takes a
 * single name argument and returns the option value
 * @returns {Object} The modules
 */
async function modules(optional) {
  const mods = {};
  if (typeof fetch === 'undefined') {
    const isOptionFunc = typeof optional === 'function';
    const cjs = isOptionFunc ? optional('useCommonJs') : optional.useCommonJs;
    mods.https = cjs ? require('https') : /* TODO : ESM use... await import('https')*/null;
  }
  return mods;
}

/**
 * GETs or POSTs data via `window.fetch` in the browser or using the `https` module on the server
 * @private
 * @ignore
 * @param {(String | URL)} [url] The URL to process 
 * @param {(TemplateOpts | Function(name:String):*)} optional Either the {@link TemplateOpts} or a function that takes a
 * single name argument and returns the option value
 * @param {(URLSearchParams | String)} [params] The URL parameters to use (JSON or URL encoded)
 * @param {Object} [store] The object where the template, partials and context are stored
 * @param {String} data The code block that will be written
 * @param {Function} [formatter] The function that will format written sources during include discovery (if any). The formatting function
 * takes 1 or 2 arguments with the first being the content that will be formatted and the second being
 * @param {Boolean} [close] Whether or not to close any resources when complete
 * @param {Object} [log] The log that can contain functions for each of the following: `error`/`warn`/`info`/`debug`.
 * @returns {(String | undefined)} The result or `undefined` when URL is omitted
 */
async function fetcher(mods, url, optional, params, store, data, formatter, close, log) {
  if (!url) return;
  const isOptionFunc = typeof optional === 'function';
  const encoding = isOptionFunc ? optional('encoding') : optional.encoding;
  url = url instanceof URL ? url : new URL(url);
  params = params instanceof URLSearchParams ? params : params ? new URLSearchParams(params) : null;
  const isDataJSON = data && typeof data === 'object';
  data = isDataJSON ? JSON.stringify(data) : data && data.toString();
  if (data && typeof formatter === 'function') {
    const fopts = isOptionFunc ? optional('writeFormatOptions') : optional.writeFormatOptions;
    data = formatter(data, fopts);
  }
  const reqOptName = data ? 'writeFetchRequestOptions' : 'readFetchRequestOptions';
  const ropts = (isOptionFunc ? optional(reqOptName) : optional[reqOptName]) || {};
  ropts.method = (ropts.method && ropts.method.toUpperCase()) || (data ? 'POST' : 'GET');
  ropts.credentials = ropts.credentials || 'same-origin';
  ropts.headers = ropts.headers || {};
  if (ropts.method !== 'GET') {
    // Content-Type needs to match the body
    if (isDataJSON) ropts.headers['Content-Type'] = `application/json; charset=${encoding}`;
    else if (data) ropts.headers['Content-Type'] = `text/javascript; charset=${encoding}`;
    else ropts.headers['Content-Type'] = `application/x-www-form-urlencoded; charset=${encoding}`;
    ropts.headers['Content-Length'] = Buffer.byteLength(data || (params && params.toString())); // needs to match the body
  } else {
    ropts.headers['Content-Type'] = `text/html; charset=${encoding}`; // needs to match the body
  }
  if (ropts.method === 'GET' && params) url.search = params;
  else if (data) ropts.body = data;
  else if (params) ropts.body = params.toString();
  const hasFetch = typeof fetch !== 'undefined';
  if (log && (log.info || log.debug)) {
    (log.debug || log.info)(`CACHE: 📡 ${hasFetch ? 'fetch' : 'https.request'} ${ropts.method} "${url.toString()}"`
      + `${log.debug ? ` for ${JSON.stringify(ropts)}` : ''}`);
  }
  if (hasFetch) {
    const res = await fetch(new Request(url.toString()), ropts);
    if (!res.ok) {
      const err = new Error(`${res.status}: ${res.statusText || ''} <- template content ${ropts.method} failed for: ${url}"`);
      if (log.error) log.error(err);
      throw err;
    }
    if (log && (log.info || log.debug)) {
      (log.debug || log.info)(`CACHE: 📡 fetch ${ropts.method} "${url.toString()}" returned ${log.debug ? res.text() : res.ok ? 'OK' : 'Not OK'}`);
    }
    const rtn = res.text();
    if (!data && ropts.method === 'GET' && typeof formatter === 'function' && typeof rtn === 'string') {
      const fopts = isOptionFunc ? optional('readFormatOptions') : optional.readFormatOptions;
      return formatter(rtn, fopts);
    }
    return rtn || '';
  }
  return new Promise(function httpsFetcher(resolve, reject) {
    const req = mods.https.request(url, ropts, res => {
      var data = '';
      if (res.statusCode < 200 || res.statusCode > 299) {
        return reject(new Error(`${res.statusCode}: ${res.statusMessage || ''} <- template content ${ropts.method} failed for: "${url}"`));
      }
      res.on('data', chunk => {
        data += chunk;
      });
      res.on('end', () => {
        if (log && (log.info || log.debug)) {
          (log.debug || log.info)(`CACHE: 📡 https.request ${ropts.method} "${url.toString()}" returned ${log.debug ? data : 'OK'}`);
        }
        if (ropts.method === 'GET' && typeof formatter === 'function' && typeof data === 'string') {
          const ropts = isOptionFunc ? optional('readFormatOptions') : optional.readFormatOptions;
          resolve(formatter(data, ropts));
        } else resolve(data || '');
      });
    });
    req.on('error', err => {
      if (log && log.error) log.error(err);
      reject(err);
    });
    if (ropts.method !== 'GET') req.write(data || (params && params.toString()));
    req.end();
  });
}

/**
 * Generates the full name path for a given template or context name.
 * @private
 * @ignore
 * @param {Object} nmrs The naming functions container defined by {@link Cachier.readWriteNames}
 * @param {String} name The template name that uniquely identifies the template content
 * @param {(TemplateOpts | Function(name:String):*)} optional Either the {@link TemplateOpts} or a function that takes a
 * single name argument and returns the option value
 * @param {URLSearchParams} [params] Any search parameters to include in the full name
 * @param {Object} store The storage object that can contain metadata for naming operations
 * @param {Boolean} [forContent] `true` to read a template __content__, `false` to read the template source code
 * @param {String} [extension] The file extension designation (only used when `forContent` or `forContext` is truthy)
 * @param {String} [forContext] `true` to read a template __context__ (overrides `forContent`)
 * @returns {String} An name suitable for read/write operations
 */
async function readWriteName(nmrs, name, optional, params, store, forContent, extension, forContext) {
  if (!name) throw new ReferenceError('Template "name" is required');
  const isOptionFunc = typeof optional === 'function';
  forContext = forContext || (name === (isOptionFunc ? optional('defaultContextName') : optional.defaultContextName));
  const bypass = isOptionFunc ? optional('bypassUrlRegExp') : optional.bypassUrlRegExp;
  const isBypass = bypass && name.match(bypass);
  let base = '';
  if (!isBypass) {
    let urlOptName = forContext ? 'contextURL' : 'partialsURL';
    if (!forContext) {
      const fileNameExp = isOptionFunc ? optional('filename') : optional.filename;
      let fileName = fileNameExp && name.match(fileNameExp);
      fileName = fileName && fileName[2];
      if (fileName) {
        const tname = isOptionFunc ? optional('defaultTemplateName') : optional.defaultTemplateName;
        if (tname ===  fileName) urlOptName = 'templateURL';
      }
    }
    base = (isOptionFunc ? optional(urlOptName) : optional[urlOptName]) || '';
    base = base ? `${base}${base.endsWith('/') ? '' : '/'}` : '';
  }
  let ext;
  const isAbs = /^https?:\/?\/?/i.test(name);
  // use pseudo origin when not absolute in order to parse URL parts (removed later)
  const url = new URL(isAbs ? name : `http://example.com/${name}`), extRx = /\.([0-9a-z]+)(?:[\?#]|$)/i;
  if (extRx.test(url.pathname)) {
    ext = ''; // already has extension
  } else if (forContent || forContext) {
    if (typeof extension === 'string') {
      ext = extension;
    } else if (forContext) {
      ext = (isOptionFunc ? optional('defaultContextExtension') : optional.defaultContextExtension) || '';
    } else {
      ext = (isOptionFunc ? optional('defaultExtension') : optional.defaultExtension) || '';
    }
  } else {
    ext = isOptionFunc ? optional('useCommonJs') : optional.useCommonJs ? 'js' : 'mjs';
  }
  if (ext) {
    ext = `${extRx.test(ext) ? '' : '.'}${ext}`;
  }
  let realName = name;
  if (ext) {
    url.pathname = `${url.pathname}${ext}`;
    realName = url.toString();
    if (!isAbs) realName = realName.replace(`${url.origin}/`, '');
  }
  return `${base}${realName}${params instanceof URLSearchParams ? `?${params.toString()}` : ''}`;
}

/**
 * Creates a pseudo registrant
 * @private
 * @ignore
 * @param {String} path The path to the template that will be written
 * @param {(TemplateOpts | Function(name:String):*)} optional Either the {@link TemplateOpts} or a function that takes a
 * single name argument and returns the option value
 * @param {Object} store Where the new cache will be stored
 * @param {Function} readFormatter The read formatter
 * @param {Function} writeFormatter The write formatter
 */
function initRegistrant(path, optional, store, readFormatter, writeFormatter) {
  const reg = {
    registerPartial: async (name, content, extension) => {
      store.data[path] = {
        name: path,
        shortName: name,
        content,
        extension: extension || (typeof optional === 'function' ? optional('defaultExtension') : optional.defaultExtension)
      };
    },
    unregister: name => {
      return Promise.resolve([delete store.data[path], delete store.sources[path]]);
    }
  };
  if (readFormatter) reg.readFormatter = readFormatter;
  if (writeFormatter) reg.writeFormatter = writeFormatter;
  return reg;
}

/**
 * Initializes the cache on a given store
 * @private
 * @ignore
 * @param {Object} store Where the new cache will be stored
 * @returns {Object} The cache object
 */
function initCache(store) {
  store.data = {};
  store.sources = {};
  store.helpers = new Director();
}

// private mapping substitute until the following is adopted: https://github.com/tc39/proposal-class-fields#private-fields
let map = new WeakMap();
let internal = function(object) {
  if (!map.has(object)) map.set(object, {});
  return {
    at: map.get(object),
    this: object
  };
};

// NOTE : WeakMap may cause issues when garbage collected on old versions of Node
// static internal(obj) {
//   if (!obj._data) {
//     Object.defineProperty(obj, '_data', { value: {}, writable: false });
//     Object.defineProperty(obj._data, 'at', { value: {}, writable: false });
//     Object.defineProperty(obj._data, 'this', { value: obj, writable: false });
//   }
//   return obj._data;
// }