'use strict';

const EngineOpts = require('./lib/engine-opts');
const JsonEngine = require('./lib/json-engine');
const Cache = require('./lib/cache');

/**
 * Micro rendering template engine
 * @example
 * // Basic example in browser
 * const Tmpl = require('templeo');
 * const vconf = {
 *  compileMode: 'sync',
 *  defaultExtension: 'html', // can be HTML, JSON, etc.
 *  isCached: true, // use with caution: when false, loades partial file(s) on every request!!!
 *  relativeTo: '/', // used to build template identifiers
 *  path: 'views',
 *  layoutPath: 'views/layout',
 *  layout: true,
 *  partialsPath: 'views/partials',
 *  helpersPath: 'views/helpers'
 * };
 * const htmlEngine = new Tmpl.Engine(vconf);
 * @example
 * // Node/Hapi example using vision:
 * const JsFrmt = require('js-beautify').js;
 * const Tmpl = require('templeo');
 * const vconf = {
 *  compileMode: 'sync',
 *  defaultExtension: 'html', // can be HTML, JSON, etc.
 *  isCached: true, // use with caution: when false, loades partial file(s) on every request!!!
 *  relativeTo: process.cwd(),
 *  path: 'views',
 *  layoutPath: 'views/layout',
 *  layout: true,
 *  partialsPath: 'views/partials',
 *  helpersPath: 'views/helpers'
 * };
 * const htmlEngine = await Tmpl.filesEngine(vconf, JsFrmt);
 * // use the following instead if compiled templates don't need to be stored in files
 * //const htmlEngine = new Tmpl.Engine(vconf);
 * vconf.engines = {
 *  html: htmlEngine,
 *  json: new Tmpl.JsonEngine()
 * };
 * try {
 *  await server.register([{ register: require('vision'), options: vconf }]);
 *  server.views(vconf);
 *  server.app.htmlPartial = htmlEngine.genPartialFunc(); // optinal HTML partial processing access via app/server
 * } catch (err) {
 *   console.error(err);
 * }
 */
class Engine {
// TODO : ESM use... export class Engine {

  /**
   * Creates a template parsing engine
   * @param {EngineOpts} [opts] The {@link EngineOpts} to use
   * @param {Cache} [cache] A {@link Cache} instance that will handle compiled template persistence
   */
  constructor(opts, cache) {
    const max = 1e10, min = 0, opt = Engine.genOptions(opts), ns = Cache.internal(this);
    ns.options = opt;
    ns.cache = cache instanceof Cache ? cache : new Cache(ns.options);
    ns.isInit = false;
    ns.prts = {};
    ns.marker = Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * A {@link https://nodejs.org|Node.js} __only__ {@link Engine} to cache templates as files for better debugging/caching
   * @param {EngineOpts} [opts] The {@link EngineOpts}
   * @param {Function} [formatFunc] The `function(string, outputFormatting)` that will return a formatted string when __writting__
   * data using the `outputFormatting` from {@link EngineOpts} as the formatting options.
   * @returns {Engine} A new {@link Engine} instance that will cache compiled templates in the file system
   */
  static async filesEngine(opts, formatFunc) {
    // TODO : ESM use... 
    // const CacheFiles = await import('lib/cache-files');
    const CacheFiles = require('./lib/cache-files');
    return new Engine(opts, new CacheFiles(opts, formatFunc));
  }

  /**
   * Generates options to be used in an {@link EngineOpts}
   * @param {Object} [opts] an optional object with any number of presets
   * @returns {EngineOpts} a new {@link EngineOpts}
   */
  static genOptions(opts) {
    return opts instanceof EngineOpts ? opts : new EngineOpts(opts);
  }

  /**
   * Processes a template
   * @param {String} tmpl the raw template source
   * @param {EngineOpts} [options] the options that overrides the default engine options
   * @param {Object} [def] the object definition to be used in the template
   * @param {String} [def.filename] when the template name is omitted, an attempt will be made to extract a name from the `filename` using `options.filename`
   * regular expression
   * @param {String} [tname] name to be given to the template
   * @param {Cache} [cache] The {@link Cache} instance that will handle the {@link Cache.write} of the template content
   * @returns {Function} the `function(data)` that returns a template result string based uopn the data object provided
   */
  static async templater(tmpl, options, def, tname, cache) {
    const c = options instanceof EngineOpts ? options : new EngineOpts(options);
    cache = cache instanceof Cache ? cache : new Cache(c);
    const tnm = tname || (def && def.filename && def.filename.match(c.filename)[2]) || ('template_' + cache.guid(null, false));
    const startend = {
  		append: { start: "'+(", end: ")+'", startencode: "'+encodeHTML(" },
  		split:  { start: "';out+=(", end: ");out+='", startencode: "';out+=encodeHTML(" }
  	}, skip = /$^/, cse = c.append ? startend.append : startend.split, ostr = tmpl.replace(/'|\\/g, '\\$&');
		var needhtmlencode, sid = 0, indv, lnOpts = { offset: 0 };
		var str = "var out='" + ostr
			.replace(c.interpolate || skip, function rplInterpolate(m, code) {
        return cse.start + coded(code, c, ostr, arguments, lnOpts, true) + cse.end;
			})
			.replace(c.encode || skip, function rplEncode(m, code) {
				needhtmlencode = true;
				return cse.startencode + coded(code, c, ostr, arguments, lnOpts, true) + cse.end;
			})
			.replace(c.conditional || skip, function rplConditional(m, elsecase, code) {
				return elsecase ?
					(code ? `';}else if(${coded(code, c, ostr, arguments, lnOpts, true)}){out+='` : "';}else{out+='") :
					(code ? `';if(${coded(code, c, ostr, arguments, lnOpts, true)}){out+='` : "';}out+='");
			})
			.replace(c.iterate || skip, function rplIterate(m, iterate, vname, iname) {
        if (!iterate) return "';} } out+='";
        sid += 1;
        indv = iname || 'i' + sid; // w/o duplicate iterator validation there is a potential for endless loop conditions
        iterate = coded(`var arr${sid}=${iterate}`, c, ostr, arguments, lnOpts);
        return `';${iterate};if(arr${sid}){var ${vname},${indv}=-1,l${sid}=arr${sid}.length-1;while(${indv}<l${sid}){${vname}=arr${sid}[${indv}+=1];out+='`;
			})
			.replace(c.evaluate || skip, function rplEvaluate(m, code) {
				return "';" + coded(code, c, ostr, arguments, lnOpts) + "out+='";
			}) + "';return out;"; // remove consecutive spaces
    if (c.errorLine && !c.outputPath) {
      str = `var lnCol={};try{${str}}catch(e){e.message+=' at template ${((tnm && '"' + tnm + '" ') || '')}line '+lnCol.ln+' column '+lnCol.col;throw e;}`;
    }
    if (c.strip) str = str.replace(/(?:^|\r|\n)\t* +| +\t*(?:\r|\n|$)/g, ' ').replace(/\r|\n|\t|\/\*[\s\S]*?\*\//g, '');
    str = str.replace(/(\n|\t|\r)/g, '\\$1').replace(/(\s|;|\}|^|\{)out\+='';/g, '$1').replace(/\+''|(\s){2,}/g, '$1');
    if (needhtmlencode) {
		  str = (function encodeHTML(code) {
        try {
          var encodeHTMLRules = { '&': '&#38;', '<': '&#60;', '>': '&#62;', '"': '&#34;', "'": '&#39;', '/': '&#47;' };
          return code ? code.toString().replace(((c.doNotSkipEncoded && /[&<>"'\/]/g) || /&(?!#?\w+;)|<|>|"|'|\//g), function(m) {return encMap[m] || m;}) : '';
        } catch (e) {
          e.message += ` While encoding HTML at: ${code}`;
          throw e;
        }
      }).toString().replace('c.doNotSkipEncoded', c.doNotSkipEncoded) + str;
		}
		try {
      const tpth = c.outputPath ? `${cache.join(c.outputPath, tnm)}.${c.outputExtension}` : tnm;
      const { func } = await cache.generateTemplate(tnm, tpth, str, !!c.outputPath);
      return func;
		} catch (e) {
      if (c.logger) c.logger(`Could not create a template function (ERROR: ${e.message}): ${str}`);
			throw e;
		}
	}

  /**
   * Processes a template via {@link Engine.templater}
   * @param {String} tmpl the raw template source
   * @param {EngineOpts} [options] the options that overrides the default engine options
   * @param {Object} [def] the object definition to be used in the template
   * @param {String} [tname] name to be given to the template
   * @returns {function} the function(data) that returns a template result string based uopn the data object provided
   */
  async template(tmpl, options, def, tname) {
    const ns = Cache.internal(this), opts = options || ns.options;
    return Engine.templater(tmpl, opts, def, tname, ns.cache);
  }

  /**
   * Processes a template (basic)
   * @param {String} tmpl the raw template source
   * @param {Object} [opts] the options sent for compilation
   * @param {Function} callback Should have a signature of `function callback(error, compiled)` 
   * @returns {function} the function(data) that returns a template result string based uopn the data object provided
   */
  compile(tmpl, opts, callback) { // ensures partials are included in the compilation
    const ns = Cache.internal(this);
    (async function compiling(ns, tmpl, opts, callback) {
      try {
        // when caching some of the partials may reference other partials that were loaded after the parent partial that uses it
        if (!ns.isInit && (ns.isInit = true)) {
          const promises = new Array(Object.keys(ns.prts).length);
          var idx = -1; // set functions in parallel
          for (let name in ns.prts) promises[idx++] = await setFn(ns, this, name);
          for (let promise of promises) {
            await promise;
          }
        }
        const fn = await templFuncPartial(ns, this, tmpl, opts);
        if (fn && ns.options && ns.options.logger) ns.options.logger(`Compiled ${fn.name}`);
        callback(null, function processTemplate() {
          arguments[0] = arguments[0] || {}; // template data
          return fn.apply(this, arguments);
        });
      } catch (err) {
        callback(err);
      }
    })(ns, tmpl, opts, callback);
  }

  /**
   * Registers and caches a partial template
   * @param {String} name the template name that uniquely identifies the template content
   * @param {String} partial the partial template content to register
   */
  registerPartial(name, partial) {
    const ns = Cache.internal(this);
    ns.prts[name] = { tmpl: partial, name: name };
    ns.prts[name].ext = ns.options.defaultExtension || '';
  }

  /**
   * Same as {@link Engine.registerPartial}, but also sets the partial function on a partial namespace
   * @param {String} name the template name that uniquely identifies the template content
   * @param {String} partial the partial template content to register
   * @param {Boolean} initFn true to set the template function
   */
  async registerAndSetPartial(name, partial) {
    const ns = Cache.internal(this);
    this.registerPartial(name, partial);
    return setFn(ns, this, name);
  }

  /**
   * On-Demand compilation of a registered template
   * @param {String} name the name of the registered tempalte
   * @param {Object} data the object that contains the data used in the template
   * @returns {String} the compiled template
   */
  async processPartial(name, data) {
    const ns = Cache.internal(this);
    if (!ns.options.isCached) await refreshPartial(ns, this, name);
    // prevent "No partial found" errors
    return (data && ns.prts[name] && (typeof ns.prts[name].fn === 'function' || await setFn(ns, this, name)) && ns.prts[name].fn(data)) || '&nbsp;';
  }

  /**
   * Generates a reference safe function for on-demand compilation of a registered templates
   * @returns {Object} an object that contains: `createdOutputDirs` (any created output template compilations), `partialFunc` (reference safe
   * {@link Engine#processPartial})
   */
  async init() {
    const engine = this, ns = Cache.internal(engine);
    return {
      createdOutputDirs: await ns.cache.setup(ns.options.outputSourcePath, ns.options.outputPath, true),
      partialFunc: (name, data) => await engine.processPartial(name, data)
    };
  }
};

/**
 * Sets a template function on a partial namespace
 * @param {Object} ns the namespace of the template engine
 * @param {Engine} eng the template engine
 * @param {String} name the template name where the function will be set
 * @returns {function} the set template function
 */
async function setFn(ns, eng, name) {
  if (ns.prts[name].tmpl) return ns.prts[name].fn = await templFuncPartial(ns, eng, ns.prts[name].tmpl, null, name);
}

/**
 * Refreshes template partial content by reading the contents of the partial file
 * @param {Object} ns the namespace of the template engine
 * @param {Engine} eng the template engine
 * @param {String} name the template name where the function will be set
 */
async function refreshPartial(ns, eng, name) {
  const pth = ns.cache.join(ns.options.relativeTo || '', ns.options.partialsPath || '.', name)
    + '.' + ((ns.prts[name] && ns.prts[name].ext) || ns.options.defaultExtension);
  const partial = await ns.cache.readPartial(pth);
  eng.registerPartial(name, partial.toString(ns.options.encoding), true);
  if (ns.options && ns.options.logger) ns.options.logger(`Refreshed partial ${name}`);
}

/**
 * Generats a template function for a partial
 * @param {Object} ns the namespace of the template engine
 * @param {Engine} eng the template engine
 * @param {String} tmpl the template contents
 * @param {Object} data the object that contains the data used in the template
 * @param {String} name the template name that uniquely identifies the template content
 * @returns {function} the {@link Engine#template} function
 */
async function templFuncPartial(ns, eng, tmpl, data, name) { // generates a template function that accounts for nested partials
  return eng.template(await rplPartial(ns, eng, tmpl, data, name), null, data, name);
}

/**
 * Replaces any included partials that may be nested within other tempaltes with the raw template content. Each replacement is flagged with the engine
 * marker so that line/column detection can be performed
 * @param {Object} ns the namespace of the template engine
 * @param {Engine} eng the template engine
 * @param {String} tmpl the template contents
 * @param {Object} data the object that contains the data used in the template
 * @param {String} name the template name that uniquely identifies the template content
 * @returns {String} the template with replaced raw partials
 */
async function rplPartial(ns, eng, tmpl, data, name) {
  const tmplx = await replace(tmpl, ns.options.include, async function partialRpl(match, key, pname) {
    var nm = (pname && pname.trim().replace(/\./g, '/')) || '';
    if (ns.prts[nm]) {
      if (!ns.options.isCached) await refreshPartial(ns, eng, nm);
      return await rplPartial(ns, eng, ns.prts[nm].tmpl, data, name); // any nested partials?
    }
    return match; // leave untouched so error will be thrown (if subsiquent calls cannot find partial)
  });
  return !tmplx.length ? '&nbsp;' : tmplx; // nbsp prevents "No partial found" errors
}

/**
 * `String.prototype.replace` alternative that supports `async` _replacer_ functions
 * @param {String} str The string to perform a replace on
 * @param {RegExp} regex The regular expression that the replace will match
 * @param {Function} replacer An `async` function that operates the same way as the function passed into `String.prototype.replace`
 */
async function replace(str, regex, replacer) {
  const mtchs = [];
  str.replace(regex, function asyncReplacer(match) {
    mtchs.push({ args: arguments, thiz: this });
    return match;
  });
  var offset = 0, beg, end, rtn;
  for (let mtch of mtchs) {
    rtn = replacer.apply(mtch.thiz, mtch.args);
    if (rtn instanceof Promise) rtn = await rtn;
    if (rtn !== mtch.args[0]) {
      if (!rtn) rtn = String(rtn); // same as async version
      beg = mtch.args[mtch.args.length - 2] + offset;
      end = beg + mtch.args[0].length;
      str = str.substring(0, beg) + rtn + str.substring(end);
      offset += rtn.length - mtch.args[0].length;
    }
  }
  return str;
}

/**
 * Unescapes a code segment and tracks line/column numbers when enabled
 * @param {String} code the code that will be escaped
 * @param {Object} [c] the template options
 * @param {String} [tmpl] the original/unaltered template source that will be used to determine the line number of the code execution
 * @param {Object} [args] the arguments that are passed into the function from the originating String.replace call
 * @param {object} [lnOpts] the line options
 * @param {Integer} [lnOpts.offset] the ongoing line number offset to account for prior replacements that may have changed line/column positioning (set internally)
 * @param {Boolean} [cond] when true the line number variable and unescaped code will be formatted as if it was being used within a conditional statement: (lnCol={ln:123,CAL_LINE_NUMBER:CALC_COLUMN_NUMBER}) && (SOME_UNESCAPED_CODE_HERE)
 * @returns {String} the unescaped value
 */
function coded(code, c, tmpl, args, lnOpts, cond) {
  var strt = '', end = code.replace(/\\('|\\)/g, '$1');//.replace(/[\r\t\n]/g, ' ');
  if (tmpl && c && c.errorLine && !c.outputPath) {
    var offset = args[args.length - 2]; // replace offset
    if (offset !== '' && !isNaN(offset) && (offset = parseInt(offset)) >= 0) {
      strt = tmpl.substring(0, offset).split(c.errorLine);
      strt = ((cond && '(') || '') + 'lnCol={ln:' + strt.length + ',col:' + (strt[strt.length - 1].length + 1) + '}' + ((cond && (end += ')') && ') && (') || ';');
    }
  }
  return strt + end;
}

// TODO : ESM remove the following lines...
exports.Engine = Engine;
exports.JsonEngine = JsonEngine;
exports.Cache = Cache;