'use strict';

// run tests:
// npm test
// generate jsdoc:
// npm run gen-docs

const TEST_FILES = {};
const DB = {};
const argv = process.argv.slice(2);
const log = process.env.NODE_ENV === 'test' || argv.includes('-NODE_ENV=test') ?
  { info: console.info, warn: console.warn, error: console.error } : 
  process.env.NODE_ENV === 'dev' || argv.includes('-NODE_ENV=dev') ? console : {};
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
const HtmlFrmt = require('js-beautify').html;
const JsFrmt = require('js-beautify').js;
exports.HtmlFrmt = HtmlFrmt;
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
exports.LOGGER = log;
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
// TODO : import { html } as HtmlFrmt from 'js-beautify';
// export * as HtmlFrmt from HtmlFrmt;
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
// export const LOGGER = log;

const Fsp = Fs.promises;
const PATH_RELATIVE_TO = '.';
const PATH_VIEWS_DIR = 'test/views';

const PATH_HTML_CONTEXT_DIR = 'test/context/html';
const PATH_HTML_PARTIALS_DIR = `${PATH_VIEWS_DIR}/partials/html`;
const PATH_HTML_TEMPLATE = `${PATH_VIEWS_DIR}/template.html`;
const PATH_HTML_CONTEXT = `${PATH_HTML_CONTEXT_DIR}/context.json`;

const PATH_JSON_CONTEXT_DIR = 'test/context/json';
const PATH_JSON_PARTIALS_DIR = `${PATH_VIEWS_DIR}/partials/json`;
const PATH_JSON_TEMPALTE = `${PATH_VIEWS_DIR}/template.jsont`;
const PATH_JSON_CONTEXT = `${PATH_JSON_CONTEXT_DIR}/context.json`;

const NO_FILE_NAME = 'noFileInclude';
const NO_FILE_EXT = 'html';
const NO_FILE_ID = `${NO_FILE_NAME}.${NO_FILE_EXT}`;
const NO_FILE_VAL = 'NO FILE TEST INCLUDE VALUE';
const NO_FILE_HTML = `<input name="${NO_FILE_NAME}" value="${NO_FILE_VAL}" />`;

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
        const baseFilePath = `${PATH_RELATIVE_TO}/${isMainTmpl ? PATH_VIEWS_DIR : isContext ? PATH_HTML_CONTEXT_DIR : PATH_HTML_PARTIALS_DIR}`;
        const mthd = req.method.toUpperCase();
        try {
          const urlo = new URL(`${url}${req.url}`), prms = urlo.searchParams, type = prms.get('type');
          const name = `${urlo.pathname.replace(/^\/+/, '').split('.').shift()}${urlo.search}`;
          calls[name] = (calls[name] || 0) + 1;
          if (log.info) log.info(`HTTPS server received: ${url}${req.url} (name: ${name}, count: ${calls[name]})`);
          let contents, file;
          if (name === NO_FILE_NAME) {
            file = NO_FILE_ID;
            contents = NO_FILE_HTML;
          } else {
            const filePath = urlo.href.replace(urlo.origin, '').replace(urlo.search, '').replace(urlo.hash, '');
            file = Path.join(baseFilePath, filePath);
            contents = await Fsp.readFile(file);
            if (!isMainTmpl && !isContext) {
              for (let prm of prms.entries()) {
                contents += `<input name="${paramsInputIdPrefix}${prm[0]}" value="${prm[1]}" />`; // add parameters as input
              }
            }
          }
          res.statusCode = 200;
          res.setHeader('Content-Type', type || (isContext ? 'application/json' : 'text/html'));
          res.end(contents);
          if (log.info || log.debug) {
            (log.debug || log.info)(`HTTPS server processed ${url}${req.url} from "${file}" with contents:`,
              log.debug ? `\n${contents.toString()}` : !!contents);
          }
        } catch (err) {
          if (log.error) log.error(err);
          res.statusCode = 400;
          res.setHeader('Content-Type', 'text/html');
          res.end(`Failed to ${mthd} for: ${url}${req.url}, ERROR: ${err.message} STACK: ${err.stack}`);
        }
      });
      server.listen(port, hostname, () => {
        const addy = server.address();
        url = `https://${addy.address === '::' || server.address === '0.0.0.0' ? '127.0.0.1' : addy.includes}:${addy.port}/`;
        if (log.info) log.info(`Server running at ${url}`);
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

    rtn.html = Main.getFile(rtn.htmlPath, cache);
    rtn.json = Main.getFile(rtn.jsonPath, cache);
    rtn.htmlContext = Main.getFile(rtn.htmlContextPath, cache);
    rtn.jsonContext = Main.getFile(rtn.jsonContextPath, cache);

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
   * @param {Object} [data] The template, partials and/or context to pass into {@link Engine.register}
   * @param {Boolean} [readPartials] The read flag to pass into {@link Engine.register}
   * @param {Boolean} [writePartials] The write flag to pass into {@link Engine.register}
   * @param {Object} [renderOpts] The options to pass into the rendering function generated from {@link Engine.compile}
   * @param {Object} [extraContext] Key/value pairs to add to the extracted context JSON
   * @returns {Object} The test object parameters that contain property/values from {@link Main.init} as well as the following:
   * - `registerResult` - Result from calling {@link Engine.register} when called
   * - `fn` - The rendering funtion returned from {@link Engine.compile}
   * - `result` - The rendered result from calling the rendering function
   */
  static async baseTest(compileOpts, engine, data, readPartials, writePartials, renderOpts, extraContext) {
    const test = await Main.init(compileOpts, engine);
    const opts = test.engine.options;
    if (!/^html$|^json$/.test(opts.defaultExtension)) throw new Error(`Invalid TEST compileOpts.defaultExtension -> ${opts.defaultExtension}`);
    const isJSON = opts.defaultExtension === 'json';
    test.registerResult = data || readPartials ? await test.engine.register(data, readPartials, writePartials) : null;
    if (log.info) log.info(`>> Compiling the "${engine.options.defaultTemplateName}" ${isJSON ? 'JSON' : 'HTML'} template...`);
    test.fn = await test.engine.compile(isJSON ? test.json : test.html);
    if (log.info) log.info(`<< Compiling of the "${engine.options.defaultTemplateName}" ${isJSON ? 'JSON' : 'HTML'} template complete!`);
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

    if (log.info) log.info(`>> Rendering the "${engine.options.defaultTemplateName}" ${isJSON ? 'JSON' : 'HTML'} template...`);
    test.result = await test.fn(context, renderOpts);
    if (log.info || log.debug) {
      (log.debug || log.info)(`<< Rendering of the "${engine.options.defaultTemplateName}" ${isJSON ? 'JSON' : 'HTML'} template complete!`
      + (log.debug ? ` result:\n${test.result}` : ''));
    }
    if (isJSON) Main.expectJSON(test.result, context);
    else Main.expectDOM(test.result, context);
    return test;
  }

  /**
   * Captures a test file contents
   * @param {String} path The path to the file to read/get
   * @param {Boolean} cache `true` to cache the read content for subsequent calls
   * @returns {Buffer} The file contents
   */
  static async getFile(path, cache = true) {
    if (cache && TEST_FILES[path]) return TEST_FILES[path];
    return cache ? TEST_FILES[path] = await Fs.promises.readFile(path) : Fs.promises.readFile(path);
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
   * 
   * @param {Object[]} files The files returned from {@link Main.getFiles} 
   */
  static expectFiles(files) {
    for (let filed of files) {
      if (!filed.path) continue;

    }
  }

  /**
   * Initializes a test location for a LevelDB connection
   * @param {String} [locPrefix='templeo-test-indexedDB-'] The DB location prefix to use
   * @returns {Object} A metadata object containing `{ locPrefix:String, loc:String }`
   */
  static async initDB(locPrefix = 'templeo-test-db-') {
    if (DB[locPrefix]) return DB[locPrefix];
    const loc = await Fs.promises.mkdtemp(Path.join(Os.tmpdir(), locPrefix));
    DB[locPrefix] = { locPrefix, loc, type: 'level' };
    if (log.info) log.info(`Using LevelDB location @ ${loc}`);
    return DB[locPrefix];
  }

  /**
   * Clears any resources associated with an LevelDB instance
   * @param {Engine} [engine] The engine that will be used to call {@link Engine.clearCache}
   * @param {Boolean} [all=true] The flag passed into {@link Engine.clearCache}. Also, when `true`, the DB resources will be __wiped__
   * @param {String} [locPrefix='templeo-test-indexedDB-'] The DB location prefix to use (set to `null` to leave DB intact)
   */
  static async clearDB(engine, all = true, locPrefix = 'templeo-test-db-') {
    const meta = DB[locPrefix];
    if (engine) {
      if (log.info) log.info(`Clearing ${all ? 'all' : 'DB connection(s) from'} cache for LevelDB @ ${meta.loc}`);
      await engine.clearCache(all);
    }
    if (!all) return;
    if (log.info) log.info(`Removing LevelDB files @ ${meta.loc}`);
    delete DB[locPrefix];
    return Main.rmrf(meta.loc);
  }

  /**
   * Gets {@link Main.getTemplateFiles} along with an `Engine` with options
   * @param {Object} [opts] The template options to use
   * @param {Engine} [engine] The `Engine` instance to use (omit to create)
   * @returns {Object} An `{ engine:Engine, opts:Object }` along with properties from {@link Main.getTemplateFiles}
   */
  static async init(opts, engine) {
    const rtn = await Main.getTemplateFiles();
    rtn.engine = engine || new Engine(opts, HtmlFrmt, JsFrmt, log);
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
  static expectDOM(html, context, files) {
    const dom = new JSDOM(html), textRx = /[\n\r\s]*Test simple text inclusion[\n\r\s]*/;
    let el;

    // text inclusion
    el = dom.window.document.getElementById('text');
    expect(el, 'Text Included Element').not.null();
    expect(el.innerHTML, 'Text Included innerHTML').to.match(textRx);
  
    // comment block should be removed
    expect(html.includes('This is a comment'), 'Comment').to.be.false();
  
    // array iteration test
    for (let i = 0, arr = context.metadata; i < arr.length; i++) {
      el = dom.window.document.querySelector(`[name="${arr[i].name}"][content="${arr[i].content}"]`) || {};
      expect(el.name, `Metadata Context Name @ index ${i}`).to.equal(arr[i].name);
      expect(el.getAttribute('content'), `Metadata Context "content" attribute @ index ${i}`).to.equal(arr[i].content);
    }

    const doubles = dom.window.document.getElementsByName('doubles');
    expect(doubles.length, 'Doubles').to.equal(2);
  
    // object property iteration test
    let hasSel;
    for (let state in context.globals.states) {
      el = dom.window.document.querySelector(`option[id="stateSelect${state}"]`) || {};
      expect(el, 'State Option Element').not.null();
      expect(el.value, 'State Option Value').to.equal(state);
      expect(el.innerHTML, 'State Option innerHTML').to.equal(context.globals.states[state]);
      if (state === 'FL') {
        hasSel = true;
        expect(el.selected, 'State Option Selected').to.be.true(); // conditional check
      }
    }
  
    expect(hasSel).to.be.true();
  
    // validate for partials
    expectColorDOM(dom, context, 'swatchSelectColor'); // select options
    expectColorDOM(dom, context, 'swatchDatalistColor'); // datalist options
  
    // validate nested partial
    const swatchDatalist = dom.window.document.getElementById('swatchDatalist');
    expect(swatchDatalist, 'Swatch DataList').to.be.object();

    // validate partial from render-time read (if present)
    if (context.dynamicIncludeURL) {
      const dynInclURL = dom.window.document.getElementById('dynamicIncludeURL');
      expect(dynInclURL, 'Dynamic Include URL Element').to.be.object();
      expect(dynInclURL.dataset.url, 'Dynamic Include data-url').to.equal(context.dynamicIncludeURL);
      expect(dynInclURL.innerHTML, 'Dynamic Include URL innerHTML').to.match(textRx);
    }
  
    //if (log.debug) log.debug(fn, rslt);
    return dom;
  }

  /**
   * Validates that a set of {@link Main.getFiles} exists from another set of {@link Main.getFiles}
   * @param {Object} [files] The files from {@link Main.getFiles}
   * @param {Object[]} [files.expected] A return value from {@link Main.getFiles} that should be present in `files.actual`
   * @param {Object[]} [files.actual] A return value from {@link Main.getFiles} that expect to have values present in `files.expected`
   */
  static async expectFiles(files) {
    expected: for (let exp in files.expected) {
      for (let act in files.actual) {
        if (exp.name === act.name) {
          continue expected;
        }
      }
      expect(filed.path)
      filed.path
    }
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
   * using a generated `name` attribute on an element generated by {@link Main.httpsServer} (ignored when `useServer` is _falsy_)
   * @param {Integer} [test.cases[].search.callCount] The number of times that the underlying `test.server` should be called to retrieve
   * included template content for the given `search.name` (ignored when `useServer` is _falsy_)
   * @param {Object} [test.cases[].pass] Whether or not basic JSON parameters are used
   * @param {Integer} [test.cases[].pass.paramCount] The number of times that include parameters that should be present in the result
   * @param {Object} [test.files] A return object from {@link Main.getTemplateFiles} (will initialize when _falsy_)
   * @param {Object} [test.server] The return object from {@link Main.httpsServer} (will initialize when _falsy_)
   * @param {Engine} [test.engine] The {@link Engine} used in the test (will initialize when _falsy_)
   * @param {Cachier} [test.cachier] The test cachier to use (__passed `cachier` overrides `test.cachier`__)
   * @param {Function} [test.renderer] The rendering function from {@link Engine.compile} used in the test (will initialize when _falsy_)
   * @param {String} [test.result] The returned results from the rendering function invocation used in the test (will initialize when _falsy_)
   * @param {Object} [opts] The options passed into the {@link TemplateOpts} constructor
   * @param {TemplateOpts} [opts.compileOpts] The compile options
   * @param {TemplateOpts} [opts.renderOpts] The render options
   * @param {Object[]} [data] Template, partials and/or context passed into {@link Engine.register}
   * @param {Boolean} [readPartials] Passes the `read` flag into {@link Engine.register}
   * @param {Boolean} [writePartials] Passes the `write` flag into {@link Engine.register}
   * @param {Cachier} [cachier] A {@link Cachier} that will be passed into {@link Engine.create}
   * @param {Boolean} [useServer] `true` to serve partials via {@link Main.httpsServer} and validate the call count
   * @param {Boolean} [closeServer] `true` to close the server when complete
   * @returns {Object} `test` The passed test object
   */
  static async paramsTest(test, opts, data, readPartials, writePartials, cachier, useServer = true, closeServer = true) {
    const idPrefix = useServer ? 'inclParamFromServer_' : '';
    opts = opts || { render: {} };
    test.files = test.files || await Main.getTemplateFiles();
    
    let els, label = test.label, pit;
    test.server = useServer ? test.server || await Main.httpsServer(opts.compile, idPrefix) : null;
    try {
      if (test.server) {
        opts.render.contextURL = test.server.url;
        opts.render.templateURL = test.server.url;
        opts.render.partialsURL = test.server.url;
      }
      test.engine = test.engine || (cachier || test.cachier ? Engine.create(cachier || test.cachier) : new Engine(opts.compile, HtmlFrmt, JsFrmt, log));
      if (data || readPartials || writePartials) {
        await test.engine.register(data, readPartials, writePartials);
      }
      test.renderer = test.renderer || await test.engine.compile(test.template);
      test.result = test.result || await test.renderer(test.files.htmlContext, opts.render);

      if (log.debug) {
        log.debug(`Parameters test complete for template:\n${test.template}\nRESULT:\n${test.result}`);
      }
      test.dom = new JSDOM(test.result);
      const cases = Array.isArray(test.cases) ? test.cases : [test.cases];

      for (let cased of cases) {
        if (test.server && cased.search && cased.search.name && cased.search.hasOwnProperty('callCount')) {
          expect(test.server.callCount(cased.search.name, cased.params),
            `${label} ${cased.search.name} call count`).to.equal(cased.search.callCount);
        }
        for (let name in cased.params) {
          if (cased.search) {
            if (cased.search.paramText) {
              label += ` include parameter text value`;
              expect(test.dom.window.document.body.innerHTML, label).to.includes(cased.search.paramText);
            } else if (cased.search.paramCount) {
              // dynamic parameters generated by the server
              label += ` "${idPrefix}${name}" include parameters getElementsByName`;
              els = test.dom.window.document.getElementsByName(`${idPrefix}${name}`);
              expect(els, label).to.not.be.null();
              expect(els.length, `${label} # of elements`).to.equal(cased.search.paramCount);
              for (let ei = 0; ei < cased.search.paramCount; ei++) {
                expect(els[ei], label).to.not.be.null();
                expect(els[ei].value, label).to.equal(cased.params[name]);
              }
            }
          }
          if (cased.pass) {
            label += ` "${name}" include parameters getElementsByName`;
            // dynamic parameters generated within the partial template itself
            // using the scoped "params"
            els = test.dom.window.document.getElementsByName(name);
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
      if (closeServer && test.server) await test.server.close();
    }
    return test;
  }

  /**
   * Validates that a {@link Main.NO_FILE_NAME} has been added by a server from {@link Main.httpsServer}
   * @param {JSDOM} dom The JSDOM to validate from
   */
  static noFileValidate(dom) {
    let noFileEl = dom.window.document.querySelector(`[name="${NO_FILE_NAME}"]`);
    let label = `Element validation for "${NO_FILE_NAME}"`;
    expect(noFileEl, label).to.not.be.null();
    expect(noFileEl.value, label).to.equal(NO_FILE_VAL);
  }

  /**
   * Runs a function from a class using `return Clazz[process.argv[2]](...args)`
   * __or__ runs through all of the `async` functions from `Object.getOwnPropertyNames(Clazz)` via
   * `await Clazz[propertyName](...args)` other than function names that are found in `excludes` or
   * `before`, `beforeEach`, `after`, `afterEach`. If the _static_ method ends with "__Error__", execution
   * will assume that the function will _throw_.
   * @ignore
   * @param {Object} Clazz The class the test running will be running for
   * @param {String[]} [excludes] Function names to exclude from execution (only used when executing all)
   * @param {*[]} [args] Any additional arguments to pass to function(s) that are executed
   * @returns {Object} The return value(s) from the designated function call with each property
   * name set to the name of the function executed and the value as the return value from the call
   */
  static async run(Clazz, excludes, ...args) {
    let prps = [], frx = /^[a-z]/i;
    for (let arg of argv) {
      if (frx.test(arg)) prps.push(arg);
    }
    if (!prps.length) prps = Object.getOwnPropertyNames(Clazz);
    if (log && log.info) log.info(`Preparing execution of ${Clazz.name}.${prps.join(`, ${Clazz.name}.`)}`);

    const excls = ['before', 'beforeEach', 'after', 'afterEach'], execr = {}, rtn = {};
    const prefix1 = '\n\x1b[37m\x1b[44m============>> ', prefix2 = ' <<============\x1b[0m\x1b[40m';
    for (let enm of excls) {
      execr[enm] = typeof Clazz[enm] === 'function' ? Clazz[enm] : null;
    }

    if (execr['before']) {
      if (log.info) log.info(`${prefix1}Executing: ${Clazz.name}.before(${args.join(',')})${prefix2}`);
      rtn['before'] = await execr['before'](...args);
    }
    let error;
    for (let prop of prps) {
      error = null;
      if (typeof Clazz[prop] !== 'function' || (excludes && excludes.includes(prop)) || excls.includes(prop)) continue;
      if (execr['beforeEach']) {
        if (log.info) log.info(`${prefix1}Executing: ${Clazz.name}.beforeEach(${args.join(',')})${prefix2}`);
        rtn['beforeEach'] = await execr['beforeEach'](...args);
      }
      try {
        if (log.info) log.info(`${prefix1}Executing: await ${Clazz.name}.${prop}(${args.join(',')})${prefix2}`);
        rtn[prop] = await Clazz[prop](...args);
        if (log.info) log.info(`\nExecution complete for: await ${Clazz.name}.${prop}(${args.join(',')})`);
      } catch (err) {
        if (prop.endsWith('Error')) {
          rtn[prop] = err;
          if (log.info) log.info(`\nExecution complete for: await ${Clazz.name}.${prop}(${args.join(',')}) -> Expected error: "${err.message}"`);
        } else {
          if (log.error) log.error(err);
          error = err;
          error.cause = `Execution failed for: await ${Clazz.name}.${prop}(${args.join(',')})`;
        }
      }
      if (execr['afterEach']) {
        if (log.info) log.info(`${prefix1}Executing: ${Clazz.name}.afterEach(${args.join(',')})${prefix2}`);
        try {
          rtn['afterEach'] = await execr['afterEach'](...args);
        } catch (err) {
          if (error && log.error) log.error(err);
          if (!error) throw err;
        }
      }
      if (error) break;
    }
    if (execr['after']) {
      if (log.info) log.info(`${prefix1}Executing: ${Clazz.name}.after(${args.join(',')})${prefix2}`);
      try {
        rtn['after'] = await execr['after'](...args);
      } catch (err) {
        if (error && log.error) log.error(err);
        if (!error) throw err;
      }
    }
    if (error) {
      if (error.cause) throw new Error(`\n${error.cause} ... Execution aborted!`);
      throw error;
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

  static get NO_FILE_NAME() {
    return NO_FILE_NAME;
  }

  static get PATH_RELATIVE_TO() {
    return PATH_RELATIVE_TO;
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