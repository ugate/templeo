'use strict';

// run tests:
// npm test
// generate jsdoc:
// npm run gen-docs

const TEST_FILES = {};
const DB = {};
const logger = {};
//const logger = { info: console.info, warn: console.warn, error: console.error };
//const logger = console;

const Forge = require('node-forge');
const Http = require('http');
exports.Http = Http;
const Https = require('https');
exports.Https = Https;
const Os = require('os');
exports.Os = Os;
const Fs = require('fs');
exports.Fs = Fs;
const Path = require('path');
exports.Path = Path;
const { expect } = require('code');
exports.expect = expect;
const Lab = require('lab');
exports.Lab = Lab;
const JsFrmt = require('js-beautify').js;
exports.JsFrmt = JsFrmt;
const { JSDOM } = require('jsdom');
exports.JSDOM = JSDOM;
const Level = require('level');
exports.Level = Level;
const Engine = require('../../index.js');
const TemplateOpts = require('../../lib/template-options.js');
exports.Engine = Engine;
exports.PLAN = 'Template Engine';
exports.TASK_DELAY = 500;
exports.TEST_TKO = 20000;
exports.LOGGER = logger;
// TODO : ESM uncomment the following lines...
// TODO : import * as Forge from 'node-forge';
// TODO : import * as http from 'https';
// export * as Https from https;
// TODO : import * as Os from 'os';
// export * as Os from Os;
// TODO : import * as Fs from 'fs';
// export * as Fs from Fs;
// TODO : import * as Path from 'path';
// export * as Path from Path;
// TODO : import * as code from 'code';
// export * as code from code;
// TODO : import * as expect from 'expect';
// export * as expect from expect;
// TODO : import * as Lab from 'lab';
// export * as Lab from Lab;
// TODO : import { js } as JsFrmt from 'js-beautify';
// export * as JsFrmt from JsFrmt;
// TODO : import { JSDOM } as JSDOM from 'jsdom';
// export * as JSDOM from JSDOM;
// TODO : import * as Level from 'level';
// export * as Level from Level;
// TODO : import * as Engine from '../../index.mjs';
// TODO : import * as TemplateOpts from '../../lib/template-options.mjs';
// export * as Engine from Engine;
// export const PLAN = 'Template Engine';
// export const TASK_DELAY = 500;
// export const TEST_TKO = 20000;
// export const LOGGER = logger;

const Fsp = Fs.promises;
const PATH_BASE = '.';
const PATH_VIEWS_DIR = 'test/views';

const PATH_HTML_CONTEXT_DIR = 'test/context/html';
const PATH_HTML_PARTIALS_DIR = `${PATH_VIEWS_DIR}/partials/html`;
const PATH_HTML_TEMPLATE = `${PATH_VIEWS_DIR}/template.html`;
const PATH_HTML_CONTEXT = `${PATH_HTML_CONTEXT_DIR}/context.json`;

const PATH_JSON_CONTEXT_DIR = 'test/context/json';
const PATH_JSON_PARTIALS_DIR = `${PATH_VIEWS_DIR}/partials/json`;
const PATH_JSON_TEMPALTE = `${PATH_VIEWS_DIR}/template.jsont`;
const PATH_JSON_CONTEXT = `${PATH_JSON_CONTEXT_DIR}/context.json`;

// TODO : ESM uncomment the following line...
// export
class Main {

  /**
   * Creates a test HTTPS server with a self-signed certificate for testing partial template `reads`. Each _response_ will contain either
   * the partial template content, the primary template being tested or the context JSON. Which content that is set in the response is
   * based upon the same path patterns outlined in the `include` documentation for partials.
   * 
   * When the request is for a partial HTML template, the request can also contain URL parameters. Each URL parameter will be appened to
   * the response in the form of an HTML `input` element using the parameters __key__ as the `name` and __value__ as the `value`. This
   * tests includes that can have dynamic partial template content based upon URL parameters being passed into a server.
   * @async
   * @param {Object} [opts] The template options that will determine how to handle requests. Options can be set after creating the server
   * since they are not used until an actual request is made
   * @param {String} [paramsInputIdPrefix='fromServer_'] The prefix that will be used for the HTML `input` IDs generated from the URL parameters 
   * @param {String} [hostname] The _host_ passed into {@link Https.Server.listen}
   * @param {String} [port] The _port_ passed into {@link Https.Server.listen}
   * @returns {Object} An object containing:
   * - `url:String` - The created server's URL
   * - `close:Function` - A parameterless async function that will stop/close the server
   * - `callCount:Function` - A __function(url:String[, params:(URLSearchParams | Object)]):Integer__ that takes a URL string and optionally
   * JSON or `URLSearchParams` and returns the number of times it has been called
   */
  static httpsServer(opts, paramsInputIdPrefix = 'fromServer_', hostname = undefined, port = undefined) {
    return new Promise((resolve, reject) => {
      const sec = selfSignedCert();
      var url, calls = {};
      const server = Https.createServer({ key: sec.key, cert: sec.cert }, async (req, res) => {
        const topts = opts instanceof TemplateOpts ? opts : new TemplateOpts(opts);
        const isMainTmpl = req.url.endsWith(`${topts.defaultTemplateName}${topts.defaultExtension ? `.${topts.defaultExtension}` : ''}`);
        const isContext = !isMainTmpl && req.url.endsWith(`${topts.defaultContextName}.json`);
        const baseFilePath = `${PATH_BASE}/${isMainTmpl ? PATH_VIEWS_DIR : isContext ? PATH_HTML_CONTEXT_DIR : PATH_HTML_PARTIALS_DIR}`;
        const mthd = req.method.toUpperCase();
        try {
          const urlo = new URL(`${url}${req.url}`), prms = urlo.searchParams, type = prms.get('type');
          const name = `${urlo.pathname.replace(/^\/+/, '').split('.').shift()}${urlo.search}`;
          calls[name] = (calls[name] || 0) + 1;
          if (logger.info) logger.info(`HTTPS server received: ${url}${req.url} (name: ${name}, count: ${calls[name]})`);
          const filePath = urlo.href.replace(urlo.origin, '').replace(urlo.search, '').replace(urlo.hash, '');
          const file = Path.join(baseFilePath, filePath);
          var contents = await Fsp.readFile(file);
          if (!isMainTmpl && !isContext) {
            for (let prm of prms.entries()) {
              contents += `<input name="${paramsInputIdPrefix}${prm[0]}" value="${prm[1]}" />`; // add parameters as input
            }
          }
          res.statusCode = 200;
          res.setHeader('Content-Type', type || (isContext ? 'application/json' : 'text/html'));
          res.end(contents);
          if (logger.debug) logger.debug(`HTTPS server processed ${url}${req.url} with contents:`, contents);
        } catch (err) {
          if (logger.error) logger.error(err);
          res.statusCode = 400;
          res.setHeader('Content-Type', 'text/html');
          res.end(`Failed to ${mthd} for: ${url}${req.url}, ERROR: ${err.message} STACK: ${err.stack}`);
        }
      });
      server.listen(port, hostname, () => {
        const addy = server.address();
        url = `https://${addy.address === '::' || server.address === '0.0.0.0' ? '127.0.0.1' : addy.includes}:${addy.port}/`;
        if (logger.info) logger.info(`Server running at ${url}`);
        resolve({
          url,
          close: () => {
            return new Promise((resolve, reject) => {
              server.close(err => err ? reject(err) : resolve());
            });
          },
          callCount: (name, params) => {
            const sprms = params instanceof URLSearchParams ? params : params ? new URLSearchParams(params) : '';
            return calls[`${name}${sprms ? `?${sprms.toString()}` : ''}`];
          }
        });
      });
    });
  }

  /**
   * Initiates a client request
   * @param {String} url The URL to request
   * @param {Boolean} [secure] `true` to use HTTPS. Otherwise, use HTTP
   * @returns {(String | Object)} Either the response string or response JSON
   */
  static clientRequest(url, secure) {
    return new Promise(async (resolve, reject) => {
      const req = (secure ? Https : Http).request(url, { method: 'GET' }, res => {
        var data = '';
        res.on('data', chunk => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            JSON.parse(data);
            reject(new Error(`Recieved JSON response for ${url}: ${data}`));
          } catch (err) {
            // error means proper non-JSON response, consume error
          }
          resolve(data);
        });
      });
      req.on('error', err => {
        reject(err);
      });
      req.end();
    });
  }

  /**
   * Captures the primary template and context data used for testing
   * @param {Boolean} cache `true` to cache read content for subsequent calls
   * @returns {Object} An object containing read file content and metadata used for testing:
   * - `htmlPath:String` - The path to the primary test HTML template file
   * - `htmlContextPath:String` - The path to the test HTML context file
   * - `jsonPath:String` - The path to the test primary JSON template file
   * - `jsonContextPath:String` - The path to the test JSON context file
   * - `html:String` - The primary test HTML template contents
   * - `json:String` - The primary test JSON template contents
   * - `htmlContext:Object` - The HTML context
   * - `jsonContext:Object` - The JSON context
   */
  static async getTemplateFiles(cache = true) {
    const rtn = {
      htmlPath: PATH_HTML_TEMPLATE,
      htmlContextPath: PATH_HTML_CONTEXT,
      jsonPath: PATH_JSON_TEMPALTE,
      jsonContextPath: PATH_JSON_CONTEXT,
    };

    rtn.html = getFile(rtn.htmlPath, cache);
    rtn.json = getFile(rtn.jsonPath, cache);
    rtn.htmlContext = getFile(rtn.htmlContextPath, cache);
    rtn.jsonContext = getFile(rtn.jsonContextPath, cache);

    rtn.html = (await rtn.html).toString();
    rtn.json = (await rtn.json).toString();
    rtn.htmlContext = JSON.parse((await rtn.htmlContext).toString());
    rtn.jsonContext = JSON.parse((await rtn.jsonContext).toString());
    
    return rtn;
  }

  /**
   * Runs the primary set of tests for an `Engine` for either {@link Main.expectDOM} for HTML output or {@link Main.expectJSON} for JSON output
   * @param {Object} [compileOpts] The options to use when calling {@link Main.init}
   * @param {Engine} [engine] The `Engine` to use when calling {@link Main.init}
   * @param {Object} [partials] The partials to pass into {@link Engine.registerPartials}
   * @param {Boolean} [readPartials] The read flag to pass into {@link Engine.registerPartials}
   * @param {Object} [renderOpts] The options to pass into the rendering function generated from {@link Engine.compile}
   * @param {Object} [extraContext] Key/value pairs to add to the extracted context JSON
   * @returns {Object} The test object parameters that contain property/values from {@link Main.init} as well as the following:
   * - `registerPartialsResult` - Result from calling {@link Engine.registerPartials} when called
   * - `fn` - The rendering funtion returned from {@link Engine.compile}
   * - `result` - The rendered result from calling the rendering function
   */
  static async baseTest(compileOpts, engine, partials, readPartials, renderOpts, extraContext) {
    const test = await Main.init(compileOpts, engine);
    const opts = test.engine.options;
    if (!/^html$|^json$/.test(opts.defaultExtension)) throw new Error(`Invalid TEST compileOpts.defaultExtension -> ${opts.defaultExtension}`);
    const isJSON = opts.defaultExtension === 'json';
    test.registerPartialsResult = partials || readPartials ? await test.engine.registerPartials(partials, readPartials) : null;
    test.fn = await test.engine.compile(isJSON ? test.json : test.html);
    expect(test.fn).to.be.function();

    var context;
    if (isJSON) context = test.jsonContext = test.jsonContext || {};
    else context = test.htmlContext = test.htmlContext || {};
    if (typeof extraContext === 'object') { // add extra context values
      for (let prop in extraContext) {
        if (!extraContext.hasOwnProperty(prop)) continue;
        context[prop] = extraContext[prop];
      }
    }

    test.result = await test.fn(context, renderOpts);
    if (logger.debug) logger.debug(test.result);//logger.debug(JsFrmt(test.result, compileOpts.formatOptions));
    if (isJSON) Main.expectJSON(test.result, context);
    else Main.expectDOM(test.result, context);
    return test;
  }

  /**
   * Gets files from a directory and any sub-directories
   * @param {String} dir The directory to get the files from
   * @param {Boolean} [readContent=true] `true` to include read file contents in the return value for each file found
   * @param {Booean} [rmBasePartial=true] `true` to remove the initial `dir` when composing the name in the return value
   * @param {Boolean} [cache=true] Value passed when calling {@link } 
   * @param {String} [_initDir=null] Used to keep track of the original `dir` when making recursive calls __Internal use only!__
   * @returns {Object[]} The files that were found with each object entry containing the follwoing:
   * - `name:String` - The derived name of the file
   * - `path:String` - The file path
   * - `content:String` - The file contents (omitted when `readContent` is falsy)
   */
  static async getFiles(dir, readContent = true, rmBasePartial = true, _initDir = null) {
    if (!_initDir) _initDir = dir.replace(/[\/\\]/g, Path.sep);
    const sdirs = await Fs.promises.readdir(dir);
    var spth, stat, sfiles, files = [], filed, named;
    for (let sdir of sdirs) {
      spth = Path.join(dir, sdir), stat = await Fs.promises.stat(spth);
      if (stat.isDirectory()) {
        sfiles = await Main.getFiles(spth, readContent, rmBasePartial, _initDir);
        files = sfiles && sfiles.length ? files.length ? files.concat(sfiles) : sfiles : files;
      } else if (stat.isFile()) {
        named = rmBasePartial ? spth.replace(_initDir, '').replace(/^[\.\/\\]+/, '') : spth;
        filed = {
          name: named.replace(/\..+$/, '').replace(/\\+/g, '/'),
          path: spth
        };
        if (readContent) filed.content = (await Fs.promises.readFile(spth)).toString();
        files.push(filed);
      }
    }
    return files;
  }

  /**
   * Opens an IndexedDB instance
   * @param {String} [locPrefix] The IndexedDB location prefix to use
   * @returns {Object} A metadata object containing `{ locPrefix:String, loc:String, indexedDB:IndexedDB }`
   */
  static async openIndexedDB(locPrefix = 'templeo-test-indexedDB-') {
    if (DB[locPrefix]) return DB[locPrefix];
    const loc = await Fs.promises.mkdtemp(Path.join(Os.tmpdir(), locPrefix));
    DB[locPrefix] = { locPrefix, loc, indexedDB: Level(loc) };
    if (logger.info) logger.info(`Using LevelDB @ ${loc}`);
    return DB[locPrefix];
  }

  /**
   * Closes any resources associated with an IndexedDB instance
   * @param {Object} db An object generated from a prior call to {@link Main.openIndexedDB}
   * @param {Engine} engine The engine being used
   */
  static async closeIndexedDB(db, engine) {
    if (engine) {
      if (logger.debug) logger.debug(`Clearing cache for LevelDB @ ${db.loc}`);
      await engine.clearCache(true);
    }
    if (logger.debug) logger.debug(`Cloasing LevelDB @ ${db.loc}`);
    await db.indexedDB.close();
    if (logger.info) logger.info(`Removing LevelDB @ ${db.loc}`);
    if (DB[db.locPrefix]) delete DB[db.locPrefix];
    return Main.rmrf(db.loc);
  }

  /**
   * Gets {@link Main.getTemplateFiles} along with an `Engine` with options
   * @param {Object} [opts] The template options to use
   * @param {Engine} [engine] The `Engine` instance to use (omit to create)
   * @returns {Object} An `{ engine:Engine, opts:Object }` along with properties from {@link Main.getTemplateFiles}
   */
  static async init(opts, engine) {
    const rtn = await Main.getTemplateFiles();
    rtn.engine = engine || new Engine(opts, JsFrmt, logger);
    rtn.opts = opts;
    return rtn;
  }

  /**
   * Async test that will either `resolve`/`reject` after a given amount of time
   * @async
   * @param {Integer} delay The delay in milliseconds to wait before resolving/rejecting
   * @param {*} [val] The value to return when resolved or error message/Error when rejecting
   * @param {Boolean} [rejectIt] `true` to reject, otherwise resolve
   */
  static wait(delay, val, rejectIt) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (rejectIt) reject(val instanceof Error ? val : new Error(val));
        else resolve(val);
      }, delay);
    });
  }

  /**
   * Validates common DOM nodes/values for a given parsed template HTML string
   * @param {String} html The parsed template HTML to validate
   * @param {Object} context The template context to validate against
   * @returns {JSDOM} The generated DOM
   */
  static expectDOM(html, context) {
    const dom = new JSDOM(html);
    var el;
  
    // comment block should be removed
    expect(html.includes('This is a comment')).to.be.false();
  
    // array iteration test
    for (let i = 0, arr = context.metadata; i < arr.length; i++) {
      el = dom.window.document.querySelector(`[name="${arr[i].name}"][content="${arr[i].content}"]`) || {};
      expect(el.name).to.equal(arr[i].name);
      expect(el.getAttribute('content')).to.equal(arr[i].content);
    }

    const doubles = dom.window.document.getElementsByName('doubles');
    expect(doubles.length).to.equal(2);
  
    // object property iteration test
    var el, hasSel;
    for (let state in context.globals.states) {
      el = dom.window.document.querySelector(`option[id="stateSelect${state}"]`) || {};
      expect(el.value).to.equal(state);
      expect(el.innerHTML).to.equal(context.globals.states[state]);
      if (state === 'FL') {
        hasSel = true;
        expect(el.selected).to.be.true(); // conditional check
      }
    }
  
    expect(hasSel).to.be.true();
  
    // validate for partials
    expectColorDOM(dom, context, 'swatchSelectColor'); // select options
    expectColorDOM(dom, context, 'swatchDatalistColor'); // datalist options
  
    // validate nested partial
    const swatchDatalist = dom.window.document.getElementById('swatchDatalist');
    expect(swatchDatalist).to.be.object();

    // validate partial from render-time read (if present)
    if (context.dynamicIncludeURL) {
      const dynInclURL = dom.window.document.getElementById('dynamicIncludeURL');
      expect(dynInclURL).to.be.object();
      expect(dynInclURL.dataset.url).to.equal(context.dynamicIncludeURL);
      expect(dynInclURL.innerHTML).to.match(/[\n\r\s]*Test simple text inclusion[\n\r\s]*/);
    }
  
    //if (logger.debug) logger.debug(fn, rslt);
    return dom;
  }

  /**
   * Validates test JSON output with a matching context data object
   * @param {(String | Object)} json Either the JSON string or JSON object to validate
   * @param {Object} context The context data to validate the JSON against
   */
  static expectJSON(json, context) {
    json = typeof json === 'string' ? JSON.parse(json) : json;
    expect(json.test).to.be.object();
    expect(json.test.one).to.be.object();
    expect(json.test.one.two).to.be.object();
    expect(json.test.one.two.three).to.equal(context.three);
  }

  /**
   * Executes a test case that will run for `include` parameter detection for both `read`/fetch requests using `URLSearchParams`
   * and scoped resolved parameters that are accessible within the templates themselves. When using `URLSearchParams`, elements
   * are validated in the DOM result for each matching `name` from the `test.cases[].params`
   * @param {Object} test The test metadata
   * @param {String} test.template The template to test
   * @param {Object[]} test.cases One or more test cases that describe the validation that should take place
   * @param {Object} test.cases[].params The parameters that will be checked within the rendered template result. Each
   * property/value in the object represents a key/value pair of parameters to test against
   * @param {Object} [test.cases[].search] The search parmeters to test for. Omit when not using `URLSearchParams`.
   * @param {String} [test.cases[].search.name] The name of the search `include` being tested
   * @param {Integer} [test.cases[].search.paramCount] The number of times that each search parameter should be included in the result
   * @param {Integer} [test.cases[].search.callCount] The number of times that the underlying server should be called to retrieve
   * included template content for the given `search.name`
   * @param {Object} [test.cases[].pass] Whether or not basic JSON parameters are used
   * @param {Integer} [test.cases[].pass.paramCount] The number of times that include parameters that should be present in the result
   * @param {Object[]} [partials] Any partials to register at compile-time
   * @param {Object} [opts] The options
   * @param {TemplateOpts} [opts.compileOpts] The compile options
   * @param {TemplateOpts} [opts.renderOpts] The render options
   */
  static async paramsTest(test, partials, opts) {
    const idPrefix = 'inclParamFromServer_';
    opts = opts || { render: {} };
    const files = await Main.getTemplateFiles();
    
    let els, label = test.label;
    const svr = await Main.httpsServer(opts.compile, idPrefix);
    try {
      opts.render.templatePathBase = svr.url;
      const engine = new Engine(opts.compile, JsFrmt, logger);
      if (partials) {
        engine.registerPartials(partials);
      }
      const renderer = await engine.compile(test.template);
      const rslt = await renderer(files.htmlContext, opts.render);

      if (logger.info) logger.info(test.template, '\nRESULTS:', rslt);
      const dom = new JSDOM(rslt);
      const cases = Array.isArray(test.cases) ? test.cases : [test.cases];

      for (let cased of cases) {
        if (cased.search && cased.search.name && cased.search.callCount) {
          expect(svr.callCount(cased.search.name, cased.params),
            `${label} ${cased.search.name} call count`).to.equal(cased.search.callCount);
        }
        for (let name in cased.params) {
          if (cased.search) {
            // dynamic parameters generated by the server
            label += ` "${idPrefix}${name}" include parameters getElementsByName`;
            els = dom.window.document.getElementsByName(`${idPrefix}${name}`);
            expect(els, label).to.not.be.null();
            expect(els.length, `${label} # of elements`).to.equal(cased.search.paramCount);
            for (let ei = 0; ei < cased.search.paramCount; ei++) {
              expect(els[ei], label).to.not.be.null();
              expect(els[ei].value, label).to.equal(cased.params[name]);
            }
          }
          if (cased.pass) {
            label += ` "${name}" include parameters getElementsByName`;
            // dynamic parameters generated within the partial template itself
            // using the scoped "params"
            els = dom.window.document.getElementsByName(`${name}`);
            expect(els, label).to.not.be.null();
            expect(els.length, `${label} # of elements`).to.equal(cased.pass.paramCount);
            expect(els[0].value, label).to.equal(cased.params[name]);
            for (let ei = 0; ei < cased.pass.paramCount; ei++) {
              expect(els[ei], label).to.not.be.null();
              expect(els[ei].value, label).to.equal(cased.params[name]);
            }
          }
        }
      }
    } finally {
      await svr.close();
    }
  }

  /**
   * Runs a function from a class using `return Clazz[process.argv[2]](...args)`
   * __or__ runs through all of the `async` functions from `Object.getOwnPropertyNames(Clazz)` via
   * `await Clazz[propertyName](...args)` other than function names that are found in `excludes` or
   * `before`, `beforeEach`, `after`, `afterEach`.
   * @ignore
   * @param {Object} Clazz The class the test running will be running for
   * @param {String[]} [excludes] Function names to exclude from execution (only used when executing all)
   * @param {*[]} [args] Any additional arguments to pass to function(s) that are executed
   * @returns {Object} The return value(s) from the designated function call with each property
   * name set to the name of the function executed and the value as the return value from the call
   */
  static async run(Clazz, excludes, ...args) {
    const prps = process.argv[2] ? [process.argv[2]] : Object.getOwnPropertyNames(Clazz);
    const excls = ['before', 'beforeEach', 'after', 'afterEach'], execr = {}, rtn = {};

    for (let enm of excls) {
      execr[enm] = typeof Clazz[enm] === 'function' ? Clazz[enm] : null;
    }

    if (execr['before']) {
      if (logger.info) logger.info(`Executing: ${Clazz.name}.before(${args.join(',')})`);
      rtn['before'] = await execr['before'](...args);
    }
    for (let prop of prps) {
      if (execr['beforeEach']) {
        if (logger.info) logger.info(`Executing: ${Clazz.name}.beforeEach(${args.join(',')})`);
        rtn['beforeEach'] = await execr['beforeEach'](...args);
      }
      if (typeof Clazz[prop] === 'function' && (!excludes || !excludes.includes(prop)) && !excls.includes(prop)) {
        if (logger.info) logger.info(`Executing: await ${Clazz.name}.${prop}(${args.join(',')})`);
        rtn[prop] = await Clazz[prop](...args);
      }
      if (execr['afterEach']) {
        if (logger.info) logger.info(`Executing: ${Clazz.name}.afterEach(${args.join(',')})`);
        rtn['afterEach'] = await execr['afterEach'](...args);
      }
    }
    if (execr['after']) {
      if (logger.info) logger.info(`Executing: ${Clazz.name}.after(${args.join(',')})`);
      rtn['after'] = await execr['after'](...args);
    }

    return rtn;
  }

  /**
   * Utility used to recursivly remove files and/or directories for a given path
   * @param {String} path The path to remove
   */
  static async rmrf(path) {
    var stats, subx;
    try {
      stats = await Fsp.stat(path);
    } catch (e) {
      stats = null;
    }
    if (stats && stats.isDirectory()) {
      for (let sub of await Fsp.readdir(path)) {
        subx = Path.resolve(path, sub);
        stats = await Fsp.stat(subx);
        if (stats.isDirectory()) await Main.rmrf(subx);
        else if (stats.isFile() || stats.isSymbolicLink()) await Fsp.unlink(subx);
      }
      await Fsp.rmdir(path); // dir path should be empty
    } else if (stats && (stats.isFile() || stats.isSymbolicLink())) await Fsp.unlink(path);
  }

  /**
   * @returns {Boolean} `true` when the process is being ran from a _test utility_
   */
  static usingTestRunner() {
    return process.mainModule.filename.endsWith('lab');
  }

  static get PATH_BASE() {
    return PATH_BASE;
  }

  static get PATH_VIEWS_DIR() {
    return PATH_VIEWS_DIR;
  }

  static get PATH_HTML_CONTEXT_DIR() {
    return PATH_HTML_CONTEXT_DIR;
  }

  static get PATH_HTML_PARTIALS_DIR() {
    return PATH_HTML_PARTIALS_DIR;
  }

  static get PATH_HTML_TEMPLATE() {
    return PATH_HTML_TEMPLATE;
  }

  static get PATH_HTML_CONTEXT() {
    return PATH_HTML_CONTEXT;
  }

  static get PATH_JSON_CONTEXT_DIR() {
    return PATH_JSON_CONTEXT_DIR;
  }

  static get PATH_JSON_PARTIALS_DIR() {
    return PATH_JSON_PARTIALS_DIR;
  }

  static get PATH_JSON_TEMPALTE() {
    return PATH_JSON_TEMPALTE;
  }

  static get PATH_JSON_CONTEXT() {
    return PATH_JSON_CONTEXT;
  }
}

// TODO : ESM remove the following line...
exports.Main = Main;

/**
 * Captures a test file contents
 * @param {String} path The path to the file to read/get
 * @param {Boolean} cache `true` to cache the read content for subsequent calls
 * @returns {Buffer} The file contents
 */
async function getFile(path, cache = true) {
  if (cache && TEST_FILES[path]) return TEST_FILES[path];
  return cache ? TEST_FILES[path] = await Fs.promises.readFile(path) : Fs.promises.readFile(path);
}

/**
 * Validates that the supplied DOM contains the color values from the context data
 * @param {JSDOM} dom The `JSDOM` instance
 * @param {Object} data The context data to validate the colors output in the DOM
 * @param {String} [prefix] A prefix to use when capturing element IDs 
 */
function expectColorDOM(dom, data, prefix) {
  var el, hasSel, idx = -1;
  for (let color of data.swatch) {
    el = dom.window.document.getElementById(`${prefix}${++idx}`) || {};
    expect(el.value).to.equal(color);
    expect(el.innerHTML).to.equal(color);
    if (color === '#ff5722') {
      hasSel = true;
      expect(el.selected).to.be.true(); // conditional check
    }
  }

  expect(hasSel).to.be.true();
}

/**
 * Generates a self-signed certificate
 * @param {Boolean} publicKey `true` to generate a __public__ key or _falsy_ to return a __private__ key
 * @returns {Object} The `{ key, cert }` The object that contains the key (public or private) and the certificate
 */
function selfSignedCert(publicKey) {
  Forge.options.usePureJavaScript = true;
  const pki = Forge.pki, keys = pki.rsa.generateKeyPair(2048), cert = pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
  const attrs = [
    {name:'commonName',value:'example.org'}
   ,{name:'countryName',value:'US'}
   ,{shortName:'ST',value:'Arizona'}
   ,{name:'localityName',value:'Tucson'}
   ,{name:'organizationName',value:'Test'}
   ,{shortName:'OU',value:'Test'}
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey);
  return {
    key: publicKey ? pki.publicKeyToPem(keys.publicKey) : pki.privateKeyToPem(keys.privateKey),
    cert: pki.certificateToPem(cert)
  };
}