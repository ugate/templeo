'use strict';

// TODO : ESM remove the following lines...
const TemplateOpts = require('./template-options');
const Director = require('./director');
// TODO : ESM uncomment the following lines...
// TODO : import * as TemplateOpts from './template-options.mjs';
// TODO : import * as Director from './director.mjs';

const FUNC_NAME_REGEXP = /[^\da-zA-Z]/g;

/**
 * A locally sandboxed/isolated environment within a single VM instance
 */
class Sandbox {
  // TODO : ESM use... export class Sandbox {

  /**
   * Compiles a locally sandboxed `async` template rendering function
   * @param {String} [name] The name given to the template (omit to generate via {@link Sandbox.guid})
   * @param {String} template The template content that will be used by the renderer
   * @param {Object} includes The cached partials that can be included in the template with the name of
   * the template as a property of the object
   * @param {String} includes[].name The name of the partial template
   * @param {String} includes[].content The partial template content
   * @param {Object} [includes[].params] The parameters that will be added to scope when the template is parsed
   * @param {Object} [includeFuncs] The cached/compiled partial rendering functions with the name of the
   * template as a property of the object and the value as the rendering function
   * @param {TemplateOpts} [compileOpts] The {@link TemplateOpts}
   * @param {Function} [namer] The function responsible for formatting template names into a full path name consumable by `read`/`write`
   * oprtations. The following arguments will be passed:
   * 1. _{String}_ `partialName` The name of the partial that will be converted into a name suitable for a read operation.
   * 1. _{(TemplateOpts | Function(name:String):*)}_ `optional` Either the {@link TemplateOpts} or a function that takes a single name
   * argument and returns the option value. The following arguments will be passed:
   * 1. _{URLSearchParams}_ `[params]` The URLSearchParams that should be used in the converted name
   * 1. _{Boolean}_ `forContent` The flag indicating if the converted name is being used to capture partials
   * 1. _{String}_ `extension` The file extension override for the converted name (omit to use the default extension set in the options).
   * 1. _{Boolean}_ `forContext` The flag indicating if the converted name is being used to capture context.
   * @param {(Function | Function[] | Object | Object[])} [readers] One or more functions and/or objects that will handle
   * render-time reads
   * @param {Function} [readers[].read] The reader is an `async function` responsible for reading partial template content/modules/etc
   * during render-time when a partial template cannot be found within `includes`. When `options.cacheRawTemplates` is _truthy_ an
   * attempt will be made to add any missing/read partials into `storage.partials` in order to prevent unnecessary template partial
   * reads for repeated includes. Read functions should not reference any external scope other than the global object space. The
   * following arguments will be passed:
   * 1. _{String}_ `partialName` The name of the partial that will be read. The read function may be invoked without a _name_ parameter
   * when the intent is to capture all partials in a single read opteration that will be included.
   * 1. _{(TemplateOpts | Function(name:String):*)}_ `optional` Either the {@link TemplateOpts} or a function that takes a single name
   * argument and returns the option value.
   * 1. _{URLSearchParams}_ `[readParams]` The URLSearchParams that should be used during the read
   * 1. _{Object}_ `storage` The storage object that can contain metadata for read operations and should contain a __partials__ object
   * that stores each of the read paratial template content/metadata.
   * 1. _{Boolean}_ `[close]` A flag indicating whether or not any resources used during the read should be closed/cleaned up after the
   * read completes. Closure may be dependent upon the policy set on the options.
   * 1. _{Object}_ `[log]` A logger that can contain functions for each of the following: `error`/`warn`/`info`/`debug`.
   * 
   * Read functions can return the partial template content and/or it can be set on the `storage.partials`.
   * @param {Function} [readers[].finish] An `async function(storage:Object)` that can perform cleanup tasks for a reader
   * after rendering has completed
   * @param {Boolean} [readers[].readAllOnInitWhenEmpty] Flag indicating that the `readers[].read` function will be invoked
   * without a _name_ parameter when no partials exist during initialization
   * @param {Director} [director] The {@link Director} that will be for extracting {@link Director.directives}
   * @param {Object} [logging] The logging flags that will determine what output will be sent to the `console` (if any) during
   * rendering
   * @param {Boolean} [logging.debug] `true` to output `console.debug` level logging
   * @param {Boolean} [logging.info] `true` to output `console.info` level logging
   * @param {Boolean} [logging.warn] `true` to output `console.warn` level logging
   * @param {Boolean} [logging.error] `true` to output `console.error` level logging
   * @returns {Function} A rendering `async function(context:Object [, renderOptions:TemplateOpts])`
   */
  static compile(name, template, includes, includeFuncs, compileOpts, namer, readers, director, logging) {
    const copts = compileOpts instanceof TemplateOpts ? compileOpts : new TemplateOpts(compileOpts);
    const named = (name && name.replace(FUNC_NAME_REGEXP, '_')) || `template_${Sandbox.guid(null, false)}`;
    const directives = codedDirectives(director);
    const code = coded(named, template, includes, copts, directives, FUNC_NAME_REGEXP, namer, readers, {
      debug: logging && !!logging.debug, info: logging && !!logging.info, warn: logging && !!logging.warn,
      error: logging && !!logging.error
    });
    return Sandbox.deserialzeBlock(code, named, true);
  }

  /**
   * Deserialzes a function string within a locally sandboxed environment (only global variables are accessible)
   * @param {String} functionString The function string to deserialize
   * @returns {Function|null} The deserialized function
   */
  static deserialzeFunction(functionString) {
    if (functionString && typeof functionString === 'string') {
      try {
        return (new Function(`return ${functionString}`))();
      } catch (err) {
        err.message += ` <- Unable to deserialize function string: ${functionString}`;
        throw err;
      }
    }
  }

  /**
   * Deserialzes a code block iwthin a locally sandboxed environment (only global variables are accessible)
   * @param {(String | Function)} block The code block to deserialize
   * @param {String} [name] A name that will be given to the function
   * @param {Boolean} [isAsync] `true` when the function is `async`
   * @returns {(Function | undefined)} The deserialized function
   */
  static deserialzeBlock(block, name, isAsync) {
    const type = typeof block;
    if (block && (type === 'string' || type === 'function')) {
      if (type === 'function') { // convert function into iife formatted function block
        block = `return (${block.toString()})()`;
      }
      const named = name && name.length ? ` ${name.replace(FUNC_NAME_REGEXP, '_')}` : '';
      // pass require (when present) since it may be hidden from the block scope
      const rqr = typeof require !== 'undefined' ? require : undefined;
      const rqrd = rqr ? `const require=arguments[0];` : '';
      const code = `${rqrd}return ${isAsync ? 'async ' : ''}function${named}(){ ${block}; }`;
      try {
        //const func = new Function(code);
        //if (named) Object.defineProperty(rtn.func, 'name', { value: named });
        //return named ? { [named](...args) { return func(...args); } }[named] : func;
        // could also use ES2017 new AsyncFunction(...)
        return (new Function(code))(rqr);
      } catch (err) {
        err.message += ` <- Unable to deserialize code ${name || ''} for: ${code}`;
        throw err;
      }
    }
  }

  /**
   * Serialzes a function
   * @param {Function} func The function to serialize
   * @returns {String|null} The serialized function
   */
  static serialzeFunction(func) {
    return func && typeof func === 'function' ? func.toString() : null;
  }

  /**
  * Generates a GUID or formats an existing `value`
  * @param {String} [value] when present, will format the value by add any missing hyphens (if `hyphenate=true`)
  * instead of generating a new value
  * @param {Boolean} [hyphenate=true] true to include hyphens in generated result
  * @returns {String} the generated GUID
  */
  static guid(value, hyphenate = true) {
    const hyp = hyphenate ? '-' : '';
    if (value) return hyphenate ? value.replace(/(.{8})-?(.{4})-?(.{4})-?(.{4})-?(.{12})/gi, `$1${hyp}$2${hyp}$3${hyp}$4${hyp}$5`) : value;
    return `xxxxxxxx${hyp}xxxx${hyp}4xxx${hyp}yxxx${hyp}xxxxxxxxxxxx`.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * @returns {Object} The global object. Typically, `window` when ran within a browser or `global` when ran on a server
   */
  static get global() {
    return (function globalize(){ return this; })();
  }
}

// TODO : ESM remove the following lines...
module.exports = Sandbox;

/**
 * Manufactures directives/functions that will be available to template lierals during rendering
 * @private
 * @param {Director} [director] The {@link Director} that will be for extracting {@link Director.directives}
 * @returns {Object} The `{ names:String, code:String }` where `names` is a string representation of the directive
 * names (in array format) and `code` represents the commulative coded functions
 */
function codedDirectives(director) {
  if (!(director instanceof Director)) {
    throw new Error(`Expected ${Director.name}, but found ${director}`);
  }
  const directives = director.directives;
  const rtn = { names: '', code: '' };
  for (let drv of directives) {
    rtn.code += `${drv.code.toString()}`;
    rtn.names += (rtn.names ? ',' : '') + drv.name;
  }
  rtn.names = `[${rtn.names}]`;
  return rtn;
}

/**
 * Generates a locally sandboxed environment compilation for template rendering
 * @private
 * @param {String} name A sanitized name given to the template
 * @param {String} template The template content that will be used by the renderer
 * @param {Object} includes The cached partials that can be included in the template with the name of
 * the template as a property of the object
 * @param {String} includes[].name The name of the partial template
 * @param {String} includes[].content The partial template content
 * @param {TemplateOpts} compileOpts The {@link TemplateOpts}
 * @param {Object} directives A return object from {@link codedDirectives}
 * @param {RegExp} nameRegExp The regular expression that will replace invalid characters when naming rendering functions
 * @param {Function} [namer] The function responsible for formatting template names into a full path name consumable by `read`/`write`
 * oprtations. The following arguments will be passed:
 * 1. _{String}_ `partialName` The name of the partial that will be converted into a name suitable for a read operation.
 * 1. _{(TemplateOpts | Function(name:String):*)}_ `optional` Either the {@link TemplateOpts} or a function that takes a single name
 * argument and returns the option value.
 * 1. _{URLSearchParams}_ `[params]` The URLSearchParams that should be used in the converted name
 * 1. _{Boolean}_ `forContent` The flag indicating if the converted name is being used to capture partials
 * 1. _{String}_ `extension` The file extension override for the converted name (omit to use the default extension set in the options).
 * 1. _{Boolean}_ `forContext` The flag indicating if the converted name is being used to capture context.
 * @param {(Function | Function[] | Object | Object[])} [readers] One or more functions and/or objects that will handle
 * render-time reads
 * @param {Function} [readers[].read] The reader is an `async function` responsible for reading partial template content/modules/etc
 * during render-time when a partial template cannot be found within `includes`. When `options.cacheRawTemplates` is _truthy_ an
 * attempt will be made to add any missing/read partials into `storage.partials` in order to prevent unnecessary template partial
 * reads for repeated includes. Read functions should not reference any external scope other than the global object space. The
 * following arguments will be passed:
 * 1. _{String}_ `partialName` The name of the partial that will be read. The read function may be invoked without a _name_ parameter
 * when the intent is to capture all partials in a single read opteration that will be included.
 * 1. _{(TemplateOpts | Function(name:String):*)}_ `optional` Either the {@link TemplateOpts} or a function that takes a single name
 * argument and returns the option value.
 * 1. _{URLSearchParams}_ `[readParams]` The URLSearchParams that should be used during the read
 * 1. _{Object}_ `storage` The storage object that can contain metadata for read operations and should contain a __partials__ object
 * that stores each of the read paratial template content/metadata.
 * 1. _{Boolean}_ `[close]` A flag indicating whether or not any resources used during the read should be closed/cleaned up after the
 * read completes. Closure may be dependent upon the policy set on the options.
 * 1. _{Object}_ `[log]` A logger that can contain functions for each of the following: `error`/`warn`/`info`/`debug`.
 * 
 * Read functions can return the partial template content and/or it can be set on the `storage.partials`.
 * @param {Function} [readers[].finish] An `async function(storage:Object)` that can perform cleanup tasks for a reader
 * after rendering has completed
 * @param {Boolean} [readers[].readAllOnInitWhenEmpty] Flag indicating that the `readers[].read` function will be invoked
 * without a _name_ parameter when no partials exist during initialization
 * @param {Object} [logging] The logging flags that will determine what output will be sent to the `console` (if any) during
 * rendering
 * @param {Boolean} [logging.debug] `true` to output `console.debug` level logging
 * @param {Boolean} [logging.info] `true` to output `console.info` level logging
 * @param {Boolean} [logging.warn] `true` to output `console.warn` level logging
 * @param {Boolean} [logging.error] `true` to output `console.error` level logging
 * @param {Object} [params] The parameters that will be available via the `options.includesParametersName`
 * alias within the scope of the included template
 * @param {Object} [metadata] The metadata that describes the template being coded (exposed to the tempalte scope)
 * @param {String} [metadata.name] The name of the template that the current template is being coded for
 * @param {Object} [metadata.parent] The metadata of the template parent to the current one being coded
 * @param {Object} [storeMeta] The private metadata pertaining to the storage being used
 * @param {Boolean} [storeMeta.hasReadAll] `true` when the templates have been flagged by a `readers[].readAllOnInitWhenEmpty`
 * and meets the criteria described
 * @param {Boolean} [storeMeta.finished] `true` when all of the available `readers[].finish` functions have completed execution
 * @returns {String} A coded rendering representation to be used in a function body by a template
 * engine. Assumes `arguments[0]` is a `context` object and `arguments[1]` is the rendering options object.
 */
function coded(name, template, includes, compileOpts, directives, nameRegExp, namer, readers, logging, params, metadata, storeMeta) {
  const varName = typeof compileOpts.varName === 'string' ? compileOpts.varName : '';
  const strFn = (key, val) => val instanceof RegExp ? { class: RegExp.name, source: val.source, flags: val.flags } : val;
  const meta = `const metadata=Object.freeze(${JSON.stringify({ name, parent: metadata })});`;
  const debug = optional('debugger', compileOpts, {}) ? 'debugger;' : '';
  const logx = `const logging=${JSON.stringify(logging)};const log={debug:logging.debug && console.debug`
    + ',info:logging.info && console.info,warn:logging.warn && console.warn,error:logging.error && console.error};';
  const namex = `const namer=${typeof namer === 'function' ? namer.toString() : null};`;
  var rdrs = Array.isArray(readers) ? readers : [readers], readerAdded, rdro, readx = `const readers=[`;
  for (let rdr of rdrs) { 
    rdro = typeof rdr === 'function' ? `{read:${rdr.toString()}}` : rdr && typeof rdr.read === 'function' ?
      `{read:${rdr.read.toString()}${typeof rdr.finish === 'function' ? `,finish:${rdr.finish.toString()}`
      + `,readAllOnInitWhenEmpty:${!!rdr.readAllOnInitWhenEmpty}` : ''}}` : '';
    if (rdro) {
      readx += `${readerAdded ? ',' : ''}${rdro}`;
      readerAdded = true;
    }
  }
  readx += `];`;
  const nmreg = `const nameRegExp=/${nameRegExp.source}/${nameRegExp.flags || ''};`;
  const coptx = `const compileOpts=${JSON.stringify(compileOpts, strFn)};`;
  const roptx = `const renderOpts=typeof arguments[1] === 'object' ? arguments[1] : {};`;
  const inclsx = `const optional=${optional.toString()};const includes=${JSON.stringify(includes)};`;
  const storex = `const store={partials:includes};const storeMeta=${storeMeta ? JSON.stringify(storeMeta) : '{}'};`;
  const varx = `const varName='${varName}';`;
  const dirsx = `const directives=${JSON.stringify(directives)};`;
  const sandx = `const renderContent=${renderContent.toString()};const renderRead=${renderRead.toString()};const coded=${coded.toString()};`;
  const inclx = `_readHander=${_readHander.toString()};include=${include.toString()};await _readHander();`;
  // read/load the primary template when not passed into coded and/or context JSON when not passed into the renderer
  const tempx = `ctx=typeof arguments[0] === 'object' ? arguments[0] : null;`;
  const itx = `${tempx}{ const cnm=(!ctx || typeof ctx !== 'object') && optional('defaultContextName');ctx=cnm ? await renderRead(cnm, true) : ctx; } `;
  const ctx = `const ${varName}=ctx;const context=${varName};ctx=undefined;`;
  const prm = `const ${optional('includesParametersName', compileOpts, {}) || 'params'}=${JSON.stringify(params)};`;
  // privately scoped parameters are isolated in a separate code block to restrict access to just the include
  // function and other private values
  const incl = `var include,ctx,_readHander; { ${logx}${namex}${readx} { ${nmreg}${coptx}${roptx}${inclsx}${storex}${varx}${dirsx}${sandx}${itx}${inclx} } }`;
  const fnsh = `await _readHander(true);`;
  // the context object is contained in a separate code block in order to isolate it from access within
  // directives
  return `${meta}${directives.code}; { ${incl}${ctx}${prm}${debug}const result=\`${template}\`;${fnsh}return result; }\n//# sourceURL=${name}.js\n`;
}

/**
 * Returns either the `renderOpts` or the `compileOpts` option value (in that order of precedence). Also converts `RegExp` constructs
 * into regular expressions. For example, `{ class: 'RegExp', source: "a|b", flags: "i" }` will be converted into `/a|b/i`.
 * __Assumes the following variables are within scope:__
 * - `compileOpts` - The compile options
 * - `renderOpts` - The rendering options
 * @private
 * @ignore
 * @param {String} name The name of the option to check for
 * @param {Object} [copts] Compile options override of an in-scope `compileOpts`
 * @param {Object} [ropts] Render options override of an in-scope `renderOpts`
 * @returns {*} The value of the option
 */
function optional(name, copts, ropts) {
  copts = copts || compileOpts;
  ropts = ropts || renderOpts;
  const opts = ropts.hasOwnProperty(name) ? ropts : copts;
  if (opts[name] && opts[name].class === RegExp.name) {
    opts[name] = new RegExp(opts[name].source, opts[name].flags);
  }
  return opts[name];
}

/**
 * Runs through all of the readers and runs any async `finish` tasks
 * __Assumes the following variables are within scope:__
 * - `store` - Miscellaneous storage container
 * - `storeMeta` - The storage metadata
 * - `readers` - One or more async functions that will read partial templates
 * - `optional` - The {@link optional} function
 * - `logging` - The logging flags
 * - `log` - The logging functions
 * @private
 * @ignore
 * @param {Boolean} [isFinish] `true` when running any `reader.finish` tasks, `false` when running any readers
 * that have `reader.readAllOnInitWhenEmpty` that call `readers.read` without a name
 */
async function _readHander(isFinish) {
  if (isFinish) {
    if (!metadata.name || storeMeta.finished) return;
    if (metadata.name !== optional('defaultTemplateName')) return;
  }
  for (let rdr of readers) {
    if (isFinish) {
      if (rdr.finish) await rdr.finish(store, optional, log);
    } else if (!storeMeta.hasReadAllOnInit && optional('renderTimeReadPolicy') === 'read-all-on-init-when-empty'
        && !Object.getOwnPropertyNames(includes).length) {
      await rdr.read(null, optional, null, store, true, log);
      storeMeta.hasReadAllOnInit = true;
    }
  }
  if (isFinish) {
    storeMeta.finished = true;
  }
}

/**
 * Compiles and renders template content at render-time
 * __Assumes the following variables are within scope:__
 * - `metadata` - The metadata for exectution
 * - `compileOpts` - The compile options
 * - `renderOpts` - The rendering options
 * - `store` - Miscellaneous storage container
 * - `storeMeta` - The storage metadata
 * - `includes` - An that contains the partial contents by property name
 * - `context` - The context object passed into the rendering function
 * - `directives` - The directive/helper functions used in the template (from {@link Director.directives})
 * - `readers` - One or more async functions that will read partial templates
 * - `namer` - The function that will compose names that will be passed into the readers
 * - `nameRegExp` - The regular expression that will replace invalid characters when naming rendering functions
 * - `coded` - The {@link coded} function
 * - `optional` - The {@link optional} function
 * - `log` - The logging functions
 * @private
 * @param {String} name The template name
 * @param {String} content The raw, uncompiled template content
 * @param {Object} [params] The parameters that will be available via the `options.includesParametersName`
 * alias within the scope of the included template
 * @returns {String} The rendered template content
 */
function renderContent(name, content, params) {
  // new Function restricts access to closures (other than globals)
  const block = coded(name, content, includes, compileOpts, directives, nameRegExp, namer, readers,
    logging, params, metadata, storeMeta);
  if (!content) content = optional('defaultPartialContent');
  // pass require (when present) since it may be hidden from the block scope
  const rqr = typeof require !== 'undefined' ? require : undefined;
  // optionally "require" can be passed when available
  const rqrd = rqr ? `const require=arguments[0];` : '';
  const named = name.replace(nameRegExp, '_');
  const renderer = new Function(`${rqrd}return async function ${named}(){ ${block}; }`)(rqr);
  return renderer(context, renderOpts);
}

/**
 * Reads a template __content__ or a template __context__ at render-time
 * __Assumes the following variables are within scope:__
 * - `metadata` - The metadata for exectution
 * - `compileOpts` - The compile options
 * - `renderOpts` - The rendering options
 * - `store` - Miscellaneous storage container
 * - `storeMeta` - The storage metadata
 * - `includes` - An that contains the partial contents by property name
 * - `context` - The context object passed into the rendering function
 * - `directives` - The directive/helper functions used in the template (from {@link Director.directives})
 * - `readers` - One or more async functions that will read partial templates
 * - `namer` - The function that will compose names that will be passed into the readers
 * - `nameRegExp` - The regular expression that will replace invalid characters when naming rendering functions
 * - `coded` - The {@link coded} function
 * - `optional` - The {@link optional} function
 * - `logging` - The logging flags
 * - `log` - The logging functions
 * @private
 * @param {String} name The template or context name
 * @param {Boolean} [forContext] `true` to read a template __context__ instead of the default read for a template
 * __content__
 * @param {URLSearchParams} [sprms] The key/value parameters to pass into the `readers`
 * @param {Object} [iprms] The parameters that will be available via the `options.includesParametersName`
 * alias within the scope of the included template
 * @param {Boolean} [fromExpression] `true` when the read is from an interpolated expression
 * @returns {(String | Object)} Either the template __content__ or the JSON __context__
 */
async function renderRead(name, forContext, sprms, iprms, fromExpression) {
  var rtn, fullName;
  try {
    fullName = namer(name, optional, sprms, true, null, forContext);
  } catch (err) {
    err.message += `${err.message} <- Unable to extract a name for con${forContext ? 'text' : 'tent'} via`
    + ` "${rdr.namer.name}" for include template @ "${fullName}" (render-time read)`;
    throw err;
  }
  if (includes[fullName] && includes[fullName].hasOwnProperty('content')) {
    rtn = includes[fullName].content;
  } else if (readers.length && optional('renderTimeReadPolicy') !== 'none') {
    let error, nerr, rcnt = 0, close;
    for (let rdr of readers) {
      try {
        rcnt++;
        close = optional('renderTimeReadPolicy') === 'read-and-close';
        rtn = await rdr.read(fullName, optional, sprms, store, close, log);
        if (typeof rtn === 'string') break;
        else if (store.partials[fullName] && typeof store.partials[fullName].content === 'string') {
          rtn = store.partials[fullName].content;
          break;
        }
        if (rcnt >= readers.length) throw new Error(`Exhausted all available readers`);
      } catch (err) {
        nerr = new err.constructor('');
        nerr.stack = `${err.message}${error && error.message ? ` <- ${error.message}` : ''}`
        + (rcnt >= readers.length ? ` <- Unable to read content via "${rdr.read.name}" for include template @`
        + ` "${fullName}"${err instanceof TypeError ? ' Ensure that a proper *PathBase option has been set' : ''} (render-time read)`
        : '') + `\nREADER #${rcnt}: ${rdr.read.name}\n${err.stack}${error ? `\n${error.stack}` : ''}`;
        error = nerr;
      }
      if (error && rcnt >= readers.length) throw error;
    }
    if (typeof rtn === 'string' && optional('cacheRawTemplates')) {
      includes[fullName] = { name: fullName, shortName: name, content: rtn, renderTime: true };
    }
  } else if (sprms) {
    const cause = readers.length ? '"options.renderTimeReadPolicy" is set to "none"' : 'no reader function(s) have been defined';
    const detail = `Read refresh required since parameters have been passed to include, but ${cause}. Parameters: ${sprms.toString()} `;
    throw new Error(`Cannot include template @ ${fullName} (${fromExpression ? 'expression' : 'string'} literal). ${detail}`);
  } else throw new Error(`Cannot find included template @ ${fullName} (${fromExpression ? 'expression' : 'string'} literal)`);
  if (forContext) {
    try {
      rtn = JSON.parse(rtn);
    } catch (err) {
      err.message += ` <- Unable to parse JSON context @ ${fullName} (render-time read)`;
      throw err;
    }
  } else {
    try {
      rtn = await renderContent(fullName, rtn, iprms);
    } catch (err) {
      err.message += ` <- Unable to include template @ ${fullName} (render-time read)`;
      throw err;
    }
  }
  return rtn;
}

/**
 * Template literal tag that will include partials during the rendering phase.
 * __Assumes the following variables are within scope:__
 * - `compileOpts` - The compile options
 * - `renderOpts` - The rendering options
 * - `store` - Miscellaneous storage container
 * - `storeMeta` - The storage metadata
 * - `includes` - An that contains the partial contents by property name
 * - `varName` - The name of the context variable
 * - `context` - The context object passed into the rendering function
 * - `directives` - The directive/helper functions used in the template (from {@link Director.directives})
 * - `readers` - One or more async functions that will read partial templates
 * - `namer` - The function that will compose names that will be passed into the readers
 * - `nameRegExp` - The regular expression that will replace invalid characters when naming rendering functions
 * - `coded` - The {@link coded} function
 * - `optional` - The {@link optional} function
 * - `logging` - The logging flags
 * - `log` - The logging functions
 * - `renderContent` - The {@link renderContent} function
 * - `renderRead` - The {@link renderRead} function
 * @private
 * @param {String[]} strs The string passed into template literal tag that contains the partial template name to include
 * @param  {Array} exps The expressions passed into template literal tag. Each expression can be one of the following:
 * - `String` - A partial template name to include
 * - `Object` - An object that contains properties that will be passed into the read function for each name that appear
 * __at__ or __before__ the same index as the object parameter expression. Parameters are __not__ cumulative. For example,
 * `name1${ { param1: 1 } }name2${ { param2: 2 } }` would imply `name1` would have `param1` while `name2` would __only__
 * have `param2`, __not__ `param1`.
 */
async function include(strs, ...exps) {
  var rtn = '';
  for (let i = 0, ln = Math.max(strs.length, exps.length), str, exp, names, ni, sprms, iprms; i < ln; i++) {
    str = strs[i] && strs[i].trim();
    exp = exps[i];
    if (str && exp instanceof URLSearchParams) {
      if (readers.length && optional('renderTimeReadPolicy') !== 'none') sprms = exp;
      exp = null;
    } else if (str && exp && typeof exp === 'object') {
      iprms = exp;
      exp = null;
    }
    if (!str && !exp && !sprms && !iprms) continue;
    names = str && exp ? [str, exp] : str ? [str] : exp ? [exp] : null;
    if (names) {
      ni = -1;
      for (let name of names) {
        ni++;
        rtn += await renderRead(name, false, sprms, iprms, ni > 0);
      }
    }
    sprms = iprms = null; // parameters do not carry over from one string/expression to the next
  }
  return rtn;
}