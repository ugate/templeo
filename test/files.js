'use strict';

const { Lab, PLAN, TEST_TKO, ENGINE_LOGGER, Engine, baseTest, init, expectDOM, JSDOM, Path, Fs, JsFrmt } = require('./_main.js');
const lab = exports.lab = Lab.script();
const { expect } = require('code');
// ESM uncomment the following lines...
// import { Lab, PLAN, ENGINE_LOGGER, TEST_TKO, Engine, baseTest, init, expectDOM, JSDOM, Path, Fs, JsFrmt } from './_main.mjs';
const plan = `${PLAN} Files`;
const PARTIAL_DETECT_DELAY_MS = 100;

// "node_modules/.bin/lab" test/files.js -vi 3

lab.experiment(plan, () => {

  lab.test(`${plan}: HTML (engine cache)`, { timeout: TEST_TKO }, async flags => {
    const opts = baseOptions();
    return baseTest(opts, true, await Engine.engineFiles(opts, JsFrmt));
  });

  lab.test(`${plan}: HTML (engine no-cache)`, { timeout: TEST_TKO }, async flags => {
    const opts = baseOptions();
    opts.isCached = false;
    return baseTest(opts, true, await Engine.engineFiles(opts, JsFrmt));
  });

  lab.test(`${plan}: HTML (engine cache watch)`, { timeout: TEST_TKO }, async flags => {
    const opts = baseOptions();
    opts.pathScanSrcWatch = true;
    const test = await init(opts, true, await Engine.engineFiles(opts, JsFrmt));
    return await partialFrag(test);
  });
});

function baseOptions() {
  return {
    pathBase: '.',
    path: 'test/views',
    pathPartials: 'test/views/partials',
    pathScanSrc: 'test/views/partials',
    logger: ENGINE_LOGGER
  };
}

async function partialFrag(test, elId, name) {
  test.frag = { elementId: elId || 'test-partial-add', name: name || 'watch-test' };
  test.frag.html = `<div id="${test.frag.elementId}"></div>`;
  /* jSDOM escapes templeo template syntax causing errors
  const udom = new JSDOM(test.html);
  udom.window.document.body.append(`{{#${test.frag.name}}}`);
  frag.html = udom.serialize();*/
  test.html = test.html.replace(/(<\s*body[^>]*>)([\s\S]*?)(<\s*\/\s*body>)/ig, (mtch, open, content, close) => {
    return `${open}${content}{{#${test.frag.name}}}${close}`;
  });

  // write frag (should be picked up and registered by the file watcher set via the scan)
  test.frag.path = `${Path.join(test.opts.pathBase, test.opts.pathPartials, test.frag.name)}.html`;
  await Fs.promises.writeFile(test.frag.path, test.frag.html);

  try {
    await promisifyDelay(PARTIAL_DETECT_DELAY_MS); // give the watch some time to detect the changes
    // compile the updated HTML
    const fn = await test.engine.compile(test.html);
    // check the result and make sure the test partial was detected 
    const rslt = fn(test.data), dom = new JSDOM(rslt);
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