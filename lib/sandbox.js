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
   * @param {Function} [namer] The 
   * `function(partialName:String, optional:(TemplateOpts | Function(name:String):*), forContent:Boolean):String`
   * responsible for formatting template names into a full path name consumable by `read`/`write` oprtations
   * @param {(Function | Function[])} [readers] One or more 
   * `async function(partialName:String, optional:(TemplateOpts | Function(name:String):*) [, readParams:URLSearchParams]):String`
   * responsible for reading partial template content/modules/etc during render-time. When a partial template cannot be
   * found within `includes`. When `compileOpts.cacheRawTemplates` is _truthy_ an attempt will be made to update `includes` with
   * the template name/content to prevent unnecessary template partial reads. The functions should not reference any external
   * scope other than the global object space. When returning multiple functions, they should be in the order in which they will
   * be executed.
   * @param {Director} [director] The {@link Director} that will be for extracting {@link Director.directives}
   * @returns {Function} A rendering `async function(context:Object [, renderOptions:TemplateOpts])`
   */
  static compile(name, template, includes, includeFuncs, compileOpts, namer, readers, director) {
    const copts = compileOpts instanceof TemplateOpts ? compileOpts : new TemplateOpts(compileOpts);
    const named = (name && name.replace(FUNC_NAME_REGEXP, '_')) || `template_${Sandbox.guid(null, false)}`;
    const directives = codedDirectives(director);
    const code = coded(named, template, includes, copts, directives, FUNC_NAME_REGEXP, namer, readers);
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
 * @param {Function} [namer] The 
 * `function(partialName:String, optional:(TemplateOpts | Function(name:String):*), forContent:Boolean):String`
 * responsible for formatting template names into a full path name consumable by `read/`write` oprtations
 * @param {(Function | Function[])} [readers] One or more 
 * `async function(partialName:String, optional:(TemplateOpts | Function(name:String):*) [, readParams:URLSearchParams]):String`
 * responsible for reading partial template content/modules/etc during render-time. When a partial template cannot be
 * found within `includes`. When `compileOpts.cacheRawTemplates` is _truthy_ an attempt will be made to update `includes` with
 * the template name/content to prevent unnecessary template partial reads. The functions should not reference any external
 * scope other than the global object space. When returning multiple functions, they should be in the order in which they will
 * be executed.
 * @param {Object} [params] The parameters that will be available via the `options.includesParametersName`
 * alias within the scope of the included template
 * @returns {String} A coded rendering representation to be used in a function body by a template
 * engine. Assumes `arguments[0]` is a `context` object and `arguments[1]` is the rendering options object.
 */
function coded(name, template, includes, compileOpts, directives, nameRegExp, namer, readers, params, metadata) {
  const varName = typeof compileOpts.varName === 'string' ? compileOpts.varName : '';
  const strFn = (key, val) => val instanceof RegExp ? { class: RegExp.name, source: val.source, flags: val.flags } : val;
  const meta = `const metadata=${JSON.stringify({ name, parent: metadata })};`;
  const debug = optional('debugger', compileOpts, {}) ? 'debugger;' : '';
  const namex = `const namer=${typeof namer === 'function' ? namer.toString() : null};`;
  var rdrs = Array.isArray(readers) ? readers : [readers], readerAdded, readx = `const readers=[`;
  for (let rdr of rdrs) {
    if (typeof rdr === 'function') {
      readx += `${readerAdded ? ',' : ''}${rdr.toString()}`;
      readerAdded = true;
    }
  }
  readx += '];';
  const nmreg = `const nameRegExp=/${nameRegExp.source}/${nameRegExp.flags || ''};`;
  const coptx = `const compileOpts=${JSON.stringify(compileOpts, strFn)};`;
  const roptx = `const renderOpts=typeof arguments[1] === 'object' ? arguments[1] : {};`;
  const inclsx = `const optional=${optional.toString()};const store={};const includes=${JSON.stringify(includes)};`;
  const varx = `const varName='${varName}';`;
  const dirsx = `const directives=${JSON.stringify(directives)};`;
  const sandx = `const renderContent=${renderContent.toString()};const renderRead=${renderRead.toString()};const coded=${coded.toString()};`;
  const inclx = `include=${include.toString()};`;
  // read/load the primary template when not passed into coded and/or context JSON when not passed into the renderer
  const tempx = `ctx=typeof arguments[0] === 'object' ? arguments[0] : null;`;
  const itx = `${tempx}{ const cnm=(!ctx || typeof ctx !== 'object') && optional('defaultContextName');ctx=cnm ? await renderRead(cnm, true) : ctx; } `;
  const ctx = `const ${varName}=ctx;const context=${varName};ctx=undefined;`;
  const prm = `const ${optional('includesParametersName', compileOpts, {}) || 'params'}=${JSON.stringify(params)};`;
  // privately scoped parameters are isolated in a separate code block to restrict access to just the include
  // function and other private values
  const incl = `var include,ctx; { ${namex}${readx} { ${nmreg}${coptx}${roptx}${inclsx}${varx}${dirsx}${sandx}${itx}${inclx} } }`;
  // the context object is contained in a separate code block in order to isolate it from access within
  // directives
  return `${meta}${directives.code}; { ${incl}${ctx}${prm}${debug} return \`${template}\`; }\n//# sourceURL=${name}.js\n`;
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
 * Compiles and renders template content at render-time
 * __Assumes the following variables are within scope:__
 * - `metadata` - The metadata for exectution
 * - `compileOpts` - The compile options
 * - `renderOpts` - The rendering options
 * - `store` - Miscellaneous storage container
 * - `includes` - An that contains the partial contents by property name
 * - `context` - The context object passed into the rendering function
 * - `directives` - The directive/helper functions used in the template (from {@link Director.directives})
 * - `readers` - One or more async functions that will read partial templates
 * - `namer` - The function that will compose names that will be passed into the readers
 * - `nameRegExp` - The regular expression that will replace invalid characters when naming rendering functions
 * - `coded` - The {@link coded} function
 * - `optional` - The {@link optional} function
 * @private
 * @param {String} name The template name
 * @param {String} content The raw, uncompiled template content
 * @param {Object} [params] The parameters that will be available via the `options.includesParametersName`
 * alias within the scope of the included template
 * @returns {String} The rendered template content
 */
function renderContent(name, content, params) {
  // new Function restricts access to closures (other than globals)
  const block = coded(name, content, includes, compileOpts, directives, nameRegExp, namer, readers, params, metadata);
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
 * - `includes` - An that contains the partial contents by property name
 * - `context` - The context object passed into the rendering function
 * - `directives` - The directive/helper functions used in the template (from {@link Director.directives})
 * - `readers` - One or more async functions that will read partial templates
 * - `namer` - The function that will compose names that will be passed into the readers
 * - `nameRegExp` - The regular expression that will replace invalid characters when naming rendering functions
 * - `coded` - The {@link coded} function
 * - `optional` - The {@link optional} function
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
  var rtn;
  const fullName = sprms ? `${name}?${sprms.toString()}` : name;
  if (includes[fullName] && includes[fullName].hasOwnProperty('content')) {
    rtn = includes[fullName].content;
  } else if (readers.length && optional('renderTimeIncludeReads')) {
    let readErrMsg = '', rcnt = 0, stacks;
    for (let reader of readers) {
      try {
        rcnt++;
        rtn = await reader(namer(name, optional, true, null, forContext, sprms), optional, sprms, store);
        if (typeof rtn === 'string') break;
        if (rcnt >= readers.length) throw new Error(`Exhausted all available readers`);
      } catch (err) {
        readErrMsg += `${readErrMsg ? `${readErrMsg} <- ` : ''}${err.message} <- Unable to read content via `
          + `"${reader.name}" for include template @ ${fullName} (render-time read)`;
        stacks = stacks || [];
        stacks.push(err.stack);
        err.message = readErrMsg;
        err.stack = stacks.join('\n<- READ\n');
        if (stacks.length >= readers.length) throw err;
      }
    }
    if (typeof rtn === 'string' && optional('cacheRawTemplates')) {
      includes[fullName] = { name: fullName, content: rtn, renderTime: true };
    }
  } else if (sprms) {
    const cause = readers.length ? '"options.renderTimeIncludeReads" is false' : 'no reader function(s) have been defined';
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
 * - `includes` - An that contains the partial contents by property name
 * - `varName` - The name of the context variable
 * - `context` - The context object passed into the rendering function
 * - `directives` - The directive/helper functions used in the template (from {@link Director.directives})
 * - `readers` - One or more async functions that will read partial templates
 * - `namer` - The function that will compose names that will be passed into the readers
 * - `nameRegExp` - The regular expression that will replace invalid characters when naming rendering functions
 * - `coded` - The {@link coded} function
 * - `optional` - The {@link optional} function
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
      if (readers.length && optional('renderTimeIncludeReads')) sprms = exp;
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