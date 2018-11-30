'use strict';

const { Lab, PLAN, TEST_TKO, ENGINE_LOGGER, Engine, JsFrmt, getTemplateFiles, expectDOM, JSDOM, Path, Fs } = require('./_main.js');
const lab = exports.lab = Lab.script();
const { expect } = require('code');
// ESM uncomment the following lines...
// import { expect, Lab, PLAN, TEST_TKO, ENGINE_LOGGER, Engine, JsFrmt, getTemplateFiles, expectDOM, JSDOM, Path, Fs } from './_main.mjs';
const plan = `${PLAN} Files`;

// "node_modules/.bin/lab" test/files.js -vi 3

lab.experiment(plan, () => {

  lab.test(`${plan}: HTML (engine cache)`, { timeout: TEST_TKO }, flags => {
    const opts = baseOptions();
    return baseTest(opts);
  });

  lab.test(`${plan}: HTML (engine no-cache)`, { timeout: TEST_TKO }, flags => {
    const opts = baseOptions();
    opts.isCached = false;
    return baseTest(opts);
  });

  lab.test(`${plan}: HTML (engine cache watch)`, { timeout: TEST_TKO }, async flags => {
    const opts = baseOptions();
    opts.pathScanSrcWatch = true;
    const { html, data } = await getTemplateFiles();
    const eng = await Engine.engineFiles(opts, JsFrmt);
    await eng.scan(true);

    // update the template with the added partial
    const frag = '<div id="test-partial-add"></div>', fnm = 'watch-test';
    /* jSDOM escapes templeo template syntax causing errors
    const udom = new JSDOM(html);
    udom.window.document.body.append(`{{#${fnm}}}`);
    const uhtml = udom.serialize();*/
    const uhtml = html.replace(/(<\s*body[^>]*>)([\s\S]*?)(<\s*\/\s*body>)/ig, (mtch, open, content, close) => {
      return `${open}${content}{{#${fnm}}}${close}`;
    });

    // write frag (should be picked up and registered by the file watcher set via the scan)
    const fragPath = `${Path.join(opts.pathBase, opts.pathPartials, fnm)}.html`;
    await Fs.promises.writeFile(fragPath, frag);

    try {
      await promisifyDelay(100); // give the watch some time to detect the changes
      // compile the updated HTML
      const fn = await eng.compile(uhtml);
      // check the result and make sure the test partial was detected 
      const rslt = fn(data), dom = new JSDOM(rslt);
      const prtl = dom.window.document.getElementById('test-partial-add');
      expect(prtl).not.null();
      expectDOM(rslt, data);
    } finally {
      Fs.promises.unlink(fragPath); // remove test fragment
    }
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

async function baseTest(opts) {
  const { tpmlPth, dtaPth, html, data } = await getTemplateFiles();

  const eng = await Engine.engineFiles(opts, JsFrmt);
  await eng.scan(true);
  const fn = await eng.compile(html);

  expect(fn).to.be.function();

  const rslt = fn(data);
  const dom = expectDOM(rslt, data);
  //console.log(rslt);

  return { tpmlPth, dtaPth, html, data, fn, rslt, dom };
}

function promisifyDelay(delay, val, rejectIt) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (rejectIt) reject(val instanceof Error ? val : new Error(val));
      else resolve(val);
    }, delay);
  });
}