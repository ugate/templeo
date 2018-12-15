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