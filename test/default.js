'use strict';

const { expect, Lab, PLAN, TEST_TKO, LOGGER, Engine, getFiles, baseTest, JsonEngine, httpsServer, JsFrmt } = require('./_main.js');
const lab = exports.lab = Lab.script();
// ESM uncomment the following lines...
// TODO : import { expect, Lab, PLAN, TEST_TKO, LOGGER, Engine, getFiles, baseTest, JsonEngine, httpsServer, JsFrmt } from './_main.mjs';
const plan = `${PLAN} Default`;

// "node_modules/.bin/lab" test/default.js -vi 1

lab.experiment(plan, () => {

  lab.test(`${plan}: HTML - Manual Partial Registration)`, { timeout: TEST_TKO }, async flags => {
    const opts = baseOptions();
    const engine = new Engine(opts, JsFrmt);
    const prtls = await getFiles('test/views/partials');
    for (let prtl of prtls) {
      await engine.registerPartial(prtl.name, prtl.content);
    }
    return baseTest(opts, true, engine);
  });

  lab.test(`${plan}: HTML - Options Fill`, { timeout: TEST_TKO }, async flags => {
    const opts = {
      useCommonJs: true,
      defaultExtension: 'html',
      isCached: true,
      formatOptions: {},
      encoding: 'utf8',
      partials: await getFiles('test/views/partials'),
      evaluate: /\{\{([\s\S]+?(\}?)+)\}\}/g,
      interpolate: /\{\{=([\s\S]+?)\}\}/g,
      encode: /\{\{!([\s\S]+?)\}\}/g,
      conditional: /\{\{\?(\?)?\s*([\s\S]*?)\s*\}\}/g,
      iterate: /\{\{~\s*(?:\}\}|([\s\S]+?)\s*\:\s*([\w$]+)\s*(?:\:\s*([\w$]+))?\s*\}\})/g,
      iterateIn: /\{\{\*\s*(?:\}\}|([\s\S]+?)\s*\:\s*([\w$]+)\s*(?:\:\s*([\w$]+))?\s*\}\})/g,
      include: /\{\{#\s*([\s\S]+?)\}\}/g,
      filename: /^(.*[\\\/]|^)([^\.]*)(.*)$/,
      varname: 'it',
      strip:  false,
      append: false,
      doNotSkipEncoded: true,
      errorLine: true,
      logger: LOGGER
    };
    return baseTest(opts, true, new Engine(opts, JsFrmt));
  });

  lab.test(`${plan}: HTML - w/options.partials`, { timeout: TEST_TKO }, async flags => {
    const opts = baseOptions();
    opts.partials = await getFiles('test/views/partials');
    return baseTest(opts, true, new Engine(opts, JsFrmt));
  });

  lab.test(`${plan}: HTML - Partials Fetch From HTTPS Server`, { timeout: TEST_TKO }, async flags => {
    const basePath = 'test/views/partials', svr = await httpsServer(basePath);
    const opts = baseOptions();
    opts.partials = await getFiles(basePath, false); // false since content should be loaded from the server
    const sopts = { read: { url: svr.url }, write: { url: svr.url }, rejectUnauthorized: false };
    await baseTest(opts, true, new Engine(opts, JsFrmt, sopts));
    await svr.close();
  });
});

function baseOptions() {
  return {
    logger: LOGGER
  };
}