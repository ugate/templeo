'use strict';

// TODO : ESM remove the following lines...
const TemplateOpts = require('./template-options');
const Director = require('./director');
// TODO : ESM uncomment the following lines...
// TODO : import * as TemplateOpts from './template-options.mjs';
// TODO : import * as Director from './director.mjs';

const FUNC_NAME_REGEXP = /[^\da-zA-Z]/g;

/**
 * A locally sandboxed environment within a single VM instance
 * @private
 */
module.exports = class Sandbox {
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
   * @param {Function} [reader] The
   * `async function(partialName:String, optional:(TemplateOpts | Function(name:String):*) [, readParams:URLSearchParams]):String`
   * responsible for reading partial template content/modules/etc during render-time. When a partial template cannot be
   * found within `includes`. When `compileOpts.cacheRawTemplates` is _truthy_ an attempt will be made to update `includes` with
   * the template name/content to prevent unnecessary template partial reads.
   * @param {Class<Director>} [DirClass] The {@link Director} class that will be for extracting {@link Director.directives}
   * @returns {Function} A rendering `async function(context:Object [, renderOptions:TemplateOpts])`
   */
  static compile(name, template, includes, includeFuncs, compileOpts, namer, reader, DirClass) {
    const copts = compileOpts instanceof TemplateOpts ? compileOpts : new TemplateOpts(compileOpts);
    const named = (name && name.replace(FUNC_NAME_REGEXP, '_')) || `template_${Sandbox.guid(null, false)}`;
    const directives = codedDirectives(DirClass);
    const code = coded(named, template, includes, copts, directives, FUNC_NAME_REGEXP, namer, reader);
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
   * @param {String} block The code block to deserialize
   * @param {String} [name] A name that will be given to the function
   * @param {Boolean} [isAsync] `true` when the function is `async`
   * @returns {Function|null} The deserialized function
   */
  static deserialzeBlock(block, name, isAsync) {
    if (block && typeof block === 'string') {
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
}

/**
 * Manufactures directives/functions that will be available to template lierals during rendering
 * @private
 * @param {Class<Director>} [DirClass] The {@link Director} class that will be for extracting {@link Director.directives}
 * @returns {Object} The `{ names:String, code:String }` where `names` is a string representation of the directive
 * names (in array format) and `code` represents the commulative coded functions
 */
function codedDirectives(DirClass) {
  if (DirClass !== Director && !Director.isPrototypeOf(DirClass)) {
    throw new Error(`Expected ${Director.name} class, but found ${(DirClass && DirClass.name) || DirClass} class`);
  }
  const directors = DirClass.directives;
  const rtn = { names: '', code: '' };
  for (let drv of directors) {
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
 * @param {Function} [reader] The
 * `async function(partialName:String, optional:(TemplateOpts | Function(name:String):*) [, readParams:URLSearchParams]):String`
 * responsible for reading partial template content/modules/etc during render-time. When a partial template cannot be
 * found within `includes`. When `compileOpts.cacheRawTemplates` is _truthy_ an attempt will be made to update `includes` with
 * the template name/content to prevent unnecessary template partial reads.
 * @param {Object} [params] The parameters that will be available via the `options.includesParametersName`
 * alias within the scope of the included template
 * @returns {String} A coded rendering representation to be used in a function body by a template
 * engine. Assumes `arguments[0]` is a `context` object and `arguments[1]` is the rendering options object.
 */
function coded(name, template, includes, compileOpts, directives, nameRegExp, namer, reader, params, metadata) {
  const varName = typeof compileOpts.varName === 'string' ? compileOpts.varName : '';
  const strFn = (key, val) => val instanceof RegExp ? { class: RegExp.name, source: val.source, flags: val.flags } : val;
  const meta = `const metadata=${JSON.stringify({ name, parent: metadata })};`;
  const debug = optional('debugger', compileOpts, {}) ? 'debugger;' : '';
  const namex = `const namer=${typeof namer === 'function' ? namer.toString() : null};`;
  const readx = `const reader=${typeof reader === 'function' ? reader.toString() : null};`;
  const nmreg = `const nameRegExp=/${nameRegExp.source}/${nameRegExp.flags || ''};`;
  const coptx = `const compileOpts=${JSON.stringify(compileOpts, strFn)};`;
  const roptx = `const renderOpts=typeof arguments[1] === 'object' ? arguments[1] : {};`;
  const inclsx = `const optional=${optional.toString()};const includes=${JSON.stringify(includes)};`;
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
 * - `includes` - An that contains the partial contents by property name
 * - `context` - The context object passed into the rendering function
 * - `directives` - The directive/helper functions used in the template (from {@link Director.directives})
 * - `reader` - The async function that will read partial templates
 * - `namer` - The function that will compose names that will be passed into the reader
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
  const block = coded(name, content, includes, compileOpts, directives, nameRegExp, namer, reader, params, metadata);
  if (!content) content = optional('defaultPartialContent');
  // pass require (when present) since it may be hidden from the block scope
  const rqr = typeof require !== 'undefined' ? require : undefined;
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
 * - `includes` - An that contains the partial contents by property name
 * - `context` - The context object passed into the rendering function
 * - `directives` - The directive/helper functions used in the template (from {@link Director.directives})
 * - `reader` - The async function that will read partial templates
 * - `namer` - The function that will compose names that will be passed into the reader
 * - `nameRegExp` - The regular expression that will replace invalid characters when naming rendering functions
 * - `coded` - The {@link coded} function
 * - `optional` - The {@link optional} function
 * @private
 * @param {String} name The template or context name
 * @param {Boolean} [forContext] `true` to read a template __context__ instead of the default read for a template
 * __content__
 * @param {URLSearchParams} [searchParams] The key/value parameters to pass into the `reader`
 * @param {Object} [includeParams] The parameters that will be available via the `options.includesParametersName`
 * alias within the scope of the included template
 * @returns {(String | Object)} Either the template __content__ or the JSON __context__
 */
async function renderRead(name, forContext, searchParams, includeParams) {
  var rtn;
  try {
    rtn = await reader(namer(name, optional, true, null, forContext), optional, searchParams);
    if (optional('cacheRawTemplates')) {
      // params are not added here since they have been dynamically included at render-time
      includes[name] = { name, content: rtn, renderTime: true };
    }
  } catch (err) {
    err.message += ` <- Unable to read content for include template @ ${name} (render-time read)`;
    throw err;
  }
  if (forContext) {
    try {
      rtn = JSON.parse(rtn);
    } catch (err) {
      err.message += ` <- Unable to parse JSON context @ ${name} (render-time read)`;
      throw err;
    }
  } else {
    try {
      rtn = await renderContent(name, rtn, includeParams);
    } catch (err) {
      err.message += ` <- Unable to include template @ ${name} (render-time read)`;
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
 * - `includes` - An that contains the partial contents by property name
 * - `varName` - The name of the context variable
 * - `context` - The context object passed into the rendering function
 * - `directives` - The directive/helper functions used in the template (from {@link Director.directives})
 * - `reader` - The async function that will read partial templates
 * - `namer` - The function that will compose names that will be passed into the reader
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
      if (reader && optional('renderTimeIncludeReads')) sprms = exp;
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
        // passing parameters always initiates a read to be invoked 
        if (!sprms && includes[name] && includes[name].hasOwnProperty('content')) {
          try {
            rtn += await renderContent(name, includes[name].content, iprms);
          } catch (err) {
            err.message += ` <- Unable to include template @ ${name} (${ni > 0 ? 'expression' : 'string'} literal)`;
            throw err;
          }
        } else if (reader && optional('renderTimeIncludeReads')) {
          rtn += await renderRead(name, false, sprms, iprms);
        } else if (sprms) {
          const cause = reader ? '"options.renderTimeIncludeReads" is false' : 'no reader function has been defined';
          const detail = `Read refresh required since parameters have been passed to include, but ${cause}. Parameters: ${sprms.toString()} `;
          throw new Error(`Cannot include template @ ${name} (${ni > 0 ? 'expression' : 'string'} literal). ${detail}`);
        } else throw new Error(`Cannot find included template @ ${name} (${ni > 0 ? 'expression' : 'string'} literal)`);
      }
    }
    sprms = iprms = null; // parameters do not carry over from one string/expression to the next
  }
  return rtn;
}