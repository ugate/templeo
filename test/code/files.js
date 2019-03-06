'use strict';

const { expect, LOGGER, Engine, JSDOM, Path, Fs, JsFrmt, Main } = require('./_main');
const CachierFiles = require('../../lib/cachier-files.js');
// ESM uncomment the following lines...
// TODO : import { expect, LOGGER, Engine, JSDOM, Path, Fs, JsFrmt, Main } from './_main.mjs';
// TODO : import * as CachierFiles from '../../lib/cachier-files.mjs';

const PARTIAL_DETECT_DELAY_MS = 100;
var engine;

// DEBUGGING:
// Use the following:
// node --inspect-brk test/code/files.js
// ...or with optional test function name appended to the end:
// node --inspect-brk test/code/files.js htmlNoCache

// TODO : ESM uncomment the following line...
// export
class Tester {

  static async after() {
    return engine ? engine.clearCache(true) : null; // cleanup temp files
  }

  static async htmlPartialReadCache() {
    const opts = baseOptions();
    return Main.baseTest(opts.compile, await getFilesEngine(opts.compile), null, true);
  }

  static async htmlPartialReadNoCache() {
    const opts = baseOptions();
    opts.compile.cacheRawTemplates = false;
    return Main.baseTest(opts.compile, await getFilesEngine(opts.compile), null, true);
  }

  static async htmlCacheWithWatch() {
    const opts = baseOptions();
    opts.compile.watchRegistrationSourcePaths = true;
    const test = await Main.init(opts.compile, await getFilesEngine(opts.compile));
    await test.engine.registerPartials(null, true);
    await partialFrag(test);
    return engine.clearCache(true); // should clear the cache/watches
  }

  static async htmlCacheWithRegisterPartials() {
    const opts = baseOptions();
    const partials = await Main.getFiles(opts.compile.partialsPath, true);
    return Main.baseTest(opts.compile, await getFilesEngine(opts.compile), partials, true);
  }

  static async htmlRenderTimeReadWithRegisteredSearchParams() {
    const opts = baseOptions(true);
    const params = {
      registeredSearchParam1: 'Registered Search Param 1 VALUE',
      registeredSearchParam2: 'Registered Search Param 2 VALUE'
    };
    const text = (await Main.getFile(`${Main.PATH_HTML_PARTIALS_DIR}/text.html`, true)).toString();
    const cachier = new CachierFiles(opts.render, JsFrmt, LOGGER);
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
    let els = test.dom.window.document.getElementsByName(Main.NO_FILE_NAME);
    // read partials from the file system at render-time
    await Main.paramsTest(test, opts, null, false, false, cachier, true, true);
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
    partialsPath: Main.PATH_HTML_PARTIALS_DIR,
    sourcePath: Main.PATH_HTML_PARTIALS_DIR
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

async function getFilesEngine(opts) {
  if (engine) await engine.clearCache(true); // cleanup temp files
  const cachier = new CachierFiles(opts, JsFrmt, LOGGER);
  engine = new Engine(cachier);
  return engine;
}

async function partialFrag(test, elId, name) {
  test.frag = { elementId: elId || 'test-partial-add', name: name || 'watch-test' };
  test.frag.html = `<div id="${test.frag.elementId}"></div>`;
  /* jSDOM escapes templeo template syntax causing errors
  const udom = new JSDOM(test.html);
  udom.window.document.body.append(`\${ include\`${test.frag.name}\` }`);
  frag.html = udom.serialize();*/
  test.html = test.html.replace(/(<\s*body[^>]*>)([\s\S]*?)(<\s*\/\s*body>)/ig, (mtch, open, content, close) => {
    return `${open}${content}\${ await include\`${test.frag.name}\` }${close}`;
  });

  // write frag (should be picked up and registered by the file watcher set via registerPartials read)
  const opts = test.engine.options;
  test.frag.path = `${Path.join(opts.relativeTo, opts.partialsPath, test.frag.name)}.html`;
  await Fs.promises.writeFile(test.frag.path, test.frag.html);

  try {
    await Main.wait(PARTIAL_DETECT_DELAY_MS); // give the watch some time to detect the changes
    // compile the updated HTML
    const fn = await test.engine.compile(test.html);
    // check the result and make sure the test partial was detected 
    const rslt = await fn(test.htmlContext), dom = new JSDOM(rslt);
    const prtl = dom.window.document.getElementById(test.frag.elementId);
    expect(prtl).not.null();
    Main.expectDOM(rslt, test.htmlContext);
  } finally {
    await Fs.promises.unlink(test.frag.path); // remove test fragment
  }
  return test;
}