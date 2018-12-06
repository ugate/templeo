'use strict';

const { expect, Lab, PLAN, TEST_TKO, ENGINE_LOGGER, Engine, getFiles, baseTest, JsonEngine, JsFrmt } = require('./_main.js');
const lab = exports.lab = Lab.script();
// ESM uncomment the following lines...
//import { expect, Lab, PLAN, TEST_TKO, ENGINE_LOGGER, Engine, getFiles, baseTest, JsonEngine, JsFrmt } from './_main.mjs';
const plan = `${PLAN} Default`;

// "node_modules/.bin/lab" test/default.js -vi 1

lab.experiment(plan, () => {

  lab.test(`${plan}: HTML (cache w/options.partials)`, { timeout: TEST_TKO }, async flags => {
    const opts = baseOptions();
    opts.partials = await getFiles('test/views/partials', true);
    return baseTest(opts, true, new Engine(opts, JsFrmt));
  });
});

function baseOptions() {
  return {
    logger: ENGINE_LOGGER
  };
}