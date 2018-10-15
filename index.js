'use strict';

const EngineOpts = require('./lib/engine-opts');
const JsonEngine = require('./lib/json-engine');
const Recall = require('./lib/recall');

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
 * //const htmlEngine = new Tmpl.Engine(vconf, recallFiles);
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
   * @param {Recall} [recall] A {@link Recall} instance that will handle compiled template persistence
   */
  constructor(opts, recall) {
    const max = 1e10, min = 0, opt = Engine.genOptions(opts), ns = Recall.internal(this);
    ns.options = opt;
    ns.recall = recall instanceof Recall ? recall : new Recall(ns.options);
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
    // const new Promise((res, rej) => {
    //  import('./lib/recall-files').then(rfs => res(new Engine(opts, new RecallFiles(opts, formatFunc)))).catch(err => rej(err));
    // };
    const RecallFiles = require('./lib/recall-files');
    return new Engine(opts, new RecallFiles(opts, formatFunc));
  }

  static async getCachedTemplate(path) {
    delete require.cache[require.resolve(path)];
    return require(path);
  }

  /**
   * Generates options to be used in an {@link EngineOpts}
   * @param {Object} [opts] an optional object with any number of presets
   * @returns {EngineOpts} a new {@link EngineOpts}
   */
  static genOptions(opts) {
    return new EngineOpts(opts);
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
	static coded(code, c, tmpl, args, lnOpts, cond) {
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

  /**
   * Processes a template
   * @param {String} tmpl the raw template source
   * @param {EngineOpts} [options] the options that overrides the default engine options
   * @param {Object} [def] the object definition to be used in the template
   * @param {String} [def.filename] when the template name is omitted, an attempt will be made to extract a name from the `filename` using `options.filename`
   * regular expression
   * @param {String} [tname] name to be given to the template
   * @param {Recall} [recall] The {@link Recall} instance that will handle the {@link Recall.write} of the template content
   * @returns {Function} the `function(data)` that returns a template result string based uopn the data object provided
   */
  static templater(tmpl, options, def, tname, recall) {
    const c = options instanceof EngineOpts ? options : new EngineOpts(options);
    recall = recall instanceof Recall ? recall : new Recall(c);
    const tnm = tname || (def && def.filename && def.filename.match(c.filename)[2]) || ('template_' + recall.guid(null, false));
    const startend = {
  		append: { start: "'+(", end: ")+'", startencode: "'+encodeHTML(" },
  		split:  { start: "';out+=(", end: ");out+='", startencode: "';out+=encodeHTML(" }
  	}, skip = /$^/, cse = c.append ? startend.append : startend.split, ostr = tmpl.replace(/'|\\/g, '\\$&');
		var needhtmlencode, sid = 0, indv, lnOpts = { offset: 0 };
		var str = "var out='" + ostr
			.replace(c.interpolate || skip, function rplInterpolate(m, code) {
        return cse.start + Engine.coded(code, c, ostr, arguments, lnOpts, true) + cse.end;
			})
			.replace(c.encode || skip, function rplEncode(m, code) {
				needhtmlencode = true;
				return cse.startencode + Engine.coded(code, c, ostr, arguments, lnOpts, true) + cse.end;
			})
			.replace(c.conditional || skip, function rplConditional(m, elsecase, code) {
				return elsecase ?
					(code ? `';}else if(${Engine.coded(code, c, ostr, arguments, lnOpts, true)}){out+='` : "';}else{out+='") :
					(code ? `';if(${Engine.coded(code, c, ostr, arguments, lnOpts, true)}){out+='` : "';}out+='");
			})
			.replace(c.iterate || skip, function rplIterate(m, iterate, vname, iname) {
        if (!iterate) return "';} } out+='";
        sid += 1;
        indv = iname || 'i' + sid; // w/o duplicate iterator validation there is a potential for endless loop conditions
        iterate = Engine.coded(`var arr${sid}=${iterate}`, c, ostr, arguments, lnOpts);
        return `';${iterate};if(arr${sid}){var ${vname},${indv}=-1,l${sid}=arr${sid}.length-1;while(${indv}<l${sid}){${vname}=arr${sid}[${indv}+=1];out+='`;
			})
			.replace(c.evaluate || skip, function rplEvaluate(m, code) {
				return "';" + Engine.coded(code, c, ostr, arguments, lnOpts) + "out+='";
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
      if (c.outputPath) {
        const tpth = `${recall.join(c.outputPath, tnm)}.${c.outputExtension}`;
        str = `${c.useCommonJs ? 'module.exports=' : 'export'} function ${tnm.replace(/\\|\/|\./g, '_')}(${c.varname}){ ${str} };`;
        str = recall.write(tpth, str, c);
        return recall.module(tpth);
      } else {
        const fn = new Function(c.varname, str);
        if (tnm) Object.defineProperty(fn, 'name', { value: tnm });
        return fn;
      }
		} catch (e) {
      if (c.logger) c.logger(`Could not create a template function (ERROR: ${e.message}): ${str}`);
			throw e;
		}
	}

  /**
   * Processes a template
   * @param {String} tmpl the raw template source
   * @param {EngineOpts} [options] the options that overrides the default engine options
   * @param {Object} [def] the object definition to be used in the template
   * @param {String} [tname] name to be given to the template
   * @returns {function} the function(data) that returns a template result string based uopn the data object provided
   */
  template(tmpl, options, def, tname) {
    const ns = Recall.internal(this), opts = options || ns.options;
    return Engine.templater(tmpl, opts, def, tname, ns.recall);
  }

  /**
   * Processes a template (basic)
   * @param {String} tmpl the raw template source
   * @param {Object} [opts] the options sent for compilation
   * @returns {function} the function(data) that returns a template result string based uopn the data object provided
   */
  compile(tmpl, opts) { // override that ensures partials are included in the compilation
    const ns = Recall.internal(this);
    // when caching some of the partials may reference other partials that were loaded after the parent partial that uses it
    if (!ns.isInit && (ns.isInit = true)) for (var name in ns.prts) setFn(ns, this, name);
    var fn = templFuncPartial(ns, this, tmpl, opts);
    if (fn && ns.options && ns.options.logger) ns.options.logger(`Compiled ${fn.name}`);
    return function processTemplate() {
      arguments[0] = arguments[0] || {}; // template data
      return fn.apply(this, arguments);
    };
  }

  /**
   * Registers, loads and caches a partial template
   * @param {String} name the template name that uniquely identifies the template content
   * @param {String} partial the partial template content to register
   * @param {Boolean} [initFn] true to set the template function
   */
  registerPartial(name, partial, initFn) {
    const ns = Recall.internal(this);
    ns.prts[name] = { tmpl: partial, name: name };
    ns.prts[name].ext = ns.options.defaultExtension || '';
    if (initFn) setFn(ns, this, name);
  }

  /**
   * On-Demand compilation of a registered template
   * @param {String} name the name of the registered tempalte
   * @param {Object} data the object that contains the data used in the template
   * @returns {String} the compiled template
   */
  processPartial(name, data) {
    const ns = Recall.internal(this);
    if (!ns.options.isCached) refreshPartial(ns, this, name);
    // prevent "No partial found" errors
    return (data && ns.prts[name] && (typeof ns.prts[name].fn === 'function' || setFn(ns, this, name)) && ns.prts[name].fn(data)) || '&nbsp;';
  }

  /**
   * Generates a reference safe function for on-demand compilation of a registered templates
   * @returns {Object} an object that contains: `createdOutputDirs` (any created output template compilations), `partialFunc` (reference safe
   * {@link Engine#processPartial})
   */
  async init() {
    const engine = this, ns = Recall.internal(engine);
    return {
      createdOutputDirs: await ns.recall.setup(ns.options.outputSourcePath, ns.options.outputPath, true),
      partialFunc: (name, data) => engine.processPartial(name, data)
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
function setFn(ns, eng, name) {
  if (ns.prts[name].tmpl) return ns.prts[name].fn = templFuncPartial(ns, eng, ns.prts[name].tmpl, null, name);
}

/**
 * Refreshes template partial content by reading the contents of the partial file
 * @param {Object} ns the namespace of the template engine
 * @param {Engine} eng the template engine
 * @param {String} name the template name where the function will be set
 */
function refreshPartial(ns, eng, name) {
  const pth = recall.join(ns.options.relativeTo || '', ns.options.partialsPath || '.', name)
    + '.' + ((ns.prts[name] && ns.prts[name].ext) || ns.options.defaultExtension);
  eng.registerPartial(name, ns.recall.read(pth).toString(ns.options.encoding), true);
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
function templFuncPartial(ns, eng, tmpl, data, name) { // generates a template function that accounts for nested partials
  return eng.template(rplPartial(ns, eng, tmpl, data, name), null, data, name);
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
function rplPartial(ns, eng, tmpl, data, name) {
  var tmplx = tmpl.replace(ns.options.include, function partialRpl(match, key, pname) {
    var nm = (pname && pname.trim().replace(/\./g, '/')) || '';
    if (ns.prts[nm]) {
      if (!ns.options.isCached) refreshPartial(ns, eng, nm);
      return rplPartial(ns, eng, ns.prts[nm].tmpl, data, name); // any nested partials?
    }
    return match; // leave untouched so error will be thrown (if subsiquent calls cannot find partial)
  });
  return !tmplx.length ? '&nbsp;' : tmplx; // nbsp prevents "No partial found" errors
}

// TODO : ESM remove the following lines...
exports.Engine = Engine;
exports.JsonEngine = JsonEngine;
exports.Recall = Recall;