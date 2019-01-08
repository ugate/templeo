'use strict';

const { Lab, PLAN, TEST_TKO, LOGGER, Engine, getFiles,  baseTest, init, expectDOM, JSDOM, Path, Fs, JsFrmt } = require('./_main.js');
const lab = exports.lab = Lab.script();
const { expect } = require('code');
// ESM uncomment the following lines...
// TODO : import { Lab, PLAN, TEST_TKO, LOGGER, Engine, getFiles,  baseTest, init, expectDOM, JSDOM, Path, Fs, JsFrmt } from './_main.mjs';
const plan = `${PLAN} Files`;
const PARTIAL_DETECT_DELAY_MS = 100;

// "node_modules/.bin/lab" test/files.js -vi 4

lab.experiment(plan, () => {

  var engine;

  async function getFilesEngine(opts) {
    if (engine) await engine.clearCache(true); // cleanup temp files
    engine = await Engine.filesEngine(opts, JsFrmt, LOGGER);
    return engine;
  }

  lab.after(async () => {
    return engine ? engine.clearCache(true) : null; // cleanup temp files
  });

  lab.test(`${plan}: HTML (cache)`, { timeout: TEST_TKO }, async flags => {
    const opts = baseOptions();
    return baseTest(opts, true, await getFilesEngine(opts));
  });

  lab.test(`${plan}: HTML (no-cache)`, { timeout: TEST_TKO }, async flags => {
    const opts = baseOptions();
    opts.isCached = false;
    return baseTest(opts, true, await getFilesEngine(opts));
  });

  lab.test(`${plan}: HTML (cache w/watch)`, { timeout: TEST_TKO }, async flags => {
    const opts = baseOptions();
    opts.watchScannedSourcePaths = true;
    const test = await init(opts, true, await getFilesEngine(opts));
    await partialFrag(test);
    return engine.clearCache(true); // should clear the cache/watches 
  });

  lab.test(`${plan}: HTML (cache w/registerPartials)`, { timeout: TEST_TKO }, async flags => {
    const opts = baseOptions();
    opts.partials = await getFiles(opts.partialsPath, true);
    return baseTest(opts, true, await getFilesEngine(opts));
  });
});

function baseOptions() {
  return {
    pathBase: '.',
    path: 'test/views',
    partialsPath: 'test/views/partials',
    scanSourcePath: 'test/views/partials'
  };
}

async function partialFrag(test, elId, name) {
  test.frag = { elementId: elId || 'test-partial-add', name: name || 'watch-test' };
  test.frag.html = `<div id="${test.frag.elementId}"></div>`;
  /* jSDOM escapes templeo template syntax causing errors
  const udom = new JSDOM(test.html);
  udom.window.document.body.append(`\${ include\`${test.frag.name}\` }`);
  frag.html = udom.serialize();*/
  test.html = test.html.replace(/(<\s*body[^>]*>)([\s\S]*?)(<\s*\/\s*body>)/ig, (mtch, open, content, close) => {
    return `${open}${content}\${ include\`${test.frag.name}\` }${close}`;
  });

  // write frag (should be picked up and registered by the file watcher set via the scan)
  test.frag.path = `${Path.join(test.opts.pathBase, test.opts.partialsPath, test.frag.name)}.html`;
  await Fs.promises.writeFile(test.frag.path, test.frag.html);

  try {
    await promisifyDelay(PARTIAL_DETECT_DELAY_MS); // give the watch some time to detect the changes
    // compile the updated HTML
    const fn = await test.engine.compile(test.html);
    // check the result and make sure the test partial was detected 
    const rslt = await fn(test.data), dom = new JSDOM(rslt);
    const prtl = dom.window.document.getElementById(test.frag.elementId);
    expect(prtl).not.null();
    expectDOM(rslt, test.data);
  } finally {
    await Fs.promises.unlink(test.frag.path); // remove test fragment
  }
  return test;
}

function promisifyDelay(delay, val, rejectIt) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (rejectIt) reject(val instanceof Error ? val : new Error(val));
      else resolve(val);
    }, delay);
  });
}