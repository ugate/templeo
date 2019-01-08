'use strict';

// TODO : ESM remove the following lines...
const TemplateOpts = require('./template-options');
const Director = require('./director');
// TODO : ESM uncomment the following lines...
// TODO : import * as TemplateOpts from './template-options.mjs';
// TODO : import * as Director from './director.mjs';

module.exports = class Sandbox {
  // TODO : ESM use... export class Sandbox {

  /**
   * Generates a locally sandboxed environment compilation for template rendering
   * @param {String} template The template content that will be encoded into the compilation sequence
   * @param {(String|Object)} includes Either the coded includes string or the includes JSON
   * @param {TemplateOpts} [compileOpts] The {@link TemplateOpts}
   * @returns {String} A coded rendering representation to be used in a function body by a template
   * engine. Assumes `arguments[0]` is a `context` object and `arguments[1]` is the rendering ooptions object.
   */
  static create(template, includes, compileOpts, reader) {
    const copts = compileOpts instanceof TemplateOpts ? compileOpts : new TemplateOpts(compileOpts);
    return coded(template, includes, copts, reader, codedDirectives(copts.directives));
  }

  /**
   * Deserialzes a function string
   * @param {String} str The function string to deserialize
   * @param {String} [name] A name that will be given to the function
   * @param {Boolean} [isAsync] `true` when the function is `async`
   * @returns {Function|null} The deserialized function
   */
  static deserialzeFunction(str, name, isAsync) {
    if (str && typeof str === 'string') {
      //const func = new Function(str);
      //if (name) Object.defineProperty(rtn.func, 'name', { value: name });
      //return name ? { [name](...args) { return func(...args); } }[name] : func;
      const nest = name || isAsync; // could also use ES2017 AsyncFunction
      const coded = nest ? `return ${isAsync ? 'async ' : ''}function${name ? ` ${name}` : ''}(){ ${str} }` : `return ${str}`;
      try {
        return nest ? (new Function(coded))() : new Function(coded);
      } catch (err) {
        err.message += ` CAUSE: Unable to deserialize function ${name || ''} for: ${coded}`;
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
}

/**
 * Manufactures directives/functions that will be available to template lierals during rendering
 * @private
 * @param {Function[]} [directives] A set of functions that will be available to templates during the rendering
 * phase
 * @returns {Object} The `{ names:String, code:String }` where `names` is a string representation of the directive
 * names (in array format) and `code` represents the commulative coded functions
 */
function codedDirectives(directives) {
  const directors = Director.directives;
  const rtn = { names: '', code: '' };
  for (let drv of directors) {
    rtn.code += `${drv.code.toString()}`;
    rtn.names += (rtn.names ? ',' : '') + drv.name;
  }
  if (directives) {
    var di = -1;
    for (let drv of directives) {
      di++;
      if (typeof drv !== 'function') throw new Error(`Directive option at index ${di} must be a named function, not ${drv}`);
      else if (!drv.name) throw new Error(`Directive option at index ${di} must be a named function`);
      rtn.code += `${drv.toString()}`;
      rtn.names += `,${drv.name}`;
    }
  }
  rtn.names = `[${rtn.names}]`;
  return rtn;
}

/**
 * Generates a locally sandboxed environment compilation for template rendering
 * @param {String} template The template content that will be encoded into the compilation sequence
 * @param {(String|Object)} includes Either the coded includes string or the includes JSON
 * @param {TemplateOpts} [compileOpts] The {@link TemplateOpts}
 * @returns {String} A coded rendering representation to be used in a function body by a template
 * engine. Assumes `arguments[0]` is a `context` object and `arguments[1]` is the rendering ooptions object.
 */
function coded(template, includes, compileOpts, reader, directives) {
  const varName = typeof compileOpts.varName === 'string' ? compileOpts.varName : '';
  const readx = `const reader=${typeof reader === 'function' ? reader.toString() : null};`;
  const coptx = `const compileOpts=${JSON.stringify(compileOpts)};`;
  const roptx = `const renderOpts=typeof arguments[1] === 'object' ? arguments[1] : {};`;
  const inclsx = `const includes=${JSON.stringify(includes)};`;
  const varx = `const varName='${varName}';`;
  const dirsx = `const directives=${JSON.stringify(directives)};`;
  const sandx = `const coded=${coded.toString()};`;
  const itx = `const ${varName}=typeof arguments[0] === 'object' ? arguments[0] : {};const context=${varName};`;
  // privately scoped parameters are isolated in a separate code block to restrict access to the include
  // function and other private values
  const incl = `var include; { ${readx} { ${coptx}${roptx}${inclsx}${varx}${dirsx}${sandx}include=${include.toString()}; } }`;
  // the context object is contained in a separate code block in order to isolate it from access within
  // directives
  return `${directives.code}; { ${itx}${incl} return \`${template}\`; }`;
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
 * - `reader` - The `async function(partialName:String):String` that will return the partial content when the partial
 * - `coded` - The {@link coded} function
 * is not present in `includes`. When `compileOpts.isCached` is _truthy_ an attempt will be made to update `includes`
 * with the template name/content to prevent unnecessary template partial reads.
 * @private
 * @async
 * @param {String[]} strs The string passed into template literal tag
 * @param  {String[]} exps The expressions passed into template literal tag
 */
async function include(strs, ...exps) {
  var prms = [];
  const rds = reader ? [] : null;
  const toContent = tmpl => {
    if (!tmpl) tmpl = renderOpts.defaultPartialContent;
    // eval is preferred over new Function here since include should already sanboxed and access to closures is required
    const rtn = tmpl;//eval(`\`${tmpl}\``);
    //const rtn = (new Function(coded(tmpl, includes, compileOpts, reader, directives)))(context, renderOpts);
    return rtn;
  };
  for (let str of strs) {
    if (includes[str] && includes[str].hasOwnProperty('tmpl')) {
      try {
        prms.push(toContent(includes[str].tmpl));
      } catch (err) {
        err.message += ` CAUSE: Unable to include template @ ${str} (string)`;
        throw err;
      }
    } else if (reader) { // read the render-time template content
      rds.push({ name: str, content: reader(str) });
    } else throw new Error(`Cannot find included template @ ${str} (string)`);
  }
  for (let exp of exps) {
    if (includes[exp] && includes[str].hasOwnProperty('tmpl')) {
      try {
        prms.push(toContent(includes[str].tmpl));
      } catch (err) {
        err.message += ` CAUSE: Unable to include template @ ${exp} (expression)`;
        throw err;
      }
    } else if (reader) { // read the render-time template content
      rds.push({ name: str, content: reader(str) });
    } else throw new Error(`Cannot find included template @ ${exp} (expression)`);
  }
  if (rds) {
    for (let read of rds) { // process the dynamic reads
      try {
        read.content = await read.content;
        if (!read.content) read.content = renderOpts.defaultPartialContent;
        if (compileOpts.isCached) includes[read.name] = read;
        prms.push(toContent(read.content));
      } catch (err) {
        err.message += ` CAUSE: Unable to include template @ ${read.name} (dynamic read)`;
        throw err;
      }
    }
  }
  return Promise.all(prms);
}