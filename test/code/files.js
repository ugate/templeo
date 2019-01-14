'use strict';

const { expect, LOGGER, Engine, JSDOM, Path, Fs, JsFrmt, Main } = require('./_main');
// ESM uncomment the following lines...
// TODO : import { expect, LOGGER, Engine, JSDOM, Path, Fs, JsFrmt, Main } from './_main.mjs';

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

  static async htmlCache() {
    const opts = baseOptions();
    return Main.baseTest(opts, await getFilesEngine(opts), null, true);
  }

  static async htmlNoCache() {
    const opts = baseOptions();
    opts.isCached = false;
    return Main.baseTest(opts, await getFilesEngine(opts), null, true);
  }

  static async htmlCacheWithWatch() {
    const opts = baseOptions();
    opts.watchRegistrationSourcePaths = true;
    const test = await Main.init(opts, await getFilesEngine(opts));
    await test.engine.registerPartials(null, true);
    await partialFrag(test);
    return engine.clearCache(true); // should clear the cache/watches
  }

  static async htmlCacheWithRegisterPartials() {
    const opts = baseOptions();
    const partials = await Main.getFiles(opts.partialsPath, true);
    return Main.baseTest(opts, await getFilesEngine(opts), partials, true);
  }
}

// TODO : ESM remove the following line...
module.exports = Tester;

// when not ran in a test runner execute static Tester functions (excluding what's passed into Main.run) 
if (!Main.usingTestRunner()) {
  (async () => await Main.run(Tester))();
}

function baseOptions() {
  return {
    pathBase: '.',
    path: 'test/views',
    partialsPath: 'test/views/partials',
    sourcePath: 'test/views/partials'
  };
}

async function getFilesEngine(opts) {
  if (engine) await engine.clearCache(true); // cleanup temp files
  engine = await Engine.filesEngine(opts, JsFrmt, LOGGER);
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
  test.frag.path = `${Path.join(test.opts.pathBase, test.opts.partialsPath, test.frag.name)}.html`;
  await Fs.promises.writeFile(test.frag.path, test.frag.html);

  try {
    await Main.wait(PARTIAL_DETECT_DELAY_MS); // give the watch some time to detect the changes
    // compile the updated HTML
    const fn = await test.engine.compile(test.html);
    // check the result and make sure the test partial was detected 
    const rslt = await fn(test.data), dom = new JSDOM(rslt);
    const prtl = dom.window.document.getElementById(test.frag.elementId);
    expect(prtl).not.null();
    Main.expectDOM(rslt, test.data);
  } finally {
    await Fs.promises.unlink(test.frag.path); // remove test fragment
  }
  return test;
}