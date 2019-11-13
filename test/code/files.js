'use strict';

const { expect, LOGGER, Engine, JSDOM, Path, Fs, HtmlFrmt, JsFrmt, Main } = require('./_main');
const CachierFiles = require('../../lib/cachier-files.js');
// ESM uncomment the following lines...
// TODO : import { expect, LOGGER, Engine, JSDOM, Path, Fs, HtmlFrmt, JsFrmt, Main } from './_main.mjs';
// TODO : import * as CachierFiles from '../../lib/cachier-files.mjs';

const PARTIAL_DETECT_DELAY_MS = 200;
var engine;

// DEBUGGING: Use the following
// node --inspect-brk test/code/files.js
// LOGGING: Use the following
// node test/code/files.js -NODE_ENV=test
// LOGGING Single Test: Use the following
// node test/code/files.js -NODE_ENV=test htmlPartialReadCache

// TODO : ESM uncomment the following line...
// export
class Tester {

  static async after() {
    return engine ? engine.clearCache(true) : null; // cleanup temp files
  }

  static async htmlPartialReadCache() {
    const opts = baseOptions(), init = await initFilesEngine(opts.compile);
    return Main.baseTest({ read: true, sendTemplate: true, sendContext: true }, opts.compile, init.engine);
  }

  static async htmlPartialReadNoCache() {
    const opts = baseOptions(), init = await initFilesEngine(opts.compile);
    opts.compile.cacheRawTemplates = false;
    return Main.baseTest({ read: true }, opts.compile, init.engine);
  }

  static async htmlCacheWithRegisterPartials() {
    const opts = baseOptions();
    const partials = await Main.getFiles(opts.compile.partialsPath, true);
    const init = await initFilesEngine(opts.compile);
    return Main.baseTest({ read: true }, opts.compile, init.engine, partials);
  }

  static async htmlCacheWithWatch() {
    const opts = baseOptions();
    opts.compile.watchPaths = true;
    const init = await initFilesEngine(opts.compile);
    const test = await Main.init(opts.compile, init.engine);
    await test.engine.register(null, true);
    return partialFragWatch(init, test, LOGGER, opts.render);
  }

  static async htmlRenderTimePartialReadCache() {
    const opts = baseOptions(true), init = await initFilesEngine(opts.compile);
    return Main.baseTest({}, opts.compile, init.engine, null, opts.render);
  }

  static async htmlRenderTimePartialReadNoCache() {
    const opts = baseOptions(true), init = await initFilesEngine(opts.compile);
    opts.render.cacheRawTemplates = false;
    return Main.baseTest({}, opts.compile, init.engine, null, opts.render);
  }

  static async htmlRenderTimeReadWrite() {
    const opts = baseOptions(true);
    const params = {
      registeredSearchParam1: 'Registered Search Param 1 VALUE',
      registeredSearchParam2: 'Registered Search Param 2 VALUE'
    };
    const text = (await Main.getFile(`${Main.PATH_HTML_PARTIALS_DIR}/text.html`, true)).toString();
    const cachier = new CachierFiles(opts.render, HtmlFrmt, JsFrmt, LOGGER);
    // write partial to file system, no HTTPS server
    const test = {
      label: 'Params = Single Search Param',
      template: `<html><body>\${ await include\`text \${ new URLSearchParams(${ JSON.stringify(params) }) }\` }\${ await include\`${ Main.NO_FILE_NAME }\` }</body></html>`,
      cases: {
        params,
        search: { name: 'text', paramText: text }
      }
    };
    // write source code to the file system at compile-time
    await Main.paramsTest(test, opts, null, false, true, cachier, true, false);
    // validate the no file element was added by the server
    Main.noFileValidate(test.dom);

    // read partials from the file system at render-time
    await Main.paramsTest(test, opts, null, false, false, cachier, true, true);
    // test.result updated, validate the no file element was added by the server
    Main.noFileValidate(test.dom);
  }

  // NOTE: Since a rendering function is decoupled from the initiating compiler,
  // file watches should not really be performed during/between rendering function calls
  static async htmlRenderTimeCacheWithWatch() {
    // need to use compile options with paths set so they match the registered test fragment path
    const opts = baseOptions(true), copts = baseOptions();
    opts.render.watchPaths = true;
    opts.render.renderTimePolicy = 'read-all-on-init-when-empty';
    const init = await initFilesEngine(copts.compile);
    const test = await Main.init(copts.compile, init.engine);
    await partialFragWatch(init, test, LOGGER, opts.render);
  }
}

// TODO : ESM remove the following line...
module.exports = Tester;

// when not ran in a test runner execute static Tester functions (excluding what's passed into Main.run) 
if (!Main.usingTestRunner()) {
  (async () => await Main.run(Tester))();
}

function baseOptions(renderTime) {
  const opts = {
    templatePath: Main.PATH_VIEWS_DIR,
    contextPath: Main.PATH_HTML_CONTEXT_DIR,
    partialsPath: Main.PATH_HTML_PARTIALS_DIR
  };
  const copts = renderTime ? {} : opts;
  const ropts = renderTime ? opts : {};
  ropts.readFetchRequestOptions = {
    rejectUnauthorized: false
  }
  return {
    compile: copts,
    render: ropts
  };
}

async function initFilesEngine(opts) {
  if (engine) await engine.clearCache(true); // cleanup temp files
  const cachier = new CachierFiles(opts, HtmlFrmt, JsFrmt, LOGGER);
  engine = Engine.create(cachier);
  return { cachier, engine };
}

async function partialFragWatch(init, test, log, renderOpts, elId, name) {
  const opts = test.engine.options;
  if (!opts.watchPaths && (!renderOpts || !renderOpts.watchPaths)) {
    throw new Error(`The "watchPaths" option must be set on the compile-time or render-time options to test file watches`);
  }
  test.frag = { elementId: elId || 'test-partial-add', name: name || 'watch-test' };
  test.frag.htmlInit = 'pre-watch-fragment';
  test.frag.html = `<div id="${test.frag.elementId}">File watcher added data!</div>`;
  /* jSDOM escapes templeo template syntax causing errors
  const udom = new JSDOM(test.html);
  udom.window.document.body.append(`\${ include\`${test.frag.name}\` }`);
  frag.html = udom.serialize();*/
  test.html = test.html.replace(/(<\s*body[^>]*>)([\s\S]*?)(<\s*\/\s*body>)/ig, (mtch, open, content, close) => {
    return `${open}${content}\${ await include\`${test.frag.name}\` }${close}`;
  });

  // write frag (should be picked up and registered by the file watcher set via register read)
  const relativeTo = (renderOpts && renderOpts.relativeTo) || opts.relativeTo;
  const partialsPath = (renderOpts && renderOpts.partialsPath) || opts.partialsPath;
  test.frag.path = `${Path.join(relativeTo, partialsPath, test.frag.name)}.html`;
  await writeWatch(test, log, false, opts.watchPaths);

  let renderFunc, error, parts;
  try {
    // initial compile test and validation
    renderFunc = await compileWatchTest(test, log, opts.watchPaths);
    if (opts.watchPaths) {
      // change the file contents that should trigger the compile-time watch to update the registered partial
      await writeWatch(test, log, true, opts.watchPaths);
      // check that the watch change was captured and reflected in a newly compiled rendering function
      renderFunc = await compileWatchTest(test, log, true);
      // render and validate the renderer has the watched changes
      await renderWatchTest(test, log, renderFunc, renderOpts);
    } else {
      parts = {};
      // render with initial unchanged partial and begin watch
      await renderWatchTest(test, log, renderFunc, renderOpts, parts);
      // change the file contents that should trigger the render-time watch to update the registered partial
      await writeWatch(test, log, true);
      // check the result and make sure the test partial was detected
      await renderWatchTest(test, log, renderFunc, null, parts); // null for render opts since we don't need to watch again
    }
  } catch (err) {
    error = err;
  } finally {
    await Fs.promises.unlink(test.frag.path); // remove test fragment
    if (opts.watchPaths) {
      if (log && log.info) log.info(`TEST: ♻️ Clearing watchers (compile-time)`);
      await engine.clearCache(true); // should clear the compile-time cache/watches
    } else if (renderFunc && renderOpts && renderOpts.watchPaths) {
      try {
        if (log && log.info) log.info(`TEST: ♻️ Clearing watchers (render-time)`);
        const uopts = baseOptions(true);
        uopts.render.unwatchPaths = true;
        await renderFunc({}, uopts.render); // should clear the render-time watches
      } catch (err) {
        if (!error) throw err;
        else if (log && log.warn) log.warn(err);
      }
    }
  }
  if (error) throw error;
  return test;
}

async function compileWatchTest(test, log, isCompileWatch) {
  if (log && log.info) {
    log.info(`TEST: 🐞 Compiling for "${test.frag.name}" @ Element ID "${test.frag.elementId}" (${isCompileWatch ? 'compile' : 'render'}-time watch)`);
  }
  // need to register the inital test fragment so it is not read at render-time since it will be missing/empty otherwise
  // this will allow the watch to be tested without a render-time read interfering
  await test.engine.registerPartial(test.frag.name, test.frag.htmlInit);
  // compile the HTML with the watched partial
  const renderFunc = await test.engine.compile(test.html);
  const reg = await test.engine.getRegistered(test.frag.name);
  expect(reg && reg.content, `Registered "${test.frag.name}"`).equals(test.frag.htmlInit);
  expect(renderFunc, `Rendering Function for "${test.frag.name}"`).to.be.function();
  return renderFunc;
}

async function writeWatch(test, log, update, isCompileWatch) {
  if (log && log.info) {
    log.info(`TEST: 🐞 ${update ? 'Changing' : 'Initializing'} watched "${test.frag.name}" @ Element ID "${test.frag.elementId}" (${isCompileWatch ? 'compile' : 'render'}-time watch)`);
  }
  await Fs.promises.writeFile(test.frag.path, update ? test.frag.html : test.frag.htmlInit);
  // give the watch some time to detect the changes
  if (update) await Main.wait(PARTIAL_DETECT_DELAY_MS);
  const reg = await test.engine.getRegistered(test.frag.name);
  expect(reg && reg.content, `Registered "${test.frag.name}"`).equals(update ? test.frag.html : test.frag.htmlInit);
}

async function renderWatchTest(test, log, renderFunc, renderOpts, parts) {
  if (log && log.info) {
    log.info(`TEST: 🐞 Rendering for "${test.frag.name}" @ Element ID "${test.frag.elementId}" (${!parts ? 'compile' : 'render'}-time watch)`);
  }
  let rslt = await renderFunc(test.htmlContext, renderOpts, null, null, parts);
  let dom = new JSDOM(rslt), prtl = dom.window.document.getElementById(test.frag.elementId);
  /*if (renderOpts && renderOpts.watchPaths) {
    dom = new JSDOM(rslt), prtl = dom.window.document.getElementById(test.frag.elementId);
    expect(prtl, `File watch for template partial "${test.frag.name}" @ Element ID "${test.frag.elementId}" (pre-change)`).null();
    await writeWatch(test, log);
    rslt = await renderFunc(test.htmlContext, renderOpts);
  }*/
  expect(prtl, `File watch for template partial "${test.frag.name}" @ Element ID "${test.frag.elementId}"`).not.null();
  Main.expectDOM(rslt, test.htmlContext);
  return rslt;
}