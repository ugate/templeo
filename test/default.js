'use strict';

const { expect, Lab, PLAN, TEST_TKO, LOGGER, Engine, getFiles, baseTest, JsonEngine, httpsServer, JsFrmt, getTemplateFiles } = require('./_main.js');
const lab = exports.lab = Lab.script();
// ESM uncomment the following lines...
// TODO : import { expect, Lab, PLAN, TEST_TKO, LOGGER, Engine, getFiles, baseTest, JsonEngine, httpsServer, JsFrmt } from './_main.mjs';
const plan = `${PLAN} Default`;

// "node_modules/.bin/lab" test/default.js -vi 1

lab.experiment(plan, () => {

  lab.test(`${plan}: HTML - registerPartials`, { timeout: TEST_TKO }, async flags => {
    const opts = baseOptions();
    const engine = new Engine(opts.compile, JsFrmt, null, LOGGER);
    const partials = await getFiles('test/views/partials');
    engine.registerPartials(partials);
    return baseTest(opts.compile, true, engine, opts.render);
  });

  lab.test(`${plan}: HTML - Partials Fetch From HTTPS Server`, { timeout: TEST_TKO }, async flags => {
    const basePath = 'test/views/partials', svr = await httpsServer(basePath);
    const opts = baseOptions();
    const sopts = { read: { url: svr.url }, write: { url: svr.url }, rejectUnauthorized: false };
    const engine = new Engine(opts.compile, JsFrmt, sopts, LOGGER);
    //const partials = await getFiles(basePath, false); // false since content should be loaded from the server
    //engine.registerPartials(partials);
    await baseTest(opts.compile, true, engine, opts.render);
    await svr.close();
  });
});

function baseOptions() {
  return {
    compile: {},
    render: {}
  };
}